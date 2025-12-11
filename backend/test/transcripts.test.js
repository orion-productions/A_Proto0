import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create a test database
const testDbPath = join(__dirname, 'test-transcripts.db');

describe('Transcript MCP Tools', () => {
  let db;
  let transcripts;

  before(() => {
    // Create test database
    db = new Database(testDbPath);
    
    // Create table
    db.exec(`
      CREATE TABLE IF NOT EXISTS transcripts (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        transcript_text TEXT NOT NULL,
        audio_file_name TEXT,
        duration REAL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    // Insert test data
    const now = Date.now();
    db.prepare(`
      INSERT INTO transcripts (id, title, transcript_text, audio_file_name, duration, created_at, updated_at)
      VALUES 
        ('test-1', 'Test Transcript 1', 'This is a test transcript about robots and AI.', 'recording1.webm', 10.5, ?, ?),
        ('test-2', 'Test Transcript 2', 'Discussion about machine learning and neural networks.', 'recording2.webm', 15.2, ?, ?),
        ('test-3', 'Test Transcript 3', 'Meeting notes about project timeline and deadlines.', 'recording3.webm', 8.0, ?, ?)
    `).run(now - 3000, now - 3000, now - 2000, now - 2000, now - 1000, now - 1000);

    // Import transcript tools (modify path to use test DB)
    transcripts = {
      getTranscripts: () => {
        try {
          const results = db.prepare('SELECT * FROM transcripts ORDER BY created_at DESC').all();
          return {
            transcripts: results.map(t => ({
              id: t.id,
              title: t.title,
              preview: t.transcript_text.substring(0, 100) + (t.transcript_text.length > 100 ? '...' : ''),
              created_at: t.created_at,
              updated_at: t.updated_at,
            })),
            total: results.length,
          };
        } catch (error) {
          return { error: error.message };
        }
      },

      getTranscript: (transcriptId) => {
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
      },

      searchTranscripts: (query) => {
        try {
          const results = db.prepare(`
            SELECT * FROM transcripts 
            WHERE transcript_text LIKE ? 
            ORDER BY created_at DESC
          `).all(`%${query}%`);
          
          return {
            query,
            transcripts: results.map(t => ({
              id: t.id,
              title: t.title,
              transcript_text: t.transcript_text,
              created_at: t.created_at,
              matches: (t.transcript_text.match(new RegExp(query, 'gi')) || []).length,
            })),
            total: results.length,
          };
        } catch (error) {
          return { error: error.message };
        }
      },

      getLatestTranscript: () => {
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
            duration: transcript.duration,
            created_at: transcript.created_at,
          };
        } catch (error) {
          return { error: error.message };
        }
      },
    };
  });

  after(() => {
    db.close();
    fs.unlinkSync(testDbPath);
  });

  it('should get all transcripts', () => {
    const result = transcripts.getTranscripts();
    assert.strictEqual(result.total, 3);
    assert.strictEqual(result.transcripts.length, 3);
    assert.strictEqual(result.transcripts[0].id, 'test-3'); // Latest first
  });

  it('should get a specific transcript by ID', () => {
    const result = transcripts.getTranscript('test-1');
    assert.strictEqual(result.id, 'test-1');
    assert.strictEqual(result.title, 'Test Transcript 1');
    assert.strictEqual(result.transcript_text, 'This is a test transcript about robots and AI.');
    assert.strictEqual(result.duration, 10.5);
  });

  it('should return error for non-existent transcript', () => {
    const result = transcripts.getTranscript('non-existent');
    assert.ok(result.error);
    assert.strictEqual(result.error, 'Transcript not found');
  });

  it('should search transcripts by keyword', () => {
    const result = transcripts.searchTranscripts('robots');
    assert.strictEqual(result.total, 1);
    assert.strictEqual(result.transcripts[0].id, 'test-1');
    assert.strictEqual(result.transcripts[0].matches, 1);
  });

  it('should search transcripts case-insensitively', () => {
    const result = transcripts.searchTranscripts('MACHINE LEARNING');
    assert.strictEqual(result.total, 1);
    assert.strictEqual(result.transcripts[0].id, 'test-2');
  });

  it('should return empty results for no matches', () => {
    const result = transcripts.searchTranscripts('nonexistent keyword');
    assert.strictEqual(result.total, 0);
    assert.strictEqual(result.transcripts.length, 0);
  });

  it('should get the latest transcript', () => {
    const result = transcripts.getLatestTranscript();
    assert.strictEqual(result.id, 'test-3'); // Most recent
    assert.strictEqual(result.title, 'Test Transcript 3');
    assert.strictEqual(result.duration, 8.0);
  });

  it('should include all required fields in transcript', () => {
    const result = transcripts.getTranscript('test-2');
    assert.ok(result.id);
    assert.ok(result.title);
    assert.ok(result.transcript_text);
    assert.ok(result.audio_file_name);
    assert.strictEqual(typeof result.duration, 'number');
    assert.strictEqual(typeof result.created_at, 'number');
    assert.strictEqual(typeof result.updated_at, 'number');
  });
});

