// AudioWorklet Processor for capturing audio samples with debugging
class AudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.bufferSize = 4096;
        this.buffer = new Float32Array(this.bufferSize);
        this.bufferIndex = 0;
        this.frameCount = 0;
        this.lastDebugTime = 0;
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];

        // 입력 없음 체크
        if (!input || !input[0]) {
            this.frameCount++;
            // 10초마다 경고
            if (currentTime - this.lastDebugTime > 10) {
                this.port.postMessage({
                    debug: true,
                    message: `No audio input for ${this.frameCount} frames`,
                    hasInput: false,
                });
                this.lastDebugTime = currentTime;
            }
            return true;
        }

        const channelData = input[0];

        // 오디오 레벨 계산 (주기적 디버깅용)
        this.frameCount++;
        if (currentTime - this.lastDebugTime > 3) {  // 3초마다 디버깅
            let sum = 0;
            let max = 0;
            for (let i = 0; i < channelData.length; i++) {
                sum += channelData[i] * channelData[i];
                const abs = Math.abs(channelData[i]);
                if (abs > max) max = abs;
            }
            const rms = Math.sqrt(sum / channelData.length);

            this.port.postMessage({
                debug: true,
                message: `Audio level: RMS=${rms.toFixed(6)}, Max=${max.toFixed(6)}, samples=${channelData.length}`,
                rms: rms,
                max: max,
                hasInput: true,
            });
            this.lastDebugTime = currentTime;
        }

        for (let i = 0; i < channelData.length; i++) {
            this.buffer[this.bufferIndex++] = channelData[i];

            // 버퍼가 가득 차면 메인 스레드로 전송
            if (this.bufferIndex >= this.bufferSize) {
                // 버퍼의 RMS 계산
                let sum = 0;
                for (let j = 0; j < this.bufferSize; j++) {
                    sum += this.buffer[j] * this.buffer[j];
                }
                const bufferRms = Math.sqrt(sum / this.bufferSize);

                this.port.postMessage({
                    audioData: this.buffer.slice(),
                    rms: bufferRms,
                });
                this.bufferIndex = 0;
            }
        }

        return true;
    }
}

registerProcessor('audio-processor', AudioProcessor);
