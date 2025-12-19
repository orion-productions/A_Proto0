import React, { useState, useEffect } from 'react';
import { X, Calendar as CalendarIcon, Clock, FileAudio, FileText, Play, Download } from 'lucide-react';
import { useTranslation } from '../utils/i18n';

const CalendarModal = ({ isOpen, onClose, audioHistory, onSelectAudio, onTranscribe }) => {
  const { t } = useTranslation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [transcriptsMap, setTranscriptsMap] = useState(new Map());

  // Fetch transcript information when modal opens
  useEffect(() => {
    if (isOpen && audioHistory.length > 0) {
      const fetchTranscripts = async () => {
        try {
          const response = await fetch('/api/transcripts');
          if (response.ok) {
            const data = await response.json();
            const transcriptMap = new Map();
            data.transcripts.forEach(transcript => {
              // Extract base name from transcript file name
              const baseName = transcript.file_name.replace('.transcript.json', '');
              transcriptMap.set(baseName, transcript);
            });
            setTranscriptsMap(transcriptMap);
          }
        } catch (error) {
          console.error('Failed to fetch transcripts:', error);
        }
      };
      fetchTranscripts();
    }
  }, [isOpen, audioHistory]);

  // Get days in month
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    // Get day of week for first day (0 = Sunday, 6 = Saturday)
    const firstDayOfWeek = firstDay.getDay();

    const days = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(null);
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const audioFiles = getAudioFilesForDate(date);
      days.push({
        date,
        day,
        audioFiles,
        hasAudio: audioFiles.length > 0
      });
    }

    return days;
  };

  // Get audio files for a specific date
  const getAudioFilesForDate = (date) => {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    return audioHistory.filter(item => {
      const recordingDate = new Date(item.recordingTime);
      recordingDate.setHours(0, 0, 0, 0);
      return recordingDate.getTime() === targetDate.getTime();
    }).sort((a, b) => new Date(b.recordingTime) - new Date(a.recordingTime)); // Most recent first
  };

  // Get audio files for selected date (for detailed view)
  const getSelectedDateAudio = () => {
    if (!selectedDate) return [];
    return getAudioFilesForDate(selectedDate);
  };

  // Format time for display
  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Get month name
  const getMonthName = (date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  // Navigate months
  const navigateMonth = (direction) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + direction);
      return newDate;
    });
    setSelectedDate(null);
  };

  // Check if date is today
  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // Check if date is selected
  const isSelected = (date) => {
    return selectedDate && date.toDateString() === selectedDate.toDateString();
  };

  // Check if transcript exists for audio file
  const hasTranscript = (audioFile) => {
    // Extract base name from audio file (remove extension)
    const baseName = audioFile.fileName.replace(/\.[^/.]+$/, '');
    // Check if a transcript file with the same base name exists
    return transcriptsMap.has(baseName);
  };

  // Handle audio file selection
  const handleAudioSelect = (audioFile) => {
    onSelectAudio(audioFile);
    onClose();
  };

  // Handle transcription
  const handleTranscribe = (audioFile) => {
    onTranscribe(audioFile);
  };

  const days = getDaysInMonth(currentDate);
  const selectedDateAudio = getSelectedDateAudio();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg border border-gray-700 max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <CalendarIcon className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">{t('audio.calendar')}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Calendar View */}
          <div className="flex-1 p-4">
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => navigateMonth(-1)}
                className="text-gray-400 hover:text-white transition-colors p-1"
              >
                ‹
              </button>
              <h3 className="text-lg font-semibold text-white">{getMonthName(currentDate)}</h3>
              <button
                onClick={() => navigateMonth(1)}
                className="text-gray-400 hover:text-white transition-colors p-1"
              >
                ›
              </button>
            </div>

            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-sm font-medium text-gray-400 py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1 flex-1">
              {days.map((dayData, index) => (
                <div
                  key={index}
                  className={`min-h-[80px] border border-gray-600 rounded p-1 cursor-pointer transition-colors ${
                    dayData
                      ? `hover:bg-gray-700 ${
                          isToday(dayData.date) ? 'bg-blue-900 border-blue-500' : ''
                        } ${
                          isSelected(dayData.date) ? 'bg-blue-700 border-blue-400' : ''
                        }`
                      : 'bg-gray-900'
                  }`}
                  onClick={() => dayData && setSelectedDate(dayData.date)}
                >
                  {dayData && (
                    <>
                      <div className="text-sm text-gray-300 mb-1">{dayData.day}</div>
                      {dayData.audioFiles.map((audio, audioIndex) => (
                        <div
                          key={audioIndex}
                          className="text-xs bg-blue-600 rounded px-1 py-0.5 mb-0.5 truncate"
                          title={`${audio.fileName} - ${Math.round(audio.duration)}s`}
                          style={{
                            backgroundColor: audio.duration > 300 ? '#dc2626' : // red for >5min
                                           audio.duration > 120 ? '#ea580c' : // orange for >2min
                                           '#2563eb' // blue for shorter
                          }}
                        >
                          <Clock className="w-3 h-3 inline mr-1" />
                          {formatTime(audio.recordingTime)}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Selected Date Details */}
          {selectedDate && (
            <div className="w-80 border-l border-gray-700 p-4 overflow-y-auto">
              <h3 className="text-lg font-semibold text-white mb-4">
                {selectedDate.toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </h3>

              {selectedDateAudio.length === 0 ? (
                <div className="text-gray-400 text-center py-8">
                  {t('no.audio.files.on.this.date')}
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedDateAudio.map((audio, index) => (
                    <div key={index} className="bg-gray-700 rounded-lg p-3">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <FileAudio className="w-4 h-4 text-blue-400 flex-shrink-0" />
                            <span className="text-sm font-medium text-white truncate" title={audio.fileName}>
                              {audio.fileName}
                            </span>
                          </div>
                          <div className="text-xs text-gray-400 space-y-1">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatTime(audio.recordingTime)}
                            </div>
                            <div>Duration: {Math.round(audio.duration)}s</div>
                            <div>Size: {Math.round(audio.fileSize / 1024)} KB</div>
                          </div>
                        </div>
                      </div>

                      {/* Transcript Status */}
                      <div className="mt-3 pt-3 border-t border-gray-600">
                        {hasTranscript(audio) ? (
                          <div className="flex items-center gap-2 text-green-400">
                            <FileText className="w-4 h-4" />
                            <span className="text-sm">{t('transcript.available')}</span>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-yellow-400">
                              <FileText className="w-4 h-4" />
                              <span className="text-sm">{t('transcript.not.available')}</span>
                            </div>
                            <button
                              onClick={() => handleTranscribe(audio)}
                              className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs py-1 px-2 rounded transition-colors"
                            >
                              {t('transcribe.now')}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Action Button */}
                      <button
                        onClick={() => handleAudioSelect(audio)}
                        className="w-full mt-3 bg-green-600 hover:bg-green-700 text-white text-sm py-2 px-3 rounded transition-colors flex items-center justify-center gap-2"
                      >
                        <Play className="w-4 h-4" />
                        {t('select.audio.file')}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CalendarModal;
