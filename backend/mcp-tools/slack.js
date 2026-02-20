import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Slack API configuration
const SLACK_BASE_URL = 'https://slack.com/api';
const CREDENTIALS_PATH = path.join(__dirname, '../credentials/slack.env');

// Slack credentials (supports both Bot tokens and OAuth 2.0 with rotation)
let SLACK_ACCESS_TOKEN = '';
let SLACK_REFRESH_TOKEN = '';
let SLACK_BOT_TOKEN = '';

// Load Slack credentials from file
const loadCredentials = () => {
  try {
    if (fs.existsSync(CREDENTIALS_PATH)) {
      const credentialsContent = fs.readFileSync(CREDENTIALS_PATH, 'utf8');
      const lines = credentialsContent.split('\n');

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith('#')) {
          const [key, ...valueParts] = trimmedLine.split('=');
          const value = valueParts.join('=').trim();
          if (key === 'SLACK_ACCESS_TOKEN') SLACK_ACCESS_TOKEN = value;
          else if (key === 'SLACK_REFRESH_TOKEN') SLACK_REFRESH_TOKEN = value;
          else if (key === 'SLACK_BOT_TOKEN') SLACK_BOT_TOKEN = value;
        }
      }
      console.log('✅ Slack credentials loaded:', {
        hasAccessToken: !!SLACK_ACCESS_TOKEN,
        hasRefreshToken: !!SLACK_REFRESH_TOKEN,
        hasBotToken: !!SLACK_BOT_TOKEN
      });
    }
  } catch (error) {
    console.warn('⚠️ Warning: Could not load Slack credentials:', error.message);
  }
};

// Save refreshed tokens back to file
const saveRefreshedTokens = (newAccessToken, newRefreshToken) => {
  try {
    let content = fs.readFileSync(CREDENTIALS_PATH, 'utf8');
    
    // Update access token
    content = content.replace(
      /SLACK_ACCESS_TOKEN=.*/,
      `SLACK_ACCESS_TOKEN=${newAccessToken}`
    );
    
    // Update refresh token if provided
    if (newRefreshToken) {
      content = content.replace(
        /SLACK_REFRESH_TOKEN=.*/,
        `SLACK_REFRESH_TOKEN=${newRefreshToken}`
      );
    }
    
    fs.writeFileSync(CREDENTIALS_PATH, content, 'utf8');
    console.log('✅ Slack tokens refreshed and saved');
    
    // Update in-memory tokens
    SLACK_ACCESS_TOKEN = newAccessToken;
    if (newRefreshToken) SLACK_REFRESH_TOKEN = newRefreshToken;
  } catch (error) {
    console.error('❌ Failed to save refreshed tokens:', error.message);
  }
};

