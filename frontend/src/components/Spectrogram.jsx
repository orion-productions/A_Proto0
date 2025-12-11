import React, { useEffect, useRef } from 'react';

// Helper function to format duration
const formatDuration = (seconds) => {
  if (!seconds || seconds <= 0 || isNaN(seconds)) return '0s';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
};

function Spectrogram({ audioStream, isRecording, liveTranscript = '', audioFileInfo = null, savedTranscriptInfo = null }) {
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);

  useEffect(() => {
    if (!audioStream || !isRecording) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        // Guard against InvalidStateError when closing an already closed context
        try {
          audioContextRef.current.close();
        } catch (e) {
          console.warn('AudioContext close warning:', e.message);
        }
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(audioStream);

    analyser.fftSize = 2048;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    source.connect(analyser);
    analyser.connect(audioContext.destination);

    audioContextRef.current = audioContext;
    analyserRef.current = analyser;
    dataArrayRef.current = dataArray;

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const draw = () => {
      if (!isRecording) return;

      animationFrameRef.current = requestAnimationFrame(draw);

      analyser.getByteFrequencyData(dataArray);

      // Clear canvas
      ctx.fillStyle = '#111827'; // gray-900
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw spectrogram bars
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * canvas.height;

        // Create gradient for visual appeal
        const gradient = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
        gradient.addColorStop(0, '#3b82f6'); // blue-500
        gradient.addColorStop(0.5, '#8b5cf6'); // purple-500
        gradient.addColorStop(1, '#ec4899'); // pink-500

        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }
    };

    draw();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try {
          audioContextRef.current.close();
        } catch (e) {
          console.warn('AudioContext close warning:', e.message);
        }
      }
    };
  }, [audioStream, isRecording]);

      if (!isRecording) {
        return (
          <div className="w-full h-32 bg-gray-900 rounded-lg p-3 flex flex-col justify-center text-gray-400 text-xs overflow-y-auto">
            {audioFileInfo || savedTranscriptInfo ? (
              <div className="space-y-1">
                <div className="text-gray-500 text-xs font-semibold mb-2">Latest Audio & Transcript Info</div>
                
                {audioFileInfo && (
                  <div className="space-y-1">
                    <div><span className="text-gray-500">Audio File:</span> <span className="text-gray-300">{audioFileInfo.fileName}</span></div>
                    {audioFileInfo.fileSize && (
                      <div><span className="text-gray-500">File Size:</span> <span className="text-gray-300">{(audioFileInfo.fileSize / 1024).toFixed(1)} KB</span></div>
                    )}
                    {audioFileInfo.duration !== null && audioFileInfo.duration !== undefined && !isNaN(audioFileInfo.duration) ? (
                      <div><span className="text-gray-500">Duration:</span> <span className="text-gray-300">{Math.round(audioFileInfo.duration)}s ({formatDuration(audioFileInfo.duration)})</span></div>
                    ) : (
                      <div><span className="text-gray-500">Duration:</span> <span className="text-gray-300 text-yellow-400">Not available</span></div>
                    )}
                    {audioFileInfo.recordingTime && (
                      <div><span className="text-gray-500">Recorded:</span> <span className="text-gray-300">{new Date(audioFileInfo.recordingTime).toLocaleString()}</span></div>
                    )}
                  </div>
                )}
                
                {audioFileInfo && (
                  <div className="mt-2 pt-2 border-t border-gray-700 space-y-1">
                    {savedTranscriptInfo ? (
                      <>
                        <div><span className="text-gray-500">Transcript File:</span> <span className="text-gray-300">{savedTranscriptInfo.title}</span></div>
                        <div><span className="text-gray-500">Word Count:</span> <span className="text-gray-300">{savedTranscriptInfo.wordCount} words</span></div>
                        <div><span className="text-gray-500">Saved At:</span> <span className="text-gray-300">{new Date(savedTranscriptInfo.savedAt).toLocaleString()}</span></div>
                      </>
                    ) : (
                      <div><span className="text-gray-500">Transcript:</span> <span className="text-yellow-400">Not available yet (generating...)</span></div>
                    )}
                  </div>
                )}
                
                {!audioFileInfo && !savedTranscriptInfo && (
                  <div className="text-gray-500 text-xs">No audio or transcript data available</div>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-500">
                <div className="text-sm mb-1">Spectrogram will appear when recording starts</div>
                <div className="text-xs">Latest audio and transcript info will be shown here</div>
              </div>
            )}
          </div>
        );
      }

  // Get the last few words for subtitle display (more readable)
  const getSubtitleText = () => {
    if (!liveTranscript) return '';
    const words = liveTranscript.trim().split(/\s+/);
    // Show last 10-15 words for readability
    const maxWords = 15;
    if (words.length <= maxWords) {
      return liveTranscript;
    }
    return '...' + words.slice(-maxWords).join(' ');
  };

  return (
    <div className="relative w-full h-32 bg-gray-900 rounded-lg overflow-hidden">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ display: 'block' }}
      />
      {/* Live subtitles overlay - styled like video captions */}
      {liveTranscript && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black to-transparent px-4 py-3">
          <div className="text-white text-base font-semibold text-center drop-shadow-lg">
            <span className="bg-black bg-opacity-50 px-2 py-1 rounded">
              {getSubtitleText()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default Spectrogram;

