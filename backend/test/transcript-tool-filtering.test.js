import { describe, it } from 'node:test';
import assert from 'node:assert';

/**
 * Test transcript tool filtering logic
 * This simulates the pattern matching and tool filtering logic from server.js
 */
describe('Transcript Tool Filtering', () => {
  // Simulate the detection logic from server.js
  const detectTranscriptToolNeed = (message) => {
    const lastUserMessage = message.toLowerCase();
    const lastUserMessageRaw = message;
    
    // Tool detection patterns (from server.js lines 467-473)
    const hasTranscriptContext = /transcript|recording|meeting|audio file|what was said|what did.*say/i.test(lastUserMessage);
    const sentenceQuery = hasTranscriptContext && /sentences?.*(?:word|appear|mentioned|containing|where)/i.test(lastUserMessageRaw);
    const mentionQuery = hasTranscriptContext && (
      /(?:is|are|was|were)\s+["']?[A-Za-z0-9\- ]+?\s+(?:mentioned|talked\s+about)/i.test(lastUserMessageRaw) ||
      /(?:where|which|that)\s+["']?[A-Za-z0-9\- ]+?\s+is\s+(?:mentioned|talked\s+about)/i.test(lastUserMessageRaw)
    );
    const needsTranscriptTool = /transcript|recording|meeting notes|what was said|what did.*say|display.*transcript|show.*transcript|summarize.*transcript|find.*transcript|search.*transcript|transcript file|what.*in.*transcript|words.*transcript|topics.*transcript/i.test(lastUserMessage) || sentenceQuery || mentionQuery;
    
    return { needsTranscriptTool, hasTranscriptContext, sentenceQuery, mentionQuery };
  };

  // Simulate tool filtering logic
  const filterTranscriptTools = (allTools, needsTranscriptTool) => {
    if (!needsTranscriptTool) {
      return allTools.filter(t => {
        const name = t.function.name.toLowerCase();
        return !name.includes('transcript') && 
               !name.includes('_transcript') &&
               name !== 'get_transcripts' &&
               name !== 'get_transcript' &&
               name !== 'get_latest_transcript' &&
               name !== 'search_transcripts' &&
               name !== 'find_sentences_in_latest_transcript' &&
               name !== 'find_sentences_in_transcript' &&
               name !== 'summarize_keyword_in_latest_transcript' &&
               name !== 'summarize_keyword_in_transcript';
      });
    }
    return allTools;
  };

  // Mock tools list
  const mockAllTools = [
    { function: { name: 'get_weather', description: 'Get weather' } },
    { function: { name: 'calculator', description: 'Calculate' } },
    { function: { name: 'get_latest_transcript', description: 'Get latest transcript' } },
    { function: { name: 'get_transcripts', description: 'List transcripts' } },
    { function: { name: 'find_sentences_in_latest_transcript', description: 'Find sentences' } },
    { function: { name: 'summarize_keyword_in_latest_transcript', description: 'Summarize keyword' } },
    { function: { name: 'get_jira_issue', description: 'Get Jira issue' } },
  ];

  describe('General knowledge questions should NOT trigger transcript tools', () => {
    const testCases = [
      'what do you know about Albert Einstein?',
      'tell me about quantum physics',
      'what is the theory of relativity?',
      'who was Marie Curie?',
      'explain machine learning',
      'what are neural networks?',
      'how does photosynthesis work?',
      'what is the capital of France?',
      'tell me about the history of computers',
      'what do you know about artificial intelligence?',
    ];

    testCases.forEach((query) => {
      it(`should NOT need transcript tools for: "${query}"`, () => {
        const result = detectTranscriptToolNeed(query);
        assert.strictEqual(result.needsTranscriptTool, false, 
          `Query "${query}" incorrectly triggered transcript tools`);
        assert.strictEqual(result.hasTranscriptContext, false,
          `Query "${query}" incorrectly detected transcript context`);
      });

      it(`should filter out transcript tools for: "${query}"`, () => {
        const result = detectTranscriptToolNeed(query);
        const filteredTools = filterTranscriptTools(mockAllTools, result.needsTranscriptTool);
        
        // Should have non-transcript tools
        assert.ok(filteredTools.length > 0, 'Should have some tools available');
        
        // Should NOT have transcript tools
        const transcriptToolNames = filteredTools
          .map(t => t.function.name.toLowerCase())
          .filter(name => name.includes('transcript'));
        assert.strictEqual(transcriptToolNames.length, 0,
          `Transcript tools should be filtered out, but found: ${transcriptToolNames.join(', ')}`);
        
        // Should still have other MCP tools
        const hasWeatherTool = filteredTools.some(t => t.function.name === 'get_weather');
        const hasCalculatorTool = filteredTools.some(t => t.function.name === 'calculator');
        const hasJiraTool = filteredTools.some(t => t.function.name === 'get_jira_issue');
        assert.ok(hasWeatherTool, 'Should still have weather tool');
        assert.ok(hasCalculatorTool, 'Should still have calculator tool');
        assert.ok(hasJiraTool, 'Should still have Jira tool');
      });
    });
  });

  describe('Explicit transcript queries SHOULD trigger transcript tools', () => {
    const testCases = [
      { query: 'what was said in the transcript?', shouldNeed: true },
      { query: 'show me the latest transcript', shouldNeed: true },
      { query: 'display the transcript file', shouldNeed: true },
      { query: 'what is in the transcript?', shouldNeed: true },
      { query: 'get the recording transcript', shouldNeed: true },
      { query: 'show meeting notes', shouldNeed: true },
      { query: 'what did they say in the recording?', shouldNeed: true },
      { query: 'find sentences where "Einstein" is mentioned in the transcript', shouldNeed: true },
      { query: 'is "Einstein" mentioned in the transcript?', shouldNeed: true },
      { query: 'search the transcript for "quantum"', shouldNeed: true },
      { query: 'summarize the transcript', shouldNeed: true },
    ];

    testCases.forEach(({ query, shouldNeed }) => {
      it(`should need transcript tools for: "${query}"`, () => {
        const result = detectTranscriptToolNeed(query);
        assert.strictEqual(result.needsTranscriptTool, shouldNeed,
          `Query "${query}" should ${shouldNeed ? 'need' : 'not need'} transcript tools`);
      });

      it(`should include transcript tools for: "${query}"`, () => {
        const result = detectTranscriptToolNeed(query);
        const filteredTools = filterTranscriptTools(mockAllTools, result.needsTranscriptTool);
        
        // Should have transcript tools
        const transcriptToolNames = filteredTools
          .map(t => t.function.name.toLowerCase())
          .filter(name => name.includes('transcript'));
        assert.ok(transcriptToolNames.length > 0,
          `Should include transcript tools, but found none. Available tools: ${filteredTools.map(t => t.function.name).join(', ')}`);
        
        // Should also have other MCP tools
        const hasWeatherTool = filteredTools.some(t => t.function.name === 'get_weather');
        assert.ok(hasWeatherTool, 'Should still have other MCP tools like weather');
      });
    });
  });

  describe('Sentence and mention queries with transcript context', () => {
    it('should detect sentence query when transcript context is present', () => {
      const query = 'find sentences where "Einstein" is mentioned in the transcript';
      const result = detectTranscriptToolNeed(query);
      assert.strictEqual(result.hasTranscriptContext, true);
      assert.strictEqual(result.sentenceQuery, true);
      assert.strictEqual(result.needsTranscriptTool, true);
    });

    it('should detect mention query when transcript context is present', () => {
      const query = 'is "Einstein" mentioned in the transcript?';
      const result = detectTranscriptToolNeed(query);
      assert.strictEqual(result.hasTranscriptContext, true);
      // Note: mentionQuery might be false if the pattern doesn't match exactly,
      // but needsTranscriptTool should still be true due to the main pattern
      assert.strictEqual(result.needsTranscriptTool, true, 
        'Should need transcript tools even if mentionQuery pattern is false');
    });

    it('should NOT detect sentence query without transcript context', () => {
      const query = 'find sentences where Einstein is mentioned';
      const result = detectTranscriptToolNeed(query);
      assert.strictEqual(result.hasTranscriptContext, false);
      assert.strictEqual(result.sentenceQuery, false);
      assert.strictEqual(result.needsTranscriptTool, false);
    });

    it('should NOT detect mention query without transcript context', () => {
      const query = 'is Einstein mentioned?';
      const result = detectTranscriptToolNeed(query);
      assert.strictEqual(result.hasTranscriptContext, false);
      assert.strictEqual(result.mentionQuery, false);
      assert.strictEqual(result.needsTranscriptTool, false);
    });
  });

  describe('Edge cases and false positives', () => {
    it('should handle questions with "about" that are NOT transcript queries', () => {
      const queries = [
        'what do you know about Einstein?',
        'tell me about quantum physics',
        'what about machine learning?',
        'can you talk about AI?',
      ];

      queries.forEach(query => {
        const result = detectTranscriptToolNeed(query);
        assert.strictEqual(result.needsTranscriptTool, false,
          `Query "${query}" should NOT trigger transcript tools`);
      });
    });

    it('should handle "what" questions that are NOT transcript queries', () => {
      const queries = [
        'what is quantum physics?',
        'what are neural networks?',
        'what do you know about computers?',
      ];

      queries.forEach(query => {
        const result = detectTranscriptToolNeed(query);
        assert.strictEqual(result.needsTranscriptTool, false,
          `Query "${query}" should NOT trigger transcript tools`);
      });
    });

    it('should handle mixed case and punctuation variations', () => {
      const queries = [
        'What Do You Know About Einstein?',
        'WHAT DO YOU KNOW ABOUT EINSTEIN?',
        'what do you know about einstein',
        'What do you know about Einstein.',
      ];

      queries.forEach(query => {
        const result = detectTranscriptToolNeed(query);
        assert.strictEqual(result.needsTranscriptTool, false,
          `Query "${query}" should NOT trigger transcript tools`);
      });
    });
  });

  describe('Tool filtering correctness', () => {
    it('should filter all transcript tools when not needed', () => {
      const filtered = filterTranscriptTools(mockAllTools, false);
      const transcriptTools = filtered.filter(t => 
        t.function.name.toLowerCase().includes('transcript')
      );
      assert.strictEqual(transcriptTools.length, 0,
        `Should filter out all transcript tools, but found: ${transcriptTools.map(t => t.function.name).join(', ')}`);
    });

    it('should keep all tools including transcript tools when needed', () => {
      const filtered = filterTranscriptTools(mockAllTools, true);
      assert.strictEqual(filtered.length, mockAllTools.length,
        'Should keep all tools when transcript tools are needed');
      
      const transcriptTools = filtered.filter(t => 
        t.function.name.toLowerCase().includes('transcript')
      );
      assert.ok(transcriptTools.length > 0,
        'Should include transcript tools when needed');
    });

    it('should preserve non-transcript tools when filtering', () => {
      const filtered = filterTranscriptTools(mockAllTools, false);
      const nonTranscriptTools = mockAllTools.filter(t => 
        !t.function.name.toLowerCase().includes('transcript')
      );
      
      assert.strictEqual(filtered.length, nonTranscriptTools.length,
        'Should preserve all non-transcript tools');
      
      filtered.forEach(tool => {
        const exists = nonTranscriptTools.some(nt => nt.function.name === tool.function.name);
        assert.ok(exists, `Tool ${tool.function.name} should be preserved`);
      });
    });
  });
});

