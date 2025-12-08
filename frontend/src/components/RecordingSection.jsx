import React, { useState, useRef } from 'react';
import { Mic, Square, Upload, FileAudio, Loader2 } from 'lucide-react';
import useStore from '../store/useStore';
import { api } from '../api/api';

function RecordingSection() {
  const { isRecording, setIsRecording } = useStore();
  const [transcript, setTranscript] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const fileInputRef = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await transcribeAudio(audioBlob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (audioBlob) => {
    setIsTranscribing(true);
    try {
      const result = await api.transcribeAudio(audioBlob);
      if (result.placeholder) {
        setTranscript(result.text);
      } else {
        setTranscript(result.text || 'Transcription completed');
      }
    } catch (error) {
      console.error('Error transcribing audio:', error);
      setTranscript('Error transcribing audio');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      await transcribeAudio(file);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 bg-gray-750 font-semibold border-b border-gray-700 flex items-center gap-2">
        <FileAudio size={18} />
        Meeting Recording
      </div>
      
      <div className="flex-1 p-3 overflow-y-auto">
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
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors"
          >
            <Upload size={18} />
          </button>
        </div>

        {isTranscribing && (
          <div className="flex items-center justify-center gap-2 text-blue-400 mb-2">
            <Loader2 className="animate-spin" size={18} />
            Transcribing...
          </div>
        )}

        {transcript && (
          <div className="bg-gray-900 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-2">Transcript:</div>
            <div className="text-sm whitespace-pre-wrap">{transcript}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default RecordingSection;

