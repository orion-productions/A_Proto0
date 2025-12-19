import axios from 'axios';

// Slack API configuration
const SLACK_BASE_URL = 'https://slack.com/api';
const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN || '';

// Helper function for Slack API calls
const slackApiCall = async (method, params = {}) => {
  try {
    const response = await axios.post(
      `${SLACK_BASE_URL}/${method}`,
      params,
      {
        headers: {
          'Authorization': `Bearer ${SLACK_TOKEN}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    
    if (!response.data.ok) {
      return { error: response.data.error || 'Slack API error' };
    }
    
    return response.data;
  } catch (error) {
    return { error: error.message };
  }
};

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
  const params = {
    channel,
    limit: Math.min(limit, 100), // Slack max is 100
  };
  
  if (oldest) params.oldest = oldest;
  if (latest) params.latest = latest;
  
  const result = await slackApiCall('conversations.history', params);
  
  if (result.error) return result;
  
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
  const result = await slackApiCall('conversations.info', { channel });
  
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
  const result = await slackApiCall('conversations.replies', {
    channel,
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