// Refresh access token using refresh token
const refreshAccessToken = async () => {
  if (!SLACK_REFRESH_TOKEN) {
    console.error('❌ No refresh token available');
    return false;
  }
  
  try {
    console.log('🔄 Refreshing Slack access token...');
    
    const response = await axios.post(
      'https://slack.com/api/oauth.v2.access',
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: SLACK_REFRESH_TOKEN
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    if (response.data.ok) {
      const newAccessToken = response.data.access_token;
      const newRefreshToken = response.data.refresh_token || SLACK_REFRESH_TOKEN;
      
      saveRefreshedTokens(newAccessToken, newRefreshToken);
      return true;
    } else {
      console.error('❌ Token refresh failed:', response.data.error);
      return false;
    }
  } catch (error) {
    console.error('❌ Token refresh error:', error.message);
    return false;
  }
};

// Get current token (prefer bot token for reliability, fallback to access token)
const getCurrentToken = () => {
  return SLACK_BOT_TOKEN || SLACK_ACCESS_TOKEN;
};

// Helper function for Slack API calls with automatic token rotation
const slackApiCall = async (method, params = {}, retryCount = 0) => {
  const token = getCurrentToken();
  
  if (!token) {
    return { error: 'No Slack token configured. Please set up slack.env credentials.' };
  }
  
  try {
    // Convert params to URL-encoded form data (Slack API standard)
    const formData = new URLSearchParams();
    
    // Add token to form data (works for bot tokens)
    // For OAuth 2.0 tokens, we'll also try Bearer header as fallback
    formData.append('token', token);
    
    // Add all other parameters
    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined) {
        formData.append(key, String(value));
      }
    }
    
    // Try with form data first (standard for bot tokens)
    let response = await axios.post(
      `${SLACK_BASE_URL}/${method}`,
      formData.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    
    // If form data fails with invalid_auth and we have an OAuth token, try Bearer header
    if (!response.data.ok && response.data.error === 'invalid_auth' && token.startsWith('xoxe.')) {
      console.log('⚠️ Form data auth failed, trying Bearer token...');
      const formDataWithoutToken = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value !== null && value !== undefined) {
          formDataWithoutToken.append(key, String(value));
        }
      }
      
      response = await axios.post(
        `${SLACK_BASE_URL}/${method}`,
        formDataWithoutToken.toString(),
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );
    }
    
    // Check for token expiration errors
    if (!response.data.ok) {
      const error = response.data.error;
      
      // Token expired or invalid - try to refresh
      if ((error === 'token_expired' || error === 'invalid_auth' || error === 'account_inactive') 
          && SLACK_REFRESH_TOKEN && retryCount === 0) {
        console.log('⚠️ Token expired, attempting refresh...');
        
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          // Retry the request with new token
          console.log('🔄 Retrying request with refreshed token...');
          return await slackApiCall(method, params, retryCount + 1);
        }
      }
      
      return { error: error || 'Slack API error' };
    }
    
    return response.data;
  } catch (error) {
    // HTTP 401 or 403 might indicate expired token
    if ((error.response?.status === 401 || error.response?.status === 403) 
        && SLACK_REFRESH_TOKEN && retryCount === 0) {
      console.log('⚠️ Authentication error, attempting token refresh...');
      
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        console.log('🔄 Retrying request with refreshed token...');
        return await slackApiCall(method, params, retryCount + 1);
      }
    }
    
    return { error: error.message };
  }
};

// Initialize credentials on module load
loadCredentials();

// Get list of channels
const getSlackChannels = async () => {
  const result = await slackApiCall('conversations.list', {
    types: 'public_channel,private_channel',
    exclude_archived: true,
  });
  
  if (result.error) return result;
  
  return {
    channels: result.channels.map(ch => ({
      id: ch.id,
      name: ch.name,
      is_private: ch.is_private,
      is_archived: ch.is_archived,
      num_members: ch.num_members,
      topic: ch.topic?.value || '',
      purpose: ch.purpose?.value || '',
    })),
  };
};

