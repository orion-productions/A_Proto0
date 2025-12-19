// Free speech-to-text using Web Speech API (browser-native, no API keys needed)
// Note: Web Speech API works best with real-time microphone input
// For file transcription, we'll use a workaround by playing the audio

/**
 * Transcribe audio file using Web Speech API
 * 
 * IMPORTANT LIMITATION: Web Speech API is designed for microphone input, not file transcription.
 * This method plays the audio file and tries to capture it, which is unreliable because:
 * - It depends on system audio routing
 * - May pick up background noise or system sounds
 * - May only capture parts of the audio
 * - Timing may be inaccurate
 * 
 * For best results, use the RECORD feature (real-time microphone transcription) instead of file upload.
 * Real-time transcription uses the microphone directly and is much more accurate.
 * 
 * Completely free and works entirely in the browser
 */
export async function transcribeAudioFile(audioFile, onProgress) {
  return new Promise((resolve, reject) => {
    // Check if Web Speech API is available
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      reject(new Error('Web Speech API is not supported in this browser. Please use Chrome, Edge, or Safari for transcription.'));
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let finalTranscript = '';
    let interimTranscript = '';

    recognition.onresult = (event) => {
      interimTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      // Update progress
      if (onProgress) {
        onProgress({
          stage: 'transcribing',
          progress: Math.min(90, 30 + (finalTranscript.length / 100)), // Estimate progress
          text: finalTranscript + interimTranscript
        });
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'no-speech') {
        // No speech detected - might be silence or unsupported format
        console.warn('No speech detected in audio file');
        // Continue and resolve with empty transcript
        recognition.stop();
        return;
      }
      if (event.error !== 'aborted') {
        reject(new Error(`Speech recognition error: ${event.error}`));
      }
    };

    recognition.onend = () => {
      if (onProgress) {
        onProgress({
          stage: 'completed',
          progress: 100,
          text: finalTranscript
        });
      }
      resolve({ text: finalTranscript.trim(), status: 'completed' });
    };

    // Create audio context to play file and route to recognition
    const audio = new Audio(URL.createObjectURL(audioFile));
    
    // Get audio duration for progress estimation
    audio.onloadedmetadata = () => {
      if (onProgress) {
        onProgress({
          stage: 'processing',
          progress: 10,
          text: ''
        });
      }
    };

    // Start recognition first
    recognition.start();

    // Play audio - Web Speech API will capture it from system audio
    audio.play().catch(err => {
      console.error('Error playing audio:', err);
      // Try to continue anyway
    });

    // Stop recognition when audio ends
    audio.onended = () => {
      setTimeout(() => {
        recognition.stop();
      }, 2000); // Give it 2 seconds to process final words
    };

    // Safety timeout - stop after 5 minutes max
    setTimeout(() => {
      if (recognition.state !== 'stopped') {
        recognition.stop();
        audio.pause();
      }
    }, 300000);
  });
}

/**
 * Start real-time speech recognition
 */
export function startRealtimeTranscription(onResult, onError, keepAlive = true) {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    if (onError) {
      onError(new Error('Web Speech API is not supported in this browser. Please use Chrome, Edge, or Safari.'));
    }
    return null;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';
  recognition._stopRequested = false;
  recognition._keepAlive = keepAlive;

  // Accumulate final transcript across all events
  let accumulatedFinalTranscript = '';

  recognition.onresult = (event) => {
    let interimTranscript = '';

    // Process only new results since last event
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        // Accumulate final results
        accumulatedFinalTranscript += transcript + ' ';
      } else {
        interimTranscript += transcript;
      }
    }

    if (onResult) {
      onResult({
        final: accumulatedFinalTranscript,
        interim: interimTranscript,
        full: accumulatedFinalTranscript + interimTranscript
      });
    }
  };

  recognition.onerror = (event) => {
    if (onError) {
      onError(new Error(`Speech recognition error: ${event.error}`));
    }
  };

  // Auto-restart if it stops unexpectedly while recording
  recognition.onend = () => {
    if (recognition._stopRequested) return;
    if (recognition._keepAlive) {
      try {
        recognition.start();
      } catch (err) {
        if (onError) onError(new Error(`Speech restart error: ${err.message}`));
      }
    }
  };

  recognition.start();
  return recognition;
}

/**
 * Stop real-time speech recognition
 */
export function stopRealtimeTranscription(recognition) {
  if (recognition) {
    recognition._stopRequested = true;
    recognition.stop();
  }
}

