"""
gRPC Conversation Service
양방향 스트리밍 오디오 처리 및 번역 서비스
"""

import uuid
import time
import threading
from typing import Dict, Optional

import numpy as np

from config.settings import Config
from utils.logger import DebugLogger
from models.session import Participant, Speaker, SessionState
from language.topology import BufferingStrategy

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from generated import conversation_pb2
from generated import conversation_pb2_grpc


class ConversationServicer(conversation_pb2_grpc.ConversationServiceServicer):
    """gRPC 서비스 구현 (v10 - 상세 디버깅 포함)"""

    def __init__(self, model_manager):
        self.models = model_manager
        self.sessions: Dict[str, SessionState] = {}
        self.lock = threading.Lock()

    def StreamChat(self, request_iterator, context):
        """양방향 스트리밍 RPC 처리"""
        session_state: Optional[SessionState] = None
        current_session_id = None

        DebugLogger.log("STREAM", "New gRPC stream connected")

        try:
            for request in request_iterator:
                current_session_id = request.session_id
                room_id = request.room_id
                participant_id = request.participant_id
                payload_type = request.WhichOneof('payload')

                # 세션 초기화 또는 스피커 업데이트
                if payload_type == 'session_init':
                    init = request.session_init

                    speaker = Speaker(
                        participant_id=init.speaker.participant_id,
                        nickname=init.speaker.nickname,
                        profile_img=init.speaker.profile_img,
                        source_language=init.speaker.source_language,
                    )

                    # 기존 세션이 있는지 확인
                    with self.lock:
                        existing_session = self.sessions.get(current_session_id)

                    if existing_session:
                        # 기존 세션이 있으면 스피커 정보만 업데이트 (버퍼와 상태 유지)
                        existing_session.speaker = speaker
                        existing_session.determine_primary_strategy()
                        session_state = existing_session

                        DebugLogger.log("SPEAKER_UPDATE", f"Speaker updated", {
                            "session": current_session_id[:8],
                            "speaker": speaker.nickname,
                            "source_lang": speaker.source_language,
                        })
                    else:
                        # 새 세션 생성
                        participants = {}
                        for p in init.participants:
                            participants[p.participant_id] = Participant(
                                participant_id=p.participant_id,
                                nickname=p.nickname,
                                profile_img=p.profile_img,
                                target_language=p.target_language,
                                translation_enabled=p.translation_enabled
                            )

                        session_state = SessionState(
                            session_id=current_session_id,
                            room_id=room_id,
                            speaker=speaker,
                            participants=participants
                        )

                        session_state.determine_primary_strategy()

                        with self.lock:
                            self.sessions[current_session_id] = session_state

                        target_langs = session_state.get_target_languages()

                        DebugLogger.log("SESSION_INIT", f"Session initialized", {
                            "session": current_session_id[:8],
                            "speaker": speaker.nickname,
                            "source_lang": speaker.source_language,
                            "target_langs": list(target_langs),
                            "strategy": session_state.primary_strategy.value,
                            "participant_count": len(participants)
                        })

                        # 새 세션일 때만 READY 상태 응답
                        yield conversation_pb2.ChatResponse(
                            session_id=current_session_id,
                            room_id=room_id,
                            status=conversation_pb2.SessionStatus(
                                status=conversation_pb2.SessionStatus.READY,
                                message="Session initialized (v10)",
                                buffering_strategy=conversation_pb2.BufferingStrategy(
                                    source_language=speaker.source_language,
                                    primary_target_language=list(target_langs)[0] if target_langs else "",
                                    strategy=conversation_pb2.BufferingStrategy.CHUNK_BASED
                                        if session_state.primary_strategy == BufferingStrategy.CHUNK_BASED
                                        else conversation_pb2.BufferingStrategy.SENTENCE_BASED,
                                    buffer_size_ms=0
                                )
                            )
                        )

                # 오디오 청크 처리
                elif payload_type == 'audio_chunk' and session_state:
                    audio_chunk = request.audio_chunk
                    chunk_bytes = len(audio_chunk)
                    audio_duration = chunk_bytes / Config.BYTES_PER_SECOND

                    DebugLogger.audio_received(current_session_id, chunk_bytes, audio_duration)

                    # VAD 처리
                    vad = session_state.vad
                    has_speech, is_sentence_end = vad.process_chunk(audio_chunk)
                    buffer_duration = len(session_state.audio_buffer) / Config.BYTES_PER_SECOND

                    DebugLogger.vad_result(has_speech, is_sentence_end, buffer_duration)

                    min_speech_bytes = int(Config.BYTES_PER_SECOND * 0.5)
                    max_buffer_bytes = Config.SENTENCE_MAX_BYTES

                    if has_speech:
                        speech_audio = vad.filter_speech(audio_chunk)
                        if speech_audio:
                            session_state.audio_buffer.extend(speech_audio)

                    should_process = False
                    process_reason = ""

                    if is_sentence_end and len(session_state.audio_buffer) >= min_speech_bytes:
                        should_process = True
                        process_reason = "sentence_end"
                    elif len(session_state.audio_buffer) >= max_buffer_bytes:
                        should_process = True
                        process_reason = "buffer_full"

                    if should_process:
                        process_bytes = bytes(session_state.audio_buffer)
                        session_state.audio_buffer.clear()
                        if process_reason == "buffer_full":
                            vad.reset()

                        DebugLogger.log("PROCESS", f"Processing audio buffer", {
                            "reason": process_reason,
                            "bytes": len(process_bytes),
                            "duration_sec": f"{len(process_bytes) / Config.BYTES_PER_SECOND:.2f}"
                        })

                        try:
                            pipeline_start = time.time()

                            for response in self._process_audio(session_state, process_bytes, True):
                                yield response

                            pipeline_latency = (time.time() - pipeline_start) * 1000
                            DebugLogger.log("PIPELINE_DONE", f"Pipeline complete", {
                                "total_latency_ms": f"{pipeline_latency:.0f}"
                            })

                        except Exception as proc_err:
                            DebugLogger.log("PROCESS_ERROR", f"Audio processing failed: {proc_err}")

                # 세션 종료
                elif payload_type == 'session_end':
                    if session_state:
                        session_state.vad.reset()

                        min_speech_bytes = int(Config.BYTES_PER_SECOND * 0.3)
                        if len(session_state.audio_buffer) >= min_speech_bytes:
                            process_bytes = bytes(session_state.audio_buffer)
                            session_state.audio_buffer.clear()

                            try:
                                for response in self._process_audio(session_state, process_bytes, True):
                                    yield response
                            except Exception as proc_err:
                                DebugLogger.log("END_PROCESS_ERROR", f"Final processing failed: {proc_err}")
                        else:
                            session_state.audio_buffer.clear()

                    if current_session_id:
                        with self.lock:
                            self.sessions.pop(current_session_id, None)

                    DebugLogger.log("SESSION_END", "Session ended", {
                        "session": current_session_id[:8] if current_session_id else "unknown",
                        "chunks_processed": session_state.chunks_processed if session_state else 0,
                        "sentences": session_state.sentences_completed if session_state else 0,
                    })

                    break

        except Exception as e:
            DebugLogger.log("STREAM_ERROR", f"Stream error: {e}")
            yield conversation_pb2.ChatResponse(
                session_id=current_session_id or "",
                error=conversation_pb2.ErrorResponse(
                    code="STREAM_ERROR",
                    message=str(e)
                )
            )

        finally:
            if current_session_id:
                with self.lock:
                    self.sessions.pop(current_session_id, None)
            DebugLogger.log("STREAM", "Stream closed")

    def _process_audio(self, state: SessionState, audio_bytes: bytes, is_final: bool):
        """오디오 처리 파이프라인 (상세 디버깅 포함)"""

        pipeline_start = time.time()
        audio_duration = len(audio_bytes) / Config.BYTES_PER_SECOND

        DebugLogger.log("PIPELINE_START", f"Starting audio pipeline", {
            "bytes": len(audio_bytes),
            "duration_sec": f"{audio_duration:.2f}",
            "is_final": is_final
        })

        state.chunks_processed += 1
        if is_final:
            state.sentences_completed += 1

        # ===== STEP 1: STT (with Room Cache) =====
        stt_start = time.time()
        source_lang = state.speaker.source_language

        def do_transcribe(audio_data):
            audio_arr = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32) / 32768.0
            return self.models.transcribe(audio_arr, source_lang)

        original_text, confidence, stt_cached = self.models.room_cache.get_or_create_stt(
            room_id=state.room_id,
            speaker_id=state.speaker.participant_id,
            audio_bytes=audio_bytes,
            transcribe_fn=do_transcribe
        )

        stt_latency = (time.time() - stt_start) * 1000
        state.total_stt_latency_ms += stt_latency

        if stt_cached:
            DebugLogger.log("CACHE_STT", f"Using cached STT result", {"text_preview": original_text[:30] if original_text else ""})

        if not original_text:
            DebugLogger.log("PIPELINE_SKIP", "No text from STT, skipping rest of pipeline")
            return

        # Filler word check
        is_filler = original_text.lower().strip() in Config.FILLER_WORDS or \
                    original_text.strip() in Config.FILLER_WORDS
        if is_filler:
            DebugLogger.log("FILLER", f"Detected filler word, skipping translation/TTS")
            transcript_id = str(uuid.uuid4())[:8]
            yield conversation_pb2.ChatResponse(
                session_id=state.session_id,
                room_id=state.room_id,
                transcript=conversation_pb2.TranscriptResult(
                    id=transcript_id,
                    speaker=conversation_pb2.SpeakerInfo(
                        participant_id=state.speaker.participant_id,
                        nickname=state.speaker.nickname,
                        profile_img=state.speaker.profile_img,
                        source_language=source_lang
                    ),
                    original_text=original_text,
                    original_language=source_lang,
                    translations=[],
                    is_partial=False,
                    is_final=True,
                    timestamp_ms=int(time.time() * 1000),
                    confidence=confidence
                )
            )
            return

        transcript_id = str(uuid.uuid4())[:8]

        # ===== STEP 2: Translation =====
        target_languages = state.get_target_languages()
        translations = []

        if len(original_text.strip()) <= 1:
            DebugLogger.log("TRANS_SKIP", "Text too short, skipping translation")
            yield conversation_pb2.ChatResponse(
                session_id=state.session_id,
                room_id=state.room_id,
                transcript=conversation_pb2.TranscriptResult(
                    id=transcript_id,
                    speaker=conversation_pb2.SpeakerInfo(
                        participant_id=state.speaker.participant_id,
                        nickname=state.speaker.nickname,
                        profile_img=state.speaker.profile_img,
                        source_language=source_lang
                    ),
                    original_text=original_text,
                    original_language=source_lang,
                    translations=[],
                    is_partial=False,
                    is_final=True,
                    timestamp_ms=int(time.time() * 1000),
                    confidence=confidence
                )
            )
            return

        trans_start = time.time()
        for target_lang in target_languages:
            def do_translate(text, src, tgt):
                return self.models.translate(text, src, tgt)

            translated_text, trans_cached = self.models.room_cache.get_or_create_translation(
                room_id=state.room_id,
                text=original_text,
                source_lang=source_lang,
                target_lang=target_lang,
                translate_fn=do_translate
            )

            if trans_cached:
                DebugLogger.log("CACHE_TRANS", f"Using cached translation", {"target": target_lang})

            if translated_text:
                target_participants = state.get_participants_by_target_language(target_lang)
                translations.append(
                    conversation_pb2.TranslationEntry(
                        target_language=target_lang,
                        translated_text=translated_text,
                        target_participant_ids=target_participants
                    )
                )
        trans_latency = (time.time() - trans_start) * 1000
        state.total_translation_latency_ms += trans_latency

        # Send Transcript
        DebugLogger.log("TRANSCRIPT_SEND", f"Sending transcript", {
            "text_len": len(original_text),
            "translations": len(translations)
        })

        yield conversation_pb2.ChatResponse(
            session_id=state.session_id,
            room_id=state.room_id,
            transcript=conversation_pb2.TranscriptResult(
                id=transcript_id,
                speaker=conversation_pb2.SpeakerInfo(
                    participant_id=state.speaker.participant_id,
                    nickname=state.speaker.nickname,
                    profile_img=state.speaker.profile_img,
                    source_language=source_lang
                ),
                original_text=original_text,
                original_language=source_lang,
                translations=translations,
                is_partial=not is_final,
                is_final=is_final,
                timestamp_ms=int(time.time() * 1000),
                confidence=confidence
            )
        )

        # ===== STEP 3: TTS (with Room Cache) =====
        tts_start = time.time()
        for translation in translations:
            target_lang = translation.target_language
            translated_text = translation.translated_text

            if len(translated_text.strip()) < Config.MIN_TTS_TEXT_LENGTH:
                continue

            if translated_text.lower().strip() in Config.FILLER_WORDS or \
               translated_text.strip() in Config.FILLER_WORDS:
                continue

            def do_synthesize(text, lang):
                return self.models.synthesize_speech(text, lang)

            audio_data, duration_ms, tts_cached = self.models.room_cache.get_or_create_tts(
                room_id=state.room_id,
                text=translated_text,
                target_lang=target_lang,
                synthesize_fn=do_synthesize
            )

            if tts_cached:
                DebugLogger.log("CACHE_TTS", f"Using cached TTS", {"target": target_lang, "audio_bytes": len(audio_data) if audio_data else 0})

            if audio_data:
                DebugLogger.log("TTS_SEND", f"Sending TTS audio", {
                    "target_lang": target_lang,
                    "audio_bytes": len(audio_data),
                    "duration_ms": duration_ms,
                    "cached": tts_cached
                })

                yield conversation_pb2.ChatResponse(
                    session_id=state.session_id,
                    room_id=state.room_id,
                    audio=conversation_pb2.AudioResult(
                        transcript_id=transcript_id,
                        target_language=target_lang,
                        target_participant_ids=list(translation.target_participant_ids),
                        audio_data=audio_data,
                        format="mp3",
                        sample_rate=24000,
                        duration_ms=duration_ms,
                        speaker_participant_id=state.speaker.participant_id
                    )
                )

        tts_latency = (time.time() - tts_start) * 1000
        state.total_tts_latency_ms += tts_latency

        # Pipeline summary
        total_latency = (time.time() - pipeline_start) * 1000
        DebugLogger.pipeline_complete(total_latency, {
            "stt_ms": f"{stt_latency:.0f}",
            "trans_ms": f"{trans_latency:.0f}",
            "tts_ms": f"{tts_latency:.0f}",
        })

    def UpdateParticipantSettings(self, request, context):
        """참가자 설정 업데이트"""
        room_id = request.room_id
        participant_id = request.participant_id

        updated = False
        with self.lock:
            for session in self.sessions.values():
                if session.room_id == room_id and participant_id in session.participants:
                    p = session.participants[participant_id]
                    p.target_language = request.target_language
                    p.translation_enabled = request.translation_enabled
                    session.determine_primary_strategy()
                    updated = True

        return conversation_pb2.ParticipantSettingsResponse(
            success=updated,
            message="Settings updated" if updated else "Participant not found"
        )
