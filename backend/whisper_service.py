#!/usr/bin/env python3
"""
Whisper transcription service for backend
Uses OpenAI's Whisper model - completely free, runs locally
"""

import whisper
import sys
import json
import os
import warnings
import re

# Suppress ALL warnings and progress bars
warnings.filterwarnings('ignore')
os.environ['PYTHONWARNINGS'] = 'ignore'

def _dedupe_repetitions(text: str, max_repeats: int = 2) -> str:
    """
    Remove excessive consecutive sentence repetitions (common Whisper failure mode).
    Keeps up to `max_repeats` of the same sentence in a row.
    """
    # Split on sentence boundaries (., ?, !)
    parts = re.split(r'([\.!?])', text)
    sentences = []
    current = ''
    for i in range(0, len(parts), 2):
        sent = parts[i].strip()
        punct = parts[i + 1] if i + 1 < len(parts) else ''
        if not sent:
          continue
        full = f"{sent}{punct}".strip()
        if sentences and sentences[-1]['text'].lower() == full.lower():
            sentences[-1]['count'] += 1
        else:
            sentences.append({'text': full, 'count': 1})

    cleaned = []
    for entry in sentences:
        repeats = min(entry['count'], max_repeats)
        cleaned.extend([entry['text']] * repeats)
    return ' '.join(cleaned).strip()


def transcribe_audio(audio_path, model_size='tiny', language='en'):
    """
    Transcribe audio file using Whisper
    
    Args:
        audio_path: Path to audio file
        model_size: Model size ('tiny', 'base', 'small', 'medium', 'large')
    
    Returns:
        dict: Transcription result with text
    """
    try:
        # Redirect stderr to devnull to suppress ALL output including progress bars
        sys.stderr = open(os.devnull, 'w')
        
        # Load model (cached after first download)
        model = whisper.load_model(model_size)
        
        # Transcribe with FP32 (CPU compatible) and conservative decoding to reduce repetition
        result = model.transcribe(
            audio_path,
            fp16=False,  # Use FP32 for CPU compatibility
            verbose=None,  # Completely suppress output
            language=language,
            temperature=0,
            best_of=5,
            beam_size=5,
            condition_on_previous_text=False,
            compression_ratio_threshold=2.4,
            logprob_threshold=-1.0,
            no_speech_threshold=0.6
        )
        
        # Restore stderr
        sys.stderr = sys.__stderr__
        
        cleaned_text = _dedupe_repetitions(result['text'].strip(), max_repeats=2)

        return {
            'text': cleaned_text,
            'status': 'success'
        }
    except Exception as e:
        return {
            'text': '',
            'status': 'error',
            'error': str(e)
        }

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No audio file provided'}))
        sys.exit(1)
    
    audio_path = sys.argv[1]
    model_size = sys.argv[2] if len(sys.argv) > 2 else os.getenv('WHISPER_MODEL', 'base.en')
    language = sys.argv[3] if len(sys.argv) > 3 else os.getenv('WHISPER_LANGUAGE', 'en')
    
    if not os.path.exists(audio_path):
        print(json.dumps({'error': f'File not found: {audio_path}'}))
        sys.exit(1)
    
    result = transcribe_audio(audio_path, model_size, language)
    print(json.dumps(result))

