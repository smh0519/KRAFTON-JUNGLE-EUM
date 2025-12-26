"""
Python gRPC STT Server with faster-whisper
Go ↔ Python 실시간 음성 인식 서버
"""

import sys
import os
import time
from concurrent import futures
from datetime import datetime

import grpc
import numpy as np
from faster_whisper import WhisperModel

# generated 모듈 import 경로 추가
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from generated import conversation_pb2
from generated import conversation_pb2_grpc


# ========================================
# Whisper 모델 초기화 (서버 시작 시 1회)
# ========================================
print("🔄 Loading Whisper model (tiny, CPU, int8)...")
model = WhisperModel(
    "tiny",
    device="cpu",
    compute_type="int8"
)
print("✅ Whisper model loaded successfully!")


class ConversationServicer(conversation_pb2_grpc.ConversationServiceServicer):
    """STT Conversation Service - faster-whisper (Low Latency)"""

    def StreamChat(self, request_iterator, context):
        """
        양방향 스트리밍 RPC 핸들러
        - SessionInit 수신: 세션 시작, 오디오 설정 저장
        - AudioChunk 수신: 버퍼에 누적 → 0.5초 이상 시 STT 수행
        - 인식 결과를 TranscriptPartial/TranscriptFinal로 반환
        """
        session_id = None
        audio_config = None
        chunk_count = 0
        total_bytes = 0
        stt_count = 0

        # 오디오 버퍼 (PCM bytes 누적)
        audio_buffer = bytearray()

        # ========================================
        # STT 설정 (Latency 최적화)
        # ========================================
        MIN_AUDIO_SECONDS = 0.5  # 0.5초 이상 누적 시 STT (기존 1.0초)

        print(f"\n{'='*60}")
        print(f"🔗 New gRPC stream connected at {datetime.now().strftime('%H:%M:%S')}")
        print(f"{'='*60}")

        try:
            for request in request_iterator:
                session_id = request.session_id
                payload_type = request.WhichOneof('payload')

                # ========================================
                # 1. SessionInit 처리
                # ========================================
                if payload_type == 'session_init':
                    init = request.session_init
                    audio_config = {
                        'sample_rate': init.sample_rate,
                        'channels': init.channels,
                        'bits_per_sample': init.bits_per_sample,
                        'language': init.language,
                    }
                    print(f"\n✅ 세션 시작: [{session_id[:8]}...]")
                    print(f"   📋 SampleRate: {init.sample_rate}Hz")
                    print(f"   📋 Channels: {init.channels}")
                    print(f"   📋 BitsPerSample: {init.bits_per_sample}")
                    print(f"   📋 Language: {init.language}")

                    # TranscriptPartial로 세션 시작 알림
                    yield conversation_pb2.ChatResponse(
                        session_id=session_id,
                        transcript_partial=conversation_pb2.TranscriptPartial(
                            text="[LISTENING] Session started",
                            confidence=1.0
                        )
                    )

                # ========================================
                # 2. AudioChunk 처리 → STT
                # ========================================
                elif payload_type == 'audio_chunk':
                    audio_bytes = request.audio_chunk
                    chunk_count += 1
                    total_bytes += len(audio_bytes)

                    # 버퍼에 오디오 누적
                    audio_buffer.extend(audio_bytes)

                    # 오디오 길이 계산 (bytes → seconds)
                    if audio_config:
                        bytes_per_sample = audio_config['bits_per_sample'] // 8
                        samples_per_second = audio_config['sample_rate'] * audio_config['channels']
                        bytes_per_second = samples_per_second * bytes_per_sample
                        buffer_seconds = len(audio_buffer) / bytes_per_second
                    else:
                        # 기본값: 16kHz, mono, 16bit
                        bytes_per_second = 16000 * 1 * 2
                        buffer_seconds = len(audio_buffer) / bytes_per_second

                    # 로그 출력 (주기적으로)
                    if chunk_count % 20 == 1 or chunk_count <= 3:
                        print(f"🎤 [{session_id[:8]}] Chunk #{chunk_count}: "
                              f"{len(audio_bytes):,} bytes, "
                              f"Buffer: {len(audio_buffer):,} bytes "
                              f"({buffer_seconds:.2f}s)")

                    # ========================================
                    # 최소 시간 이상 누적되면 STT 수행
                    # ========================================
                    if buffer_seconds >= MIN_AUDIO_SECONDS:
                        stt_count += 1
                        start_time = time.time()
                        print(f"🔊 [{session_id[:8]}] STT #{stt_count}: {buffer_seconds:.2f}s audio...")

                        try:
                            # PCM Int16 → Float32 [-1.0, 1.0] 변환
                            audio_array = np.frombuffer(bytes(audio_buffer), dtype=np.int16)
                            audio_float = audio_array.astype(np.float32) / 32768.0

                            # faster-whisper 음성 인식 (Low Latency 설정)
                            language = audio_config.get('language', 'ko') if audio_config else 'ko'

                            segments, info = model.transcribe(
                                audio_float,
                                language=language,
                                beam_size=1,  # Greedy Search (속도 우선)
                                vad_filter=True,
                                vad_parameters={
                                    "min_silence_duration_ms": 300,  # 짧은 침묵 허용
                                    "speech_pad_ms": 100,
                                }
                            )

                            # 세그먼트 텍스트 결합
                            transcription = ""
                            for segment in segments:
                                transcription += segment.text.strip() + " "
                            transcription = transcription.strip()

                            elapsed = time.time() - start_time

                            if transcription:
                                print(f"📝 [{session_id[:8]}] STT Result ({elapsed:.2f}s): \"{transcription}\"")

                                # TranscriptFinal 전송 (text 필드만!)
                                yield conversation_pb2.ChatResponse(
                                    session_id=session_id,
                                    transcript_final=conversation_pb2.TranscriptFinal(
                                        text=transcription
                                    )
                                )
                            else:
                                print(f"🔇 [{session_id[:8]}] No speech detected ({elapsed:.2f}s)")

                        except Exception as e:
                            print(f"⚠️ [{session_id[:8]}] STT Error: {e}")
                            yield conversation_pb2.ChatResponse(
                                session_id=session_id,
                                error=conversation_pb2.ErrorResponse(
                                    code="STT_ERROR",
                                    message=str(e)
                                )
                            )

                        # 버퍼 초기화
                        audio_buffer.clear()

                    # CPU 과부하 방지 (최소 휴식)
                    time.sleep(0.01)

                # ========================================
                # 3. SessionEnd 처리
                # ========================================
                elif payload_type == 'session_end':
                    reason = request.session_end.reason

                    # 남은 버퍼가 있으면 마지막 STT 수행
                    if len(audio_buffer) > 0 and audio_config:
                        bytes_per_sample = audio_config['bits_per_sample'] // 8
                        samples_per_second = audio_config['sample_rate'] * audio_config['channels']
                        bytes_per_second = samples_per_second * bytes_per_sample
                        buffer_seconds = len(audio_buffer) / bytes_per_second

                        if buffer_seconds >= 0.3:  # 0.3초 이상이면 처리
                            print(f"🔊 [{session_id[:8]}] Final STT: {buffer_seconds:.2f}s remaining...")

                            try:
                                audio_array = np.frombuffer(bytes(audio_buffer), dtype=np.int16)
                                audio_float = audio_array.astype(np.float32) / 32768.0

                                language = audio_config.get('language', 'ko')
                                segments, info = model.transcribe(
                                    audio_float,
                                    language=language,
                                    beam_size=1,
                                    vad_filter=True,
                                )

                                transcription = ""
                                for segment in segments:
                                    transcription += segment.text.strip() + " "
                                transcription = transcription.strip()

                                if transcription:
                                    print(f"📝 [{session_id[:8]}] Final: \"{transcription}\"")
                                    yield conversation_pb2.ChatResponse(
                                        session_id=session_id,
                                        transcript_final=conversation_pb2.TranscriptFinal(
                                            text=transcription
                                        )
                                    )
                            except Exception as e:
                                print(f"⚠️ Final STT Error: {e}")

                    print(f"\n🛑 세션 종료: [{session_id[:8]}...] - {reason}")
                    break

        except grpc.RpcError as e:
            print(f"❌ gRPC Error: {e}")
        except Exception as e:
            print(f"❌ Unexpected Error: {e}")
        finally:
            # 세션 통계 출력
            if session_id:
                print(f"\n{'─'*60}")
                print(f"📊 Session [{session_id[:8]}...] Summary:")
                print(f"   • Total Chunks: {chunk_count:,}")
                print(f"   • Total Bytes: {total_bytes:,} ({total_bytes/1024:.1f} KB)")
                print(f"   • STT Calls: {stt_count}")
                print(f"{'─'*60}\n")


