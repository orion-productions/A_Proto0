import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import os from 'os';
import { join } from 'path';

// Ensure we don't touch real transcripts; use temp dir
const tmpRoot = fs.mkdtempSync(join(os.tmpdir(), 'transcripts-anna-bug-'));
process.env.TRANSCRIPTS_DIR = tmpRoot;

describe('Anna keyword search bug reproduction', () => {
  let transcripts;

  before(async () => {
    transcripts = (await import('../mcp-tools/transcripts.js')).default;

    // Create the actual transcript from the user's example
    const actualTranscriptText = `Hello, this is 6 Minute English from BBC Learning English. I'm Pippa. And I'm Phil. What was your favourite game when you were a child, Pippa? I think my favourite game was skipping with a skipping rope. How about you? Well, I could never skip, so I think I just preferred playing football. Ah, well that's a good game to play in the playground. Eighty years ago, it was quite common for children in Britain's cities to play in bombsites, the ruins of houses which had been destroyed in World War II. Today the idea is back in fashion, with kids playing not in bombsites, but in junk playgrounds, also called adventure playgrounds. In contrast to pre-made playgrounds, where swings and slides are fixed in place, adventure playgrounds provide pieces of building materials for kids to build things themselves. Reporter William Kramer went to see one such playground in Rexham, North Wales, for BBC World Service programme People Fixing the World. At first glance, the land is little more than a junkyard. There are stacks of used wooden pallets and big reels for holding wires. But if you look a little bit closer, you'll see crooked, homemade structures, hidey holes and turrets. Children run barefoot, they swing on ropes and throw themselves down a makeshift water slide. At first glance, William sees only junk. The phrase, at first glance, means looking at something for the first time before having a chance to look more carefully. Adventure playgrounds are indeed full of junk, pieces of construction material like old tires, planks of wood and lengths of rope. But look closely and you'll see children using the junk to play, building dens and hidey holes. A hidey hole is a small place for hiding things, or in this case, for children to hide themselves. In this episode, we'll be hearing how adventure playgrounds are giving kids the freedom and space to play. As usual, we'll be learning some useful new words and phrases, and remember, you can find all this episode's vocabulary along with a transcript on our website, bbclearningenglish. com. But now I have a question for you, Pippa. We know that adventure playgrounds started off after the Second World War, but in which country? Was it A, France, B, Germany or C, Denmark? Hmm, I think maybe France. I think French children maybe were very adventurous. Okay, well we'll find out the answer to that question later in the programme. Adventure playgrounds give kids the freedom to choose how they play. According to child development expert Dr Anna Housley Juster, this freedom is vital as she explains here to BBC World Services people fixing the world. It's true. We do tend to minimise play in certain ways, but actually after the most basic needs are met for children, so food, shelter, water, safe place to be, play is by far the most important factor for healthy child development. Anna thinks play is as important as a child's basic needs like food and safety, but unfortunately the importance of play tends to be minimised. If something tends to happen, it happens often and is likely to happen again. Anna says that after a child's basic needs are met, play is by far the most important factor in a healthy childhood. She uses the phrase, by far, to mean by a greater amount. For example, your teacher might say, you're by far the best student in class. The freedom to take controlled risks in a safe environment is what Anna calls self-directed play. Here she explains more to Myra Anubi, presenter of BBC programme People Fixing the World. So what you're seeing is letting kids play, free play actually, or play on their own and kind of come up with the ideas, that's really crucial for their development. It's a 100% crucial for their development in what I meant when I said that it's protective is that kids build resiliency, confidence, coping strategies, regulation strategies. So many of the skills that we know lead to healthy human development are developed in play. Myra mentions the importance of free play and Anna says it's 100% crucial, meaning completely. You can also say 100% as an informal response to mean, yes, I agree with you completely. Adventure playgrounds have lots of small dangers, hard pieces of wood, sharp metal, nails. According to Anna, taking small risks when playing with these makes kids more resilient and builds coping strategies. A term for the psychological ways children develop to manage challenging situations. And Phil, I think it's time for the answer to your quiz question. Yes, I asked you in which country Adventure Playgrounds started? You said France, but I'm afraid the correct answer was Denmark. They were introduced by Danish architect Karl Theodor Sorenson. OK, let's recap the vocabulary we've learned, starting with the phrase at first glance, where you see something quickly without a chance to consider it more carefully. A hidey hole is a small place for hiding things in, or hiding yourself in. If people tend to do something, they do it often and will probably continue to do it in the future. The phrase by far means by a great amount. Saying 100% means completely and can be used to emphasise a statement or show that you totally agree with it. And finally coping strategies are psychological ways of managing your emotions in challenging situations. Once again our six minutes are up, But remember, you can find many more trending topics, plus a quiz and worksheet for this episode on our website, bbclearningenglish. com. Hope to see you there soon, but for now, it's goodbye. Goodbye.`;

    const testTranscript = {
      name: '251113_6_minute_english_how_important_is_play_download.transcript.json',
      data: {
        id: 't1',
        title: '251113_6_minute_english_how_important_is_play_download.transcript.json',
        transcript_text: actualTranscriptText,
        audio_file_name: '251113_6_minute_english_how_important_is_play_download.mp3',
        created_at: Date.now(),
        updated_at: Date.now(),
        file_name: '251113_6_minute_english_how_important_is_play_download.transcript.json'
      }
    };

    const full = join(tmpRoot, testTranscript.name);
    fs.writeFileSync(full, JSON.stringify(testTranscript.data, null, 2), 'utf8');
  });

  after(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('finds all sentences with "Anna" in the actual transcript', () => {
    const result = transcripts.findSentencesInTranscript(
      '251113_6_minute_english_how_important_is_play_download.transcript.json',
      'Anna'
    );
    
    assert.ok(!result.error, result.error || 'expected success');
    assert.ok(result.count > 0, `should find sentences with "Anna", got count: ${result.count}`);
    assert.ok(result.sentences.length > 0, 'should return sentences array');
    
    // Verify we found the expected sentences
    const allSentences = result.sentences.join(' ');
    assert.ok(/Anna Housley Juster/i.test(allSentences), 'should find "Anna Housley Juster"');
    assert.ok(/Anna thinks/i.test(allSentences), 'should find "Anna thinks"');
    assert.ok(/Anna says/i.test(allSentences), 'should find "Anna says"');
    assert.ok(/Anna calls/i.test(allSentences), 'should find "Anna calls"');
    assert.ok(/Anna says it's 100% crucial/i.test(allSentences), 'should find "Anna says it\'s 100% crucial"');
    assert.ok(/According to Anna/i.test(allSentences), 'should find "According to Anna"');
    
    console.log(`Found ${result.count} sentences with "Anna":`);
    result.sentences.forEach((s, i) => {
      console.log(`  ${i + 1}. ${s.substring(0, 100)}...`);
    });
  });

  it('extracts "Anna" keyword from user query patterns', () => {
    const queries = [
      'can you give me the sentences where "Anna" is mentioned in the transcript "251113_6_minute_english_how_important_is_play_download.transcript.json"?',
      'can you give me the sentences where "Anna" is mentioned?',
      'sentences where the word Anna appears',
      'is there a place where Anna is mentioned?',
      'is Anna mentioned?',
      'does this transcript mention Anna?',
    ];

    // Test keyword extraction patterns (matching server.js patterns)
    const sentencePattern1 = /sentences?.*?\bword\b\s+["']?([A-Za-z0-9\-_]+)["']?/i;
    const sentencePattern2 = /sentences?.*?\bword\b\s+([A-Za-z0-9\-_ ]+?)\s+appears?/i;
    const sentencePattern3 = /sentences?.*?(?:where|containing|with)\s+["']?([A-Za-z0-9\-_ ]+?)(?:\s+is\s+mentioned|["']?)(?:\s|$|\.|\?)/i;
    const sentencePattern4 = /sentences?.*?(["'][^"']+["'])/i;
    const sentencePattern5 = /sentences?.*?where\s+["']?([A-Za-z0-9\-_ ]+?)["']?(?:\s|$|\.|\?)/i;
    
    const mentionPattern1 = /(?:where|which|that)\s+["']?([A-Za-z0-9\- ]+?)\s+is\s+(?:mentioned|talked\s+about)/i;
    const mentionPattern2 = /(?:is|does).*?mention\s+["']?([A-Za-z0-9\- ]+?)["']?(?:\s|$|\.|\?)/i;
    const mentionPattern3 = /(?:is|does)\s+["']?([A-Za-z0-9\-]{1,20})\s+mentioned/i;
    const mentionPattern4 = /\b(mention|talk about|about)\s+["']?([A-Za-z0-9\- ]+)["']?/i;

    for (const query of queries) {
      let keyword = null;
      
      // Try sentence patterns first
      const sm1 = query.match(sentencePattern1);
      const sm2 = query.match(sentencePattern2);
      const sm3 = query.match(sentencePattern3);
      const sm4 = query.match(sentencePattern4);
      const sm5 = query.match(sentencePattern5);
      
      keyword = (sm1?.[1] || sm2?.[1] || sm3?.[1] || sm4?.[1] || sm5?.[1] || '').replace(/["']/g, '').trim();
      
      // If no sentence match, try mention patterns
      if (!keyword) {
        const mm1 = query.match(mentionPattern1);
        const mm2 = query.match(mentionPattern2);
        const mm3 = query.match(mentionPattern3);
        const mm4 = query.match(mentionPattern4);
        
        keyword = (mm1?.[1] || mm2?.[1] || mm2?.[2] || mm3?.[1] || mm4?.[1] || '').replace(/["']/g, '').trim();
      }
      
      assert.ok(keyword.length > 0, `should extract keyword from: ${query}`);
      assert.ok(/Anna/i.test(keyword), `should extract "Anna" from: ${query}, got: ${keyword}`);
    }
  });
});

