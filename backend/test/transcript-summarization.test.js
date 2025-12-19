import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Transcript summarization detection', () => {
  const summaryPattern = /summary|summarize|summarise|brief|short version|tl;dr/i;
  const transcriptNamePattern = /transcript(?: file)?[^"'\n]*["']([^"']+)["']/i;

  it('detects "summarize" in user message', () => {
    const msg1 = 'summarize transcript "test.json"';
    const msg2 = 'can you summarise the transcript?';
    const msg3 = 'give me a brief summary';
    const msg4 = 'short version please';
    const msg5 = 'tl;dr the transcript';

    assert.ok(summaryPattern.test(msg1), 'should detect "summarize"');
    assert.ok(summaryPattern.test(msg2), 'should detect "summarise"');
    assert.ok(summaryPattern.test(msg3), 'should detect "brief"');
    assert.ok(summaryPattern.test(msg4), 'should detect "short version"');
    assert.ok(summaryPattern.test(msg5), 'should detect "tl;dr"');
  });

  it('extracts transcript filename from quoted string', () => {
    const msg1 = 'summarize transcript "251113_6_minute_english_how_important_is_play_download.transcript.json"';
    const msg2 = 'summarise transcript "recording-20251212-161753.transcript.json"';
    const msg3 = 'can you display what is in the transcript "test.json"?';

    const match1 = msg1.match(transcriptNamePattern);
    const match2 = msg2.match(transcriptNamePattern);
    const match3 = msg3.match(transcriptNamePattern);

    assert.ok(match1, 'should match quoted filename in msg1');
    assert.strictEqual(match1[1], '251113_6_minute_english_how_important_is_play_download.transcript.json');
    
    assert.ok(match2, 'should match quoted filename in msg2');
    assert.strictEqual(match2[1], 'recording-20251212-161753.transcript.json');
    
    assert.ok(match3, 'should match quoted filename in msg3');
    assert.strictEqual(match3[1], 'test.json');
  });

  it('detects summarization intent with transcript filename', () => {
    const testCases = [
      { msg: 'summarize transcript "test.json"', hasSummary: true, hasFile: true },
      { msg: 'summarise transcript "test.json"', hasSummary: true, hasFile: true },
      { msg: 'can you summarize the transcript "test.json"?', hasSummary: true, hasFile: true },
      { msg: 'show transcript "test.json"', hasSummary: false, hasFile: true },
      { msg: 'display transcript "test.json"', hasSummary: false, hasFile: true },
      { msg: 'summarize latest transcript', hasSummary: true, hasFile: false },
    ];

    for (const tc of testCases) {
      const hasSummary = summaryPattern.test(tc.msg);
      const fileMatch = tc.msg.match(transcriptNamePattern);
      const hasFile = !!fileMatch;

      assert.strictEqual(hasSummary, tc.hasSummary, 
        `Expected hasSummary=${tc.hasSummary} for "${tc.msg}", got ${hasSummary}`);
      assert.strictEqual(hasFile, tc.hasFile, 
        `Expected hasFile=${tc.hasFile} for "${tc.msg}", got ${hasFile}`);
    }
  });

  it('handles unquoted transcript names', () => {
    const unquotedPattern = /transcript(?: file)?\s*[:\-]?\s*([A-Za-z0-9 _\-,.()]+)/i;
    
    const msg1 = 'summarize transcript 251113_6_minute_english_how_important_is_play_download.transcript.json';
    const msg2 = 'summarise transcript recording-20251212-161753.transcript.json';
    
    const match1 = msg1.match(unquotedPattern);
    const match2 = msg2.match(unquotedPattern);

    assert.ok(match1, 'should match unquoted filename');
    assert.ok(match1[1].includes('251113'), 'should extract filename part');
    
    assert.ok(match2, 'should match unquoted filename');
    assert.ok(match2[1].includes('recording-20251212'), 'should extract filename part');
  });
});

