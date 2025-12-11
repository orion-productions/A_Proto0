import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Upload, FileAudio, Loader2, CheckCircle2 } from 'lucide-react';
import useStore from '../store/useStore';
import { api } from '../api/api';
import Spectrogram from './Spectrogram';
import { startRealtimeTranscription, stopRealtimeTranscription } from '../utils/speechToText';
// Lazy load Whisper to avoid breaking app on startup
const whisperPromise = import('../utils/whisperTranscription');

function RecordingSection() {
  const { isRecording, setIsRecording } = useStore();
  const [transcript, setTranscript] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionProgress, setTranscriptionProgress] = useState({ stage: '', progress: 0 });
  const [transcriptionStatus, setTranscriptionStatus] = useState(''); // 'idle', 'processing', 'completed', 'error'
  const [audioStream, setAudioStream] = useState(null);
  const [realtimeTranscript, setRealtimeTranscript] = useState('');
  const [audioFileInfo, setAudioFileInfo] = useState(null); // Store audio file metadata
  const [savedTranscriptInfo, setSavedTranscriptInfo] = useState(null); // Store saved transcript metadata
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);
  const accumulatedTranscriptRef = useRef(''); // Use ref to track accumulated transcript (avoids stale state)
  const progressTimerRef = useRef(null); // Smooth progress timer

  // Smoothly advance progress toward a target while work is in-flight
  const startSmoothProgress = (startValue, targetValue, step = 3, intervalMs = 300) => {
    // Clear any existing timer
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
    }
    let current = startValue;
    progressTimerRef.current = setInterval(() => {
      current = Math.min(current + step, targetValue);
      setTranscriptionProgress(prev => ({
        stage: prev.stage || 'processing',
        progress: current
      }));
      if (current >= targetValue) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
    }, intervalMs);
  };

  const stopSmoothProgress = () => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setAudioStream(stream);
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioStream(null);
        
        // Stop real-time transcription
        if (recognitionRef.current) {
          stopRealtimeTranscription(recognitionRef.current);
          recognitionRef.current = null;
        }
        
        // Get actual audio duration
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        let actualDuration = 0;
        
        try {
          await new Promise((resolve, reject) => {
            // Set timeout in case metadata never loads
            const timeout = setTimeout(() => {
              console.warn('Audio metadata timeout, using fallback duration');
              resolve();
            }, 3000);
            
            if (audio.readyState >= 2) {
              // Metadata already loaded
              actualDuration = audio.duration;
              clearTimeout(timeout);
              resolve();
            } else {
              audio.onloadedmetadata = () => {
                actualDuration = audio.duration;
                clearTimeout(timeout);
                resolve();
              };
              audio.onerror = () => {
                clearTimeout(timeout);
                console.warn('Error loading audio metadata');
                resolve(); // Continue anyway
              };
            }
          });
          
          // Validate duration
          if (isNaN(actualDuration) || !isFinite(actualDuration) || actualDuration <= 0) {
            console.warn('Invalid duration, using MediaRecorder duration estimate');
            // Fallback: estimate from blob size (rough estimate: 1KB ≈ 0.06 seconds for WebM)
            actualDuration = Math.round((audioBlob.size / 1024) * 0.06);
          }
        } catch (error) {
          console.warn('Error calculating duration:', error);
          // Fallback estimate
          actualDuration = Math.round((audioBlob.size / 1024) * 0.06);
        } finally {
          URL.revokeObjectURL(audioUrl);
        }
        
        const recordingTime = new Date();
        
        // STEP 1: Set audio file info immediately
        setAudioFileInfo({
          fileName: 'recording.webm',
          fileSize: audioBlob.size,
          duration: actualDuration,
          recordingTime: recordingTime.toISOString(),
          type: 'recording'
        });
        
        // Clear transcript info - will be set after saving
        setSavedTranscriptInfo(null);
        
        console.log('✅ Audio file info set - spectrogram should show "transcript not available yet"');
        
        // STEP 2: Transcribe using Whisper (accurate and reliable)
        console.log('🎙️ Recording stopped - starting Whisper transcription...');
        
        // Clear real-time transcript (it was just a preview)
        setRealtimeTranscript('');
        accumulatedTranscriptRef.current = '';
        
        // Transcribe the audio blob using Whisper
        await transcribeAudio(audioBlob, recordingTime);
        
        // Clear the real-time transcript preview
        setRealtimeTranscript('');
        accumulatedTranscriptRef.current = '';
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        setRealtimeTranscript('');
        accumulatedTranscriptRef.current = ''; // Clear ref after use
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setTranscript('');
      setRealtimeTranscript('');
      accumulatedTranscriptRef.current = ''; // Reset accumulated transcript
      setTranscriptionStatus('idle');

          // Start real-time transcription using Web Speech API
          try {
            accumulatedTranscriptRef.current = ''; // Reset accumulated transcript
            recognitionRef.current = startRealtimeTranscription(
              (result) => {
                // result.full contains accumulated final + current interim
                // Store in ref to avoid stale state issues
                accumulatedTranscriptRef.current = result.full;
                // Update state for UI display
                setRealtimeTranscript(result.full);
                // Also update the main transcript to show progress
                setTranscript(result.full);
              },
              (error) => {
                console.warn('Real-time transcription error:', error);
                // Continue recording even if real-time transcription fails
              },
              true // keepAlive: auto-restart if API stops unexpectedly
            );
          } catch (error) {
            console.warn('Could not start real-time transcription:', error);
            // Continue recording without real-time transcription
          }
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setAudioStream(null);
      
      // Stop real-time transcription
      if (recognitionRef.current) {
        stopRealtimeTranscription(recognitionRef.current);
        recognitionRef.current = null;
      }
    }
  };

  // REMOVED useEffect that loads transcript on mount - it was overwriting new recordings
  // State will ONLY be set when a new recording/transcription is saved

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        stopRealtimeTranscription(recognitionRef.current);
      }
    };
  }, []);

  const transcribeAudio = async (audioBlob, recordingTime = null) => {
    setIsTranscribing(true);
    setTranscriptionStatus('processing');
    setTranscriptionProgress({ stage: 'initializing', progress: 5 });
    setTranscript('');

    try {
      // Get audio file info
      const fileName = audioBlob instanceof File ? audioBlob.name : 'recording.webm';
      const fileSize = audioBlob.size;
      
      // Get audio duration - wait for metadata to load
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      let actualDuration = 0;
      
      try {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Audio metadata timeout'));
          }, 3000);
          
          if (audio.readyState >= 2) {
            actualDuration = audio.duration;
            clearTimeout(timeout);
            resolve();
          } else {
            audio.onloadedmetadata = () => {
              actualDuration = audio.duration;
              clearTimeout(timeout);
              resolve();
            };
            audio.onerror = () => {
              clearTimeout(timeout);
              reject(new Error('Error loading audio metadata'));
            };
          }
        });
        
        if (isNaN(actualDuration) || !isFinite(actualDuration) || actualDuration <= 0) {
          console.warn('Invalid duration, estimating from size');
          actualDuration = Math.round((fileSize / 1024) * 0.06);
        }
      } catch (error) {
        console.warn('Error getting audio duration:', error);
        actualDuration = Math.round((fileSize / 1024) * 0.06);
      } finally {
        URL.revokeObjectURL(audioUrl);
      }
      
      // Set audio file info (if not already set)
      if (!audioFileInfo) {
        setAudioFileInfo({
          fileName: fileName,
          fileSize: fileSize,
          duration: actualDuration,
          recordingTime: recordingTime ? recordingTime.toISOString() : new Date().toISOString(),
          type: audioBlob instanceof File ? 'uploaded' : 'recording'
        });
      }
      
      // Use Whisper for transcription (backend-based, reliable)
      console.log('🎤 Transcribing with Whisper (backend)...');
      
      setTranscriptionProgress({ stage: 'uploading', progress: 15 });
      
      // Start smooth progress toward 80% while waiting for backend
      startSmoothProgress(20, 80, 3, 300);
      
      // Send audio to backend for Whisper transcription
      const result = await api.transcribeWithWhisper(audioBlob, fileName);
      
      // Backend responded — finish progress smoothly to completion
      stopSmoothProgress();
      setTranscriptionProgress({ stage: 'processing', progress: 95 });

      if (result.text) {
        const finalText = result.text.trim();
        setTranscript(finalText);
        
        // Calculate word count
        const wordCount = finalText.split(/\s+/).filter(w => w.length > 0).length;
        
        // Save transcript to database so LLM can access it
        try {
          const savedTranscript = await api.saveTranscript(
            `Transcript ${recordingTime ? recordingTime.toLocaleString() : new Date().toLocaleString()}`,
            finalText,
            fileName,
            actualDuration
          );
          
          // Store saved transcript info - this updates the spectrogram display
          const newTranscriptInfo = {
            id: savedTranscript.id,
            title: savedTranscript.title,
            wordCount: wordCount,
            savedAt: savedTranscript.created_at
          };
          
          setSavedTranscriptInfo(newTranscriptInfo);
          
          // Force update to ensure it sticks
          requestAnimationFrame(() => {
            setSavedTranscriptInfo(newTranscriptInfo);
            setTranscript(finalText);
          });
          
          console.log('✅ Saved Whisper transcript:', {
            id: savedTranscript.id,
            title: savedTranscript.title,
            wordCount: wordCount,
            textLength: finalText.length,
            preview: finalText.substring(0, 100)
          });
        } catch (error) {
          console.warn('Failed to save transcript:', error);
        }
      }
      
      setTranscriptionStatus('completed');
      setTranscriptionProgress({ stage: 'completed', progress: 100 });
    } catch (error) {
      console.error('Error transcribing audio:', error);
      const errorMsg = error.message || 'Transcription failed.';
      setTranscript(`Error: ${errorMsg}\n\nPlease ensure you're using a modern browser (Chrome or Edge recommended).`);
      setTranscriptionStatus('error');
      setTranscriptionProgress({ stage: 'error', progress: 0 });
    } finally {
      stopSmoothProgress();
      setIsTranscribing(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      console.log('📁 Transcribing uploaded file with Whisper...');
      setTranscript('');
      setTranscriptionStatus('processing');
      setSavedTranscriptInfo(null); // Clear previous transcript info
      await transcribeAudio(file);
    }
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 bg-gray-750 font-semibold border-b border-gray-700 flex items-center gap-2">
        <FileAudio size={18} />
        Meeting Recording
      </div>
      
      <div className="flex-1 p-3 overflow-y-auto flex flex-col">
        {/* Controls */}
        <div className="flex gap-2 mb-3">
          {!isRecording ? (
            <button
              onClick={startRecording}
              className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg transition-colors"
            >
              <Mic size={18} />
              Record
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="flex-1 flex items-center justify-center gap-2 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg transition-colors"
            >
              <Square size={18} />
              Stop
            </button>
          )}
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="audio/*"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isRecording || isTranscribing}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg transition-colors"
          >
            <Upload size={18} />
          </button>
        </div>

        {/* Spectrogram with live subtitles */}
            <div className="mb-3">
              <Spectrogram 
                audioStream={audioStream} 
                isRecording={isRecording} 
                liveTranscript={realtimeTranscript || transcript}
                audioFileInfo={audioFileInfo}
                savedTranscriptInfo={savedTranscriptInfo}
              />
            </div>

        {/* Transcription Progress */}
        {isTranscribing && (
          <div className="mb-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-blue-400">
                <Loader2 className="animate-spin" size={16} />
                <span className="capitalize">
                  {transcriptionProgress.stage === 'initializing' && 'Initializing Whisper...'}
                  {transcriptionProgress.stage === 'model_loading' && 'Loading Whisper model (first time only)...'}
                  {transcriptionProgress.stage === 'model_loaded' && 'Model ready, processing...'}
                  {transcriptionProgress.stage === 'processing' && 'Transcribing with Whisper...'}
                  {transcriptionProgress.stage === 'error' && 'Error occurred'}
                  {!transcriptionProgress.stage && 'Processing...'}
                </span>
              </div>
              <span className="text-gray-400">{transcriptionProgress.progress}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${transcriptionProgress.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Transcription Status */}
        {transcriptionStatus === 'completed' && !isTranscribing && (
          <div className="flex items-center gap-2 text-green-400 mb-2 text-sm">
            <CheckCircle2 size={16} />
            <span>Transcription completed</span>
          </div>
        )}

        {transcriptionStatus === 'error' && !isTranscribing && (
          <div className="flex items-center gap-2 text-red-400 mb-2 text-sm">
            <span>⚠️ Transcription failed</span>
          </div>
        )}

        {/* Transcript */}
        {transcript && (
          <div className="bg-gray-900 rounded-lg p-3 flex-1 overflow-y-auto">
            <div className="text-xs text-gray-400 mb-2 font-semibold">Transcript content:</div>
            <div className="text-sm whitespace-pre-wrap text-gray-200">{transcript}</div>
          </div>
        )}

            {/* Empty state */}
            {!transcript && !isTranscribing && !isRecording && (
              <div className="flex-1 flex items-center justify-center text-gray-500 text-sm text-center">
                <div>
                  <p className="mb-2">Start recording or upload an audio file</p>
                  <p className="text-xs">Supported formats: WebM, MP3, WAV, OGG, M4A, FLAC</p>
                  <p className="text-xs text-yellow-400 mt-2">
                    ⚠️ Note: File transcription accuracy may be limited. For best results, use the Record feature.
                  </p>
                </div>
              </div>
            )}
      </div>
    </div>
  );
}

export default RecordingSection;

