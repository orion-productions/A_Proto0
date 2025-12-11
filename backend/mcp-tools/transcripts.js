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
            },
            required: ['transcriptId'],
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
  ],
};