// Get messages from a channel
const getSlackMessages = async (channel, limit = 20, oldest = null, latest = null) => {
  // If channel is a name (starts with #), look up the channel ID first
  let channelId = channel;
  let channelName = null; // Store channel name for error messages
  if (channel && channel.startsWith('#')) {
    channelName = channel.substring(1); // Remove #
    const channelsResult = await getSlackChannels();
    if (channelsResult.error) {
      return { error: `Failed to get channels list: ${channelsResult.error}` };
    }
    const foundChannel = channelsResult.channels.find(ch => ch.name === channelName);
    if (!foundChannel) {
      return { error: `Channel #${channelName} not found in your Slack workspace. Available channels: ${channelsResult.channels.map(ch => `#${ch.name}`).join(', ')}` };
    }
    channelId = foundChannel.id;
  }
  
  const params = {
    channel: channelId,
    limit: Math.min(limit, 100), // Slack max is 100
  };
  
  if (oldest) params.oldest = oldest;
  if (latest) params.latest = latest;
  
  const result = await slackApiCall('conversations.history', params);
  
  // Handle channel access errors - try to join the channel if not a member
  if (result.error) {
    console.log(`⚠️ Slack API error for conversations.history: ${result.error} (channel: ${channelId || channel})`);
    
    // If missing scope directly, return helpful error
    if (result.error === 'missing_scope') {
      return { 
        error: `Cannot access channel #${channelName || channelId}. The Slack bot is missing the required permission (scope: ${result.needed || 'channels:read'}). To fix this: 1) Go to your Slack app settings (api.slack.com/apps), 2) Add the "${result.needed || 'channels:read'}" scope under "OAuth & Permissions", 3) Reinstall the app to your workspace.` 
      };
    }
    
    if (result.error === 'not_in_channel' || result.error === 'channel_not_found') {
      console.log(`⚠️ Bot not in channel ${channelId}, attempting to join...`);
      // Try to join the channel
      const joinResult = await slackApiCall('conversations.join', { channel: channelId });
      if (joinResult.error) {
        // If join fails, return a helpful error message
        if (joinResult.error === 'missing_scope') {
          return { 
            error: `Cannot access channel #${channelName || channelId}. The Slack bot is missing the required permission (scope: ${joinResult.needed || 'channels:join'}). To fix this: 1) Go to your Slack app settings (api.slack.com/apps), 2) Add the "${joinResult.needed || 'channels:join'}" scope under "OAuth & Permissions", 3) Reinstall the app to your workspace. Alternatively, you can manually invite the bot to the channel.` 
          };
        }
        if (joinResult.error === 'method_not_supported_for_channel_type') {
          return { error: `Cannot access channel #${channelName || channelId}. This may be a private channel that requires an invitation, or the bot may not have permission to join.` };
        }
        return { error: `Cannot access channel #${channelName || channelId}: ${joinResult.error}. The bot may need to be invited to this channel or granted additional permissions.` };
      }
      // If join succeeded, retry getting messages
      console.log(`✅ Successfully joined channel ${channelId}, retrying message fetch...`);
      const retryResult = await slackApiCall('conversations.history', params);
      if (retryResult.error) return retryResult;
      // Use the retry result
      return {
        messages: retryResult.messages.map(msg => ({
          ts: msg.ts,
          user: msg.user,
          text: msg.text,
          type: msg.type,
          subtype: msg.subtype,
          thread_ts: msg.thread_ts,
          reply_count: msg.reply_count,
          reactions: msg.reactions || [],
        })),
        has_more: retryResult.has_more,
      };
    }
    return result;
  }
  
  return {
    messages: result.messages.map(msg => ({
      ts: msg.ts,
      user: msg.user,
      text: msg.text,
      type: msg.type,
      subtype: msg.subtype,
      thread_ts: msg.thread_ts,
      reply_count: msg.reply_count,
      reactions: msg.reactions || [],
    })),
    has_more: result.has_more,
  };
};

// Get channel information
const getSlackChannelInfo = async (channel) => {
  // If channel is a name (starts with #), look up the channel ID first
  let channelId = channel;
  if (channel && channel.startsWith('#')) {
    const channelName = channel.substring(1); // Remove #
    const channelsResult = await getSlackChannels();
    if (channelsResult.error) {
      return { error: `Failed to get channels list: ${channelsResult.error}` };
    }
    const foundChannel = channelsResult.channels.find(ch => ch.name === channelName);
    if (!foundChannel) {
      return { error: `Channel #${channelName} not found in your Slack workspace.` };
    }
    channelId = foundChannel.id;
  }
  
  const result = await slackApiCall('conversations.info', { channel: channelId });
  
  if (result.error) return result;
  
  const ch = result.channel;
  return {
    id: ch.id,
    name: ch.name,
    is_private: ch.is_private,
    is_archived: ch.is_archived,
    num_members: ch.num_members,
    topic: ch.topic?.value || '',
    purpose: ch.purpose?.value || '',
    created: ch.created,
    creator: ch.creator,
  };
};

// Get user information
const getSlackUser = async (user) => {
  const result = await slackApiCall('users.info', { user });
  
  if (result.error) return result;
  
  const u = result.user;
  return {
    id: u.id,
    name: u.name,
    real_name: u.real_name,
    display_name: u.profile?.display_name || '',
    email: u.profile?.email || '',
    status: u.profile?.status_text || '',
    timezone: u.tz,
    is_bot: u.is_bot,
    is_admin: u.is_admin,
  };
};

// Search messages across workspace
const searchSlackMessages = async (query, count = 20) => {
  const result = await slackApiCall('search.messages', {
    query,
    count: Math.min(count, 100),
  });
  
  if (result.error) return result;
  
  return {
    query,
    total: result.messages?.total || 0,
    matches: (result.messages?.matches || []).map(msg => ({
      channel: msg.channel?.name || msg.channel?.id,
      user: msg.user,
      text: msg.text,
      ts: msg.ts,
    })),
  };
};

// Get thread replies
const getSlackThreadReplies = async (channel, thread_ts) => {
  // If channel is a name (starts with #), look up the channel ID first
  let channelId = channel;
  if (channel && channel.startsWith('#')) {
    const channelName = channel.substring(1); // Remove #
    const channelsResult = await getSlackChannels();
    if (channelsResult.error) {
      return { error: `Failed to get channels list: ${channelsResult.error}` };
    }
    const foundChannel = channelsResult.channels.find(ch => ch.name === channelName);
    if (!foundChannel) {
      return { error: `Channel #${channelName} not found in your Slack workspace.` };
    }
    channelId = foundChannel.id;
  }
  
  const result = await slackApiCall('conversations.replies', {
    channel: channelId,
    ts: thread_ts,
  });
  
  if (result.error) return result;
  
  return {
    thread_ts,
    messages: result.messages.map(msg => ({
      ts: msg.ts,
      user: msg.user,
      text: msg.text,
      type: msg.type,
    })),
  };
};

export default {
  getSlackChannels,
  getSlackMessages,
  getSlackChannelInfo,
  getSlackUser,
  searchSlackMessages,
  getSlackThreadReplies,
  definition: [
    {
      type: 'function',
      function: {
        name: 'get_slack_channels',
        description: 'Get list of all Slack channels (public and private)',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_slack_messages',
        description: 'Get messages from a Slack channel',
        parameters: {
          type: 'object',
          properties: {
            channel: {
              type: 'string',
              description: 'Channel ID or channel name (e.g., C1234567890 or #general)',
            },
            limit: {
              type: 'number',
              description: 'Number of messages to retrieve (max 100, default 20)',
            },
            oldest: {
              type: 'string',
              description: 'Oldest timestamp to retrieve messages from (Unix timestamp)',
            },
            latest: {
              type: 'string',
              description: 'Latest timestamp to retrieve messages from (Unix timestamp)',
            },
          },
          required: ['channel'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_slack_channel_info',
        description: 'Get detailed information about a Slack channel',
        parameters: {
          type: 'object',
          properties: {
            channel: {
              type: 'string',
              description: 'Channel ID or channel name',
            },
          },
          required: ['channel'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_slack_user',
        description: 'Get information about a Slack user',
        parameters: {
          type: 'object',
          properties: {
            user: {
              type: 'string',
              description: 'User ID or username',
            },
          },
          required: ['user'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'search_slack_messages',
        description: 'Search for messages across the Slack workspace',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query (e.g., "from:username", "in:channel", "has:link")',
            },
            count: {
              type: 'number',
              description: 'Number of results to return (max 100, default 20)',
            },
          },
          required: ['query'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_slack_thread_replies',
        description: 'Get replies to a Slack message thread',
        parameters: {
          type: 'object',
          properties: {
            channel: {
              type: 'string',
              description: 'Channel ID or channel name',
            },
            thread_ts: {
              type: 'string',
              description: 'Thread timestamp (from the parent message)',
            },
          },
          required: ['channel', 'thread_ts'],
        },
      },
    },
  ],
};

