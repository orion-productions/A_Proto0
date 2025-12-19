import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, parse, resolve } from 'path';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Store transcripts relative to backend directory, regardless of process cwd
const transcriptsDir = process.env.TRANSCRIPTS_DIR
  ? resolve(process.env.TRANSCRIPTS_DIR)
  : join(__dirname, '..', 'transcripts');
if (!fs.existsSync(transcriptsDir)) {
  fs.mkdirSync(transcriptsDir, { recursive: true });
}

const sanitizeBase = (name = '') => name.trim()
  .replace(/\s+/g, '_')
  .replace(/[^a-zA-Z0-9_\-\.]/g, '_')
  .slice(0, 120) || 'transcript';

const readTranscriptFile = (filePath) => {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    try {
      return JSON.parse(raw);
    } catch (parseErr) {
      // Fallback: treat as plain text transcript
      const stat = fs.statSync(filePath);
      const base = parse(filePath).name;
      return {
        id: base,
        title: base,
        transcript_text: raw,
        audio_file_name: null,
        duration: null,
        created_at: stat.birthtimeMs || stat.ctimeMs || Date.now(),
        updated_at: stat.mtimeMs || stat.ctimeMs || Date.now(),
        file_name: parse(filePath).base,
        file_size: stat.size,
      };
    }
  } catch (err) {
    return { error: `Failed to read transcript file ${filePath}: ${err.message}` };
  }
};

const listTranscriptFiles = () => fs.readdirSync(transcriptsDir)
  .filter(f => f.toLowerCase().endsWith('.json'))
  .map(f => join(transcriptsDir, f));

const loadAllTranscripts = () => {
  const files = listTranscriptFiles();
  const records = [];
  for (const filePath of files) {
    const data = readTranscriptFile(filePath);
    if (data && !data.error) {
      records.push({ ...data, _filePath: filePath });
    }
  }
  // Sort latest first
  records.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
  return records;
};

const saveTranscript = ({ title, transcript_text, audio_file_name, duration }) => {
  if (!transcript_text || typeof transcript_text !== 'string' || !transcript_text.trim()) {
    return { error: 'transcript_text is required' };
  }

  const id = uuidv4();
  const timestamp = Date.now();
  const baseSource = audio_file_name ? parse(audio_file_name).name : (title || `transcript-${id}`);
  const base = sanitizeBase(baseSource);

  let fileName = `${base}.transcript.json`;
  let filePath = join(transcriptsDir, fileName);

  // Avoid overwriting an existing different transcript
  if (fs.existsSync(filePath)) {
    fileName = `${base}-${id}.transcript.json`;
    filePath = join(transcriptsDir, fileName);
  }

  const record = {
    id,
    title: title || baseSource || 'Untitled Transcript',
    transcript_text,
    audio_file_name: audio_file_name || null,
    duration: duration || null,
    created_at: timestamp,
    updated_at: timestamp,
    file_name: fileName,
  };

  fs.writeFileSync(filePath, JSON.stringify(record, null, 2), 'utf8');
  return record;
};

const deleteTranscript = (transcriptId) => {
  const all = loadAllTranscripts();
  const target = all.find(t => t.id === transcriptId);
  if (!target) return { error: 'Transcript not found' };
  try {
    fs.unlinkSync(target._filePath);
    return { success: true };
  } catch (err) {
    return { error: err.message };
  }
};

const getTranscriptByFileName = (fileName) => {
  if (!fileName) return { error: 'fileName is required' };
  const needle = fileName.toLowerCase();
  const withoutExt = parse(fileName).name.toLowerCase();
  const all = loadAllTranscripts();
  const match = all.find(t => {
    const audio = (t.audio_file_name || '').toLowerCase();
    const title = (t.title || '').toLowerCase();
    const baseAudio = parse(t.audio_file_name || '').name.toLowerCase();
    const tFile = (t.file_name || '').toLowerCase();
    const tFileBase = parse(t.file_name || '').name.toLowerCase();
    return (
      audio === needle ||
      title === needle ||
      baseAudio === needle ||
      tFile === needle ||
      tFileBase === needle ||
      baseAudio === withoutExt ||
      tFileBase === withoutExt
    );
  });
  if (!match) {
    // Direct path attempts
    const directPath = join(transcriptsDir, fileName);
    if (fs.existsSync(directPath)) {
      const data = readTranscriptFile(directPath);
      if (!data.error) return data;
    }
    // Lowercase path attempt
    const lcPath = join(transcriptsDir, fileName.toLowerCase());
    if (fs.existsSync(lcPath)) {
      const data = readTranscriptFile(lcPath);
      if (!data.error) return data;
    }
    const direct = tryReadByName(needle) || tryReadByName(withoutExt);
    if (direct) return direct;

    // Suggestions
    const files = listTranscriptFiles().map(f => parse(f).base);
    const suggestions = files
      .filter(f => f.toLowerCase().includes(needle) || f.toLowerCase().includes(withoutExt))
      .slice(0, 5);

    return {
      error: `Transcript with file name "${fileName}" not found`,
      suggestions
    };
  }
  const { _filePath, ...rest } = match;
  return rest;
};

