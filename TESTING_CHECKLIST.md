# Manual Testing Checklist

## Test 1: Recording Flow

### Steps:
1. Open http://localhost:5174
2. Navigate to the "Meeting Recording" section (right panel, middle)
3. Click the **"Record"** button
4. Grant microphone permission if prompted
5. Speak clearly for 10-15 seconds
6. Click the **"Stop"** button

### Expected Results:
- [ ] ✅ During recording:
  - Spectrogram shows animated frequency bars
  - Real-time transcript appears at bottom of spectrogram
  - Transcript updates as you speak
  
- [ ] ✅ After clicking Stop:
  - Spectrogram immediately shows audio file info:
    - `Audio File: recording.webm`
    - `File Size: XX KB`
    - `Duration: Xs (Ym Zs)`
    - `Recorded: [timestamp]`
  - Shows: `Transcript: Not available yet (generating...)`
  
- [ ] ✅ During transcription:
  - Progress bar appears
  - Shows stage: "Processing..." → "Transcribing..."
  - Shows percentage: 0% → 100%
  
- [ ] ✅ After transcription completes:
  - Spectrogram updates with:
    - `Transcript File: Transcript [timestamp]`
    - `Word Count: X words`
    - `Saved At: [timestamp]`
  - Below shows: `✅ Transcription completed`
  - Below shows: `Transcript content:`
  - Full transcript text displayed below

---

## Test 2: File Upload Flow

### Steps:
1. Click the **Upload** button (blue button with upload icon)
2. Select an audio file (MP3, WAV, OGG, M4A, or FLAC)
3. Wait for transcription

### Expected Results:
- [ ] ✅ Spectrogram shows audio file info immediately
- [ ] ✅ Shows "Transcript: Not available yet (generating...)"
- [ ] ✅ Progress bar appears
- [ ] ✅ After completion: spectrogram updates with transcript info
- [ ] ✅ Full transcript displayed below with "Transcript content:" label

---

## Test 3: LLM Queries About Transcript

### Steps:
1. Complete Test 1 or Test 2 (ensure you have a saved transcript)
2. Go to the central chat panel
3. Try these queries:

**Query 1:** "can you display what is in the transcript file?"
- [ ] ✅ LLM retrieves and displays the transcript content

**Query 2:** "can you summarize the transcript file?"
- [ ] ✅ LLM provides a summary

**Query 3:** "is there a mention about [keyword from your recording]?"
- [ ] ✅ LLM searches and confirms presence/absence

**Query 4:** "what are the key themes mentioned?"
- [ ] ✅ LLM analyzes and lists themes

**Query 5:** "how many people are speaking?"
- [ ] ✅ LLM analyzes speaker count

### Expected Behavior:
- [ ] ✅ In the MCP Agents panel (right panel, top):
  - The "transcript" tool should light up (blue, pulsing) when being used
- [ ] ✅ LLM provides accurate responses based on transcript content

---

## Test 4: Multiple Recordings

### Steps:
1. Record audio #1 (speak about topic A)
2. Wait for transcription to complete
3. Record audio #2 (speak about topic B)
4. Wait for transcription to complete
5. Check spectrogram info

### Expected Results:
- [ ] ✅ Spectrogram always shows the LATEST recording info
- [ ] ✅ Each transcript is saved with unique timestamp
- [ ] ✅ LLM can access the latest transcript
- [ ] ✅ Word count updates correctly for each recording

---

## Test 5: Error Handling

### Steps:
1. Try recording without granting microphone permission

### Expected Results:
- [ ] ✅ Alert appears: "Could not access microphone. Please check permissions."

---

## Test 6: UI Persistence

### Steps:
1. Record and transcribe audio
2. Refresh the page (F5)
3. Check the spectrogram

### Expected Results:
- [ ] ✅ Spectrogram shows "Spectrogram will appear when recording starts"
- [ ] ✅ No old data persists (as designed - fresh state on reload)
- [ ] ✅ Can ask LLM about previous transcripts (they're in database)

---

## Test 7: Long Recording

### Steps:
1. Record for 30+ seconds
2. Speak continuously

### Expected Results:
- [ ] ✅ Real-time transcript shows last ~15 words during recording
- [ ] ✅ Full transcript includes ALL spoken words after transcription
- [ ] ✅ Word count is accurate

---

## Test 8: Browser Compatibility

### Browsers to Test:
- [ ] ✅ Chrome (recommended)
- [ ] ✅ Edge (recommended)
- [ ] ✅ Safari (macOS)

### Expected:
- [ ] ✅ All features work in Chrome/Edge
- [ ] ⚠️ Safari may have limited support (Web Speech API limitations)

---

## Known Issues to Verify

### Issue: Partial Transcription
**Previous Problem:** Only first few words captured
**Fix:** Now transcribes full audio file after recording stops
- [ ] ✅ Verify: Full transcript matches entire spoken content

### Issue: Stale Transcript Info
**Previous Problem:** Spectrogram showed old transcript after new recording
**Fix:** Clear transcript info immediately when recording stops
- [ ] ✅ Verify: Shows "Not available yet" before transcription completes
- [ ] ✅ Verify: Updates with correct new transcript info after completion

### Issue: Missing Labels
**Previous Problem:** "Transcript:" instead of "Transcript content:"
**Fix:** Updated label text
- [ ] ✅ Verify: Label now says "Transcript content:"

---

## Success Criteria

All checkboxes above should be checked (✅) for the implementation to be considered complete and working.

If any test fails, please report:
1. Which test failed
2. What was expected
3. What actually happened
4. Any error messages in browser console (F12)

