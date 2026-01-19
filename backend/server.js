import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join, isAbsolute, extname } from 'path';
import fs from 'fs';
import multer from 'multer';
import { exec } from 'child_process';
import { promisify } from 'util';
import { mcpTools, toolsDefinition } from './mcp-tools/index.js';
import transcriptsStore from './mcp-tools/transcripts.js';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3002;
const WHISPER_MODEL = process.env.WHISPER_MODEL || 'base.en'; // better accuracy than tiny with moderate size
const WHISPER_LANGUAGE = process.env.WHISPER_LANGUAGE || 'en';
const PYTHON_BIN = process.env.PYTHON_PATH || 'python';

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(join(__dirname, 'public')));

// Initialize SQLite database
const db = new Database('chats.db');
db.exec(`
  CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
  );
`);

// Audio storage directory (keep uploaded/recorded audio)
const AUDIO_DIR = join(__dirname, 'audio');
if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

// Configure multer for file uploads, preserving audio files
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, AUDIO_DIR),
    filename: (req, file, cb) => {
      const original = file.originalname || 'audio.webm';
      const safeName = original.replace(/[^a-zA-Z0-9._-]/g, '_');
      const stamp = Date.now();
      // Avoid collisions while keeping the original name visible
      cb(null, `${stamp}-${safeName}`);
    }
  })
});

// Debug helper to log weather LLM responses
function logWeatherDebug(payload) {
  try {
    const line = `${new Date().toISOString()} ${payload}\n`;
    fs.appendFileSync(join(__dirname, 'weather-debug.log'), line);
  } catch (err) {
    console.error('weather debug log write failed:', err.message);
  }
}

// Scratchpad file operations
const SCRATCHPAD_FILE = join(process.cwd(), '..', 'scratchpad.txt');

function readScratchpadFile() {
  try {
    if (fs.existsSync(SCRATCHPAD_FILE)) {
      return fs.readFileSync(SCRATCHPAD_FILE, 'utf8');
    }
    return '';
  } catch (error) {
    console.error('Error reading scratchpad file:', error);
    return '';
  }
}

function writeScratchpadFile(content) {
  try {
    fs.writeFileSync(SCRATCHPAD_FILE, content, 'utf8');
    return true;
  } catch (error) {
    console.error('Error writing scratchpad file:', error);
    return false;
  }
}

// MCP Tools are now imported from ./mcp-tools/index.js
// See backend/mcp-tools/ directory for individual tool implementations

// Execute tool call
// Maps LLM function names to tool implementations
async function executeTool(toolName, params) {
  try {
    switch(toolName) {
      // Weather tools
      case 'get_weather':
        return await mcpTools.weather(params.city);
      
      // Math tools
      case 'add_numbers':
        return mcpTools.add(params.a, params.b);
      case 'calculator':
        return mcpTools.calculator(params.expression);
      
      // Jira tools
      case 'get_jira_issue':
        return await mcpTools.getJiraIssue(params.issueKey);
      case 'search_jira_issues':
        return await mcpTools.searchJiraIssues(params.jql, params.maxResults, params.startAt);
      case 'get_jira_project':
        return await mcpTools.getJiraProject(params.projectKey);
      case 'get_jira_projects':
        return await mcpTools.getJiraProjects();
      case 'get_jira_issue_comments':
        return await mcpTools.getJiraIssueComments(params.issueKey);
      case 'get_jira_issue_transitions':
        return await mcpTools.getJiraIssueTransitions(params.issueKey);
      case 'get_jira_issue_worklog':
        return await mcpTools.getJiraIssueWorklog(params.issueKey);
      
      // Slack tools
      case 'get_slack_channels':
        return await mcpTools.getSlackChannels();
      case 'get_slack_messages':
        return await mcpTools.getSlackMessages(params.channel, params.limit, params.oldest, params.latest);
      case 'get_slack_channel_info':
        return await mcpTools.getSlackChannelInfo(params.channel);
      case 'get_slack_user':
        return await mcpTools.getSlackUser(params.user);
      case 'search_slack_messages':
        return await mcpTools.searchSlackMessages(params.query, params.count);
      case 'get_slack_thread_replies':
        return await mcpTools.getSlackThreadReplies(params.channel, params.thread_ts);
      
      // GitHub tools
      case 'get_github_issue':
        return await mcpTools.getGitHubIssue(params.owner, params.repo, params.issueNumber);
      case 'get_github_repo':
        return await mcpTools.getGitHubRepo(params.owner, params.repo);
      case 'list_github_issues':
        return await mcpTools.listGitHubIssues(params.owner, params.repo, params.state, params.limit);
      case 'get_github_pull_request':
        return await mcpTools.getGitHubPullRequest(params.owner, params.repo, params.pullNumber);
      case 'list_github_pull_requests':
        return await mcpTools.listGitHubPullRequests(params.owner, params.repo, params.state, params.limit);
      case 'get_github_issue_comments':
        return await mcpTools.getGitHubIssueComments(params.owner, params.repo, params.issueNumber);
      case 'get_github_commits':
        return await mcpTools.getGitHubCommits(params.owner, params.repo, params.branch, params.limit);
      case 'search_github_repos':
        return await mcpTools.searchGitHubRepos(params.query, params.limit);
      
      // Perforce tools
      case 'get_perforce_changelist':
        return await mcpTools.getPerforceChangelist(params.changelist);
      case 'list_perforce_changelists':
        return await mcpTools.listPerforceChangelists(params.user, params.limit);
      case 'get_perforce_file_info':
        return await mcpTools.getPerforceFileInfo(params.filePath);
      case 'list_perforce_files':
        return await mcpTools.listPerforceFiles(params.path, params.limit);
      case 'get_perforce_file_content':
        return await mcpTools.getPerforceFileContent(params.filePath, params.revision);
      case 'get_perforce_file_history':
        return await mcpTools.getPerforceFileHistory(params.filePath, params.limit);
      case 'get_perforce_client':
        return await mcpTools.getPerforceClient(params.clientName);
      
      // Confluence tools
      case 'get_confluence_page':
        return await mcpTools.getConfluencePage(params.pageId);
      case 'search_confluence_pages':
        return await mcpTools.searchConfluencePages(params.query, params.limit, params.spaceKey);
      case 'get_confluence_space':
        return await mcpTools.getConfluenceSpace(params.spaceKey);
      case 'list_confluence_spaces':
        return await mcpTools.listConfluenceSpaces(params.limit);
      case 'get_confluence_space_pages':
        return await mcpTools.getConfluenceSpacePages(params.spaceKey, params.limit);
      case 'get_confluence_page_children':
        return await mcpTools.getConfluencePageChildren(params.pageId, params.limit);
      case 'get_confluence_page_attachments':
        return await mcpTools.getConfluencePageAttachments(params.pageId);
      case 'get_confluence_page_comments':
        return await mcpTools.getConfluencePageComments(params.pageId, params.limit);
      
      // Gmail tools
      case 'get_gmail_message':
        return await mcpTools.getGmailMessage(params.messageId, params.format);
      case 'list_gmail_messages':
        return await mcpTools.listGmailMessages(params.query, params.maxResults, params.pageToken);
      case 'search_gmail_messages':
        return await mcpTools.searchGmailMessages(params.query, params.maxResults);
      case 'get_gmail_labels':
        return await mcpTools.getGmailLabels();
      case 'get_gmail_messages_by_label':
        return await mcpTools.getGmailMessagesByLabel(params.labelId, params.maxResults);
      case 'get_gmail_thread':
        return await mcpTools.getGmailThread(params.threadId);
      case 'get_gmail_message_attachments':
        return await mcpTools.getGmailMessageAttachments(params.messageId, params.attachmentId);
      case 'get_gmail_profile':
        return await mcpTools.getGmailProfile();
      
      // Google Calendar tools
      case 'list_calendar_events':
        return await mcpTools.listCalendarEvents(params.calendarId, params.timeMin, params.timeMax, params.maxResults, params.singleEvents, params.orderBy);
      case 'get_calendar_event':
        return await mcpTools.getCalendarEvent(params.calendarId || 'primary', params.eventId);
      case 'list_calendars':
        return await mcpTools.listCalendars();
      case 'get_calendar':
        return await mcpTools.getCalendar(params.calendarId);
      case 'search_calendar_events':
        return await mcpTools.searchCalendarEvents(params.calendarId, params.query, params.timeMin, params.timeMax, params.maxResults);
      case 'get_calendar_free_busy':
        return await mcpTools.getCalendarFreeBusy(params.timeMin, params.timeMax, params.calendarIds);
      case 'get_calendar_upcoming_events':
        return await mcpTools.getCalendarUpcomingEvents(params.calendarId, params.maxResults);
      
      // Google Drive tools
      case 'list_drive_files':
        return await mcpTools.listDriveFiles(params.query, params.pageSize, params.pageToken, params.orderBy);
      case 'get_drive_file':
        return await mcpTools.getDriveFile(params.fileId, params.fields);
      case 'get_drive_file_content':
        return await mcpTools.getDriveFileContent(params.fileId, params.mimeType);
      case 'search_drive_files':
        return await mcpTools.searchDriveFiles(params.query, params.pageSize);
      case 'list_drive_folder_files':
        return await mcpTools.listDriveFolderFiles(params.folderId, params.pageSize);
      case 'get_drive_folder_path':
        return await mcpTools.getDriveFolderPath(params.fileId);
      case 'get_drive_about':
        return await mcpTools.getDriveAbout();
      case 'list_drive_shared_files':
        return await mcpTools.listDriveSharedFiles(params.pageSize);
      case 'list_drive_recent_files':
        return await mcpTools.listDriveRecentFiles(params.pageSize);
      
      // Discord tools
      case 'get_discord_channel':
        return await mcpTools.getDiscordChannel(params.channelId);
      case 'list_discord_channel_messages':
        return await mcpTools.listDiscordChannelMessages(params.channelId, params.limit, params.before, params.after, params.around);
      case 'get_discord_message':
        return await mcpTools.getDiscordMessage(params.channelId, params.messageId);
      case 'get_discord_guild':
        return await mcpTools.getDiscordGuild(params.guildId);
      case 'list_discord_guild_channels':
        return await mcpTools.listDiscordGuildChannels(params.guildId);
      case 'get_discord_guild_member':
        return await mcpTools.getDiscordGuildMember(params.guildId, params.userId);
      case 'list_discord_guild_members':
        return await mcpTools.listDiscordGuildMembers(params.guildId, params.limit, params.after);
      case 'get_discord_user':
        return await mcpTools.getDiscordUser(params.userId);
      case 'get_discord_bot_user':
        return await mcpTools.getDiscordBotUser();
      case 'list_discord_guilds':
        return await mcpTools.listDiscordGuilds(params.limit, params.before, params.after);
      case 'get_discord_message_reactions':
        return await mcpTools.getDiscordMessageReactions(params.channelId, params.messageId, params.emoji);
      case 'search_discord_messages':
        return await mcpTools.searchDiscordMessages(params.channelId, params.query, params.limit);
      
      // Transcripts tools
      case 'get_transcripts':
        const transcriptsResult = mcpTools.getTranscripts();
        if (transcriptsResult.error) {
          return { error: transcriptsResult.error, suggestion: 'No transcripts found. Please record a meeting or upload an audio file first.' };
        }
        return transcriptsResult;
      case 'get_transcript':
        // If transcriptId is null, missing, or empty, use get_latest_transcript instead
        if (params?.fileName) {
          const byFile = mcpTools.getTranscriptByFileName(params.fileName);
          if (byFile.error) {
            return { error: byFile.error, suggestion: 'Transcript not found for that file name. Use get_transcripts to list available names or provide a valid transcriptId.' };
          }
          return byFile;
        }
        if (params?.currentTranscript) {
          const latest = mcpTools.getLatestTranscript();
          if (latest.error) {
            return { error: latest.error, suggestion: 'No transcripts found. Please record a meeting first.' };
          }
          return latest;
        }
        if (!params || !params.transcriptId || params.transcriptId === null || params.transcriptId === '') {
          console.log('get_transcript called without ID, using get_latest_transcript instead');
          const result = mcpTools.getLatestTranscript();
          if (result.error) {
            return { error: result.error, suggestion: 'No transcripts found. Please record a meeting first.' };
          }
          return result;
        }
        return mcpTools.getTranscript(params.transcriptId);
      case 'search_transcripts':
        return mcpTools.searchTranscripts(params.query);
      case 'get_latest_transcript':
        return mcpTools.getLatestTranscript();
      case 'find_sentences_in_latest_transcript':
        return mcpTools.findSentencesInLatest(params.keyword);
      case 'find_sentences_in_transcript':
        return mcpTools.findSentencesInTranscript(params.fileName, params.keyword);
      case 'summarize_keyword_in_latest_transcript':
        return mcpTools.summarizeKeywordInLatest(params.keyword);
      case 'summarize_keyword_in_transcript':
        return mcpTools.summarizeKeywordInTranscript(params.fileName, params.keyword);
      
      default:
        console.error(`Unknown tool: ${toolName}`);
        return { error: `Unknown tool: ${toolName}` };
    }
  } catch (error) {
    console.error(`Error executing tool ${toolName}:`, error);
    return { error: error.message };
  }
}

