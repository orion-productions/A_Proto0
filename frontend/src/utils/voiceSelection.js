// Voice selection utility for text-to-speech
// Maps language codes to available voices based on gender preference

/**
 * Get the best available voice for a given language and gender preference
 * @param {string} lang - Language code (en, es, fr, de, it, pt, zh, ja)
 * @param {string} gender - 'feminine' or 'masculine'
 * @returns {SpeechSynthesisVoice|null} - The selected voice or null if not found
 */
export function getVoiceForLanguage(lang, gender) {
  if (!('speechSynthesis' in window)) {
    return null;
  }

  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) {
    return null;
  }

  // Voice preferences by language and gender
  // These are common voice names across different browsers/OS
  const voicePreferences = {
    en: {
      feminine: [
        'Google UK English Female',
        'Microsoft Zira - English (United States)',
        'Samantha', // macOS
        'Karen', // macOS
        'Victoria', // macOS
        'en-US-Standard-E', // Google Cloud (if available)
        'en-GB-Standard-A', // Google Cloud
        'English Female',
        'en-US',
      ],
      masculine: [
        'Google UK English Male',
        'Microsoft David - English (United States)',
        'Alex', // macOS
        'Daniel', // macOS
        'Tom', // macOS
        'en-US-Standard-D', // Google Cloud
        'en-GB-Standard-B', // Google Cloud
        'English Male',
        'en-US',
      ],
    },
    es: {
      feminine: [
        'Google español Female',
        'Microsoft Sabina - Spanish (Spain)',
        'Monica', // macOS
        'Paulina', // macOS
        'es-ES-Standard-A', // Google Cloud
        'es-MX-Standard-A', // Google Cloud
        'Spanish Female',
        'es-ES',
        'es-MX',
      ],
      masculine: [
        'Google español Male',
        'Microsoft Pablo - Spanish (Spain)',
        'Diego', // macOS
        'Jorge', // macOS
        'es-ES-Standard-B', // Google Cloud
        'es-MX-Standard-B', // Google Cloud
        'Spanish Male',
        'es-ES',
        'es-MX',
      ],
    },
    fr: {
      feminine: [
        'Google français Female',
        'Microsoft Hortense - French (France)',
        'Amélie', // macOS
        'Aurelie', // macOS
        'fr-FR-Standard-A', // Google Cloud
        'fr-CA-Standard-A', // Google Cloud
        'French Female',
        'fr-FR',
        'fr-CA',
      ],
      masculine: [
        'Google français Male',
        'Microsoft Paul - French (France)',
        'Thomas', // macOS
        'Nicolas', // macOS
        'fr-FR-Standard-B', // Google Cloud
        'fr-CA-Standard-B', // Google Cloud
        'French Male',
        'fr-FR',
        'fr-CA',
      ],
    },
    de: {
      feminine: [
        'Google Deutsch Female',
        'Microsoft Katja - German (Germany)',
        'Anna', // macOS
        'de-DE-Standard-A', // Google Cloud
        'German Female',
        'de-DE',
      ],
      masculine: [
        'Google Deutsch Male',
        'Microsoft Stefan - German (Germany)',
        'Markus', // macOS
        'de-DE-Standard-B', // Google Cloud
        'German Male',
        'de-DE',
      ],
    },
    it: {
      feminine: [
        'Google italiano Female',
        'Microsoft Elsa - Italian (Italy)',
        'Alice', // macOS
        'it-IT-Standard-A', // Google Cloud
        'Italian Female',
        'it-IT',
      ],
      masculine: [
        'Google italiano Male',
        'Microsoft Cosimo - Italian (Italy)',
        'Luca', // macOS
        'it-IT-Standard-B', // Google Cloud
        'Italian Male',
        'it-IT',
      ],
    },
    pt: {
      feminine: [
        'Google português Female',
        'Microsoft Heloisa - Portuguese (Brazil)',
        'Luciana', // macOS
        'pt-BR-Standard-A', // Google Cloud
        'pt-PT-Standard-A', // Google Cloud
        'Portuguese Female',
        'pt-BR',
        'pt-PT',
      ],
      masculine: [
        'Google português Male',
        'Microsoft Daniel - Portuguese (Brazil)',
        'João', // macOS
        'pt-BR-Standard-B', // Google Cloud
        'pt-PT-Standard-B', // Google Cloud
        'Portuguese Male',
        'pt-BR',
        'pt-PT',
      ],
    },
    zh: {
      feminine: [
        'Google 普通话 Female',
        'Microsoft Yaoyao - Chinese (Simplified, PRC)',
        'Ting-Ting', // macOS
        'Sin-Ji', // macOS
        'zh-CN-Standard-A', // Google Cloud
        'zh-TW-Standard-A', // Google Cloud
        'Chinese Female',
        'zh-CN',
        'zh-TW',
      ],
      masculine: [
        'Google 普通话 Male',
        'Microsoft Kangkang - Chinese (Simplified, PRC)',
        'Yu-shu', // macOS
        'zh-CN-Standard-B', // Google Cloud
        'zh-TW-Standard-B', // Google Cloud
        'Chinese Male',
        'zh-CN',
        'zh-TW',
      ],
    },
    ja: {
      feminine: [
        'Google 日本語 Female',
        'Microsoft Nanami - Japanese (Japan)',
        'Kyoko', // macOS
        'Otoya', // macOS (some versions)
        'ja-JP-Standard-A', // Google Cloud
        'Japanese Female',
        'ja-JP',
      ],
      masculine: [
        'Google 日本語 Male',
        'Microsoft Ichiro - Japanese (Japan)',
        'Otoya', // macOS
        'ja-JP-Standard-B', // Google Cloud
        'Japanese Male',
        'ja-JP',
      ],
    },
  };

  const preferences = voicePreferences[lang];
  if (!preferences) {
    // Fallback: try to find any voice matching the language
    const langVoices = voices.filter(v => v.lang.startsWith(lang));
    return langVoices.length > 0 ? langVoices[0] : voices[0];
  }

  const genderPreferences = preferences[gender] || preferences.feminine;
  
  // Try to find a voice matching the preferences
  for (const preference of genderPreferences) {
    const voice = voices.find(v => 
      v.name.toLowerCase().includes(preference.toLowerCase()) ||
      v.lang.toLowerCase().includes(preference.toLowerCase())
    );
    if (voice) {
      return voice;
    }
  }

  // Fallback: find any voice in the language
  const langVoices = voices.filter(v => v.lang.startsWith(lang));
  if (langVoices.length > 0) {
    // If we have gender preference, try to find a voice that matches
    if (gender === 'feminine') {
      const feminineVoice = langVoices.find(v => 
        v.name.toLowerCase().includes('female') ||
        v.name.toLowerCase().includes('woman') ||
        v.name.toLowerCase().includes('samantha') ||
        v.name.toLowerCase().includes('zira') ||
        v.name.toLowerCase().includes('helen')
      );
      if (feminineVoice) return feminineVoice;
    } else {
      const masculineVoice = langVoices.find(v => 
        v.name.toLowerCase().includes('male') ||
        v.name.toLowerCase().includes('man') ||
        v.name.toLowerCase().includes('david') ||
        v.name.toLowerCase().includes('mark')
      );
      if (masculineVoice) return masculineVoice;
    }
    return langVoices[0];
  }

  // Last resort: return first available voice
  return voices[0];
}

/**
 * Wait for voices to be loaded (they load asynchronously)
 * @returns {Promise<SpeechSynthesisVoice[]>}
 */
export function waitForVoices() {
  return new Promise((resolve) => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      resolve(voices);
      return;
    }

    // Wait for voiceschanged event
    const onVoicesChanged = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
      resolve(window.speechSynthesis.getVoices());
    };
    window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
    
    // Timeout after 1 second
    setTimeout(() => {
      window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
      resolve(window.speechSynthesis.getVoices());
    }, 1000);
  });
}