// Helper: attempt direct file read by name from transcriptsDir
const tryReadByName = (name) => {
  const candidates = [
    name,
    `${name}.json`,
    `${name}.transcript.json`,
    parse(name).ext ? name : `${name}.transcript.json`
  ];
  for (const cand of candidates) {
    const full = join(transcriptsDir, cand);
    if (fs.existsSync(full)) {
      const data = readTranscriptFile(full);
      if (!data.error) return data;
    }
  }
  // Fallback: scan directory for case-insensitive endsWith match
  const files = listTranscriptFiles();
  const lowerNeedle = name.toLowerCase();
  for (const f of files) {
    const base = f.toLowerCase();
    const baseName = parse(f).name.toLowerCase();
    if (base.endsWith(lowerNeedle) || baseName === lowerNeedle || base.includes(lowerNeedle) || baseName.includes(lowerNeedle)) {
      const data = readTranscriptFile(f);
      if (!data.error) return data;
    }
  }
  return null;
};

const splitSentences = (text) => {
  if (!text) return [];
  // Split on . ! ? plus common full-width punctuation, keep simple
  // Also handle cases where punctuation might be followed by quotes or other characters
  return text
    .split(/(?<=[\.!\?。！？])\s+/)
    .map(s => s.trim())
    .filter(Boolean);
};

const normalize = (s) => s?.toLowerCase() || '';

// Find sentences containing keyword (word-boundary aware)
const findSentencesWithKeyword = (text, keyword) => {
  if (!text || !keyword) return [];
  const sentences = splitSentences(text);
  const kw = normalize(keyword.trim());
  // Use word boundary regex to match whole words only
  const wordBoundaryRegex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  return sentences.filter(s => wordBoundaryRegex.test(s));
};

const findSentencesInLatest = (keyword) => {
  if (!keyword || !keyword.trim()) return { error: 'keyword is required' };
  const latest = getLatestTranscript();
  if (latest.error) return latest;
  const matched = findSentencesWithKeyword(latest.transcript_text, keyword);
  return {
    transcriptId: latest.id,
    title: latest.title,
    keyword,
    sentences: matched,
    count: matched.length,
  };
};

const findSentencesInTranscript = (fileName, keyword) => {
  if (!keyword || !keyword.trim()) return { error: 'keyword is required' };
  const transcript = getTranscriptByFileName(fileName);
  if (transcript.error) return transcript;
  const matched = findSentencesWithKeyword(transcript.transcript_text, keyword);
  return {
    transcriptId: transcript.id,
    title: transcript.title,
    keyword,
    sentences: matched,
    count: matched.length,
  };
};

const summarizeKeywordInLatest = (keyword) => {
  const result = findSentencesInLatest(keyword);
  if (result.error) return result;
  if (!result.count) {
    return { keyword, summary: `No mentions of "${keyword}" in the latest transcript.`, sentences: [] };
  }
  // Simple extractive summary: return unique matched sentences (max 5)
  const unique = Array.from(new Set(result.sentences));
  const summary = unique.slice(0, 5).join(' ');
  return {
    transcriptId: result.transcriptId,
    title: result.title,
    keyword,
    summary,
    sentences: unique,
    count: result.count,
  };
};

const summarizeKeywordInTranscript = (fileName, keyword) => {
  const result = findSentencesInTranscript(fileName, keyword);
  if (result.error) return result;
  if (!result.count) {
    return { keyword, summary: `No mentions of "${keyword}" in the transcript "${fileName}".`, sentences: [] };
  }
  // Simple extractive summary: return unique matched sentences (max 5)
  const unique = Array.from(new Set(result.sentences));
  const summary = unique.slice(0, 5).join(' ');
  return {
    transcriptId: result.transcriptId,
    title: result.title,
    keyword,
    summary,
    sentences: unique,
    count: result.count,
  };
};

