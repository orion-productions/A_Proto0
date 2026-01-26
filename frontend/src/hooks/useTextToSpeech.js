import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook for text-to-speech using Web Speech API
 * Features:
 * - Auto language detection
 * - Voice gender selection
 * - Queue management for multiple messages
 */
export const useTextToSpeech = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [preferredGender, setPreferredGender] = useState('female'); // 'male' or 'female'
  
  const utteranceRef = useRef(null);
  const queueRef = useRef([]);

  // Check browser support and load voices
  useEffect(() => {
    if ('speechSynthesis' in window) {
      setIsSupported(true);
      
      // Load available voices
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        setAvailableVoices(voices);
        console.log(`Loaded ${voices.length} voices for TTS`);
      };
      
      // Voices are loaded asynchronously in some browsers
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
      
      return () => {
        window.speechSynthesis.onvoiceschanged = null;
      };
    } else {
      console.warn('Speech Synthesis API not supported in this browser');
      setIsSupported(false);
    }
  }, []);

  // Detect language from text
  const detectLanguageFromText = (text) => {
    // Check for common character patterns
    if (/[\u4e00-\u9fa5]/.test(text)) return 'zh-CN'; // Chinese
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return 'ja-JP'; // Japanese
    if (/[\uac00-\ud7af]/.test(text)) return 'ko-KR'; // Korean
    if (/[\u0600-\u06ff]/.test(text)) return 'ar-SA'; // Arabic
    if (/[\u0400-\u04ff]/.test(text)) return 'ru-RU'; // Russian
    
    // Check for common language words (case insensitive)
    const lowerText = text.toLowerCase();
    
    // French detection
    const frenchWords = ['le', 'la', 'les', 'un', 'une', 'de', 'et', 'est', 'dans', 'pour', 'avec', 'je', 'tu', 'il', 'elle', 'nous', 'vous', 'mais', 'pas', 'ce', 'qui', 'que'];
    const frenchCount = frenchWords.filter(word => new RegExp(`\\b${word}\\b`, 'i').test(lowerText)).length;
    
    // Spanish detection
    const spanishWords = ['el', 'la', 'los', 'las', 'un', 'una', 'de', 'y', 'es', 'en', 'por', 'con', 'yo', 'tú', 'él', 'ella', 'nosotros', 'pero', 'no', 'ese', 'este'];
    const spanishCount = spanishWords.filter(word => new RegExp(`\\b${word}\\b`, 'i').test(lowerText)).length;
    
    // German detection
    const germanWords = ['der', 'die', 'das', 'ein', 'eine', 'und', 'ist', 'in', 'von', 'mit', 'ich', 'du', 'er', 'sie', 'wir', 'aber', 'nicht'];
    const germanCount = germanWords.filter(word => new RegExp(`\\b${word}\\b`, 'i').test(lowerText)).length;
    
    // Italian detection
    const italianWords = ['il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'una', 'di', 'e', 'è', 'in', 'per', 'con', 'io', 'tu', 'lui', 'lei', 'noi', 'ma', 'non'];
    const italianCount = italianWords.filter(word => new RegExp(`\\b${word}\\b`, 'i').test(lowerText)).length;
    
    // Portuguese detection
    const portugueseWords = ['o', 'a', 'os', 'as', 'um', 'uma', 'de', 'e', 'é', 'em', 'por', 'com', 'eu', 'tu', 'ele', 'ela', 'nós', 'mas', 'não'];
    const portugueseCount = portugueseWords.filter(word => new RegExp(`\\b${word}\\b`, 'i').test(lowerText)).length;
    
    // Find the language with the most matches
    const counts = [
      { lang: 'fr-FR', count: frenchCount },
      { lang: 'es-ES', count: spanishCount },
      { lang: 'de-DE', count: germanCount },
      { lang: 'it-IT', count: italianCount },
      { lang: 'pt-PT', count: portugueseCount },
    ];
    
    const maxCount = Math.max(...counts.map(c => c.count));
    if (maxCount >= 3) {
      const detectedLang = counts.find(c => c.count === maxCount);
      return detectedLang.lang;
    }
    
    // Default to English
    return 'en-US';
  };
  
  // Select the best voice for the given language and gender preference
  const selectVoice = (language, gender = preferredGender) => {
    if (availableVoices.length === 0) return null;
    
    // Extract language code (e.g., 'en' from 'en-US')
    const langCode = language.split('-')[0];
    
    // Filter voices by language
    let matchingVoices = availableVoices.filter(voice => 
      voice.lang.startsWith(langCode) || voice.lang.startsWith(language)
    );
    
    if (matchingVoices.length === 0) {
      // Fallback to English or first available
      matchingVoices = availableVoices.filter(voice => voice.lang.startsWith('en'));
      if (matchingVoices.length === 0) {
        matchingVoices = availableVoices;
      }
    }
    
    // Try to match gender based on voice name patterns
    const genderKeywords = gender === 'female' 
      ? ['female', 'woman', 'samantha', 'victoria', 'karen', 'moira', 'tessa', 'fiona', 'zira']
      : ['male', 'man', 'daniel', 'thomas', 'david', 'james', 'mark', 'george'];
    
    const genderMatch = matchingVoices.find(voice => 
      genderKeywords.some(keyword => voice.name.toLowerCase().includes(keyword))
    );
    
    if (genderMatch) return genderMatch;
    
    // Fallback to first matching voice for the language
    return matchingVoices[0] || availableVoices[0];
  };
  
  // Speak the given text
  const speak = useCallback((text, options = {}) => {
    if (!isSupported || !text.trim()) {
      console.warn('TTS not supported or empty text');
      return;
    }
    
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    // Detect language from text
    const detectedLanguage = options.language || detectLanguageFromText(text);
    console.log(`Detected language: ${detectedLanguage} for text: "${text.substring(0, 50)}..."`);
    
    // Create utterance
    const utterance = new SpeechSynthesisUtterance(text);
    utteranceRef.current = utterance;
    
    // Set language
    utterance.lang = detectedLanguage;
    
    // Select voice
    const voice = selectVoice(detectedLanguage, options.gender || preferredGender);
    if (voice) {
      utterance.voice = voice;
      console.log(`Selected voice: ${voice.name} (${voice.lang})`);
    }
    
    // Set speech parameters
    utterance.rate = options.rate || 1.0; // Speed (0.1 to 10)
    utterance.pitch = options.pitch || 1.0; // Pitch (0 to 2)
    utterance.volume = options.volume || 1.0; // Volume (0 to 1)
    
    // Event handlers
    utterance.onstart = () => {
      setIsSpeaking(true);
      console.log('Started speaking');
    };
    
    utterance.onend = () => {
      setIsSpeaking(false);
      utteranceRef.current = null;
      console.log('Finished speaking');
      
      // Process queue if there are more items
      if (queueRef.current.length > 0) {
        const nextItem = queueRef.current.shift();
        speak(nextItem.text, nextItem.options);
      }
    };
    
    utterance.onerror = (event) => {
      console.error('TTS error:', event.error);
      setIsSpeaking(false);
      utteranceRef.current = null;
    };
    
    // Speak
    try {
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.error('Error starting speech:', error);
      setIsSpeaking(false);
    }
  }, [isSupported, availableVoices, preferredGender]);
  
  // Add to queue (useful for multiple messages)
  const speakQueued = useCallback((text, options = {}) => {
    if (isSpeaking) {
      queueRef.current.push({ text, options });
      console.log(`Added to TTS queue (queue size: ${queueRef.current.length})`);
    } else {
      speak(text, options);
    }
  }, [isSpeaking, speak]);
  
  // Stop speaking
  const stop = useCallback(() => {
    if (isSupported) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      utteranceRef.current = null;
      queueRef.current = [];
      console.log('Stopped speaking and cleared queue');
    }
  }, [isSupported]);
  
  // Pause speaking
  const pause = useCallback(() => {
    if (isSupported && isSpeaking) {
      window.speechSynthesis.pause();
      console.log('Paused speaking');
    }
  }, [isSupported, isSpeaking]);
  
  // Resume speaking
  const resume = useCallback(() => {
    if (isSupported) {
      window.speechSynthesis.resume();
      console.log('Resumed speaking');
    }
  }, [isSupported]);
  
  return {
    isSpeaking,
    isSupported,
    availableVoices,
    preferredGender,
    setPreferredGender,
    speak,
    speakQueued,
    stop,
    pause,
    resume,
  };
};
