import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Transcript fast-path detection patterns', () => {
  // Simulate the detection logic from server.js
  const detectTranscriptQuery = (message) => {
    const lastUserMessage = message.toLowerCase();
    const lastUserMessageRaw = message;
    
    // Tool detection patterns (from server.js)
    const sentenceQuery = /sentences?.*(?:word|appear|mentioned|containing|where)/i.test(lastUserMessageRaw);
    const mentionQuery = /(?:is|are|was|were)\s+["']?[A-Za-z0-9\- ]+?\s+(?:mentioned|talked\s+about)/i.test(lastUserMessageRaw) ||
                        /\b(mention|talk about|about)\s+["']?[A-Za-z0-9\- ]+/i.test(lastUserMessageRaw) ||
                        /(?:where|which|that)\s+["']?[A-Za-z0-9\- ]+?\s+is\s+(?:mentioned|talked\s+about)/i.test(lastUserMessageRaw);
    const needsTranscriptTool = /transcript|recording|meeting notes|what was said|what did.*say|display.*transcript|show.*transcript|summarize.*transcript|find.*transcript|search.*transcript|transcript file|what.*in.*transcript|words.*transcript|topics.*transcript/i.test(lastUserMessage) || sentenceQuery || mentionQuery;
    
    return { needsTranscriptTool, sentenceQuery, mentionQuery };
  };
  
  // Simulate fast-path pattern matching
  const matchSentenceKeyword = (message) => {
    const lastUserMessageRaw = message;
    const transcriptNameInSentenceQuery = message.match(/transcript(?: file)?[^"'\n]*["']([^"']+)["']/i) ||
      message.match(/transcript(?: file)?\s*[:\-]?\s*([A-Za-z0-9 _\-,.()]+)/i);
    
    const sentenceKeywordMatch =
      lastUserMessageRaw.match(/sentences?.*?\bword\b\s+["']?([A-Za-z0-9\-_]+)["']?/i) ||
      lastUserMessageRaw.match(/sentences?.*?\bword\b\s+([A-Za-z0-9\-_ ]+?)\s+appears?/i) ||
      lastUserMessageRaw.match(/sentences?.*?where\s+["']?([A-Za-z0-9\-_ ]+?)["']?\s+is\s+mentioned/i) ||
      lastUserMessageRaw.match(/sentences?.*?(?:where|containing|with)\s+["']?([A-Za-z0-9\-_ ]+?)(?:\s+is\s+mentioned|["']?)(?:\s|$|\.|\?)/i) ||
      lastUserMessageRaw.match(/where\s+(?:the\s+)?\bword\b\s+["']?([A-Za-z0-9\-_ ]+?)["']?\s+is\s+mentioned/i) ||
      lastUserMessageRaw.match(/where\s+["']?([A-Za-z0-9\-_ ]+?)["']?\s+is\s+mentioned/i) ||
      (!transcriptNameInSentenceQuery && lastUserMessageRaw.match(/sentences?.*?where\s+(["'][^"']+["'])/i)) ||
      (!transcriptNameInSentenceQuery && lastUserMessageRaw.match(/sentences?.*?(["'][^"']+["'])/i)) ||
      lastUserMessageRaw.match(/sentences?.*?where\s+["']?([A-Za-z0-9\-_ ]+?)["']?(?:\s|$|\.|\?)/i);
    
    if (sentenceKeywordMatch) {
      const keyword = (sentenceKeywordMatch[1] || '').replace(/["']/g, '').trim();
      return { matched: true, keyword, transcriptName: transcriptNameInSentenceQuery?.[1] };
    }
    return { matched: false };
  };

  it('detects "can you give me the sentences where \'Anna\' is mentioned?"', () => {
    const query = "can you give me the sentences where 'Anna' is mentioned?";
    const detection = detectTranscriptQuery(query);
    const match = matchSentenceKeyword(query);
    
    assert.ok(detection.needsTranscriptTool, 'should detect transcript tool needed');
    assert.ok(detection.sentenceQuery, 'should detect sentence query');
    assert.ok(match.matched, 'fast-path should match');
    assert.strictEqual(match.keyword, 'Anna', 'should extract keyword "Anna"');
  });

  it('detects "can you give me the sentences where \"Anna\" is mentioned in the transcript \'file.json\'?"', () => {
    const query = "can you give me the sentences where \"Anna\" is mentioned in the transcript 'file.json'?";
    const detection = detectTranscriptQuery(query);
    const match = matchSentenceKeyword(query);
    
    assert.ok(detection.needsTranscriptTool, 'should detect transcript tool needed');
    assert.ok(detection.sentenceQuery, 'should detect sentence query');
    assert.ok(match.matched, 'fast-path should match');
    assert.strictEqual(match.keyword, 'Anna', 'should extract keyword "Anna"');
    assert.strictEqual(match.transcriptName, 'file.json', 'should extract transcript filename');
  });

  it('detects "sentences where the word sound appears"', () => {
    const query = "sentences where the word sound appears";
    const detection = detectTranscriptQuery(query);
    const match = matchSentenceKeyword(query);
    
    assert.ok(detection.needsTranscriptTool, 'should detect transcript tool needed');
    assert.ok(detection.sentenceQuery, 'should detect sentence query');
    assert.ok(match.matched, 'fast-path should match');
    assert.strictEqual(match.keyword, 'sound', 'should extract keyword "sound"');
  });

  it('detects "is there a place where Anna is mentioned?"', () => {
    const query = "is there a place where Anna is mentioned?";
    const detection = detectTranscriptQuery(query);
    
    assert.ok(detection.needsTranscriptTool, 'should detect transcript tool needed');
    assert.ok(detection.mentionQuery, 'should detect mention query');
  });

  it('detects "is Anna mentioned?"', () => {
    const query = "is Anna mentioned?";
    const detection = detectTranscriptQuery(query);
    
    assert.ok(detection.needsTranscriptTool, 'should detect transcript tool needed');
    assert.ok(detection.mentionQuery, 'should detect mention query');
  });

  it('detects "does this transcript mention Anna?"', () => {
    const query = "does this transcript mention Anna?";
    const detection = detectTranscriptQuery(query);
    
    assert.ok(detection.needsTranscriptTool, 'should detect transcript tool needed');
    assert.ok(detection.mentionQuery, 'should detect mention query');
  });

  it('handles unquoted keywords', () => {
    const query = "can you give me the sentences where Anna is mentioned?";
    const match = matchSentenceKeyword(query);
    
    assert.ok(match.matched, 'fast-path should match unquoted keywords');
    assert.strictEqual(match.keyword, 'Anna', 'should extract unquoted keyword "Anna"');
  });

  it('handles double-quoted keywords', () => {
    const query = 'can you give me the sentences where "Anna" is mentioned?';
    const match = matchSentenceKeyword(query);
    
    assert.ok(match.matched, 'fast-path should match double-quoted keywords');
    assert.strictEqual(match.keyword, 'Anna', 'should extract double-quoted keyword "Anna"');
  });

  it('handles single-quoted keywords', () => {
    const query = "can you give me the sentences where 'Anna' is mentioned?";
    const match = matchSentenceKeyword(query);
    
    assert.ok(match.matched, 'fast-path should match single-quoted keywords');
    assert.strictEqual(match.keyword, 'Anna', 'should extract single-quoted keyword "Anna"');
  });

  it('detects "is there a place where the word \'Anna\' is mentioned" (without "sentences" at start)', () => {
    const query = "is there a place where the word 'Anna' is mentioned in the transcript 'file.json'?";
    const detection = detectTranscriptQuery(query);
    const match = matchSentenceKeyword(query);
    
    assert.ok(detection.needsTranscriptTool, 'should detect transcript tool needed');
    assert.ok(match.matched, 'fast-path should match queries without "sentences" at start');
    assert.strictEqual(match.keyword, 'Anna', 'should extract keyword "Anna"');
  });
});

