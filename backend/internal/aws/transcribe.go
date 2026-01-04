package aws

import (
	"context"
	"log"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/transcribestreaming"
	"github.com/aws/aws-sdk-go-v2/service/transcribestreaming/types"
)

// TranscribeClient wraps Amazon Transcribe Streaming
type TranscribeClient struct {
	client     *transcribestreaming.Client
	sampleRate int32
}

// TranscribeStream represents an active transcription stream for a speaker
type TranscribeStream struct {
	speakerID  string
	sourceLang string

	eventStream *transcribestreaming.StartStreamTranscriptionEventStream
	ctx         context.Context
	cancel      context.CancelFunc

	// Output channel
	TranscriptChan chan *TranscriptResult

	// Audio input channel
	audioIn chan []byte

	mu       sync.Mutex
	isClosed bool
}

// TranscriptResult represents a transcription result
type TranscriptResult struct {
	SpeakerID   string
	Text        string
	Language    string
	IsPartial   bool
	IsFinal     bool
	Confidence  float32
	TimestampMs uint64
}

// Transcribe 언어 코드 매핑
var transcribeLanguageCodes = map[string]types.LanguageCode{
	"ko": types.LanguageCodeKoKr,
	"en": types.LanguageCodeEnUs,
	"ja": types.LanguageCodeJaJp,
	"zh": types.LanguageCodeZhCn,
}

// NewTranscribeClient creates a new Transcribe Streaming client
func NewTranscribeClient(cfg aws.Config, sampleRate int32) *TranscribeClient {
	return &TranscribeClient{
		client:     transcribestreaming.NewFromConfig(cfg),
		sampleRate: sampleRate,
	}
}

// StartStream initiates a new transcription stream for a speaker
func (c *TranscribeClient) StartStream(ctx context.Context, speakerID, sourceLang string) (*TranscribeStream, error) {
	langCode, ok := transcribeLanguageCodes[sourceLang]
	if !ok {
		langCode = types.LanguageCodeEnUs
		log.Printf("[Transcribe] Unknown language '%s', defaulting to en-US", sourceLang)
	}

	log.Printf("[Transcribe] Starting stream for speaker %s with langCode=%v, sampleRate=%d",
		speakerID, langCode, c.sampleRate)

	streamCtx, cancel := context.WithCancel(ctx)

	ts := &TranscribeStream{
		speakerID:      speakerID,
		sourceLang:     sourceLang,
		ctx:            streamCtx,
		cancel:         cancel,
		TranscriptChan: make(chan *TranscriptResult, 50),
		audioIn:        make(chan []byte, 100),
		isClosed:       false,
	}

	// Start the transcription stream
	resp, err := c.client.StartStreamTranscription(streamCtx, &transcribestreaming.StartStreamTranscriptionInput{
		LanguageCode:         langCode,
		MediaEncoding:        types.MediaEncodingPcm,
		MediaSampleRateHertz: aws.Int32(c.sampleRate),
	})
	if err != nil {
		log.Printf("[Transcribe] ERROR StartStreamTranscription failed: %v", err)
		cancel()
		return nil, err
	}

	log.Printf("[Transcribe] StartStreamTranscription success, SessionId=%v", resp.SessionId)

	ts.eventStream = resp.GetStream()

	// Start goroutines for sending audio and receiving transcripts
	// Note: Error checking is done in receiveLoop after event channel closes
	go ts.sendAudioLoop()
	go ts.receiveLoop()

	log.Printf("[Transcribe] Started stream for speaker %s (lang: %s)", speakerID, sourceLang)

	return ts, nil
}

// MaxAudioChunkSize is the recommended audio chunk size for AWS Transcribe
// AWS recommends 50-200ms chunks. For 16kHz mono PCM:
// 100ms = 100/1000 * 16000 * 2 = 3,200 bytes
// 200ms = 200/1000 * 16000 * 2 = 6,400 bytes
// Using 100ms (3,200 bytes) for optimal latency
const MaxAudioChunkSize = 3200

// SendAudio sends audio data to the transcription stream
// Large audio chunks are automatically split into 100ms chunks (~3.2KB for 16kHz mono)
func (ts *TranscribeStream) SendAudio(audioData []byte) error {
	ts.mu.Lock()
	if ts.isClosed {
		ts.mu.Unlock()
		return nil
	}
	ts.mu.Unlock()

	// Split large audio into chunks of MaxAudioChunkSize
	for offset := 0; offset < len(audioData); offset += MaxAudioChunkSize {
		end := offset + MaxAudioChunkSize
		if end > len(audioData) {
			end = len(audioData)
		}
		chunk := audioData[offset:end]

		select {
		case ts.audioIn <- chunk:
			// Successfully queued
		case <-ts.ctx.Done():
			return ts.ctx.Err()
		default:
			log.Printf("[Transcribe] Audio buffer full for speaker %s", ts.speakerID)
			return nil
		}
	}
	return nil
}

