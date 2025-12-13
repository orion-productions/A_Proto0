import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import os from 'os';
import { join } from 'path';

// Ensure we don't touch real transcripts; use temp dir
const tmpRoot = fs.mkdtempSync(join(os.tmpdir(), 'transcripts-keyword-test-'));
process.env.TRANSCRIPTS_DIR = tmpRoot;

describe('Transcript keyword search (word-boundary matching)', () => {
  let transcripts;

  before(async () => {
    transcripts = (await import('../mcp-tools/transcripts.js')).default;

    // Create test transcript with "Anna" mentions
    const testTranscript = {
      name: 'test-anna.transcript.json',
      data: {
        id: 't1',
        title: 'test-anna.transcript.json',
        transcript_text: 'According to child development expert Dr Anna Housley Juster, this freedom is vital. Anna thinks play is as important as a child\'s basic needs. Anna says that after a child\'s basic needs are met, play is by far the most important factor. According to Anna, taking small risks makes kids more resilient. Hannah is a different name. Annually we review this.',
        audio_file_name: 'test-anna.webm',
        created_at: Date.now(),
        updated_at: Date.now(),
        file_name: 'test-anna.transcript.json'
      }
    };

    const full = join(tmpRoot, testTranscript.name);
    fs.writeFileSync(full, JSON.stringify(testTranscript.data, null, 2), 'utf8');
  });

  after(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('finds sentences with "Anna" using word-boundary matching', () => {
    const result = transcripts.findSentencesInTranscript('test-anna.transcript.json', 'Anna');
    assert.ok(!result.error, result.error || 'expected success');
    assert.ok(result.count > 0, 'should find at least one sentence with "Anna"');
    assert.ok(result.sentences.length > 0, 'should return sentences');
    
    // Verify all returned sentences contain "Anna" as a whole word
    for (const sentence of result.sentences) {
      assert.ok(/Anna/i.test(sentence), `sentence should contain "Anna": ${sentence}`);
    }
    
    // Verify it does NOT match "Hannah" or "Annually"
    const allText = result.sentences.join(' ');
    assert.ok(!/Hannah/i.test(allText), 'should not match "Hannah"');
    assert.ok(!/Annually/i.test(allText), 'should not match "Annually"');
  });

  it('finds sentences in latest transcript', () => {
    const result = transcripts.findSentencesInLatest('Anna');
    assert.ok(!result.error, result.error || 'expected success');
    assert.ok(result.count > 0, 'should find sentences with "Anna"');
    assert.ok(result.sentences.length > 0, 'should return sentences');
  });

  it('returns empty results for non-existent keyword', () => {
    const result = transcripts.findSentencesInTranscript('test-anna.transcript.json', 'NonExistentWord123');
    assert.ok(!result.error, result.error || 'expected success');
    assert.strictEqual(result.count, 0, 'should find no sentences');
    assert.strictEqual(result.sentences.length, 0, 'should return empty array');
  });

  it('returns error for non-existent transcript', () => {
    const result = transcripts.findSentencesInTranscript('non-existent-file.transcript.json', 'Anna');
    assert.ok(result.error, 'should return error for non-existent transcript');
  });

  it('handles case-insensitive keyword matching', () => {
    const result1 = transcripts.findSentencesInTranscript('test-anna.transcript.json', 'Anna');
    const result2 = transcripts.findSentencesInTranscript('test-anna.transcript.json', 'anna');
    const result3 = transcripts.findSentencesInTranscript('test-anna.transcript.json', 'ANNA');
    
    assert.strictEqual(result1.count, result2.count, 'case should not matter');
    assert.strictEqual(result1.count, result3.count, 'case should not matter');
  });
});

describe('Keyword extraction patterns', () => {
  it('extracts keyword from "sentences where the word X appears"', () => {
    const pattern1 = /sentences?.*?\bword\b\s+["']?([A-Za-z0-9\-_]+)["']?/i;
    const pattern2 = /sentences?.*?\bword\b\s+([A-Za-z0-9\-_ ]+?)\s+appears?/i;
    const pattern3 = /sentences?.*?(?:where|containing|with)\s+["']?([A-Za-z0-9\-_ ]+?)(?:\s+is\s+mentioned|["']?)(?:\s|$|\.|\?)/i;
    
    const queries = [
      'can you give me the sentences where the word "Anna" appears?',
      'sentences where the word Anna appears',
      'sentences containing Anna',
      'sentences where Anna is mentioned',
    ];

    for (const query of queries) {
      const match1 = query.match(pattern1);
      const match2 = query.match(pattern2);
      const match3 = query.match(pattern3);
      
      const keyword = (match1?.[1] || match2?.[1] || match3?.[1] || '').replace(/["']/g, '').trim();
      assert.ok(keyword.length > 0, `should extract keyword from: ${query}`);
      assert.ok(/Anna/i.test(keyword), `should extract "Anna" from: ${query}`);
    }
  });

  it('extracts keyword from quoted strings', () => {
    const pattern = /sentences?.*?(["'][^"']+["'])/i;
    
    const query = 'can you give me the sentences where the word "Anna" is mentioned?';
    const match = query.match(pattern);
    
    assert.ok(match, 'should match quoted keyword');
    const keyword = (match[1] || '').replace(/["']/g, '').trim();
    assert.strictEqual(keyword, 'Anna', 'should extract "Anna" from quoted string');
  });
});

