import axios from 'axios';

// Discord API configuration
const DISCORD_API_BASE = 'https://discord.com/api/v10';
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || '';

// Helper function for Discord API calls
const discordApiCall = async (endpoint, method = 'GET', data = null) => {
  try {
    const config = {
      method,
      url: `${DISCORD_API_BASE}${endpoint}`,
      headers: {
        'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'AI-Unseen-Workspace (https://github.com, 1.0)',
      },
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return response.data;
  } catch (error) {
    return { 
      error: error.response?.data?.message || error.message 
    };
  }
};

// Get Discord channel
const getDiscordChannel = async (channelId) => {
  const result = await discordApiCall(`/channels/${channelId}`);
  
  if (result.error) return result;
  
  return {
    id: result.id,
    name: result.name,
    type: result.type,
    guild_id: result.guild_id,
    position: result.position,
    topic: result.topic || '',
    nsfw: result.nsfw || false,
    last_message_id: result.last_message_id || null,
    parent_id: result.parent_id || null,
    rate_limit_per_user: result.rate_limit_per_user || 0,
  };
};

// List Discord channel messages
const listDiscordChannelMessages = async (channelId, limit = 50, before = null, after = null, around = null) => {
  let endpoint = `/channels/${channelId}/messages?limit=${Math.min(limit, 100)}`;
  
  if (before) endpoint += `&before=${before}`;
  if (after) endpoint += `&after=${after}`;
  if (around) endpoint += `&around=${around}`;
  
  const result = await discordApiCall(endpoint);
  
  if (result.error) return result;
  
  return {
    messages: result.map(msg => ({
      id: msg.id,
      channel_id: msg.channel_id,
      author: {
        id: msg.author.id,
        username: msg.author.username,
        discriminator: msg.author.discriminator,
        global_name: msg.author.global_name || null,
        avatar: msg.author.avatar,
        bot: msg.author.bot || false,
      },
      content: msg.content || '',
      timestamp: msg.timestamp,
      edited_timestamp: msg.edited_timestamp || null,
      tts: msg.tts || false,
      mention_everyone: msg.mention_everyone || false,
      mentions: msg.mentions?.map(m => ({
        id: m.id,
        username: m.username,
        global_name: m.global_name || null,
      })) || [],
      mention_roles: msg.mention_roles || [],
      attachments: msg.attachments?.map(a => ({
        id: a.id,
        filename: a.filename,
        size: a.size,
        url: a.url,
        proxy_url: a.proxy_url,
        content_type: a.content_type || null,
      })) || [],
      embeds: msg.embeds || [],
      reactions: msg.reactions?.map(r => ({
        emoji: r.emoji,
        count: r.count,
        me: r.me || false,
      })) || [],
      pinned: msg.pinned || false,
      type: msg.type,
    })),
  };
};

// Get Discord message
const getDiscordMessage = async (channelId, messageId) => {
  const result = await discordApiCall(`/channels/${channelId}/messages/${messageId}`);
  
  if (result.error) return result;
  
  return {
    id: result.id,
    channel_id: result.channel_id,
    author: {
      id: result.author.id,
      username: result.author.username,
      discriminator: result.author.discriminator,
      global_name: result.author.global_name || null,
      avatar: result.author.avatar,
      bot: result.author.bot || false,
    },
    content: result.content || '',
    timestamp: result.timestamp,
    edited_timestamp: result.edited_timestamp || null,
    tts: result.tts || false,
    mention_everyone: result.mention_everyone || false,
    mentions: result.mentions?.map(m => ({
      id: m.id,
      username: m.username,
      global_name: m.global_name || null,
    })) || [],
    mention_roles: result.mention_roles || [],
    attachments: result.attachments?.map(a => ({
      id: a.id,
      filename: a.filename,
      size: a.size,
      url: a.url,
      proxy_url: a.proxy_url,
      content_type: a.content_type || null,
    })) || [],
    embeds: result.embeds || [],
    reactions: result.reactions?.map(r => ({
      emoji: r.emoji,
      count: r.count,
      me: r.me || false,
    })) || [],
    pinned: result.pinned || false,
    type: result.type,
  };
};

// Get Discord guild (server)
const getDiscordGuild = async (guildId) => {
  const result = await discordApiCall(`/guilds/${guildId}`);
  
  if (result.error) return result;
  
  return {
    id: result.id,
    name: result.name,
    icon: result.icon || null,
    description: result.description || null,
    owner_id: result.owner_id,
    region: result.region || null,
    afk_channel_id: result.afk_channel_id || null,
    afk_timeout: result.afk_timeout || 0,
    verification_level: result.verification_level,
    default_message_notifications: result.default_message_notifications,
    explicit_content_filter: result.explicit_content_filter,
    roles: result.roles?.map(r => ({
      id: r.id,
      name: r.name,
      color: r.color,
      hoist: r.hoist || false,
      mentionable: r.mentionable || false,
    })) || [],
    emojis: result.emojis?.map(e => ({
      id: e.id,
      name: e.name,
      animated: e.animated || false,
    })) || [],
    features: result.features || [],
    member_count: result.member_count || null,
    premium_tier: result.premium_tier || 0,
  };
};

// List Discord guild channels
const listDiscordGuildChannels = async (guildId) => {
  const result = await discordApiCall(`/guilds/${guildId}/channels`);
  
  if (result.error) return result;
  
  return {
    channels: result.map(ch => ({
      id: ch.id,
      name: ch.name,
      type: ch.type,
      position: ch.position,
      topic: ch.topic || null,
      nsfw: ch.nsfw || false,
      parent_id: ch.parent_id || null,
      rate_limit_per_user: ch.rate_limit_per_user || 0,
    })),
  };
};

// Get Discord guild member
const getDiscordGuildMember = async (guildId, userId) => {
  const result = await discordApiCall(`/guilds/${guildId}/members/${userId}`);
  
  if (result.error) return result;
  
  return {
    user: result.user ? {
      id: result.user.id,
      username: result.user.username,
      discriminator: result.user.discriminator,
      global_name: result.user.global_name || null,
      avatar: result.user.avatar,
      bot: result.user.bot || false,
    } : null,
    nick: result.nick || null,
    roles: result.roles || [],
    joined_at: result.joined_at,
    premium_since: result.premium_since || null,
    deaf: result.deaf || false,
    mute: result.mute || false,
  };
};

// List Discord guild members
const listDiscordGuildMembers = async (guildId, limit = 1000, after = null) => {
  let endpoint = `/guilds/${guildId}/members?limit=${Math.min(limit, 1000)}`;
  if (after) endpoint += `&after=${after}`;
  
  const result = await discordApiCall(endpoint);
  
  if (result.error) return result;
  
  return {
    members: result.map(member => ({
      user: member.user ? {
        id: member.user.id,
        username: member.user.username,
        discriminator: member.user.discriminator,
        global_name: member.user.global_name || null,
        avatar: member.user.avatar,
        bot: member.user.bot || false,
      } : null,
      nick: member.nick || null,
      roles: member.roles || [],
      joined_at: member.joined_at,
    })),
  };
};

// Get Discord user
const getDiscordUser = async (userId) => {
  const result = await discordApiCall(`/users/${userId}`);
  
  if (result.error) return result;
  
  return {
    id: result.id,
    username: result.username,
    discriminator: result.discriminator,
    global_name: result.global_name || null,
    avatar: result.avatar,
    bot: result.bot || false,
    system: result.system || false,
    banner: result.banner || null,
    accent_color: result.accent_color || null,
  };
};

// Get current bot user
const getDiscordBotUser = async () => {
  const result = await discordApiCall('/users/@me');
  
  if (result.error) return result;
  
  return {
    id: result.id,
    username: result.username,
    discriminator: result.discriminator,
    global_name: result.global_name || null,
    avatar: result.avatar,
    bot: result.bot || false,
    system: result.system || false,
  };
};

// List Discord guilds (servers) the bot is in
const listDiscordGuilds = async (limit = 200, before = null, after = null) => {
  let endpoint = `/users/@me/guilds?limit=${Math.min(limit, 200)}`;
  if (before) endpoint += `&before=${before}`;
  if (after) endpoint += `&after=${after}`;
  
  const result = await discordApiCall(endpoint);
  
  if (result.error) return result;
  
  return {
    guilds: result.map(guild => ({
      id: guild.id,
      name: guild.name,
      icon: guild.icon || null,
      owner: guild.owner || false,
      permissions: guild.permissions || '',
      features: guild.features || [],
    })),
  };
};

// Get message reactions
const getDiscordMessageReactions = async (channelId, messageId, emoji) => {
  // URL encode emoji (can be unicode or custom emoji format like name:id)
  const encodedEmoji = encodeURIComponent(emoji);
  const result = await discordApiCall(`/channels/${channelId}/messages/${messageId}/reactions/${encodedEmoji}`);
  
  if (result.error) return result;
  
  return {
    emoji: emoji,
    users: result.map(user => ({
      id: user.id,
      username: user.username,
      discriminator: user.discriminator,
      global_name: user.global_name || null,
      avatar: user.avatar,
      bot: user.bot || false,
    })),
  };
};

// Search messages in a channel (Discord doesn't have native search, so we'll list and filter)
const searchDiscordMessages = async (channelId, query, limit = 50) => {
  // Get recent messages and filter by content
  const messagesResult = await listDiscordChannelMessages(channelId, limit * 2);
  
  if (messagesResult.error) return messagesResult;
  
  const queryLower = query.toLowerCase();
  const filtered = messagesResult.messages.filter(msg => 
    msg.content.toLowerCase().includes(queryLower) ||
    msg.author.username.toLowerCase().includes(queryLower)
  ).slice(0, limit);
  
  return {
    query: query,
    messages: filtered,
  };
};

export default {
  getDiscordChannel,
  listDiscordChannelMessages,
  getDiscordMessage,
  getDiscordGuild,
  listDiscordGuildChannels,
  getDiscordGuildMember,
  listDiscordGuildMembers,
  getDiscordUser,
  getDiscordBotUser,
  listDiscordGuilds,
  getDiscordMessageReactions,
  searchDiscordMessages,
  definition: [
    {
      type: 'function',
      function: {
        name: 'get_discord_channel',
        description: 'Get information about a Discord channel',
        parameters: {
          type: 'object',
          properties: {
            channelId: {
              type: 'string',
              description: 'Discord channel ID',
            },
          },
          required: ['channelId'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_discord_channel_messages',
        description: 'List messages from a Discord channel',
        parameters: {
          type: 'object',
          properties: {
            channelId: {
              type: 'string',
              description: 'Discord channel ID',
            },
            limit: {
              type: 'number',
              description: 'Number of messages to retrieve (default 50, max 100)',
            },
            before: {
              type: 'string',
              description: 'Get messages before this message ID',
            },
            after: {
              type: 'string',
              description: 'Get messages after this message ID',
            },
            around: {
              type: 'string',
              description: 'Get messages around this message ID',
            },
          },
          required: ['channelId'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_discord_message',
        description: 'Get a specific Discord message by ID',
        parameters: {
          type: 'object',
          properties: {
            channelId: {
              type: 'string',
              description: 'Discord channel ID',
            },
            messageId: {
              type: 'string',
              description: 'Discord message ID',
            },
          },
          required: ['channelId', 'messageId'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_discord_guild',
        description: 'Get information about a Discord server (guild)',
        parameters: {
          type: 'object',
          properties: {
            guildId: {
              type: 'string',
              description: 'Discord guild (server) ID',
            },
          },
          required: ['guildId'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_discord_guild_channels',
        description: 'List all channels in a Discord server',
        parameters: {
          type: 'object',
          properties: {
            guildId: {
              type: 'string',
              description: 'Discord guild (server) ID',
            },
          },
          required: ['guildId'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_discord_guild_member',
        description: 'Get information about a member in a Discord server',
        parameters: {
          type: 'object',
          properties: {
            guildId: {
              type: 'string',
              description: 'Discord guild (server) ID',
            },
            userId: {
              type: 'string',
              description: 'Discord user ID',
            },
          },
          required: ['guildId', 'userId'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_discord_guild_members',
        description: 'List members in a Discord server',
        parameters: {
          type: 'object',
          properties: {
            guildId: {
              type: 'string',
              description: 'Discord guild (server) ID',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of members (default 1000, max 1000)',
            },
            after: {
              type: 'string',
              description: 'Get members after this user ID (for pagination)',
            },
          },
          required: ['guildId'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_discord_user',
        description: 'Get information about a Discord user',
        parameters: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              description: 'Discord user ID',
            },
          },
          required: ['userId'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_discord_bot_user',
        description: 'Get information about the bot user',
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
        name: 'list_discord_guilds',
        description: 'List Discord servers (guilds) the bot is in',
        parameters: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of guilds (default 200, max 200)',
            },
            before: {
              type: 'string',
              description: 'Get guilds before this guild ID',
            },
            after: {
              type: 'string',
              description: 'Get guilds after this guild ID',
            },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_discord_message_reactions',
        description: 'Get users who reacted to a message with a specific emoji',
        parameters: {
          type: 'object',
          properties: {
            channelId: {
              type: 'string',
              description: 'Discord channel ID',
            },
            messageId: {
              type: 'string',
              description: 'Discord message ID',
            },
            emoji: {
              type: 'string',
              description: 'Emoji (unicode like 👍 or custom like name:id)',
            },
          },
          required: ['channelId', 'messageId', 'emoji'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'search_discord_messages',
        description: 'Search for messages in a channel by content or author',
        parameters: {
          type: 'object',
          properties: {
            channelId: {
              type: 'string',
              description: 'Discord channel ID',
            },
            query: {
              type: 'string',
              description: 'Search query (searches in message content and author username)',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results (default 50)',
            },
          },
          required: ['channelId', 'query'],
        },
      },
    },
  ],
};