// API Routes

// Root route - Serve HTML for browsers, JSON for API clients
app.get('/', (req, res) => {
  const acceptHeader = req.headers.accept || '';
  // If browser requests HTML, serve the HTML page with thumbnail
  if (acceptHeader.includes('text/html')) {
    res.sendFile(join(__dirname, 'public', 'index.html'));
  } else {
    // Otherwise serve JSON for API clients
    res.json({
      message: 'AI Unseen Workspace API Server',
      version: '1.0.0',
      endpoints: {
        chats: '/api/chats',
        messages: '/api/chats/:id/messages',
        llm: '/api/llm/chat',
        models: '/api/llm/models',
        status: '/api/llm/status',
        mcpTools: '/api/mcp/tools',
        transcripts: '/api/transcripts',
        transcribe: '/api/transcribe',
        transcribeWhisper: '/api/transcribe-whisper'
      },
      frontend: 'http://localhost:5174',
      documentation: 'See README.md for API usage'
    });
  }
});

// Chat management
app.get('/api/chats', (req, res) => {
  const chats = db.prepare('SELECT * FROM chats ORDER BY updated_at DESC').all();
  res.json(chats);
});

app.post('/api/chats', (req, res) => {
  const id = uuidv4();
  const title = req.body.title || 'New Chat';
  const timestamp = Date.now();
  
  db.prepare('INSERT INTO chats (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)')
    .run(id, title, timestamp, timestamp);
  
  res.json({ id, title, created_at: timestamp, updated_at: timestamp });
});

app.delete('/api/chats/:id', (req, res) => {
  db.prepare('DELETE FROM chats WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.put('/api/chats/:id', (req, res) => {
  const { title } = req.body;
  const timestamp = Date.now();
  
  db.prepare('UPDATE chats SET title = ?, updated_at = ? WHERE id = ?')
    .run(title, timestamp, req.params.id);
  
  res.json({ success: true, title, updated_at: timestamp });
});

// Transcripts API (file-based)
app.post('/api/transcripts', (req, res) => {
  const { title, transcript_text, audio_file_name, duration } = req.body;
  const result = transcriptsStore.saveTranscript({ title, transcript_text, audio_file_name, duration });
  if (result.error) {
    return res.status(400).json({ error: result.error });
  }
  res.json(result);
});

app.get('/api/transcripts', (req, res) => {
  const result = transcriptsStore.getTranscripts();
  if (result.error) {
    return res.status(500).json({ error: result.error });
  }
  res.json(result.transcripts);
});

app.get('/api/transcripts/:id', (req, res) => {
  const result = transcriptsStore.getTranscript(req.params.id);
  if (result.error) {
    return res.status(404).json({ error: result.error });
  }
  res.json(result);
});

app.delete('/api/transcripts/:id', (req, res) => {
  const result = transcriptsStore.deleteTranscript(req.params.id);
  if (result.error) {
    return res.status(404).json({ error: result.error });
  }
  res.json({ success: true });
});

// Scratchpad endpoints
app.get('/api/scratchpad', (req, res) => {
  try {
    const content = readScratchpadFile();
    res.json({ content });
  } catch (error) {
    console.error('Error reading scratchpad:', error);
    res.status(500).json({ error: 'Failed to read scratchpad' });
  }
});

app.post('/api/scratchpad', (req, res) => {
  try {
    const { content } = req.body;
    const success = writeScratchpadFile(content || '');
    if (success) {
      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'Failed to write scratchpad' });
    }
  } catch (error) {
    console.error('Error writing scratchpad:', error);
    res.status(500).json({ error: 'Failed to write scratchpad' });
  }
});

// Serve audio files for download/transcription
app.get('/api/audio/:filename', (req, res) => {
  const fileName = req.params.filename;
  const filePath = join(AUDIO_DIR, fileName);

  console.log('🎵 Audio download request:', { fileName, AUDIO_DIR, filePath, exists: fs.existsSync(filePath) });

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.log('❌ Audio file not found:', filePath);
    return res.status(404).json({ error: 'Audio file not found' });
  }

  // Set appropriate headers for audio file
  const ext = extname(fileName).toLowerCase();
  const mimeType = ext === '.webm' ? 'audio/webm' :
                   ext === '.mp3' ? 'audio/mpeg' :
                   ext === '.wav' ? 'audio/wav' :
                   'application/octet-stream';

  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

  // Stream the file
  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);

  fileStream.on('error', (error) => {
    console.error('Error streaming audio file:', error);
    res.status(500).json({ error: 'Error reading audio file' });
  });
});

// Get list of audio files with metadata
app.get('/api/audio-files', (req, res) => {
  try {
    const audioDir = join(__dirname, 'audio');
    if (!fs.existsSync(audioDir)) {
      return res.json({ audioFiles: [] });
    }

    const files = fs.readdirSync(audioDir);
    const audioFiles = [];

    for (const file of files) {
      const filePath = join(audioDir, file);
      const stats = fs.statSync(filePath);

      // Extract timestamp from filename (first part before first dash)
      const timestampMatch = file.match(/^(\d+)-/);
      let recordingTime = null;

      if (timestampMatch) {
        const timestamp = parseInt(timestampMatch[1]);
        recordingTime = new Date(timestamp).toISOString();
      } else {
        // Fallback to file modification time
        recordingTime = stats.mtime.toISOString();
      }

      // Determine file type and duration estimate
      const ext = extname(file).toLowerCase();
      let type = 'upload';
      let duration = 0;

      if (file.includes('recording-')) {
        type = 'recording';
        // Estimate duration from file size (rough approximation)
        // For WebM/OGG/MP3: ~1KB ≈ 0.06 seconds at 128kbps
        duration = Math.round((stats.size / 1024) * 0.06);
      }

      audioFiles.push({
        fileName: file,
        fileSize: stats.size,
        recordingTime: recordingTime,
        type: type,
        duration: duration
      });
    }

    // Sort by recording time (newest first)
    audioFiles.sort((a, b) => new Date(b.recordingTime) - new Date(a.recordingTime));

    res.json({ audioFiles });
  } catch (error) {
    console.error('Error getting audio files:', error);
    res.status(500).json({ error: 'Failed to get audio files' });
  }
});

app.get('/api/chats/:id/messages', (req, res) => {
  const messages = db.prepare('SELECT * FROM messages WHERE chat_id = ? ORDER BY timestamp ASC')
    .all(req.params.id);
  res.json(messages);
});

app.post('/api/chats/:id/messages', (req, res) => {
  const messageId = uuidv4();
  const { role, content } = req.body;
  const timestamp = Date.now();
  
  db.prepare('INSERT INTO messages (id, chat_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?)')
    .run(messageId, req.params.id, role, content, timestamp);
  
  db.prepare('UPDATE chats SET updated_at = ? WHERE id = ?')
    .run(timestamp, req.params.id);
  
  res.json({ id: messageId, chat_id: req.params.id, role, content, timestamp });
});

