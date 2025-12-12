import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import os from 'os';
import { join } from 'path';
// Ensure we don't touch real transcripts; use temp dir
const tmpRoot = fs.mkdtempSync(join(os.tmpdir(), 'transcripts-test-'));
process.env.TRANSCRIPTS_DIR = tmpRoot;

describe('Transcript file lookups (filesystem)', () => {
  let transcripts;

  before(async () => {
    transcripts = (await import('../mcp-tools/transcripts.js')).default;

    // Create sample transcript files (JSON and plain text)
    const samples = [
      {
        name: 'short-name.transcript.json',
        data: {
          id: 't1',
          title: 'short-name.transcript.json',
          transcript_text: 'hello world',
          audio_file_name: 'short-name.webm',
          created_at: Date.now(),
          updated_at: Date.now(),
          file_name: 'short-name.transcript.json'
        }
      },
      {
        name: 'very_long_filename_with_many_parts_how_are_horses_helping_to_heal_humans_download.transcript.json',
        data: {
          id: 't2',
          title: 'very_long_filename_with_many_parts_how_are_horses_helping_to_heal_humans_download.transcript.json',
          transcript_text: 'long content',
          audio_file_name: 'very_long_filename_with_many_parts_how_are_horses_helping_to_heal_humans_download.mp3',
          created_at: Date.now(),
          updated_at: Date.now(),
          file_name: 'very_long_filename_with_many_parts_how_are_horses_helping_to_heal_humans_download.transcript.json'
        }
      },
      {
        name: 'plain_text_only.transcript.json',
        data: 'This is plain text content without JSON.'
      }
    ];

    for (const s of samples) {
      const full = join(tmpRoot, s.name);
      if (typeof s.data === 'string') {
        fs.writeFileSync(full, s.data, 'utf8');
      } else {
        fs.writeFileSync(full, JSON.stringify(s.data, null, 2), 'utf8');
      }
    }
  });

  after(() => {
    // cleanup temp dir
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('finds by exact transcript file name (json)', () => {
    const res = transcripts.getTranscriptByFileName('short-name.transcript.json');
    assert.ok(!res.error, res.error || 'expected success');
    assert.strictEqual(res.transcript_text, 'hello world');
  });

  it('finds long names (contains/endsWith match)', () => {
    const res = transcripts.getTranscriptByFileName('very_long_filename_with_many_parts_how_are_horses_helping_to_heal_humans_download.transcript.json');
    assert.ok(!res.error, res.error || 'expected success');
    assert.strictEqual(res.transcript_text, 'long content');
  });

  it('falls back to base-name match (without extension)', () => {
    const res = transcripts.getTranscriptByFileName('very_long_filename_with_many_parts_how_are_horses_helping_to_heal_humans_download');
    assert.ok(!res.error, res.error || 'expected success');
    assert.strictEqual(res.transcript_text, 'long content');
  });

  it('reads plain-text transcripts when JSON parse fails', () => {
    const res = transcripts.getTranscriptByFileName('plain_text_only.transcript.json');
    assert.ok(!res.error, res.error || 'expected success');
    assert.strictEqual(res.transcript_text.trim(), 'This is plain text content without JSON.');
  });
});