// sendAudioLoop sends audio chunks to Transcribe
func (ts *TranscribeStream) sendAudioLoop() {
	defer func() {
		log.Printf("[Transcribe] sendAudioLoop ended for speaker %s", ts.speakerID)
		// Mark stream as closed
		ts.mu.Lock()
		ts.isClosed = true
		ts.mu.Unlock()
		if ts.eventStream != nil {
			ts.eventStream.Close()
		}
	}()

	audioChunkCount := 0
	totalBytesSent := 0
	for {
		select {
		case <-ts.ctx.Done():
			log.Printf("[Transcribe] Context done for speaker %s, sent %d chunks (%d bytes total)", ts.speakerID, audioChunkCount, totalBytesSent)
			return
		case audioData, ok := <-ts.audioIn:
			if !ok {
				log.Printf("[Transcribe] audioIn channel closed for speaker %s, sent %d chunks (%d bytes total)", ts.speakerID, audioChunkCount, totalBytesSent)
				return
			}

			audioChunkCount++
			totalBytesSent += len(audioData)

			// Log first 10 chunks, then every 50th chunk
			if audioChunkCount <= 10 || audioChunkCount%50 == 0 {
				log.Printf("[Transcribe] 📤 Sending audio chunk #%d to AWS for speaker %s (%d bytes, total: %d bytes)",
					audioChunkCount, ts.speakerID, len(audioData), totalBytesSent)
			}

			err := ts.eventStream.Send(ts.ctx, &types.AudioStreamMemberAudioEvent{
				Value: types.AudioEvent{
					AudioChunk: audioData,
				},
			})
			if err != nil {
				log.Printf("[Transcribe] ❌ ERROR sending audio chunk #%d for speaker %s: %v", audioChunkCount, ts.speakerID, err)
				return
			}
		}
	}
}

// receiveLoop receives transcript results from Transcribe
func (ts *TranscribeStream) receiveLoop() {
	defer func() {
		log.Printf("[Transcribe] receiveLoop ended for speaker %s", ts.speakerID)
		// Mark stream as closed
		ts.mu.Lock()
		ts.isClosed = true
		ts.mu.Unlock()
		close(ts.TranscriptChan)
	}()

	log.Printf("[Transcribe] receiveLoop started for speaker %s", ts.speakerID)

	// Events() returns a channel of transcript events
	// Note: Don't check Err() before receiving - it should be checked AFTER the loop
	events := ts.eventStream.Events()

	eventCount := 0
	for event := range events {
		// Check context cancellation
		select {
		case <-ts.ctx.Done():
			log.Printf("[Transcribe] Context done in receiveLoop for speaker %s after %d events", ts.speakerID, eventCount)
			return
		default:
		}

		eventCount++
		switch e := event.(type) {
		case *types.TranscriptResultStreamMemberTranscriptEvent:
			log.Printf("[Transcribe] ✅ Received transcript event #%d for speaker %s", eventCount, ts.speakerID)
			ts.handleTranscriptEvent(e.Value)
		default:
			log.Printf("[Transcribe] Received unknown event type #%d for speaker %s: %T", eventCount, ts.speakerID, event)
		}
	}

	// Check for errors AFTER the event loop completes (per AWS SDK pattern)
	if err := ts.eventStream.Err(); err != nil {
		log.Printf("[Transcribe] ❌ Stream error for speaker %s: %v", ts.speakerID, err)
	} else {
		log.Printf("[Transcribe] Events channel closed for speaker %s after %d events (clean close)", ts.speakerID, eventCount)
	}
}

// handleTranscriptEvent processes a transcript event
func (ts *TranscribeStream) handleTranscriptEvent(event types.TranscriptEvent) {
	if event.Transcript == nil || len(event.Transcript.Results) == 0 {
		return
	}

	for _, result := range event.Transcript.Results {
		if len(result.Alternatives) == 0 {
			continue
		}

		alt := result.Alternatives[0]
		transcript := aws.ToString(alt.Transcript)

		if transcript == "" {
			continue
		}

		isPartial := result.IsPartial

		// Calculate confidence (average of item confidences)
		var confidence float32 = 1.0
		if len(alt.Items) > 0 && alt.Items[0].Confidence != nil {
			confidence = float32(*alt.Items[0].Confidence)
		}

		select {
		case ts.TranscriptChan <- &TranscriptResult{
			SpeakerID:   ts.speakerID,
			Text:        transcript,
			Language:    ts.sourceLang,
			IsPartial:   isPartial,
			IsFinal:     !isPartial,
			Confidence:  confidence,
			TimestampMs: uint64(time.Now().UnixMilli()),
		}:
		default:
			log.Printf("[Transcribe] Transcript channel full for speaker %s", ts.speakerID)
		}
	}
}

// IsClosed returns whether the stream has been closed
func (ts *TranscribeStream) IsClosed() bool {
	ts.mu.Lock()
	defer ts.mu.Unlock()
	return ts.isClosed
}

// Close terminates the transcription stream
func (ts *TranscribeStream) Close() error {
	ts.mu.Lock()
	if ts.isClosed {
		ts.mu.Unlock()
		return nil
	}
	ts.isClosed = true
	ts.mu.Unlock()

	ts.cancel()
	close(ts.audioIn)

	log.Printf("[Transcribe] Closed stream for speaker %s", ts.speakerID)
	return nil
}
