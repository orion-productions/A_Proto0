import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { cwd } from 'process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get database instance - use the same path as server.js (root directory)
// server.js uses 'chats.db' which resolves to the project root
const dbPath = join(cwd(), 'chats.db');
const db = new Database(dbPath);

const getTranscriptByFileName = (fileName) => {
  if (!fileName) return { error: 'fileName is required' };
  try {
    const transcript = db.prepare(`
      SELECT * FROM transcripts 
      WHERE audio_file_name = ? OR title = ? 
      ORDER BY created_at DESC LIMIT 1
    `).get(fileName, fileName);
    if (!transcript) return { error: `Transcript with file name "${fileName}" not found` };
    return {
      id: transcript.id,
      title: transcript.title,
      transcript_text: transcript.transcript_text,
      audio_file_name: transcript.audio_file_name,
      duration: transcript.duration,
      created_at: transcript.created_at,
      updated_at: transcript.updated_at,
    };
  } catch (error) {
    return { error: error.message };
  }
};

const splitSentences = (text) => {
  if (!text) return [];
  // Split on . ! ? plus common full-width punctuation, keep simple
  return text
    .split(/(?<=[\.!\?。！？])\s+/)
    .map(s => s.trim())
    .filter(Boolean);
};

const normalize = (s) => s?.toLowerCase() || '';

const findSentencesInLatest = (keyword) => {
  if (!keyword || !keyword.trim()) return { error: 'keyword is required' };
  const latest = getLatestTranscript();
  if (latest.error) return latest;
  const sentences = splitSentences(latest.transcript_text);
  const kw = normalize(keyword);
  const matched = sentences.filter(s => normalize(s).includes(kw));
  return {
    transcriptId: latest.id,
    title: latest.title,
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

// Get all transcripts
const getTranscripts = () => {
  try {
    const transcripts = db.prepare('SELECT * FROM transcripts ORDER BY created_at DESC').all();
    return {
      transcripts: transcripts.map(t => ({
        id: t.id,
        title: t.title,
        preview: t.transcript_text.substring(0, 100) + (t.transcript_text.length > 100 ? '...' : ''),
        created_at: t.created_at,
        updated_at: t.updated_at,
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
    const transcript = db.prepare('SELECT * FROM transcripts WHERE id = ?').get(transcriptId);
    if (!transcript) {
      return { error: 'Transcript not found' };
    }
    return {
      id: transcript.id,
      title: transcript.title,
      transcript_text: transcript.transcript_text,
      audio_file_name: transcript.audio_file_name,
      duration: transcript.duration,
      created_at: transcript.created_at,
      updated_at: transcript.updated_at,
    };
  } catch (error) {
    return { error: error.message };
  }
};

// Search transcripts by content
const searchTranscripts = (query) => {
  try {
    const transcripts = db.prepare(`
      SELECT * FROM transcripts 
      WHERE transcript_text LIKE ? 
      ORDER BY created_at DESC
    `).all(`%${query}%`);
    
    return {
      query,
      transcripts: transcripts.map(t => ({
        id: t.id,
        title: t.title,
        transcript_text: t.transcript_text,
        created_at: t.created_at,
        matches: (t.transcript_text.match(new RegExp(query, 'gi')) || []).length,
      })),
      total: transcripts.length,
    };
  } catch (error) {
    return { error: error.message };
  }
};

// Get latest transcript
const getLatestTranscript = () => {
  try {
    const transcript = db.prepare('SELECT * FROM transcripts ORDER BY created_at DESC LIMIT 1').get();
    if (!transcript) {
      return { error: 'No transcripts found' };
    }
    return {
      id: transcript.id,
      title: transcript.title,
      transcript_text: transcript.transcript_text,
      audio_file_name: transcript.audio_file_name,
      created_at: transcript.created_at,
    };
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
  summarizeKeywordInLatest,
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

