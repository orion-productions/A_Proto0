import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Upload, FileAudio, Loader2, CheckCircle2, CalendarDays, FileText } from 'lucide-react';
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
  const [audioHistory, setAudioHistory] = useState([]);
  const [showCalendar, setShowCalendar] = useState(false);
  const audioBlobRef = useRef(null);
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
        audioBlobRef.current = audioBlob;
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
        setAudioHistory((prev) => [
          ...prev,
          {
            fileName: 'recording.webm',
            fileSize: audioBlob.size,
            duration: actualDuration,
            recordingTime: recordingTime.toISOString(),
            type: 'recording'
          }
        ]);
        
        // Clear transcript info - will be set after saving
        setSavedTranscriptInfo(null);
        
        console.log('✅ Audio file info set - spectrogram should show "transcript not available yet"');
        
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
        setAudioHistory((prev) => [
          ...prev,
          {
            fileName,
            fileSize,
            duration: actualDuration,
            recordingTime: recordingTime ? recordingTime.toISOString() : new Date().toISOString(),
            type: audioBlob instanceof File ? 'uploaded' : 'recording'
          }
        ]);
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
      audioBlobRef.current = file;
      setTranscript('');
      setTranscriptionStatus('idle');
      setSavedTranscriptInfo(null); // Clear previous transcript info
      // Set audio info but do not auto-transcribe
      const recordingTime = new Date().toISOString();
      const audioUrl = URL.createObjectURL(file);
      const audio = new Audio(audioUrl);
      let duration = 0;
      try {
        await new Promise((resolve) => {
          const timeout = setTimeout(resolve, 1500);
          audio.onloadedmetadata = () => {
            duration = audio.duration;
            clearTimeout(timeout);
            resolve();
          };
          audio.onerror = () => resolve();
        });
      } finally {
        URL.revokeObjectURL(audioUrl);
      }
      setAudioFileInfo({
        fileName: file.name,
        fileSize: file.size,
        duration: duration || Math.round((file.size / 1024) * 0.06),
        recordingTime,
        type: 'uploaded'
      });
      setAudioHistory((prev) => [
        ...prev,
        {
          fileName: file.name,
          fileSize: file.size,
          duration: duration || Math.round((file.size / 1024) * 0.06),
          recordingTime,
          type: 'uploaded'
        }
      ]);
    }
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Calendar view (simple weekly list)
  const renderCalendar = () => {
    if (!audioHistory.length) {
      return <div className="text-sm text-gray-300 p-3">No audio files yet.</div>;
    }
    return (
      <div className="p-3 text-sm text-gray-200 space-y-2 max-h-64 overflow-y-auto">
        {audioHistory.map((item, idx) => (
          <div key={idx} className="bg-gray-700 rounded p-2 flex justify-between items-center">
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate" title={item.fileName}>{item.fileName}</div>
              <div className="text-xs text-gray-300">
                {new Date(item.recordingTime).toLocaleString()} • {Math.round(item.duration)}s
              </div>
            </div>
            <button
              className="ml-2 text-xs bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded"
              onClick={() => {
                setAudioFileInfo(item);
                setShowCalendar(false);
              }}
            >
              Select
            </button>
          </div>
        ))}
      </div>
    );
  };

  const renderInfoPanels = () => {
    const audioTooltip = audioFileInfo
      ? `Audio File: ${audioFileInfo.fileName || 'n/a'}
Size: ${Math.round((audioFileInfo.fileSize || 0) / 1024)} KB
Duration: ${audioFileInfo.duration ? Math.round(audioFileInfo.duration) + 's' : 'n/a'}
Recorded at: ${audioFileInfo.recordingTime ? new Date(audioFileInfo.recordingTime).toLocaleString() : 'n/a'}`
      : 'No audio selected';

    const transcriptTooltip = savedTranscriptInfo
      ? `Transcript File: ${savedTranscriptInfo.title || 'n/a'}
Size: ${savedTranscriptInfo.fileSize ? Math.round(savedTranscriptInfo.fileSize / 1024) + ' KB' : 'n/a'}
Word Count: ${savedTranscriptInfo.wordCount || 'n/a'}
Transcribed at: ${savedTranscriptInfo.savedAt ? new Date(savedTranscriptInfo.savedAt).toLocaleString() : 'n/a'}`
      : 'No transcript yet';

    return (
      <div className="bg-gray-900 rounded-lg p-3 mb-3 flex flex-col md:flex-row gap-3">
        <div className="flex-1 min-w-0" title={audioTooltip}>
          <div className="text-xs text-gray-400 mb-1 font-semibold">Audio</div>
          {audioFileInfo ? (
            <div className="text-sm text-gray-200 space-y-1">
              <div>Audio File name: <span className="font-semibold">{audioFileInfo.fileName}</span></div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">No audio selected</div>
          )}
        </div>
        <div className="flex-1 min-w-0" title={transcriptTooltip}>
          <div className="text-xs text-gray-400 mb-1 font-semibold">Transcript</div>
          {savedTranscriptInfo ? (
            <div className="text-sm text-gray-200 space-y-1">
              <div>Transcript File Name: <span className="font-semibold">{savedTranscriptInfo.title}</span></div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">No transcript yet</div>
          )}
        </div>
      </div>
    );
  };

  const handleManualTranscribe = async () => {
    if (!audioBlobRef.current) {
      alert('No audio file available. Please record or upload first.');
      return;
    }
    setTranscriptionStatus('processing');
    setTranscript('');
    setSavedTranscriptInfo(null);
    await transcribeAudio(audioBlobRef.current);
  };

  const handleLoadTranscriptFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    setTranscript(text);
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const info = {
      id: file.name,
      title: file.name,
      wordCount,
      savedAt: new Date().toISOString()
    };
    setSavedTranscriptInfo(info);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 bg-gray-750 font-semibold border-b border-gray-700 flex items-center gap-2">
        <FileAudio size={18} />
        Meeting Recording
      </div>
      
      <div className="flex-1 p-3 overflow-y-auto flex flex-col">
        {/* Controls */}
        <div className="flex gap-2 mb-3 items-center">
          {!isRecording ? (
            <button
              onClick={startRecording}
              className="flex items-center justify-center gap-1 bg-red-600 hover:bg-red-700 text-white py-2 px-3 rounded-lg transition-colors"
            >
              <Mic size={18} />
              Record
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="flex items-center justify-center gap-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-3 rounded-lg transition-colors"
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
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-2 px-3 rounded-lg transition-colors"
          >
            <Upload size={18} />
          </button>
          <button
            onClick={() => setShowCalendar(!showCalendar)}
            className="flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white py-2 px-3 rounded-lg transition-colors"
          >
            <CalendarDays size={16} />
            Calendar
          </button>
          <button
            onClick={handleManualTranscribe}
            disabled={isRecording || isTranscribing}
            className={`flex items-center justify-center gap-2 ${isTranscribing ? 'bg-green-800' : 'bg-green-600 hover:bg-green-700'} disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-2 px-3 rounded-lg transition-colors`}
            title="Manually trigger transcript for current audio file"
          >
            <FileText size={16} />
            {isTranscribing ? `Transcribing... ${transcriptionProgress.progress || 0}%` : 'Transcript'}
          </button>
          <input
            type="file"
            accept=".txt"
            className="hidden"
            id="load-transcript-file"
            onChange={handleLoadTranscriptFile}
          />
          <label
            htmlFor="load-transcript-file"
            className="flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white py-2 px-3 rounded-lg transition-colors cursor-pointer"
            title="Load transcript from file"
          >
            <Upload size={16} />
            Load Transcript
          </label>
        </div>

        {showCalendar && (
          <div className="mb-3 bg-gray-800 rounded border border-gray-700">
            <div className="px-3 py-2 text-sm font-semibold border-b border-gray-700 flex items-center justify-between">
              <span>Calendar (latest audio files)</span>
              <button className="text-xs text-blue-400 hover:underline" onClick={() => setShowCalendar(false)}>Close</button>
            </div>
            {renderCalendar()}
          </div>
        )}

        {/* Spectrogram while recording; otherwise show info block with tooltips */}
        {isRecording ? (
          <div className="mb-3">
            <Spectrogram 
              audioStream={audioStream} 
              isRecording={isRecording} 
              liveTranscript={realtimeTranscript || transcript}
              audioFileInfo={audioFileInfo}
              savedTranscriptInfo={savedTranscriptInfo}
            />
          </div>
        ) : (
          <div
            className="mb-3 bg-gray-900 rounded-lg p-3 text-sm text-gray-200 space-y-1"
            title={
              `Audio File name: ${audioFileInfo?.fileName || 'n/a'}\n` +
              `Audio File Size: ${audioFileInfo?.fileSize ? Math.round(audioFileInfo.fileSize / 1024) + ' KB' : 'n/a'}\n` +
              `Duration: ${audioFileInfo?.duration ? Math.round(audioFileInfo.duration) + 's' : 'n/a'}\n` +
              `Recorded at: ${audioFileInfo?.recordingTime ? new Date(audioFileInfo.recordingTime).toLocaleString() : 'n/a'}\n` +
              `Transcript File Name: ${savedTranscriptInfo?.title || 'n/a'}\n` +
              `Transcript File size: ${savedTranscriptInfo?.fileSize ? Math.round(savedTranscriptInfo.fileSize / 1024) + ' KB' : 'n/a'}\n` +
              `Word Count: ${savedTranscriptInfo?.wordCount || 'n/a'}\n` +
              `Transcribed at: ${savedTranscriptInfo?.savedAt ? new Date(savedTranscriptInfo.savedAt).toLocaleString() : 'n/a'}`
            }
          >
            <div>Audio File name: <span className="font-semibold">{audioFileInfo?.fileName || 'n/a'}</span></div>
            <div>Transcript File Name: <span className="font-semibold">{savedTranscriptInfo?.title || 'n/a'}</span></div>
          </div>
        )}

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

