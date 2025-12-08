import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import multer from 'multer';
import { mcpTools, toolsDefinition } from './mcp-tools/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

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

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

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
  const { model, messages, provider, enableTools = true } = req.body;
  
  try {
    if (provider === 'ollama') {
      const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
      
      // Set up streaming response
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      let conversationMessages = [...messages];
      let toolCallsDetected = false;
      
      // Detect if user query needs tools
      const lastUserMessage = messages[messages.length - 1]?.content?.toLowerCase() || '';
      
      // Tool detection patterns
      const needsWeatherTool = /weather|temperature|forecast|climat|météo/i.test(lastUserMessage);
      const needsAddTool = /add|sum|plus|\+|calculate/i.test(lastUserMessage);
      const needsJiraTool = /jira|issue|project|ticket|bug|story|epic/i.test(lastUserMessage);
      const needsSlackTool = /slack|channel|message|workspace|thread/i.test(lastUserMessage);
      const needsGithubTool = /github|git|repository|repo|pull request|pr|issue|commit/i.test(lastUserMessage);
      const needsPerforceTool = /perforce|p4|changelist|depot|workspace|client/i.test(lastUserMessage);
      const needsConfluenceTool = /confluence|page|space|wiki|documentation/i.test(lastUserMessage);
      const needsGmailTool = /gmail|email|mail|message|inbox|unread|sent/i.test(lastUserMessage);
      const needsCalendarTool = /calendar|event|meeting|appointment|schedule|agenda/i.test(lastUserMessage);
      const needsDriveTool = /drive|file|document|folder|google drive|gdrive/i.test(lastUserMessage);
      const needsDiscordTool = /discord|guild|server|channel|dm|direct message/i.test(lastUserMessage);
      
      const needsTools = needsWeatherTool || needsAddTool || needsJiraTool || 
                        needsSlackTool || needsGithubTool || needsPerforceTool || needsConfluenceTool ||
                        needsGmailTool || needsCalendarTool || needsDriveTool || needsDiscordTool;
      
      console.log('User message:', lastUserMessage);
      console.log('Needs tools:', needsTools);
      
      // Only add tool instructions if the query needs them
      if (enableTools && needsTools && conversationMessages[0]?.role !== 'system') {
        const toolsDescription = toolsDefinition.map(t =>
          `${t.function.name}: ${t.function.description}`
        ).join('\n');

        const toolInstructions = `You are a helpful assistant with access to these tools:
${toolsDescription}

When you need to use a tool, respond with EXACTLY this format:
[TOOL_CALL: tool_name {"param": "value"}]

For example:
[TOOL_CALL: get_weather {"city": "Paris"}]
[TOOL_CALL: get_jira_issue {"issueKey": "PROJ-123"}]
[TOOL_CALL: get_github_issue {"owner": "owner", "repo": "repo", "issueNumber": 1}]

After using a tool, you'll receive the result and should provide a natural language response to the user.`;
        
        conversationMessages.unshift({
          role: 'system',
          content: toolInstructions
        });
      }
      
      // Tool calling loop
      let maxIterations = 5;
      while (maxIterations > 0) {
        maxIterations--;
        
        const requestBody = {
          model: model || 'llama3.2:3b',
          messages: conversationMessages,
          stream: false
        };
        
        // Only add tools if the query needs them
        if (enableTools && needsTools) {
          requestBody.tools = toolsDefinition;
          console.log('Adding tools to request');
        } else {
          console.log('NOT adding tools to request');
        }
        
        const response = await axios.post(`${ollamaUrl}/api/chat`, requestBody);
        const assistantMessage = response.data.message;
        
        // Debug logging
        console.log('LLM Response:', JSON.stringify(assistantMessage, null, 2));
        
        // Check if the LLM wants to use a tool
        if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
          toolCallsDetected = true;
          
          // Add assistant's tool call request to conversation
          conversationMessages.push(assistantMessage);
          
          // Execute each tool call
          for (const toolCall of assistantMessage.tool_calls) {
            const toolName = toolCall.function.name;
            const toolParams = toolCall.function.arguments;
            
            // Send tool call info to frontend
            res.write(`data: ${JSON.stringify({ 
              type: 'tool_call', 
              tool: toolName, 
              params: toolParams 
            })}\n\n`);
            
            // Execute the tool
            const toolResult = await executeTool(toolName, toolParams);
            
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
          const toolResult = await executeTool(toolName, toolParams);
          
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
        }
        
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

// MCP Tools
app.get('/api/mcp/tools', (req, res) => {
  // Group tools by service/category for better organization
  const toolCategories = {
    'weather': { id: 'weather', name: 'Weather', description: 'Get weather for a city', category: 'General' },
    'add': { id: 'add', name: 'Add Numbers', description: 'Add two numbers together', category: 'General' },
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

// Audio transcription (using free Whisper model via Hugging Face Inference API)
// Note: You'll need to sign up for a free Hugging Face account and get an API key
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    const audioFile = req.file;
    if (!audioFile) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // For now, return a placeholder response
    // In production, you'd integrate with Whisper API or run it locally
    res.json({ 
      text: 'Transcription feature ready. To enable, add Hugging Face API key or set up local Whisper.',
      placeholder: true
    });

    // Clean up uploaded file
    fs.unlinkSync(audioFile.path);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 Ollama URL: ${process.env.OLLAMA_BASE_URL || 'http://localhost:11434'}`);
  console.log(`🤖 Default model: ${process.env.DEFAULT_MODEL || 'llama3.2:3b'}`);
});

