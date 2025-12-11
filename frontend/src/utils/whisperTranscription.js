// Whisper transcription using Transformers.js
// Completely free, runs in browser, no API keys needed

// Lazy load Transformers.js to avoid breaking the app on startup
let transformers = null;
let transcriber = null;
let isLoading = false;

// Dynamically import Transformers.js only when needed
async function loadTransformers() {
  if (transformers) return transformers;
  
  try {
    console.log('🔄 Loading Transformers.js library...');
    transformers = await import('@xenova/transformers');
    
    // Configure after loading
    transformers.env.allowLocalModels = false;
    transformers.env.allowRemoteModels = true;
    transformers.env.useBrowserCache = true;
    
    console.log('✅ Transformers.js loaded successfully');
    return transformers;
  } catch (error) {
    console.error('❌ Failed to load Transformers.js:', error);
    throw new Error('Failed to load Whisper library. Please refresh the page and try again.');
  }
}

/**
 * Initialize Whisper model
 * Downloads model on first use (cached afterwards)
 */
async function initializeWhisper(onProgress) {
  if (transcriber) return transcriber;
  if (isLoading) {
    // Wait for existing initialization
    while (isLoading) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return transcriber;
  }

  isLoading = true;
  
  try {
    console.log('🔄 Initializing Whisper model...');
    
    // Load Transformers.js dynamically
    const tf = await loadTransformers();
    
    if (onProgress) {
      onProgress({
        stage: 'model_loading',
        progress: 10,
        text: 'Loading Whisper model (first time only)...'
      });
    }

    // Use Whisper tiny model (fastest, smallest)
    // Options: "tiny", "base", "small", "medium", "large"
    // tiny = ~39MB, base = ~74MB, small = ~244MB
    transcriber = await tf.pipeline(
      'automatic-speech-recognition',
      'Xenova/whisper-tiny.en',
      {
        quantized: true, // Use quantized model for smaller size and faster loading
        progress_callback: (progress) => {
          console.log('Model loading progress:', progress);
          if (onProgress) {
            if (progress.status === 'progress' && progress.total) {
              const percent = Math.round((progress.loaded / progress.total) * 100);
              onProgress({
                stage: 'model_loading',
                progress: 10 + (percent * 0.3), // 10-40%
                text: `Downloading model: ${percent}%`
              });
            } else if (progress.status === 'done') {
              onProgress({
                stage: 'model_loading',
                progress: 45,
                text: 'Model downloaded, initializing...'
              });
            } else if (progress.status === 'ready') {
              onProgress({
                stage: 'model_loaded',
                progress: 50,
                text: 'Model ready!'
              });
            } else if (progress.status === 'initiate') {
              onProgress({
                stage: 'model_loading',
                progress: 15,
                text: 'Fetching model files...'
              });
            }
          }
        },
        revision: 'main',
      }
    );

    console.log('✅ Whisper model loaded');
    
    if (onProgress) {
      onProgress({
        stage: 'model_loaded',
        progress: 50,
        text: 'Model loaded, starting transcription...'
      });
    }

    isLoading = false;
    return transcriber;
  } catch (error) {
    isLoading = false;
    console.error('Error initializing Whisper:', error);
    
    // Provide helpful error message
    let errorMessage = 'Failed to initialize Whisper model. ';
    
    if (error.message.includes('JSON')) {
      errorMessage += 'Network error or CDN issue. Please check your internet connection and try again.';
    } else if (error.message.includes('fetch')) {
      errorMessage += 'Unable to download model. Please check your internet connection.';
    } else if (error.message.includes('CORS')) {
      errorMessage += 'CORS error. The model files could not be loaded.';
    } else {
      errorMessage += error.message;
    }
    
    throw new Error(errorMessage);
  }
}

/**
 * Transcribe audio file using Whisper
 * @param {Blob} audioBlob - Audio file to transcribe
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<{text: string, status: string}>}
 */
export async function transcribeWithWhisper(audioBlob, onProgress) {
  try {
    console.log('🎤 Starting Whisper transcription...', {
      size: audioBlob.size,
      type: audioBlob.type
    });

    if (onProgress) {
      onProgress({
        stage: 'initializing',
        progress: 5,
        text: 'Preparing audio...'
      });
    }

    // Initialize Whisper model
    const model = await initializeWhisper(onProgress);

    if (onProgress) {
      onProgress({
        stage: 'processing',
        progress: 60,
        text: 'Transcribing audio...'
      });
    }

    // Convert blob to array buffer
    const arrayBuffer = await audioBlob.arrayBuffer();
    
    // Transcribe
    const result = await model(arrayBuffer, {
      chunk_length_s: 30, // Process in 30-second chunks
      stride_length_s: 5,  // 5-second overlap between chunks
      return_timestamps: false, // Set to true if you want timestamps
    });

    console.log('✅ Whisper transcription completed:', {
      text: result.text,
      length: result.text.length
    });

    if (onProgress) {
      onProgress({
        stage: 'completed',
        progress: 100,
        text: result.text
      });
    }

    return {
      text: result.text,
      status: 'completed'
    };
  } catch (error) {
    console.error('❌ Whisper transcription error:', error);
    
    if (onProgress) {
      onProgress({
        stage: 'error',
        progress: 0,
        text: ''
      });
    }

    throw new Error(`Whisper transcription failed: ${error.message}`);
  }
}

/**
 * Check if Whisper is available in the browser
 */
export function isWhisperAvailable() {
  try {
    // Check if we can import transformers
    return typeof window !== 'undefined' && 'Worker' in window;
  } catch {
    return false;
  }
}

/**
 * Get estimated model size for user information
 */
export function getModelInfo() {
  return {
    name: 'Whisper Tiny (English)',
    size: '~39 MB',
    description: 'Fast and accurate speech recognition',
    firstLoadTime: '~30 seconds (cached afterwards)',
    accuracy: 'High accuracy for English speech',
  };
}