// LLM integration with tool calling support
app.post('/api/llm/chat', async (req, res) => {
  const { model, messages, provider = 'ollama', enableTools = true } = req.body;
  
  try {
    if (provider === 'ollama') {
      const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
      
      // Set up streaming response
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      let conversationMessages = [...messages];
      let toolCallsDetected = false;
      let lastToolResult = null;
      
      // Detect if user query needs tools
      const lastUserMessageRaw = messages[messages.length - 1]?.content || '';
      const lastUserMessage = lastUserMessageRaw?.toLowerCase() || '';
      
      // Tool detection patterns (multilingual support)
      const needsWeatherTool = /weather|temperature|forecast|climat|météo|temps|fait-il|tiempo|hace|wetter|wie ist|天気|てんき|tiānqì|天气/i.test(lastUserMessage);
      const needsAddTool = /add|sum|plus|\+|calculate/i.test(lastUserMessage);
      const needsMathTool = /(\d\s*[\+\-\*\/\^]\s*\d)|\b(sin|cos|tan|asin|acos|atan|exp|log|ln|sqrt|abs|min|max)\s*\(|\bpi\b|π|log\(/i.test(lastUserMessageRaw);
      const needsJiraTool = /jira|issue|project|ticket|bug|story|epic/i.test(lastUserMessage);
      const needsSlackTool = /slack|channel|message|workspace|thread/i.test(lastUserMessage);
      const needsGithubTool = /github|git|repository|repo|pull request|pr|issue|commit/i.test(lastUserMessage);
      const needsPerforceTool = /perforce|p4|changelist|depot|workspace|client/i.test(lastUserMessage);
      const needsConfluenceTool = /confluence|page|space|wiki|documentation/i.test(lastUserMessage);
      const needsGmailTool = /gmail|email|mail|message|inbox|unread|sent/i.test(lastUserMessage);
      const needsCalendarTool = /calendar|event|meeting|appointment|schedule|agenda/i.test(lastUserMessage);
      const needsDriveTool = /drive|file|document|folder|google drive|gdrive/i.test(lastUserMessage);
      const needsDiscordTool = /discord|guild|server|channel|dm|direct message/i.test(lastUserMessage);
      // More aggressive detection for sentence/mention queries - but ONLY when explicitly about transcripts
      const hasTranscriptContext = /transcript|recording|meeting|audio file|what was said|what did.*say/i.test(lastUserMessage);
      const sentenceQuery = hasTranscriptContext && /sentences?.*(?:word|appear|mentioned|containing|where)/i.test(lastUserMessageRaw);
      const mentionQuery = hasTranscriptContext && (
        /(?:is|are|was|were)\s+["']?[A-Za-z0-9\- ]+?\s+(?:mentioned|talked\s+about)/i.test(lastUserMessageRaw) ||
        /(?:where|which|that)\s+["']?[A-Za-z0-9\- ]+?\s+is\s+(?:mentioned|talked\s+about)/i.test(lastUserMessageRaw)
      );
      const needsTranscriptTool = /transcript|recording|meeting notes|what was said|what did.*say|display.*transcript|show.*transcript|summarize.*transcript|find.*transcript|search.*transcript|transcript file|what.*in.*transcript|words.*transcript|topics.*transcript/i.test(lastUserMessage) || sentenceQuery || mentionQuery;
      
      const needsTools = needsWeatherTool || needsAddTool || needsJiraTool || 
                        needsSlackTool || needsGithubTool || needsPerforceTool || needsConfluenceTool ||
                        needsGmailTool || needsCalendarTool || needsDriveTool || needsDiscordTool || needsTranscriptTool || needsMathTool;
      
      console.log('User message:', lastUserMessage);
      console.log('Needs tools:', needsTools);
      if (needsTranscriptTool) {
        console.log('[TRANSCRIPT] Transcript tool needed. Sentence query:', sentenceQuery, 'Mention query:', mentionQuery);
      }
      
        // Fast-path transcript requests: fetch transcript and optionally summarize
        // IMPORTANT: Only execute fast-path if we're CERTAIN this is a transcript query
        // Double-check that we have explicit transcript context before proceeding
        if (enableTools && needsTranscriptTool) {
        // Normalize smart quotes for matching
        const transcriptMessage = lastUserMessageRaw.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
        
        // Additional safety check: verify explicit transcript context exists
        const explicitTranscriptContext = /transcript|recording|meeting|audio file|what was said|what did.*say/i.test(transcriptMessage.toLowerCase());
        if (!explicitTranscriptContext) {
          console.log('[FAST-PATH] Skipping fast-path - no explicit transcript context detected. Query will be handled by LLM without transcript tools.');
          // Fall through to normal LLM processing without fast-path
        } else {
          console.log('[FAST-PATH] Explicit transcript context detected, proceeding with fast-path');

          // Check for "latest/most recent/last transcript" intent (robust, including "transcript file")
          const wantsLatestTranscript =
            /latest|most recent|last/i.test(transcriptMessage) &&
            /\btranscript\b/i.test(transcriptMessage);
          const wantsLatestTranscriptFile =
            /latest|most recent|last/i.test(transcriptMessage) &&
            /(transcript\s+file|file\s+transcript)/i.test(transcriptMessage);

          if (wantsLatestTranscript || wantsLatestTranscriptFile) {
            res.write(`data: ${JSON.stringify({ type: 'tool_call', tool: 'get_latest_transcript', params: {} })}\n\n`);
            const toolResult = await executeTool('get_latest_transcript', {});
            res.write(`data: ${JSON.stringify({ type: 'tool_result', tool: 'get_latest_transcript', result: toolResult })}\n\n`);

            const title = toolResult.title || 'Latest transcript';
            const body = toolResult.transcript_text || '(no content)';
            const content = toolResult.error
              ? `I couldn't fetch the latest transcript: ${toolResult.error}`
              : `Here is ${title}:\n\n${body}`;

            res.write(`data: ${JSON.stringify({ content })}\n\n`);
            res.write('data: [DONE]\n\n');
            return res.end();
          }

          // Try to extract a keyword for sentence-level or mention queries FIRST (before transcript name matching)
          // Also check if a specific transcript filename was mentioned
          const transcriptNameInSentenceQuery = transcriptMessage.match(/transcript(?: file)?[^"'\n]*["']([^"']+)["']/i) ||
            transcriptMessage.match(/transcript(?: file)?\s*[:\-]?\s*([A-Za-z0-9 _\-,.()]+)/i);
          
          const sentenceKeywordMatch =
            // sentences where the word X appears
            lastUserMessageRaw.match(/sentences?.*?\bword\b\s+["']?([A-Za-z0-9\-_]+)["']?/i) ||
          // sentences where the word foo bar appears
          lastUserMessageRaw.match(/sentences?.*?\bword\b\s+([A-Za-z0-9\-_ ]+?)\s+appears?/i) ||
          // "sentences where X is mentioned" - more flexible pattern (MOST IMPORTANT - catches "sentences where 'Anna' is mentioned")
          lastUserMessageRaw.match(/sentences?.*?where\s+["']?([A-Za-z0-9\-_ ]+?)["']?\s+is\s+mentioned/i) ||
          // "sentences where X" or "sentences containing X"
          lastUserMessageRaw.match(/sentences?.*?(?:where|containing|with)\s+["']?([A-Za-z0-9\-_ ]+?)(?:\s+is\s+mentioned|["']?)(?:\s|$|\.|\?)/i) ||
          // "where the word X is mentioned" (doesn't require "sentences" at start) - catches "is there a place where the word 'Anna' is mentioned"
          lastUserMessageRaw.match(/where\s+(?:the\s+)?\bword\b\s+["']?([A-Za-z0-9\-_ ]+?)["']?\s+is\s+mentioned/i) ||
          // "where X is mentioned" (more general, doesn't require "sentences" or "word")
          lastUserMessageRaw.match(/where\s+["']?([A-Za-z0-9\-_ ]+?)["']?\s+is\s+mentioned/i) ||
          // quoted keyword (but not if it's a transcript filename) - catch "sentences where 'X'"
          (!transcriptNameInSentenceQuery && lastUserMessageRaw.match(/sentences?.*?where\s+(["'][^"']+["'])/i)) ||
          // quoted keyword anywhere in sentence query (but not if it's a transcript filename)
          (!transcriptNameInSentenceQuery && lastUserMessageRaw.match(/sentences?.*?(["'][^"']+["'])/i)) ||
          // simple: "sentences where X" 
          lastUserMessageRaw.match(/sentences?.*?where\s+["']?([A-Za-z0-9\-_ ]+?)["']?(?:\s|$|\.|\?)/i);
        
          // Only check for mention keywords (removed "about X" pattern - too broad)
          const mentionKeywordMatch = (
            // "where X is mentioned" or "that X is mentioned"
            lastUserMessageRaw.match(/(?:where|which|that)\s+["']?([A-Za-z0-9\- ]+?)\s+is\s+(?:mentioned|talked\s+about)/i) ||
            // "does X mention Y?" or "does it mention Y?" - capture Y after "mention" (preferred)
            lastUserMessageRaw.match(/(?:is|does).*?mention\s+["']?([A-Za-z0-9\- ]+?)["']?(?:\s|$|\.|\?)/i) ||
          // "is X mentioned?" - only if X is a single word (not "this transcript")
          lastUserMessageRaw.match(/(?:is|does)\s+["']?([A-Za-z0-9\-]{1,20})\s+mentioned/i) ||
            // "mention X" or "talk about X" in transcript context only
            lastUserMessageRaw.match(/\b(mention|talk about)\s+["']?([A-Za-z0-9\- ]+)["']?/i)
          );

        // If user asked for sentences containing a word - CHECK THIS FIRST before transcript name matching
        if (sentenceKeywordMatch) {
          const keyword = (sentenceKeywordMatch[1] || '').replace(/["']/g, '').trim();
          console.log(`[FAST-PATH] Sentence keyword query detected. Keyword: "${keyword}", Transcript: ${transcriptNameInSentenceQuery ? transcriptNameInSentenceQuery[1] : 'latest'}`);
          
          // If a specific transcript was mentioned, search that transcript
          if (transcriptNameInSentenceQuery) {
            const fileName = (transcriptNameInSentenceQuery[1] || '').trim();
            res.write(`data: ${JSON.stringify({ type: 'tool_call', tool: 'find_sentences_in_transcript', params: { fileName, keyword } })}\n\n`);
            const toolResult = await executeTool('find_sentences_in_transcript', { fileName, keyword });
            res.write(`data: ${JSON.stringify({ type: 'tool_result', tool: 'find_sentences_in_transcript', result: toolResult })}\n\n`);

            const content = toolResult?.error
              ? `I couldn't search the transcript "${fileName}": ${toolResult.error}`
              : (toolResult?.sentences?.length
                ? `Found ${toolResult.sentences.length} sentence(s) with "${keyword}" in ${toolResult.title || fileName}:\n\n${toolResult.sentences.join('\n')}`
                : `No sentences found containing "${keyword}" in ${toolResult.title || fileName}.`);

            res.write(`data: ${JSON.stringify({ content })}\n\n`);
            res.write('data: [DONE]\n\n');
            return res.end();
          } else {
            // Use latest transcript
            res.write(`data: ${JSON.stringify({ type: 'tool_call', tool: 'find_sentences_in_latest_transcript', params: { keyword } })}\n\n`);
            const toolResult = await executeTool('find_sentences_in_latest_transcript', { keyword });
            res.write(`data: ${JSON.stringify({ type: 'tool_result', tool: 'find_sentences_in_latest_transcript', result: toolResult })}\n\n`);

            const content = toolResult?.error
              ? `I couldn't search the transcript: ${toolResult.error}`
              : (toolResult?.sentences?.length
                ? `Found ${toolResult.sentences.length} sentence(s) with "${keyword}" in ${toolResult.title || 'the latest transcript'}:\n\n${toolResult.sentences.join('\n')}`
                : `No sentences found containing "${keyword}" in the latest transcript.`);

            res.write(`data: ${JSON.stringify({ content })}\n\n`);
            res.write('data: [DONE]\n\n');
            return res.end();
          }
        }

        // If user asked whether transcript mentions X or talks about X, summarize the keyword
        if (mentionKeywordMatch) {
          // Some patterns capture in group 1, others in group 2
          const keyword = (mentionKeywordMatch[1] || mentionKeywordMatch[2] || '').replace(/["']/g, '').trim();
          
          // Check if a specific transcript filename was mentioned
          const transcriptNameInMentionQuery = transcriptMessage.match(/transcript(?: file)?[^"'\n]*["']([^"']+)["']/i) ||
            transcriptMessage.match(/transcript(?: file)?\s*[:\-]?\s*([A-Za-z0-9 _\-,.()]+)/i);
          
          console.log(`[FAST-PATH] Mention keyword query detected. Keyword: "${keyword}", Transcript: ${transcriptNameInMentionQuery ? transcriptNameInMentionQuery[1] : 'latest'}`);
          
          if (transcriptNameInMentionQuery && keyword) {
            const fileName = (transcriptNameInMentionQuery[1] || '').trim();
            res.write(`data: ${JSON.stringify({ type: 'tool_call', tool: 'summarize_keyword_in_transcript', params: { fileName, keyword } })}\n\n`);
            const toolResult = await executeTool('summarize_keyword_in_transcript', { fileName, keyword });
            res.write(`data: ${JSON.stringify({ type: 'tool_result', tool: 'summarize_keyword_in_transcript', result: toolResult })}\n\n`);

            const content = toolResult?.error
              ? `I couldn't summarize "${keyword}" in "${fileName}": ${toolResult.error}`
              : (toolResult?.summary || `Mentions of "${keyword}" in "${fileName}":\n\n${(toolResult.sentences || []).join('\n')}`);

            res.write(`data: ${JSON.stringify({ content })}\n\n`);
            res.write('data: [DONE]\n\n');
            return res.end();
          }
          
          // Default: search latest transcript
          res.write(`data: ${JSON.stringify({ type: 'tool_call', tool: 'summarize_keyword_in_latest_transcript', params: { keyword } })}\n\n`);
          const toolResult = await executeTool('summarize_keyword_in_latest_transcript', { keyword });
          res.write(`data: ${JSON.stringify({ type: 'tool_result', tool: 'summarize_keyword_in_latest_transcript', result: toolResult })}\n\n`);

          const content = toolResult?.error
            ? `I couldn't summarize "${keyword}": ${toolResult.error}`
            : (toolResult?.summary || `Mentions of "${keyword}":\n\n${(toolResult.sentences || []).join('\n')}`);

          res.write(`data: ${JSON.stringify({ content })}\n\n`);
          res.write('data: [DONE]\n\n');
          return res.end();
        }
        } // End of explicitTranscriptContext check - if no explicit context, skip fast-path and continue to normal LLM processing

        // Try to extract an explicit transcript file/name (robust to partial phrasing) - ONLY if no sentence/mention query
        const transcriptNameMatch =
          transcriptMessage.match(/transcript(?: file)?[^"'\n]*["']([^"']+)["']/i) || // quoted name after "transcript"
          transcriptMessage.match(/transcript(?: file)?\s*[:\-]?\s*([A-Za-z0-9 _\-,.()]+)/i) || // unquoted name after transcript
          (transcriptMessage.toLowerCase().includes('transcript') && transcriptMessage.match(/["']([^"']+)["']/)) || // any quoted string if "transcript" present
          null;

        if (transcriptNameMatch) {
          const fileName = (transcriptNameMatch[1] || '').trim();
          const genericName = /^(file|transcript|latest|last|recent|most recent)$/i.test(fileName);
          const wantsLatestByName = /latest|last|recent/i.test(transcriptMessage) && /file/i.test(fileName);
          const wantsSummary = /summary|summarize|summarise|brief|short version|tl;dr/i.test(lastUserMessage);

          // Treat generic or "latest ... file" captures as latest transcript
          if (genericName || wantsLatestByName) {
            res.write(`data: ${JSON.stringify({ type: 'tool_call', tool: 'get_latest_transcript', params: {} })}\n\n`);
            const toolResult = await executeTool('get_latest_transcript', {});
            res.write(`data: ${JSON.stringify({ type: 'tool_result', tool: 'get_latest_transcript', result: toolResult })}\n\n`);

            const title = toolResult.title || 'Latest transcript';
            const body = toolResult.transcript_text || '(no content)';
            let content;
            if (toolResult.error) {
              content = `I couldn't fetch the latest transcript: ${toolResult.error}`;
            } else if (wantsSummary) {
              try {
                const summaryPrompt = [
                  { role: 'system', content: 'Summarize the following transcript in a few concise sentences.' },
                  { role: 'user', content: `Title: ${title}\nTranscript:\n${body}` }
                ];
                const summaryResp = await axios.post(`${ollamaUrl}/api/chat`, {
                  model: model || process.env.DEFAULT_MODEL || 'qwen2.5:1.5b',
                  messages: summaryPrompt,
                  stream: false
                }, { timeout: 20000 });
                const summary = summaryResp.data?.message?.content?.trim();
                content = summary || `Here is ${title} (summary unavailable):\n\n${body}`;
              } catch (err) {
                content = `Here is ${title} (summary failed):\n\n${body}`;
              }
            } else {
              content = `Here is ${title}:\n\n${body}`;
            }

            res.write(`data: ${JSON.stringify({ content })}\n\n`);
            res.write('data: [DONE]\n\n');
            return res.end();
          }

          // Explicit non-generic name
          if (fileName && !/^(file|transcript|latest|last|recent)$/i.test(fileName)) {
            // Re-check summarization intent with both raw and lowercase messages
            const wantsSummaryCheck = /summary|summarize|summarise|brief|short version|tl;dr/i.test(lastUserMessage) || 
                                     /summary|summarize|summarise|brief|short version|tl;dr/i.test(lastUserMessageRaw);
            
            res.write(`data: ${JSON.stringify({ type: 'tool_call', tool: 'get_transcript', params: { fileName } })}\n\n`);
            const toolResult = await executeTool('get_transcript', { fileName });
            res.write(`data: ${JSON.stringify({ type: 'tool_result', tool: 'get_transcript', result: toolResult })}\n\n`);

            let content;
            if (toolResult.error) {
              content = `I couldn't fetch the transcript "${fileName}": ${toolResult.error}${toolResult.suggestions ? `\nSuggestions: ${toolResult.suggestions.join(', ')}` : ''}`;
            } else {
              const title = toolResult.title || fileName;
              const body = toolResult.transcript_text || '(no content)';
              if (wantsSummaryCheck) {
                try {
                  const summaryPrompt = [
                    { role: 'system', content: 'Summarize the following transcript in a few concise sentences.' },
                    { role: 'user', content: `Title: ${title}\nTranscript:\n${body}` }
                  ];
                  const summaryResp = await axios.post(`${ollamaUrl}/api/chat`, {
                    model: model || process.env.DEFAULT_MODEL || 'qwen2.5:1.5b',
                    messages: summaryPrompt,
                    stream: false
                  }, { timeout: 120000 }); // Increased from 20s to 120s for long transcripts
                  const summary = summaryResp.data?.message?.content?.trim();
                  content = summary || `Here is ${title} (summary unavailable):\n\n${body}`;
                } catch (err) {
                  content = `Here is ${title} (summary failed):\n\n${body}`;
                }
              } else {
                content = `Here is ${title}:\n\n${body}`;
              }
            }

            res.write(`data: ${JSON.stringify({ content })}\n\n`);
            res.write('data: [DONE]\n\n');
            return res.end();
          }
        }

          // Send tool call + result events so the frontend shows MCP activity
          res.write(`data: ${JSON.stringify({ type: 'tool_call', tool: 'get_latest_transcript', params: {} })}\n\n`);
          const toolResult = await executeTool('get_latest_transcript', {});
          res.write(`data: ${JSON.stringify({ type: 'tool_result', tool: 'get_latest_transcript', result: toolResult })}\n\n`);
          
          const wantsSummary = /summary|summarize|summarise|brief|short version|tl;dr/i.test(lastUserMessage);
          const title = toolResult.title || 'Latest transcript';
          const body = toolResult.transcript_text || '(no content)';
          
          // If user asked to summarize, try LLM summary with fallback
          if (wantsSummary && !toolResult.error) {
            try {
              const summaryPrompt = [
                { role: 'system', content: 'Summarize the following transcript in a few concise sentences.' },
                { role: 'user', content: `Title: ${title}\nTranscript:\n${body}` }
              ];
              const summaryResp = await axios.post(`${ollamaUrl}/api/chat`, {
                model: model || process.env.DEFAULT_MODEL || 'qwen2.5:1.5b',
                messages: summaryPrompt,
                stream: false
              }, { timeout: 120000 }); // 2 minutes for summarization
              
              const summary = summaryResp.data?.message?.content?.trim();
              const content = summary || `Here is ${title} (summary unavailable):\n\n${body}`;
              res.write(`data: ${JSON.stringify({ content })}\n\n`);
              res.write('data: [DONE]\n\n');
              return res.end();
            } catch (err) {
              const fallback = `Here is ${title} (summary failed):\n\n${body}`;
              res.write(`data: ${JSON.stringify({ content: fallback })}\n\n`);
              res.write('data: [DONE]\n\n');
              return res.end();
            }
          }

          // Default: return full transcript (or error)
          let content;
          if (toolResult.error) {
            content = `I couldn't fetch the transcript: ${toolResult.error}`;
          } else {
            content = `Here is ${title}:\n\n${body}`;
          }
          
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
          res.write('data: [DONE]\n\n');
          return res.end();
        }

      // Fast-path math/calculator: deterministic tool execution for expressions
      if (enableTools && needsMathTool) {
        // Extract expression from the user message (strip helper phrases)
        let expr = lastUserMessageRaw.replace(/[?!？！，、。]+$/g, '').trim();
        expr = expr.replace(/^(what\s+is|what's|calculate|compute|eval(uate)?|please\s+compute|please\s+calculate|can\s+you\s+compute|can\s+you\s+calculate)\s+/i, '');
        expr = expr.replace(/^(the\s+value\s+of\s+)/i, '');
        expr = expr.trim();

        // If still empty, fall back to the raw (punctuation-stripped) message
        if (!expr) {
          expr = lastUserMessageRaw.replace(/[?!？！，、。]+$/g, '').trim();
        }

        res.write(`data: ${JSON.stringify({ type: 'tool_call', tool: 'calculator', params: { expression: expr } })}\n\n`);
        const toolResult = await executeTool('calculator', { expression: expr });
        res.write(`data: ${JSON.stringify({ type: 'tool_result', tool: 'calculator', result: toolResult })}\n\n`);

        let finalContent;
        if (toolResult?.error) {
          finalContent = `Calculator error: ${toolResult.error}`;
        } else {
          finalContent = `Result: ${toolResult.result}`;
        }

        res.write(`data: ${JSON.stringify({ type: 'final_response' })}\n\n`);
        const chunkSize = 5;
        for (let i = 0; i < finalContent.length; i += chunkSize) {
          const chunk = finalContent.slice(i, i + chunkSize);
          res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        res.write('data: [DONE]\n\n');
        return res.end();
      }

      // Fast-path weather requests: extract city and call weather tool directly
      if (enableTools && needsWeatherTool) {
        // Try to extract city name from the message - handle both capitalized and lowercase
        const cityMatch = lastUserMessage.match(/(?:weather|temperature|forecast|climat|météo).*?(?:in|at|for|of)\s+([a-zA-Z\s]+?)(?:\?|$|\.|,)/i) ||
                        lastUserMessage.match(/(?:weather|temperature|forecast|climat|météo)\s+(?:in|at|for|of)?\s*([a-zA-Z\s]+?)(?:\?|$|\.|,)/i) ||
                        lastUserMessage.match(/([a-zA-Z\s]+?)(?:\s+weather|\s+temperature|\s+forecast)/i);
        
        let city = cityMatch ? cityMatch[1].trim() : null;
        
        // If no city found, try common patterns (case-insensitive)
        if (!city) {
          // Check for common city names in the message
          const commonCities = ['Paris', 'London', 'New York', 'Tokyo', 'Berlin', 'Madrid', 'Rome', 'Amsterdam', 'Vienna', 'Barcelona', 'New York City', 'Los Angeles', 'San Francisco', 'Chicago', 'Miami', 'Seattle'];
          for (const commonCity of commonCities) {
            if (lastUserMessage.toLowerCase().includes(commonCity.toLowerCase())) {
              city = commonCity;
              break;
            }
          }
        }
        
        // If still no city, try to find any capitalized word (likely a city name)
        if (!city) {
          const words = lastUserMessage.split(/\s+/);
          // Look for capitalized words that aren't common words
          const commonWords = ['what', 'is', 'the', 'weather', 'in', 'at', 'for', 'of', 'temperature', 'forecast'];
          const capitalizedWords = words.filter(w => 
            /^[A-Z][a-z]+$/.test(w) && !commonWords.includes(w.toLowerCase())
          );
          if (capitalizedWords.length > 0) {
            city = capitalizedWords[capitalizedWords.length - 1];
          }
        }
        
        // Last resort: if message is simple like "weather in paris", extract the word after "in"
        if (!city) {
          const inMatch = lastUserMessage.match(/\bin\s+([a-z]+)/i);
          if (inMatch) {
            city = inMatch[1].charAt(0).toUpperCase() + inMatch[1].slice(1);
          }
        }
        
        if (city) {
          console.log(`Fast-path weather request for city: ${city}`);
          // Send tool call + result events so the frontend shows MCP activity
          res.write(`data: ${JSON.stringify({ type: 'tool_call', tool: 'get_weather', params: { city } })}\n\n`);
          const toolResult = await executeTool('get_weather', { city });
          res.write(`data: ${JSON.stringify({ type: 'tool_result', tool: 'get_weather', result: toolResult })}\n\n`);
          
          // Concise summary for LLM (use only current request context to avoid prior city bleed)
          let summary;
          if (toolResult?.error) {
            summary = `Error for ${city}: ${toolResult.error}`;
          } else {
            const t = toolResult;
            summary = `${t?.location || city}: ${t?.conditions || 'N/A'}, ${t?.temperature || 'N/A'}, feels like ${t?.feels_like || 'N/A'}, humidity ${t?.humidity || 'N/A'}, wind ${t?.wind_speed || 'N/A'}, precipitation ${t?.precipitation || 'N/A'}`;
          }

          // Generate a natural response using ONLY this request (no prior conversation to avoid cross-city contamination)
          const weatherMessages = [
            { role: 'system', content: 'You are a concise assistant. Answer with the provided weather summary only. Do not ask questions. Do not mix with prior context.' },
            { role: 'assistant', content: `Weather summary for ${city}: ${summary}` },
            { role: 'user', content: 'Reply to the user with this weather information.' }
          ];
          
          try {
            // Get final response from LLM
            const finalResponse = await axios.post(`${ollamaUrl}/api/chat`, {
              model: model || process.env.DEFAULT_MODEL || 'qwen2.5:1.5b',
              messages: weatherMessages,
              options: { temperature: 0.2, top_p: 0.9 },
              stream: false
            }, {
              timeout: 30000 // 30 second timeout for final response
            });
            
            console.log('Weather LLM raw response:', JSON.stringify(finalResponse.data || {}, null, 2));
            logWeatherDebug(`success response: ${JSON.stringify(finalResponse.data || {}, null, 2)}`);

            let finalContent = finalResponse.data?.message?.content?.trim() || '';
            if (!finalContent) {
              finalContent = 'LLM returned empty content for weather response.';
            }

            res.write(`data: ${JSON.stringify({ type: 'final_response' })}\n\n`);
            
            // Stream the final content
            const chunkSize = 5;
            for (let i = 0; i < finalContent.length; i += chunkSize) {
              const chunk = finalContent.slice(i, i + chunkSize);
              res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
              await new Promise(resolve => setTimeout(resolve, 20));
            }
            
            res.write('data: [DONE]\n\n');
            return res.end();
          } catch (err) {
            console.error('Weather LLM call failed:', err.message, err.response?.data);
            logWeatherDebug(`error: ${err.message} response: ${JSON.stringify(err.response?.data || null)}`);
            const fallback = `Weather response failed: ${err.message}`;
            res.write(`data: ${JSON.stringify({ type: 'final_response' })}\n\n`);
            res.write(`data: ${JSON.stringify({ content: fallback })}\n\n`);
            res.write('data: [DONE]\n\n');
            return res.end();
          }
        }
      }
      
      // Filter tools based on what's actually needed
      // MCP Tools should ALWAYS be active, but transcript tools only when explicitly needed
      let filteredToolsDefinition = toolsDefinition;
      if (enableTools && needsTools) {
        // Only include transcript tools if explicitly needed
        if (!needsTranscriptTool) {
          filteredToolsDefinition = toolsDefinition.filter(t => {
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
          console.log(`[TOOLS] Filtered out transcript tools. ${filteredToolsDefinition.length} tools available (${toolsDefinition.length - filteredToolsDefinition.length} transcript tools excluded)`);
        } else {
          console.log(`[TOOLS] Transcript tools INCLUDED. ${filteredToolsDefinition.length} tools available (transcript tools enabled)`);
        }
      }
      
      // Always add a basic system prompt for consistency, even when no tools are needed
      if (conversationMessages[0]?.role !== 'system') {
        if (enableTools && needsTools) {
          const toolsDescription = filteredToolsDefinition.map(t =>
            `${t.function.name}: ${t.function.description}`
          ).join('\n');

          // Build examples - only include transcript examples if transcript tools are available
          const transcriptExamples = needsTranscriptTool ? `
[TOOL_CALL: get_latest_transcript {}]
[TOOL_CALL: get_transcripts {}]
[TOOL_CALL: find_sentences_in_latest_transcript {"keyword": "Anna"}]
[TOOL_CALL: find_sentences_in_transcript {"fileName": "transcript.json", "keyword": "Anna"}]
[TOOL_CALL: summarize_keyword_in_latest_transcript {"keyword": "Anna"}]` : '';

          const transcriptRules = needsTranscriptTool ? `

CRITICAL RULES FOR TRANSCRIPT QUERIES:
- ONLY use transcript tools when the user EXPLICITLY asks about transcripts, recordings, meeting notes, or what was said in a recording
- DO NOT use transcript tools for general knowledge questions (e.g., "what do you know about X", "tell me about Y") unless the user explicitly asks if X or Y was mentioned in a transcript
- If the user asks for "sentences where X is mentioned" or "sentences containing X" IN A TRANSCRIPT, you MUST use find_sentences_in_latest_transcript or find_sentences_in_transcript (if a filename is specified)
- If the user asks "is X mentioned?" or "does this mention X?" IN A TRANSCRIPT, you MUST use summarize_keyword_in_latest_transcript or summarize_keyword_in_transcript (if a filename is specified)
- NEVER try to answer transcript questions from memory or guesswork - ALWAYS use the transcript tools WHEN EXPLICITLY ASKED ABOUT TRANSCRIPTS
- When a specific transcript filename is mentioned (e.g., "transcript 'file.json'"), use find_sentences_in_transcript or summarize_keyword_in_transcript with the fileName parameter
- When no filename is specified but user asks about transcripts, use get_latest_transcript or find_sentences_in_latest_transcript

IMPORTANT: When a user asks about transcripts, recordings, or meeting notes:
- ALWAYS use get_latest_transcript (NOT get_transcript) when user asks about "the transcript", "the transcript file", "display the transcript", "what is in the transcript", or any question about transcripts without specifying a transcript ID
- Use get_transcripts to list all available transcripts
- Use search_transcripts to find specific words or topics
- ONLY use get_transcript when you have a specific transcriptId from get_transcripts
- DO NOT automatically check transcripts for general knowledge questions - only use transcript tools when explicitly asked` : '';

          const perforceRules = needsPerforceTool ? `

CRITICAL RULES FOR PERFORCE QUERIES:
- When user asks about changelists, changes, commits, or Perforce data, you MUST use list_perforce_changelists
- NEVER generate changelist data from memory or training data - ALL Perforce data MUST come from tool calls
- If user asks for "10 most recent changelists", use list_perforce_changelists with limit=10
- If user specifies a username (e.g., "from Jose Vieira"), use the user parameter
- Example: "list changelists from jose_vieira" → [TOOL_CALL: list_perforce_changelists {"user": "jose_vieira", "limit": 50}]
- Example: "10 most recent changelists from john_doe" → [TOOL_CALL: list_perforce_changelists {"user": "john_doe", "limit": 10}]
- ALWAYS call the tool first before responding with changelist information` : '';

          const toolInstructions = `You are a helpful multilingual assistant with access to these tools:
${toolsDescription}

MULTILINGUAL SUPPORT:
- Users may ask questions in ANY language (English, French, Spanish, German, Japanese, Chinese, etc.)
- You MUST understand queries in all languages and call the appropriate tools
- Examples of multilingual queries that should trigger tools:
  * English: "What's the weather in Paris?" → [TOOL_CALL: get_weather {"city": "Paris"}]
  * French: "Quel temps fait-il à Paris?" → [TOOL_CALL: get_weather {"city": "Paris"}]
  * Spanish: "¿Qué tiempo hace en París?" → [TOOL_CALL: get_weather {"city": "Paris"}]
  * German: "Wie ist das Wetter in Paris?" → [TOOL_CALL: get_weather {"city": "Paris"}]
  * Japanese: "パリの天気は?" → [TOOL_CALL: get_weather {"city": "Paris"}]
- ALWAYS extract the city name and call the tool, regardless of the query language
- Respond to the user in the SAME language they used in their query

When you need to use a tool, respond with EXACTLY this format:
[TOOL_CALL: tool_name {"param": "value"}]

For example:
[TOOL_CALL: get_weather {"city": "Paris"}]
[TOOL_CALL: get_jira_issue {"issueKey": "PROJ-123"}]
[TOOL_CALL: get_github_issue {"owner": "owner", "repo": "repo", "issueNumber": 1}]
[TOOL_CALL: calculator {"expression": "5+3"}]
[TOOL_CALL: list_perforce_changelists {"user": "jose_vieira", "limit": 10}]
${transcriptExamples}${transcriptRules}${perforceRules}

After using a tool, you'll receive the result and should provide a natural language response to the user IN THEIR LANGUAGE.`;

          const arithmeticHint = `\nFor arithmetic expressions (e.g., "5+1", "12.3*4", "sin(pi/2)+log(10)+3^2"), use the calculator tool with an expression string.`;
          const fullInstructions = toolInstructions + arithmeticHint;

          conversationMessages.unshift({
            role: 'system',
            content: fullInstructions
          });
        } else {
          // Add a basic system prompt for general knowledge questions
          conversationMessages.unshift({
            role: 'system',
            content: 'You are a helpful AI assistant. Answer questions directly and provide accurate information.'
          });
        }
      }
      
      // Detect if query is in non-English language and translate if needed for better tool calling
      const lastUserMsg = conversationMessages[conversationMessages.length - 1];
      if (lastUserMsg && lastUserMsg.role === 'user' && enableTools && needsTools) {
        const userQuery = lastUserMsg.content;
        
        // Simple language detection (check for non-ASCII characters or common non-English words)
        const hasNonAscii = /[^\x00-\x7F]/.test(userQuery); // Japanese, Chinese, etc.
        const hasFrench = /\b(quel|quelle|comment|pourquoi|où|quand|temps|fait|paris)\b/i.test(userQuery);
        const hasSpanish = /\b(qué|cómo|dónde|cuándo|tiempo|hace)\b/i.test(userQuery);
        const hasGerman = /\b(wie|was|wo|wann|wetter|ist)\b/i.test(userQuery);
        
        const isNonEnglish = hasNonAscii || hasFrench || hasSpanish || hasGerman;
        
        if (isNonEnglish) {
          console.log(`[TRANSLATION] Non-English query detected, translating to English for tool calling...`);
          try {
            // Use the LLM to translate the query to English
            const translationPrompt = [
              { role: 'system', content: 'Translate the following text to English. Only output the English translation, nothing else.' },
              { role: 'user', content: userQuery }
            ];
            
            const translationResp = await axios.post(`${ollamaUrl}/api/chat`, {
              model: model || process.env.DEFAULT_MODEL || 'qwen2.5:1.5b',
              messages: translationPrompt,
              stream: false
            }, { timeout: 10000 });
            
            const englishQuery = translationResp.data?.message?.content?.trim();
            if (englishQuery) {
              console.log(`[TRANSLATION] Original: "${userQuery}"`);
              console.log(`[TRANSLATION] English: "${englishQuery}"`);
              
              // Store original query for response
              lastUserMsg.originalContent = userQuery;
              lastUserMsg.content = englishQuery; // Use English for tool calling
            }
          } catch (err) {
            console.error('[TRANSLATION] Translation failed:', err.message);
            // Continue with original query if translation fails
          }
        }
      }
      
      // Tool calling loop
      let maxIterations = 5;
      let toolsAlreadyExecuted = false; // Track if we've already called tools
      while (maxIterations > 0) {
        maxIterations--;
        
        const requestBody = {
          model: model || process.env.DEFAULT_MODEL || 'qwen2.5:1.5b',
          messages: conversationMessages,
          stream: false,
          options: {
            temperature: 0.3,  // Lower temperature for faster, more focused responses
            num_predict: 2048, // Limit max tokens to prevent extremely long thinking sections
            top_p: 0.9,        // Nucleus sampling for better quality
            repeat_penalty: 1.1 // Slight penalty to avoid repetitive thinking
          }
        };
        
        // Only add tools on the FIRST iteration - after tools are executed, we don't need them for formatting the response
        if (enableTools && needsTools && !toolsAlreadyExecuted) {
          requestBody.tools = filteredToolsDefinition;
          console.log(`[TOOLS] Adding ${filteredToolsDefinition.length} tools to LLM request (transcript tools ${needsTranscriptTool ? 'INCLUDED' : 'EXCLUDED'})`);
        } else {
          console.log('[TOOLS] NOT adding tools to request (formatting response)');
        }
        
        // Use longer timeout for general knowledge questions (no tools)
        // Increased timeout for tool requests with large models (qwen3:30b needs more time with 76 tools)
        const requestTimeout = (enableTools && needsTools) ? 300000 : 180000; // 300s (5min) with tools, 180s without tools
        const response = await axios.post(`${ollamaUrl}/api/chat`, requestBody, {
          timeout: requestTimeout
        });
        const assistantMessage = response.data.message;
        
        // Debug logging
        console.log('LLM Response:', JSON.stringify(assistantMessage, null, 2));
        console.log('Tool calls detected:', assistantMessage.tool_calls?.length || 0);
        
        // Check if the LLM wants to use a tool
        if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
          toolCallsDetected = true;
          
          // Add assistant's tool call request to conversation
          conversationMessages.push(assistantMessage);
          
          // Execute each tool call
          for (const toolCall of assistantMessage.tool_calls) {
            const toolName = toolCall.function.name;
            // Parse tool parameters - they might be a JSON string or already an object
            let toolParams = toolCall.function.arguments;
            if (typeof toolParams === 'string') {
              try {
                toolParams = JSON.parse(toolParams);
              } catch (e) {
                console.warn('Failed to parse tool params as JSON:', toolParams);
                toolParams = {};
              }
            }
            if (!toolParams || typeof toolParams !== 'object') {
              toolParams = {};
            }
            
            // Send tool call info to frontend
            res.write(`data: ${JSON.stringify({ 
              type: 'tool_call', 
              tool: toolName, 
              params: toolParams 
            })}\n\n`);
            
            // Execute the tool
            const isTranscriptTool = toolName.toLowerCase().includes('transcript');
            if (isTranscriptTool) {
              console.log(`[TRANSCRIPT TOOL] ⚠️ Executing transcript tool: ${toolName} with params:`, toolParams);
            } else {
              console.log(`[MCP TOOL] Executing tool: ${toolName} with params:`, toolParams);
            }
            const toolResult = await executeTool(toolName, toolParams);
            if (isTranscriptTool) {
              console.log(`[TRANSCRIPT TOOL] ⚠️ Result:`, toolResult);
            } else {
              console.log(`[MCP TOOL] Result:`, toolResult);
            }
            lastToolResult = toolResult;
            
            // Send tool result to frontend
            res.write(`data: ${JSON.stringify({ 
              type: 'tool_result', 
              tool: toolName, 
              result: toolResult 
            })}\n\n`);
            
            // Add tool result to conversation
            conversationMessages.push({
              role: 'tool',
              content: JSON.stringify(toolResult),
              tool_call_id: toolCall.id
            });
          }
          
          // Mark that tools have been executed - no need to add them on next iteration
          toolsAlreadyExecuted = true;
          
          // Continue loop to get final response with tool results
          continue;
        }
        
        // Check for manual tool call format (fallback for models without native support)
        const content = assistantMessage.content || '';
        const toolCallMatch = content.match(/\[TOOL_CALL:\s*(\w+)\s*({.*?})\]/);
        
        if (toolCallMatch && enableTools) {
          toolCallsDetected = true;
          const toolName = toolCallMatch[1];
          const toolParams = JSON.parse(toolCallMatch[2]);
          
          // Send tool call info to frontend
          res.write(`data: ${JSON.stringify({ 
            type: 'tool_call', 
            tool: toolName, 
            params: toolParams 
          })}\n\n`);
          
          // Execute the tool
          console.log(`Executing tool (manual format): ${toolName} with params:`, toolParams);
          const toolResult = await executeTool(toolName, toolParams);
          console.log(`Tool result (manual format):`, toolResult);
          
          // Send tool result to frontend
          res.write(`data: ${JSON.stringify({ 
            type: 'tool_result', 
            tool: toolName, 
            result: toolResult 
          })}\n\n`);
          
          // Add tool result to conversation
          conversationMessages.push({
            role: 'assistant',
            content: content
          });
          conversationMessages.push({
            role: 'user',
            content: `Tool result for ${toolName}: ${JSON.stringify(toolResult)}. Please provide a natural language response to the user based on this information.`
          });
          
          // Mark that tools have been executed - no need to add them on next iteration
          toolsAlreadyExecuted = true;
          
          // Continue loop to get final response
          continue;
        }
        
        // No more tool calls - stream final response
        if (assistantMessage.content) {
          // If tools were used, send a marker
          if (toolCallsDetected) {
            res.write(`data: ${JSON.stringify({ type: 'final_response' })}\n\n`);
          }
          
          // Stream the final content
          const content = assistantMessage.content;
          const chunkSize = 5; // Characters per chunk
          for (let i = 0; i < content.length; i += chunkSize) {
            const chunk = content.slice(i, i + chunkSize);
            res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
            await new Promise(resolve => setTimeout(resolve, 20)); // Small delay for streaming effect
          }
          res.write('data: [DONE]\n\n');
          res.end();
          break;
        }

        // If we reach here and tools were used but the model returned no content, synthesize a fallback from the last tool result
        if (toolCallsDetected) {
          const fallback = lastToolResult
            ? `Here is the result from the tool: ${JSON.stringify(lastToolResult)}`
            : 'Tools were executed, but no response was generated.';
          res.write(`data: ${JSON.stringify({ type: 'final_response' })}\n\n`);
          const chunkSize = 5;
          for (let i = 0; i < fallback.length; i += chunkSize) {
            const chunk = fallback.slice(i, i + chunkSize);
            res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
            await new Promise(resolve => setTimeout(resolve, 20));
          }
          res.write('data: [DONE]\n\n');
          res.end();
          break;
        }
        
        // If no tools and no content, return a generic error to avoid silence
        res.write(`data: ${JSON.stringify({ content: 'No response generated.' })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
        break;
      }
      
    } else {
      // For other providers (OpenAI, Anthropic, etc.)
      res.json({ error: 'Provider not yet implemented' });
    }
  } catch (error) {
    console.error('LLM Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get available Ollama models
app.get('/api/llm/models', async (req, res) => {
  try {
    const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    const response = await axios.get(`${ollamaUrl}/api/tags`);
    res.json(response.data.models || []);
  } catch (error) {
    console.error('Error fetching models:', error.message);
    res.json([]);
  }
});

// Check Ollama status (version + running models)
app.get('/api/llm/status', async (req, res) => {
  const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  try {
    const [versionResp, psResp, tagsResp] = await Promise.all([
      axios.get(`${ollamaUrl}/api/version`),
      axios.get(`${ollamaUrl}/api/ps`),
      axios.get(`${ollamaUrl}/api/tags`).catch(() => ({ data: { models: [] } }))
    ]);
    
    // Precompute tag sizes (model file sizes)
    const tagSizes = {};
    (tagsResp.data?.models || []).forEach(m => {
      const name = m.name || m.model;
      if (name && m.size) {
        tagSizes[name] = m.size;
      }
    });

    // Enhance each running model with device and memory info (RAM vs VRAM)
    const modelsRunning = (psResp.data?.models || []).map((model) => {
      const gpuLayers = model.gpu_layers || model.gpu_layers_count || 0;
      const sizeVram = model.size_vram || 0; // bytes in VRAM if present
      const sizeRam = model.size || 0;       // bytes in system memory
      const tagSize = tagSizes[model.name] || 0; // model file size fallback

      // Device detection (NPU is not exposed; heuristic falls back to GPU/CPU)
      let device = 'CPU';
      if (gpuLayers > 0 || sizeVram > 0) {
        device = 'GPU'; // Could be NPU, but Ollama API doesn't expose it
      }

      // Prefer VRAM size when present, else RAM, else tag size
      let memoryBytes = sizeVram || sizeRam || tagSize || 0;
      let memoryType = sizeVram > 0 ? 'VRAM' : 'RAM';

      const sizeGB = memoryBytes > 0 ? parseFloat((memoryBytes / (1024 * 1024 * 1024)).toFixed(2)) : 0;

      return {
        ...model,
        device,
        memoryType,
        sizeGB,
        name: model.name
      };
    });

    res.json({
      status: 'ok',
      version: versionResp.data?.version,
      modelsRunning
    });
  } catch (error) {
    console.error('Ollama status error:', error.message);
    const message = error.response?.data?.error || error.message;
    res.status(500).json({ status: 'error', error: message });
  }
});

// Stop/unload a model (helps re-evaluate GPU usage)
app.post('/api/llm/stop', async (req, res) => {
  const { model } = req.body;
  const targetModel = model || process.env.DEFAULT_MODEL || 'qwen2.5:1.5b';
  const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  try {
    await axios.post(`${ollamaUrl}/api/stop`, { name: targetModel });
    res.json({ status: 'stopped', model: targetModel });
  } catch (error) {
    console.error('Stop model error:', error.message);
    const message = error.response?.data?.error || error.message;
    res.status(500).json({ status: 'error', error: message });
  }
});

// Warm up / load a specific Ollama model (non-streaming)
app.post('/api/llm/warmup', async (req, res) => {
  const { model } = req.body;
  const targetModel = model || process.env.DEFAULT_MODEL || 'qwen2.5:1.5b';
  console.log(`🔥 WARMUP REQUEST: received model="${model}", using targetModel="${targetModel}"`);
  const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

  try {
    // First check if model is already loaded
    try {
      const psResponse = await axios.get(`${ollamaUrl}/api/ps`);
      const runningModels = psResponse.data?.models || [];
      const isModelLoaded = runningModels.some(m => m.name === targetModel);
      
      if (isModelLoaded) {
        console.log(`Model ${targetModel} is already loaded`);
        const modelInfo = runningModels.find(m => m.name === targetModel);
        
        // Get device info
        const gpuLayers = modelInfo?.gpu_layers || modelInfo?.gpu_layers_count || 0;
        const sizeVram = modelInfo?.size_vram || 0;
        let device = 'CPU';
        if (gpuLayers > 0 || sizeVram > 0) {
          device = 'GPU'; // Could be NPU, but hard to distinguish via API
        }

        // Use VRAM size if available, otherwise RAM size
        let memoryBytes = sizeVram > 0 ? sizeVram : (modelInfo?.size || 0);
        let memoryType = sizeVram > 0 ? 'VRAM' : 'RAM';

        // Fallback: if no size info from ps, try tags endpoint (model file size)
        if (!memoryBytes) {
          try {
            const tagsResponse = await axios.get(`${ollamaUrl}/api/tags`);
            const tagModelInfo = tagsResponse.data?.models?.find(m => m.name === targetModel || m.model === targetModel);
            if (tagModelInfo && tagModelInfo.size) {
              memoryBytes = tagModelInfo.size;
              memoryType = 'RAM';
            }
          } catch (tagsError) {
            console.warn('Could not get model size:', tagsError.message);
          }
        }

        const sizeGB = memoryBytes > 0 ? parseFloat((memoryBytes / (1024 * 1024 * 1024)).toFixed(2)) : 0;
        
        return res.json({
          status: 'ready',
          model: targetModel,
          alreadyLoaded: true,
          device,
          memoryType,
          sizeGB
        });
      }
    } catch (psError) {
      console.warn('Could not check model status:', psError.message);
    }

    // Load the model by making a simple generation request
    // Use a timeout to prevent hanging
    const timeout = 120000; // 2 minutes timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await axios.post(`${ollamaUrl}/api/generate`, {
        model: targetModel,
        prompt: 'ping',
        stream: false
      }, {
        timeout: timeout,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Verify model is loaded and get device/memory info
      let device = 'CPU';
      let memoryType = 'RAM';
      let memoryBytes = 0;

      try {
        // Prefer runtime memory info from /api/ps
        try {
          const psResponse = await axios.get(`${ollamaUrl}/api/ps`);
          const runningModels = psResponse.data?.models || [];
          const modelInfo = runningModels.find(m => m.name === targetModel);

          if (modelInfo) {
            const gpuLayers = modelInfo.gpu_layers || modelInfo.gpu_layers_count || 0;
            const sizeVram = modelInfo.size_vram || 0;
            const sizeRam = modelInfo.size || 0;

            if (gpuLayers > 0 || sizeVram > 0) {
              device = 'GPU'; // NPU not exposed; heuristic treats VRAM/gpu_layers as GPU
            } else {
              device = 'CPU';
            }

            if (sizeVram > 0) {
              memoryBytes = sizeVram;
              memoryType = 'VRAM';
            } else if (sizeRam > 0) {
              memoryBytes = sizeRam;
              memoryType = 'RAM';
            }

            console.log(`Model ${targetModel} running on ${device} (gpu_layers: ${gpuLayers}, vram: ${sizeVram > 0 ? (sizeVram / (1024*1024*1024)).toFixed(2) + 'GB' : '0'}, ram: ${sizeRam > 0 ? (sizeRam / (1024*1024*1024)).toFixed(2) + 'GB' : '0'})`);
          } else {
            console.warn(`Model ${targetModel} may not be fully loaded`);
          }
        } catch (psError) {
          console.warn('Could not get model device info:', psError.message);
        }

        // Fallback: use model file size from /api/tags if runtime sizes are missing
        if (!memoryBytes) {
          try {
            const tagsResponse = await axios.get(`${ollamaUrl}/api/tags`);
            const tagModelInfo = tagsResponse.data?.models?.find(m => m.name === targetModel || m.model === targetModel);
            if (tagModelInfo && tagModelInfo.size) {
              memoryBytes = tagModelInfo.size;
              memoryType = 'RAM';
            }
          } catch (tagsError) {
            console.warn('Could not get model size from tags:', tagsError.message);
          }
        }
      } catch (verifyError) {
        console.warn('Could not verify model load status:', verifyError.message);
      }

      const sizeGB = memoryBytes > 0 ? parseFloat((memoryBytes / (1024 * 1024 * 1024)).toFixed(2)) : 0;

      res.json({
        status: 'ready',
        model: targetModel,
        device,
        memoryType,
        sizeGB,
        response_time_ms: response.data?.total_duration ? Math.round(response.data.total_duration / 1000000) : undefined,
      });
    } catch (generateError) {
      clearTimeout(timeoutId);
      throw generateError;
    }
  } catch (error) {
    console.error('Warmup error:', error.message);
    const message = error.response?.data?.error || error.message;
    const isTimeout = error.code === 'ECONNABORTED' || error.message.includes('timeout');
    res.status(500).json({ 
      status: 'error', 
      error: isTimeout ? 'Model loading timed out. The model may still be loading in the background.' : message 
    });
  }
});

// MCP Tools
app.get('/api/mcp/tools', (req, res) => {
  // Group tools by service/category for better organization
  const toolCategories = {
    'weather': { id: 'weather', name: 'Weather', description: 'Get weather for a city', category: 'General' },
    'add': { id: 'add', name: 'Add Numbers', description: 'Add two numbers together', category: 'General' },
    'calculator': { id: 'calculator', name: 'Calculator', description: 'Evaluate a math expression (add/subtract/multiply/divide)', category: 'General' },
    // Jira tools
    'jira': { id: 'jira', name: 'Jira', description: 'Read Jira issues, projects, and more', category: 'Jira' },
    // Slack tools
    'slack': { id: 'slack', name: 'Slack', description: 'Read Slack channels, messages, and users', category: 'Slack' },
    // GitHub tools
    'github': { id: 'github', name: 'GitHub', description: 'Read GitHub repositories, issues, PRs, and commits', category: 'GitHub' },
    // Perforce tools
    'perforce': { id: 'perforce', name: 'Perforce', description: 'Read Perforce changelists, files, and workspace info', category: 'Perforce' },
    // Confluence tools
    'confluence': { id: 'confluence', name: 'Confluence', description: 'Read Confluence pages, spaces, and documentation', category: 'Confluence' },
    // Google Workspace tools
    'gmail': { id: 'gmail', name: 'Gmail', description: 'Read Gmail messages, labels, and threads', category: 'Google Workspace' },
    'google-calendar': { id: 'google-calendar', name: 'Google Calendar', description: 'Read calendar events, calendars, and schedules', category: 'Google Workspace' },
    'google-drive': { id: 'google-drive', name: 'Google Drive', description: 'Read Drive files, folders, and metadata', category: 'Google Workspace' },
    // Discord tools
    'discord': { id: 'discord', name: 'Discord', description: 'Read Discord channels, messages, servers, and users', category: 'Discord' },
    // Transcripts tools
    'transcripts': { id: 'transcripts', name: 'Transcripts', description: 'Display, search, and summarize meeting transcripts and recordings', category: 'General' },
  };
  
  res.json(Object.values(toolCategories));
});

app.post('/api/mcp/tools/:toolId', async (req, res) => {
  const { toolId } = req.params;
  const params = req.body;
  
  if (mcpTools[toolId]) {
    try {
      const result = await mcpTools[toolId](...Object.values(params));
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(404).json({ error: 'Tool not found' });
  }
});

// Audio transcription - Now using Web Speech API (client-side, completely free, no dependencies)
// Transcription happens entirely in the browser - no backend processing needed
// This endpoint is kept for file upload compatibility but transcription is client-side
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    const audioFile = req.file;
    if (!audioFile) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // Return file info - actual transcription happens client-side using Web Speech API
    // The file is available for the client to process
    res.json({ 
      message: 'File uploaded. Transcription will happen in browser using Web Speech API.',
      fileName: audioFile.filename,
      size: audioFile.size,
      path: `/uploads/${audioFile.filename}` // For reference, but client processes the blob
    });

    // Clean up uploaded file after a delay
    setTimeout(() => {
      if (fs.existsSync(audioFile.path)) {
        fs.unlinkSync(audioFile.path);
      }
    }, 60000);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Debug endpoint to test Whisper
app.get('/api/test-whisper', async (req, res) => {
  try {
    const testFile = req.query.file || 'uploads\\85293eb39aeaa8a22c9c463deaa3ca88';
    const absolutePath = join(process.cwd(), testFile);
    const scriptPath = join(process.cwd(), 'backend', 'whisper_service.py');
    
    console.log('Testing:', { scriptPath, audioPath: absolutePath });
    
    const { stdout, stderr } = await execAsync(
      `python "${scriptPath}" "${absolutePath}" tiny`,
      { maxBuffer: 10 * 1024 * 1024, timeout: 300000 }
    );
    
    res.json({
      success: true,
      stdout,
      stderr,
      parsed: JSON.parse(stdout)
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      stdout: error.stdout,
      stderr: error.stderr,
      code: error.code
    });
  }
});

// Whisper transcription endpoint (backend-based)
app.post('/api/transcribe-whisper', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const audioPath = req.file.path;
    console.log('🎤 Transcribing audio with Whisper:', audioPath);

    // Check if Python and Whisper are available
    try {
      await execAsync(`${PYTHON_BIN} --version`);
    } catch (error) {
      return res.status(500).json({
        error: 'Python not found. Please install Python 3.8+ to use Whisper transcription.',
        fallback: true
      });
    }

    // Run Whisper transcription
    try {
      // Use absolute path and keep audio file (no deletion)
      // Multer gives us absolute paths, so use as-is
      const absolutePath = audioPath;
      const scriptPath = join(__dirname, 'whisper_service.py');
      
      console.log('Running Whisper:', { scriptPath, audioPath: absolutePath, model: WHISPER_MODEL, language: WHISPER_LANGUAGE });
      
      // Set timeout to 5 minutes
      const { stdout, stderr } = await execAsync(
        `${PYTHON_BIN} "${scriptPath}" "${absolutePath}" ${WHISPER_MODEL} ${WHISPER_LANGUAGE}`,
        { 
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer
          timeout: 300000 // 5 minutes timeout
        }
      );

      console.log('Whisper completed');
      console.log('Whisper stdout:', stdout);
      
      const result = JSON.parse(stdout);

      if (result.status === 'error') {
        return res.status(500).json({ error: result.error, fallback: true });
      }

      res.json({
        text: result.text,
        status: 'completed',
        model: WHISPER_MODEL,
        language: WHISPER_LANGUAGE
      });
    } catch (error) {
      console.error('Whisper transcription error:', error);
      console.error('Error message:', error.message);
      console.error('Error stdout:', error.stdout);
      console.error('Error stderr:', error.stderr);
      
      const stderr = error.stderr || '';
      const stdout = error.stdout || '';
      const msg = error.message || '';
      const combined = `${stderr}\n${stdout}\n${msg}`.toLowerCase();

      // Check for common dependency issues (narrow match to avoid false positives)
      if (/modulenotfounderror.*whisper/.test(combined) || /no module named ['"]whisper['"]/.test(combined)) {
        return res.status(500).json({
          error: 'Whisper Python package not installed. Run: pip install openai-whisper',
          fallback: true
        });
      }
      if (combined.includes('ffmpeg')) {
        return res.status(500).json({
          error: 'ffmpeg not found. Install ffmpeg and ensure it is on PATH.',
          fallback: true
        });
      }

      // Include stderr/stdout for diagnosis
      const errorDetails = error.stderr || error.stdout || error.message;
      res.status(500).json({
        error: 'Transcription failed: ' + errorDetails,
        fallback: true
      });
    }
  } catch (error) {
    console.error('Transcription endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 Ollama URL: ${process.env.OLLAMA_BASE_URL || 'http://localhost:11434'}`);
  console.log(`🤖 Default model: ${process.env.DEFAULT_MODEL || 'qwen2.5:1.5b'}`);
  console.log(`🎤 Whisper: Backend transcription available`);
});

