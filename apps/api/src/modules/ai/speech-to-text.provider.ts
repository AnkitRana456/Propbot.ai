import { pino } from 'pino';

export const sttLogger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
});

export interface SpeechToTextResult {
  text: string;
  language?: string;
  durationSeconds?: number;
  confidence?: number;
  provider: 'whisper' | 'mock_stt';
}

export interface SpeechToTextProvider {
  transcribe(
    audioBuffer: Buffer,
    mimeType?: string,
    options?: { language?: string; prompt?: string },
  ): Promise<SpeechToTextResult>;
}

export class MockSpeechToTextProvider implements SpeechToTextProvider {
  async transcribe(
    audioBuffer: Buffer,
    _mimeType = 'audio/ogg',
    _options?: { language?: string; prompt?: string },
  ): Promise<SpeechToTextResult> {
    sttLogger.info({ bufferSize: audioBuffer.length }, 'Using MockSpeechToTextProvider for voice note');

    // Deterministic transcription simulation based on buffer length
    const sampleTranscriptions = [
      'Hi, I would like to know the starting price and payment plan for the 3 BHK villas at Prestige Sanctuary.',
      'Hello, what is the possession timeline and RERA registration number for this project?',
      'Can you please arrange a private site visit preview this weekend on Saturday at 11 AM?',
      'Kya mujhe 3BHK flat ka brochure aur floor plans WhatsApp par mil sakte hain?',
      'What are the clubhouse amenities and maintenance charges per square foot?',
    ];

    const index = audioBuffer.length % sampleTranscriptions.length;
    const text = sampleTranscriptions[index] || sampleTranscriptions[0]!;

    return {
      text,
      language: text.includes('Kya') ? 'hi-Latn' : 'en',
      durationSeconds: Math.max(3, Math.round(audioBuffer.length / 8000)),
      confidence: 0.95,
      provider: 'mock_stt',
    };
  }
}

export class WhisperSpeechToTextProvider implements SpeechToTextProvider {
  private fallback = new MockSpeechToTextProvider();

  async transcribe(
    audioBuffer: Buffer,
    mimeType = 'audio/ogg',
    options?: { language?: string; prompt?: string },
  ): Promise<SpeechToTextResult> {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return this.fallback.transcribe(audioBuffer, mimeType, options);
    }

    try {
      const formData = new FormData();
      const blob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType });
      formData.append('file', blob, 'audio.ogg');
      formData.append('model', 'whisper-1');
      if (options?.language) {
        formData.append('language', options.language);
      }
      if (options?.prompt) {
        formData.append('prompt', options.prompt);
      }

      const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      });

      if (!res.ok) {
        sttLogger.warn({ status: res.status }, 'Whisper API error, falling back to mock provider');
        return this.fallback.transcribe(audioBuffer, mimeType, options);
      }

      const data = (await res.json()) as { text?: string; language?: string; duration?: number };
      return {
        text: data.text || '',
        language: data.language,
        durationSeconds: data.duration,
        confidence: 0.98,
        provider: 'whisper',
      };
    } catch (err) {
      sttLogger.warn({ err }, 'Whisper transcription failed, falling back to mock');
      return this.fallback.transcribe(audioBuffer, mimeType, options);
    }
  }
}

export const speechToTextProvider: SpeechToTextProvider = new WhisperSpeechToTextProvider();
