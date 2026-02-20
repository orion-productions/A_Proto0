import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Gmail API configuration
const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1';

// Load Google credentials from file
let GOOGLE_ACCESS_TOKEN = '';
let GOOGLE_REFRESH_TOKEN = '';
let GOOGLE_CLIENT_ID = '';
let GOOGLE_CLIENT_SECRET = '';

try {
  const credentialsPath = path.join(__dirname, '../credentials/google.env');
  if (fs.existsSync(credentialsPath)) {
    const credentialsContent = fs.readFileSync(credentialsPath, 'utf8');
    const lines = credentialsContent.split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        const value = valueParts.join('=').trim();
        if (key === 'GOOGLE_ACCESS_TOKEN') {
          GOOGLE_ACCESS_TOKEN = value;
        } else if (key === 'GOOGLE_REFRESH_TOKEN') {
          GOOGLE_REFRESH_TOKEN = value;
        } else if (key === 'GOOGLE_CLIENT_ID') {
          GOOGLE_CLIENT_ID = value;
        } else if (key === 'GOOGLE_CLIENT_SECRET') {
          GOOGLE_CLIENT_SECRET = value;
        }
      }
    }
    console.log('✅ Google credentials loaded:', {
      hasAccessToken: !!GOOGLE_ACCESS_TOKEN,
      hasRefreshToken: !!GOOGLE_REFRESH_TOKEN,
      hasClientCredentials: !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET)
    });
  }
} catch (error) {
  console.warn('⚠️ Warning: Could not load Google credentials:', error.message);
}

// Save refreshed access token to file
const saveAccessToken = (newToken) => {
  try {
    const credentialsPath = path.join(__dirname, '../credentials/google.env');
    let content = fs.readFileSync(credentialsPath, 'utf8');
    
    // Update access token in file
    if (content.includes('GOOGLE_ACCESS_TOKEN=')) {
      content = content.replace(
        /GOOGLE_ACCESS_TOKEN=.*/,
        `GOOGLE_ACCESS_TOKEN=${newToken}`
      );
    } else {
      content += `\nGOOGLE_ACCESS_TOKEN=${newToken}`;
    }
    
    fs.writeFileSync(credentialsPath, content, 'utf8');
    GOOGLE_ACCESS_TOKEN = newToken; // Update in-memory token
    console.log('✅ Google access token refreshed and saved');
  } catch (error) {
    console.error('❌ Failed to save refreshed token:', error.message);
  }
};

// Refresh access token using refresh token
const refreshAccessToken = async () => {
  if (!GOOGLE_REFRESH_TOKEN) {
    return { error: 'No refresh token available. Cannot automatically refresh access token.' };
  }
  
  // Check if we have client credentials (required for refresh)
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return { 
      error: 'Client ID and Client Secret are required for automatic token refresh. If you got the token from OAuth Playground, you cannot auto-refresh. You need to set up a proper OAuth application in Google Cloud Console with GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.' 
    };
  }
  
  try {
    console.log('🔄 Refreshing Google access token...');
    
    const response = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token'
    });
    
    if (response.data.access_token) {
      const newAccessToken = response.data.access_token;
      saveAccessToken(newAccessToken);
      return { success: true, access_token: newAccessToken };
    } else {
      return { error: 'Token refresh failed: No access token in response' };
    }
  } catch (error) {
    const errorMsg = error.response?.data?.error_description || error.response?.data?.error || error.message;
    console.error('❌ Token refresh failed:', errorMsg);
    return { error: `Token refresh failed: ${errorMsg}` };
  }
};

// Helper function for Gmail API calls with automatic token refresh
const gmailApiCall = async (endpoint, method = 'GET', data = null, retryCount = 0) => {
  if (!GOOGLE_ACCESS_TOKEN) {
    return { 
      error: 'Gmail API token not configured. Please set up google.env credentials with GOOGLE_ACCESS_TOKEN. See CREDENTIALS_GUIDE.md for setup instructions.' 
    };
  }
  
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
    const errorMsg = error.response?.data?.error?.message || error.message;
    const status = error.response?.status;
    
    // If 401 (unauthorized) and we have a refresh token, try to refresh
    if (status === 401 && GOOGLE_REFRESH_TOKEN && retryCount === 0) {
      // Check if we have client credentials for refresh
      if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
        console.log('⚠️ Access token expired, attempting automatic refresh...');
        const refreshResult = await refreshAccessToken();
        
        if (refreshResult.success || refreshResult.access_token) {
          console.log('✅ Token refreshed, retrying request...');
          // Retry the request with new token
          return await gmailApiCall(endpoint, method, data, retryCount + 1);
        }
        // If refresh failed, fall through to show the actual error
      }
      // No client credentials or refresh failed - show token error
    }
    
    // Provide helpful error messages
    if (status === 401) {
      // Check if error indicates invalid token vs expired token
      const isInvalidToken = errorMsg?.includes('Invalid Credentials') || errorMsg?.includes('invalid authentication');
      
      if (isInvalidToken) {
        return { 
          error: `Gmail authentication failed. The access token is invalid or expired. Please get a new token from https://developers.google.com/oauthplayground/ (select scopes: gmail.readonly, calendar.readonly, drive.readonly) and update GOOGLE_ACCESS_TOKEN in google.env. Original error: ${errorMsg}` 
        };
      } else {
        return { 
          error: `Gmail authentication failed. The access token may have expired (tokens expire after ~1 hour). Please get a new token from https://developers.google.com/oauthplayground/ and update GOOGLE_ACCESS_TOKEN in google.env. Original error: ${errorMsg}` 
        };
      }
    }
    
    if (status === 403) {
      return { 
        error: `Gmail access denied. Make sure the token has the required scopes: gmail.readonly, calendar.readonly, drive.readonly. Original error: ${errorMsg}` 
      };
    }
    
    return { 
      error: errorMsg || error.message 
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

