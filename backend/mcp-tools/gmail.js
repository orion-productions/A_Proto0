import axios from 'axios';

// Gmail API configuration
const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1';
const GOOGLE_ACCESS_TOKEN = process.env.GOOGLE_ACCESS_TOKEN || '';

// Helper function for Gmail API calls
const gmailApiCall = async (endpoint, method = 'GET', data = null) => {
  try {
    const config = {
      method,
      url: `${GMAIL_API_BASE}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${GOOGLE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return response.data;
  } catch (error) {
    return { 
      error: error.response?.data?.error?.message || error.message 
    };
  }
};

// Decode base64url email body
const decodeEmailBody = (body) => {
  if (!body) return '';
  try {
    // Replace URL-safe base64 characters
    const base64 = body.replace(/-/g, '+').replace(/_/g, '/');
    // Add padding if needed
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
    return Buffer.from(padded, 'base64').toString('utf-8');
  } catch (e) {
    return body;
  }
};

// Get Gmail message
const getGmailMessage = async (messageId, format = 'full') => {
  const result = await gmailApiCall(`/users/me/messages/${messageId}?format=${format}`);
  
  if (result.error) return result;
  
  // Extract headers
  const headers = {};
  result.payload?.headers?.forEach(h => {
    headers[h.name.toLowerCase()] = h.value;
  });
  
  // Extract body
  let body = '';
  if (result.payload?.body?.data) {
    body = decodeEmailBody(result.payload.body.data);
  } else if (result.payload?.parts) {
    // Handle multipart messages
    for (const part of result.payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        body = decodeEmailBody(part.body.data);
        break;
      } else if (part.mimeType === 'text/html' && part.body?.data && !body) {
        body = decodeEmailBody(part.body.data);
      }
    }
  }
  
  return {
    id: result.id,
    threadId: result.threadId,
    snippet: result.snippet,
    subject: headers.subject || '',
    from: headers.from || '',
    to: headers.to || '',
    cc: headers.cc || '',
    bcc: headers.bcc || '',
    date: headers.date || '',
    body: body,
    labels: result.labelIds || [],
    sizeEstimate: result.sizeEstimate,
  };
};

// List Gmail messages
const listGmailMessages = async (query = '', maxResults = 20, pageToken = null) => {
  let endpoint = `/users/me/messages?maxResults=${Math.min(maxResults, 500)}`;
  if (query) endpoint += `&q=${encodeURIComponent(query)}`;
  if (pageToken) endpoint += `&pageToken=${pageToken}`;
  
  const result = await gmailApiCall(endpoint);
  
  if (result.error) return result;
  
  return {
    messages: result.messages || [],
    resultSizeEstimate: result.resultSizeEstimate,
    nextPageToken: result.nextPageToken,
  };
};

// Search Gmail messages
const searchGmailMessages = async (query, maxResults = 20) => {
  return await listGmailMessages(query, maxResults);
};

// Get Gmail labels
const getGmailLabels = async () => {
  const result = await gmailApiCall('/users/me/labels');
  
  if (result.error) return result;
  
  return {
    labels: result.labels.map(label => ({
      id: label.id,
      name: label.name,
      type: label.type,
      messageListVisibility: label.messageListVisibility,
      labelListVisibility: label.labelListVisibility,
    })),
  };
};

// Get messages by label
const getGmailMessagesByLabel = async (labelId, maxResults = 20) => {
  return await listGmailMessages(`label:${labelId}`, maxResults);
};

// Get Gmail thread
const getGmailThread = async (threadId) => {
  const result = await gmailApiCall(`/users/me/threads/${threadId}`);
  
  if (result.error) return result;
  
  return {
    id: result.id,
    snippet: result.snippet,
    historyId: result.historyId,
    messages: result.messages?.map(msg => ({
      id: msg.id,
      threadId: msg.threadId,
      labelIds: msg.labelIds,
    })) || [],
  };
};

// Get message attachments
const getGmailMessageAttachments = async (messageId, attachmentId) => {
  const result = await gmailApiCall(`/users/me/messages/${messageId}/attachments/${attachmentId}`);
  
  if (result.error) return result;
  
  return {
    size: result.size,
    data: result.data, // Base64 encoded attachment data
  };
};

// Get Gmail profile
const getGmailProfile = async () => {
  const result = await gmailApiCall('/users/me/profile');
  
  if (result.error) return result;
  
  return {
    emailAddress: result.emailAddress,
    messagesTotal: result.messagesTotal,
    threadsTotal: result.threadsTotal,
    historyId: result.historyId,
  };
};

export default {
  getGmailMessage,
  listGmailMessages,
  searchGmailMessages,
  getGmailLabels,
  getGmailMessagesByLabel,
  getGmailThread,
  getGmailMessageAttachments,
  getGmailProfile,
  definition: [
    {
      type: 'function',
      function: {
        name: 'get_gmail_message',
        description: 'Get a Gmail message by its ID with full content',
        parameters: {
          type: 'object',
          properties: {
            messageId: {
              type: 'string',
              description: 'Gmail message ID',
            },
            format: {
              type: 'string',
              description: 'Message format',
              enum: ['full', 'metadata', 'minimal', 'raw'],
            },
          },
          required: ['messageId'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_gmail_messages',
        description: 'List Gmail messages with optional search query',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Gmail search query (e.g., "from:example@gmail.com", "subject:meeting", "is:unread")',
            },
            maxResults: {
              type: 'number',
              description: 'Maximum number of messages (default 20, max 500)',
            },
            pageToken: {
              type: 'string',
              description: 'Page token for pagination',
            },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'search_gmail_messages',
        description: 'Search Gmail messages using Gmail search syntax',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query (e.g., "from:user@example.com subject:meeting is:unread")',
            },
            maxResults: {
              type: 'number',
              description: 'Maximum number of results (default 20, max 500)',
            },
          },
          required: ['query'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_gmail_labels',
        description: 'Get all Gmail labels',
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
        name: 'get_gmail_messages_by_label',
        description: 'Get Gmail messages filtered by label',
        parameters: {
          type: 'object',
          properties: {
            labelId: {
              type: 'string',
              description: 'Label ID (e.g., "INBOX", "UNREAD", "SENT")',
            },
            maxResults: {
              type: 'number',
              description: 'Maximum number of messages (default 20, max 500)',
            },
          },
          required: ['labelId'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_gmail_thread',
        description: 'Get a Gmail conversation thread by thread ID',
        parameters: {
          type: 'object',
          properties: {
            threadId: {
              type: 'string',
              description: 'Gmail thread ID',
            },
          },
          required: ['threadId'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_gmail_message_attachments',
        description: 'Get attachment data from a Gmail message',
        parameters: {
          type: 'object',
          properties: {
            messageId: {
              type: 'string',
              description: 'Gmail message ID',
            },
            attachmentId: {
              type: 'string',
              description: 'Attachment ID from the message',
            },
          },
          required: ['messageId', 'attachmentId'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_gmail_profile',
        description: 'Get Gmail profile information (email, message count, etc.)',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    },
  ],
};