def serve():
    """gRPC 서버 시작"""
    server = grpc.server(
        futures.ThreadPoolExecutor(max_workers=10),
        options=[
            ('grpc.max_send_message_length', 4 * 1024 * 1024),  # 4MB
            ('grpc.max_receive_message_length', 4 * 1024 * 1024),  # 4MB
        ]
    )

    conversation_pb2_grpc.add_ConversationServiceServicer_to_server(
        ConversationServicer(), server
    )

    server.add_insecure_port('0.0.0.0:50051')
    server.start()

    print("""
╔══════════════════════════════════════════════════════════════╗
║       🐍 Python STT gRPC Server (faster-whisper)             ║
╠══════════════════════════════════════════════════════════════╣
║  Address:  0.0.0.0:50051                                     ║
║  Service:  ConversationService.StreamChat                    ║
║  Model:    whisper-tiny (CPU, int8)                          ║
║  Mode:     STT Low-Latency (0.5s buffer, beam=1)             ║
╚══════════════════════════════════════════════════════════════╝
    """)
    print("⏳ Waiting for connections...\n")

    try:
        server.wait_for_termination()
    except KeyboardInterrupt:
        print("\n\n🛑 Server shutting down...")
        server.stop(grace=5)
        print("✅ Server stopped gracefully.")


if __name__ == '__main__':
    serve()