// Get all transcripts
const getTranscripts = () => {
  try {
    const transcripts = loadAllTranscripts();
    return {
      transcripts: transcripts.map(t => ({
        id: t.id,
        title: t.title,
        preview: t.transcript_text.substring(0, 100) + (t.transcript_text.length > 100 ? '...' : ''),
        created_at: t.created_at,
        updated_at: t.updated_at,
        audio_file_name: t.audio_file_name,
        file_name: t.file_name,
      })),
      total: transcripts.length,
    };
  } catch (error) {
    return { error: error.message };
  }
};

// Get a specific transcript
const getTranscript = (transcriptId) => {
  try {
    const transcripts = loadAllTranscripts();
    const transcript = transcripts.find(t => t.id === transcriptId);
    if (!transcript) {
      return { error: 'Transcript not found' };
    }
    const { _filePath, ...rest } = transcript;
    return rest;
  } catch (error) {
    return { error: error.message };
  }
};

// Search transcripts by content
const searchTranscripts = (query) => {
  try {
    const transcripts = loadAllTranscripts();
    const lower = query.toLowerCase();
    const results = transcripts
      .filter(t => (t.transcript_text || '').toLowerCase().includes(lower))
      .map(t => ({
        id: t.id,
        title: t.title,
        transcript_text: t.transcript_text,
        created_at: t.created_at,
        matches: (t.transcript_text.match(new RegExp(query, 'gi')) || []).length,
      }));
    
    return {
      query,
      transcripts: results,
      total: results.length,
    };
  } catch (error) {
    return { error: error.message };
  }
};

// Get latest transcript
const getLatestTranscript = () => {
  try {
    const transcripts = loadAllTranscripts();
    if (!transcripts.length) {
      return { error: 'No transcripts found' };
    }
    const latest = transcripts[0];
    const { _filePath, ...rest } = latest;
    return rest;
  } catch (error) {
    return { error: error.message };
  }
};

export default {
  getTranscripts,
  getTranscript,
  searchTranscripts,
  getLatestTranscript,
  getTranscriptByFileName,
  findSentencesInLatest,
  findSentencesInTranscript,
  summarizeKeywordInLatest,
  summarizeKeywordInTranscript,
  saveTranscript,
  deleteTranscript,
  definition: [
      {
        type: 'function',
        function: {
          name: 'get_transcripts',
          description: 'Get list of all saved meeting transcripts and recordings. Use this to see what transcripts are available.',
          parameters: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_transcript',
          description: 'Display the full content of a specific transcript by its ID. ONLY use this when you already have a transcriptId from get_transcripts. If the user asks about "the transcript" without specifying an ID, use get_latest_transcript instead.',
          parameters: {
            type: 'object',
            properties: {
              transcriptId: {
                type: 'string',
                description: 'The transcript ID (required - must be obtained from get_transcripts first)',
              },
              fileName: {
                type: 'string',
                description: 'Optional: transcript file name (audio file name or title) to resolve the transcript',
              },
              currentTranscript: {
                type: 'boolean',
                description: 'If true, use the latest transcript',
              },
            },
            required: [],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'search_transcripts',
          description: 'Search transcripts by text content to find specific words or topics. Use this to find transcripts containing certain keywords or topics.',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query to find in transcript text (e.g., "meeting", "project", "deadline")',
              },
            },
            required: ['query'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_latest_transcript',
          description: 'Get and display the most recently created transcript. ALWAYS use this when user asks about "the transcript", "the transcript file", "what is in the transcript", "display the transcript", or any question about transcripts without specifying a particular transcript ID. This will retrieve the latest saved transcript automatically.',
          parameters: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'find_sentences_in_latest_transcript',
          description: 'Return all sentences from the latest transcript that contain the given keyword (case-insensitive). Use this to answer "give me the sentences where the word X appears".',
          parameters: {
            type: 'object',
            properties: {
              keyword: {
                type: 'string',
                description: 'Keyword to search for in sentences (e.g., "heart", "sound")',
              },
            },
            required: ['keyword'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'summarize_keyword_in_latest_transcript',
          description: 'Summarize what is said about a keyword in the latest transcript by returning the matched sentences and a short extractive summary. Use this for questions like "does this transcript mention X?" or "what do they say about X?".',
          parameters: {
            type: 'object',
            properties: {
              keyword: {
                type: 'string',
                description: 'Keyword to summarize (e.g., "heart", "sound")',
              },
            },
            required: ['keyword'],
          },
        },
      },
  ],
};

