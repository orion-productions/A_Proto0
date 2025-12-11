import { describe, it, expect, beforeEach, vi } from 'vitest';
import { startRealtimeTranscription, stopRealtimeTranscription, transcribeAudioFile } from '../utils/speechToText';

describe('speechToText utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('startRealtimeTranscription', () => {
    it('should start recognition and return instance', () => {
      const onResult = vi.fn();
      const onError = vi.fn();

      const recognition = startRealtimeTranscription(onResult, onError);

      expect(recognition).toBeDefined();
      expect(recognition.start).toHaveBeenCalled();
      expect(recognition.continuous).toBe(true);
      expect(recognition.interimResults).toBe(true);
    });

    it('should call onResult with accumulated transcript', () => {
      const onResult = vi.fn();
      const onError = vi.fn();

      const recognition = startRealtimeTranscription(onResult, onError);

      // Simulate recognition results
      const mockEvent = {
        resultIndex: 0,
        results: [
          { 0: { transcript: 'Hello ' }, isFinal: true },
          { 0: { transcript: 'world' }, isFinal: false },
        ],
      };

      recognition.onresult(mockEvent);

      expect(onResult).toHaveBeenCalledWith(
        expect.objectContaining({
          final: expect.stringContaining('Hello'),
          interim: expect.stringContaining('world'),
          full: expect.stringContaining('Hello'),
        })
      );
    });

    it('should accumulate multiple final results', () => {
      const onResult = vi.fn();
      const recognition = startRealtimeTranscription(onResult, vi.fn());

      // First result
      recognition.onresult({
        resultIndex: 0,
        results: [{ 0: { transcript: 'Hello ' }, isFinal: true }],
      });

      // Second result
      recognition.onresult({
        resultIndex: 1,
        results: [{ 0: { transcript: 'world ' }, isFinal: true }],
      });

      expect(onResult).toHaveBeenLastCalledWith(
        expect.objectContaining({
          final: expect.stringContaining('Hello'),
          full: expect.stringContaining('Hello'),
        })
      );
    });

    it('should handle errors', () => {
      const onResult = vi.fn();
      const onError = vi.fn();

      const recognition = startRealtimeTranscription(onResult, onError);

      const mockError = new Error('test error');
      recognition.onerror({ error: 'test error' });

      expect(onError).toHaveBeenCalled();
    });

    it('should return null if Web Speech API is not supported', () => {
      const originalSpeechRecognition = global.SpeechRecognition;
      const originalWebkitSpeechRecognition = global.webkitSpeechRecognition;

      delete global.SpeechRecognition;
      delete global.webkitSpeechRecognition;

      const onError = vi.fn();
      const recognition = startRealtimeTranscription(vi.fn(), onError);

      expect(recognition).toBeNull();
      expect(onError).toHaveBeenCalledWith(expect.any(Error));

      global.SpeechRecognition = originalSpeechRecognition;
      global.webkitSpeechRecognition = originalWebkitSpeechRecognition;
    });
  });

  describe('stopRealtimeTranscription', () => {
    it('should stop recognition', () => {
      const recognition = {
        stop: vi.fn(),
      };

      stopRealtimeTranscription(recognition);

      expect(recognition.stop).toHaveBeenCalled();
    });

    it('should handle null recognition gracefully', () => {
      expect(() => stopRealtimeTranscription(null)).not.toThrow();
    });
  });

  describe('transcribeAudioFile', () => {
    it('should transcribe audio file and return transcript', async () => {
      const mockBlob = new Blob(['audio data'], { type: 'audio/webm' });
      const onProgress = vi.fn();

      const recognitionInstance = {
        start: vi.fn(),
        stop: vi.fn(),
        onresult: null,
        onend: null,
        onerror: null,
        continuous: false,
        interimResults: false,
        lang: '',
      };

      global.SpeechRecognition = vi.fn(() => recognitionInstance);
      global.webkitSpeechRecognition = global.SpeechRecognition;

      const promise = transcribeAudioFile(mockBlob, onProgress);

      // Simulate successful transcription
      setTimeout(() => {
        recognitionInstance.onresult({
          resultIndex: 0,
          results: [{ 0: { transcript: 'Test transcript' }, isFinal: true }],
        });
        recognitionInstance.onend();
      }, 10);

      const result = await promise;

      expect(result.text).toBe('Test transcript');
      expect(result.status).toBe('completed');
      expect(onProgress).toHaveBeenCalled();
    });

    it('should call onProgress with stage updates', async () => {
      const mockBlob = new Blob(['audio data'], { type: 'audio/webm' });
      const onProgress = vi.fn();

      const recognitionInstance = {
        start: vi.fn(),
        stop: vi.fn(),
        onresult: null,
        onend: null,
        onerror: null,
      };

      global.SpeechRecognition = vi.fn(() => recognitionInstance);

      const promise = transcribeAudioFile(mockBlob, onProgress);

      setTimeout(() => {
        recognitionInstance.onresult({
          resultIndex: 0,
          results: [{ 0: { transcript: 'Test' }, isFinal: true }],
        });
        recognitionInstance.onend();
      }, 10);

      await promise;

      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: expect.any(String),
          progress: expect.any(Number),
        })
      );
    });

    it('should handle no-speech error gracefully', async () => {
      const mockBlob = new Blob(['audio data'], { type: 'audio/webm' });

      const recognitionInstance = {
        start: vi.fn(),
        stop: vi.fn(),
        onresult: null,
        onend: null,
        onerror: null,
      };

      global.SpeechRecognition = vi.fn(() => recognitionInstance);

      const promise = transcribeAudioFile(mockBlob, vi.fn());

      setTimeout(() => {
        recognitionInstance.onerror({ error: 'no-speech' });
        recognitionInstance.onend();
      }, 10);

      const result = await promise;

      expect(result.text).toBe('');
      expect(result.status).toBe('completed');
    });

    it('should reject on recognition error', async () => {
      const mockBlob = new Blob(['audio data'], { type: 'audio/webm' });

      const recognitionInstance = {
        start: vi.fn(),
        stop: vi.fn(),
        onresult: null,
        onend: null,
        onerror: null,
      };

      global.SpeechRecognition = vi.fn(() => recognitionInstance);

      const promise = transcribeAudioFile(mockBlob, vi.fn());

      setTimeout(() => {
        recognitionInstance.onerror({ error: 'audio-capture' });
      }, 10);

      await expect(promise).rejects.toThrow('Speech recognition error: audio-capture');
    });

    it('should reject if Web Speech API is not supported', async () => {
      const originalSpeechRecognition = global.SpeechRecognition;
      const originalWebkitSpeechRecognition = global.webkitSpeechRecognition;

      delete global.SpeechRecognition;
      delete global.webkitSpeechRecognition;

      const mockBlob = new Blob(['audio data'], { type: 'audio/webm' });

      await expect(transcribeAudioFile(mockBlob, vi.fn())).rejects.toThrow(
        'Web Speech API is not supported'
      );

      global.SpeechRecognition = originalSpeechRecognition;
      global.webkitSpeechRecognition = originalWebkitSpeechRecognition;
    });
  });
});

