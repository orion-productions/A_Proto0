import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook for speech-to-text using Web Speech API
 * Features:
 * - Continuous listening
 * - Real-time interim results
 * - Auto language detection
 * - 5-second silence detection for auto-send
 */
export const useSpeechRecognition = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const [detectedLanguage, setDetectedLanguage] = useState('en-US');
  
  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const onSilenceCallbackRef = useRef(null);
  const shouldBeListeningRef = useRef(false); // Track whether we should be listening
  const resetLanguageHandlerRef = useRef(null); // Store the event handler for cleanup

  // Check browser support
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setIsSupported(true);
      recognitionRef.current = new SpeechRecognition();
      
      // Configure recognition
      const recognition = recognitionRef.current;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      
      // Try to support multiple languages (browser will auto-detect)
      // Default to English, but will adapt based on speech
      recognition.lang = 'en-US';
      
      // Listen for manual language changes from UI
      resetLanguageHandlerRef.current = (event) => {
        const targetLang = event.detail || 'en-US';
        console.log(`🌍 Manual language change to ${targetLang}`);
        if (recognitionRef.current) {
          recognitionRef.current.lang = targetLang;
          setDetectedLanguage(targetLang);
          // Restart recognition if active to apply new language
          if (shouldBeListeningRef.current) {
            recognitionRef.current.stop(); // Will auto-restart via onend with new language
          }
        }
      };
      
      window.addEventListener('setSpeechLanguage', resetLanguageHandlerRef.current);
      // Keep the old event for backward compatibility (resets to English)
      window.addEventListener('resetSpeechLanguage', () => {
        resetLanguageHandlerRef.current({ detail: 'en-US' });
      });
      
      // Handle results
      recognition.onresult = (event) => {
        console.log('🎤 Speech recognition result received (event index:', event.resultIndex, ')');
        let interim = '';
        let final = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcriptPiece = event.results[i][0].transcript;
          
          if (event.results[i].isFinal) {
            final += transcriptPiece + ' ';
            
            // Try to detect language from the transcript
            const lang = event.results[i][0].transcript;
            if (lang) {
              // Simple language detection based on character patterns
              const detectedLang = detectLanguageFromText(lang);
              setDetectedLanguage(detectedLang);
            }
          } else {
            interim += transcriptPiece;
          }
        }
        
        if (final) {
          console.log('✅ Final result:', final);
          
          // Detect and update language if changed
          const detectedLang = detectLanguageFromText(final);
          if (detectedLang !== detectedLanguage) {
            console.log(`🔄 Language changed: ${detectedLanguage} → ${detectedLang}`);
            setDetectedLanguage(detectedLang);
            
            // Update recognition language and restart
            if (recognitionRef.current && shouldBeListeningRef.current) {
              console.log(`🌍 Updating Speech Recognition to ${detectedLang}...`);
              recognitionRef.current.lang = detectedLang;
              // The recognition will restart automatically via onend handler
            }
          }
          
          setTranscript(prev => {
            const newTranscript = prev + final;
            console.log('📝 Updated transcript to:', newTranscript);
            console.log('📝 Previous was:', prev);
            return newTranscript;
          });
          setInterimTranscript('');
          
          // Reset silence timer when we get final results
          startOrResetSilenceTimer();
        } else if (interim) {
          console.log('⏳ Interim result:', interim);
          setInterimTranscript(interim);
          
          // Reset silence timer on any speech (including interim)
          startOrResetSilenceTimer();
        }
      };
      
      // Handle errors
      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        
        if (event.error === 'no-speech') {
          // No speech detected, but keep listening
          console.log('No speech detected, continuing to listen...');
        } else if (event.error === 'aborted') {
          // Recognition was aborted
          setIsListening(false);
        } else if (event.error === 'network') {
          console.error('Network error in speech recognition');
        }
      };
      
      // Handle end event
      recognition.onend = () => {
        console.log('🔴 Speech recognition ended');
        console.log('   shouldBeListening (ref):', shouldBeListeningRef.current);
        console.log('   isListening (state):', isListening);
        
        // Restart if we're supposed to be listening (check the ref, not state)
        if (shouldBeListeningRef.current && recognitionRef.current) {
          console.log('🔄 Auto-restarting speech recognition...');
          try {
            recognitionRef.current.start();
            setIsListening(true);
            console.log('✅ Successfully restarted speech recognition');
          } catch (error) {
            console.error('❌ Error restarting recognition:', error);
            // If restart fails, try stopping and starting fresh after a delay
            setTimeout(() => {
              if (shouldBeListeningRef.current) {
                try {
                  console.log('🔄 Attempting fresh restart...');
                  recognitionRef.current.start();
                  setIsListening(true);
                  console.log('✅ Fresh restart successful');
                } catch (e) {
                  console.error('❌ Fresh restart also failed:', e);
                  setIsListening(false);
                  shouldBeListeningRef.current = false;
                }
              }
            }, 100);
          }
        } else {
          console.log('⏹️ Not restarting (shouldBeListening:', shouldBeListeningRef.current, ')');
          setIsListening(false);
        }
      };
    } else {
      console.warn('Speech Recognition API not supported in this browser');
      setIsSupported(false);
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      clearSilenceTimer();
      if (resetLanguageHandlerRef.current) {
        window.removeEventListener('resetSpeechLanguage', resetLanguageHandlerRef.current);
      }
    };
  }, []);
  
  // Improved language detection with scoring system
  const detectLanguageFromText = (text) => {
    const lowerText = text.toLowerCase();
    
    // Check for non-Latin character patterns first (these are definitive)
    if (/[\u4e00-\u9fa5]/.test(text)) return 'zh-CN'; // Chinese
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return 'ja-JP'; // Japanese
    if (/[\uac00-\ud7af]/.test(text)) return 'ko-KR'; // Korean
    if (/[\u0600-\u06ff]/.test(text)) return 'ar-SA'; // Arabic
    if (/[\u0400-\u04ff]/.test(text)) return 'ru-RU'; // Russian
    
    // Score-based detection for European languages
    const scores = {
      'fr-FR': 0,
      'es-ES': 0,
      'de-DE': 0,
      'it-IT': 0,
      'pt-PT': 0,
    };
    
    // French indicators (unique words and phrases)
    const frenchWords = [
      // Question words
      'quel', 'quelle', 'quels', 'quelles', 'comment', 'pourquoi', 'quand', 'où',
      // Common phrases
      'est-ce', 'qu\'est-ce', 'c\'est', 'n\'est', 'il y a',
      // Pronouns
      'je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'elles',
      // Common verbs
      'fait', 'suis', 'es', 'est', 'sommes', 'sont', 'ai', 'as', 'avons', 'ont',
      'comprends', 'parle', 'parlez', 'peux', 'peut', 'veux', 'dois',
      // Common words
      'le', 'la', 'les', 'un', 'une', 'de', 'du', 'des', 'à', 'au', 'aux',
      'temps', 'français', 'avec', 'dans', 'pour', 'mais', 'cette', 'très'
    ];
    frenchWords.forEach(word => {
      if (lowerText.includes(word)) scores['fr-FR'] += 2;
    });
    
    // Spanish indicators
    const spanishWords = ['qué', 'cómo', 'dónde', 'cuándo', 'español', 'hablas', 'entiendes', 'yo', 'tú', 'nosotros', 'vosotros', 'ellos', 'ellas', 'está', 'están', 'ser', 'estar'];
    spanishWords.forEach(word => {
      if (lowerText.includes(word)) scores['es-ES'] += 2;
    });
    
    // German indicators
    const germanWords = ['ich', 'du', 'wir', 'ihr', 'sie', 'der', 'die', 'das', 'ein', 'eine', 'und', 'aber', 'nicht', 'auch', 'wie', 'was', 'wo', 'warum', 'deutsch', 'verstehst'];
    germanWords.forEach(word => {
      if (lowerText.includes(word)) scores['de-DE'] += 2;
    });
    
    // Italian indicators
    const italianWords = ['io', 'tu', 'noi', 'voi', 'loro', 'il', 'lo', 'la', 'i', 'gli', 'le', 'e', 'ma', 'non', 'anche', 'come', 'cosa', 'dove', 'quando', 'italiano'];
    italianWords.forEach(word => {
      if (lowerText.includes(word)) scores['it-IT'] += 2;
    });
    
    // Portuguese indicators
    const portugueseWords = ['eu', 'tu', 'nós', 'vós', 'eles', 'elas', 'o', 'a', 'os', 'as', 'e', 'mas', 'não', 'também', 'como', 'o que', 'onde', 'quando', 'português'];
    portugueseWords.forEach(word => {
      if (lowerText.includes(word)) scores['pt-PT'] += 2;
    });
    
    // Find the highest score
    let maxScore = 0;
    let detectedLang = 'en-US';
    
    for (const [lang, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        detectedLang = lang;
      }
    }
    
    // Only switch if we have a confident detection (score >= 8)
    // This prevents false positives while being responsive to actual language switches
    if (maxScore >= 8) {
      console.log(`🌍 Language detected: ${detectedLang} (score: ${maxScore})`);
      return detectedLang;
    }
    
    // Default to English if no confident detection
    console.log(`🌍 Defaulting to English (max score: ${maxScore} - need 8+)`);
    return 'en-US';
  };
  
  // Start or reset the silence timer (2 seconds)
  const startOrResetSilenceTimer = useCallback(() => {
    // Clear any existing timer
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
      console.log('🔄 Resetting silence timer');
    }
    
    // Start a new 2-second timer
    silenceTimerRef.current = setTimeout(() => {
      console.log('⏰ 2 seconds of silence detected!');
      console.log('📝 Current transcript in hook:', transcript);
      console.log('📝 Callback registered?', !!onSilenceCallbackRef.current);
      
      // Always trigger callback if it exists
      if (onSilenceCallbackRef.current) {
        console.log('🚀 Firing silence callback...');
        onSilenceCallbackRef.current();
      } else {
        console.warn('⚠️ No silence callback registered!');
      }
    }, 2000); // Changed from 5000 to 2000 (2 seconds)
    
    console.log('⏱️ Started new 2-second silence timer');
  }, [transcript]);
  
  // Clear the silence timer
  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      console.log('🛑 Clearing silence timer');
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);
  
  // Start listening
  const startListening = useCallback((onSilenceCallback) => {
    if (!isSupported || !recognitionRef.current) {
      console.error('❌ Speech recognition not supported');
      return;
    }
    
    // Store the callback and set the ref
    onSilenceCallbackRef.current = onSilenceCallback;
    shouldBeListeningRef.current = true; // Mark that we should be listening
    console.log('✅ Silence callback registered, shouldBeListening set to true');
    
    try {
      // Don't clear transcript here - let the component manage that
      recognitionRef.current.start();
      setIsListening(true);
      console.log('🎤 Started listening for speech...');
      
      // Start the silence timer immediately
      // This ensures we detect silence even if user doesn't speak immediately
      if (transcript.trim()) {
        console.log('📝 Existing transcript detected, starting silence timer');
        startOrResetSilenceTimer();
      }
    } catch (error) {
      if (error.name === 'InvalidStateError') {
        // Already started, just update state
        setIsListening(true);
        console.log('🎤 Speech recognition already active');
      } else {
        console.error('❌ Error starting speech recognition:', error);
        shouldBeListeningRef.current = false;
      }
    }
  }, [isSupported, transcript, startOrResetSilenceTimer]);
  
  // Stop listening
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      shouldBeListeningRef.current = false; // Mark that we should NOT be listening
      recognitionRef.current.stop();
      setIsListening(false);
      clearSilenceTimer();
      console.log('🛑 Stopped listening, shouldBeListening set to false');
    }
  }, [clearSilenceTimer]);
  
  // Reset transcript
  const resetTranscript = useCallback(() => {
    console.log('🔄 RESETTING TRANSCRIPT');
    console.log('   Before reset - transcript:', transcript, 'interim:', interimTranscript);
    setTranscript('');
    setInterimTranscript('');
    clearSilenceTimer();
    console.log('   After reset - transcript cleared');
  }, [transcript, interimTranscript, clearSilenceTimer]);
  
  // Get full text (final + interim)
  const fullTranscript = transcript + (interimTranscript ? ' ' + interimTranscript : '');
  
  return {
    isListening,
    transcript,
    interimTranscript,
    fullTranscript,
    isSupported,
    detectedLanguage,
    startListening,
    stopListening,
    resetTranscript,
  };
};
