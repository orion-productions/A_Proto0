import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Spectrogram from '../components/Spectrogram';

describe('Spectrogram Component', () => {
  it('should render "not recording" view when not recording', () => {
    render(<Spectrogram audioStream={null} isRecording={false} />);

    expect(screen.getByText(/Spectrogram will appear when recording starts/i)).toBeInTheDocument();
  });

  it('should render canvas when recording', () => {
    const mockStream = {};
    const { container } = render(
      <Spectrogram audioStream={mockStream} isRecording={true} liveTranscript="" />
    );

    const canvas = container.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
  });

  it('should display audio file info when not recording', () => {
    const audioFileInfo = {
      fileName: 'test-recording.webm',
      fileSize: 1024 * 500, // 500 KB
      duration: 45,
      recordingTime: '2024-01-01T12:00:00Z',
      type: 'recording',
    };

    render(
      <Spectrogram
        audioStream={null}
        isRecording={false}
        audioFileInfo={audioFileInfo}
        liveTranscript=""
      />
    );

    expect(screen.getByText(/test-recording.webm/i)).toBeInTheDocument();
    expect(screen.getByText(/500\.0 KB/i)).toBeInTheDocument();
    expect(screen.getByText(/45s/i)).toBeInTheDocument();
  });

  it('should display transcript file info when available', () => {
    const audioFileInfo = {
      fileName: 'recording.webm',
      fileSize: 1024 * 100,
      duration: 30,
      recordingTime: '2024-01-01T12:00:00Z',
      type: 'recording',
    };

    const savedTranscriptInfo = {
      id: 'transcript-1',
      title: 'Transcript 1/1/2024, 12:00:00 PM',
      wordCount: 150,
      savedAt: Date.parse('2024-01-01T12:05:00Z'),
    };

    render(
      <Spectrogram
        audioStream={null}
        isRecording={false}
        audioFileInfo={audioFileInfo}
        savedTranscriptInfo={savedTranscriptInfo}
        liveTranscript=""
      />
    );

    expect(screen.getByText(/Transcript 1\/1\/2024, 12:00:00 PM/i)).toBeInTheDocument();
    expect(screen.getByText(/150 words/i)).toBeInTheDocument();
  });

  it('should show duration in formatted time', () => {
    const audioFileInfo = {
      fileName: 'recording.webm',
      fileSize: 1024,
      duration: 125, // 2 minutes 5 seconds
      recordingTime: '2024-01-01T12:00:00Z',
      type: 'recording',
    };

    render(
      <Spectrogram
        audioStream={null}
        isRecording={false}
        audioFileInfo={audioFileInfo}
        liveTranscript=""
      />
    );

    expect(screen.getByText(/2m 5s/i)).toBeInTheDocument();
  });

  it('should handle zero duration', () => {
    const audioFileInfo = {
      fileName: 'recording.webm',
      fileSize: 1024,
      duration: 0,
      recordingTime: '2024-01-01T12:00:00Z',
      type: 'recording',
    };

    render(
      <Spectrogram
        audioStream={null}
        isRecording={false}
        audioFileInfo={audioFileInfo}
        liveTranscript=""
      />
    );

    expect(screen.getByText(/0s/i)).toBeInTheDocument();
  });

  it('should handle missing duration', () => {
    const audioFileInfo = {
      fileName: 'recording.webm',
      fileSize: 1024,
      duration: null,
      recordingTime: '2024-01-01T12:00:00Z',
      type: 'recording',
    };

    render(
      <Spectrogram
        audioStream={null}
        isRecording={false}
        audioFileInfo={audioFileInfo}
        liveTranscript=""
      />
    );

    expect(screen.getByText(/Not available/i)).toBeInTheDocument();
  });

  it('should display "Latest Audio & Transcript Info" header when info is available', () => {
    const audioFileInfo = {
      fileName: 'recording.webm',
      fileSize: 1024,
      duration: 10,
      recordingTime: '2024-01-01T12:00:00Z',
      type: 'recording',
    };

    render(
      <Spectrogram
        audioStream={null}
        isRecording={false}
        audioFileInfo={audioFileInfo}
        liveTranscript=""
      />
    );

    expect(screen.getByText(/Latest Audio & Transcript Info/i)).toBeInTheDocument();
  });

  it('should show default message when no data', () => {
    render(
      <Spectrogram
        audioStream={null}
        isRecording={false}
        audioFileInfo={null}
        savedTranscriptInfo={null}
        liveTranscript=""
      />
    );

    expect(screen.getByText(/Spectrogram will appear when recording starts/i)).toBeInTheDocument();
  });

  it('should cleanup on unmount when recording', () => {
    const mockStream = {};
    const { unmount } = render(
      <Spectrogram audioStream={mockStream} isRecording={true} liveTranscript="" />
    );

    // Should not throw on unmount
    expect(() => unmount()).not.toThrow();
  });
});

