import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Google Drive API configuration
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';

// Load Google credentials from file
let GOOGLE_ACCESS_TOKEN = '';

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
        }
      }
    }
  }
} catch (error) {
  console.warn('Warning: Could not load Google credentials:', error.message);
}

// Helper function for Drive API calls
const driveApiCall = async (endpoint, method = 'GET', data = null) => {
  try {
    const config = {
      method,
      url: `${DRIVE_API_BASE}${endpoint}`,
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

// List Drive files
const listDriveFiles = async (query = '', pageSize = 20, pageToken = null, orderBy = 'modifiedTime desc') => {
  let endpoint = `/files?pageSize=${Math.min(pageSize, 1000)}&orderBy=${encodeURIComponent(orderBy)}&fields=nextPageToken,files(id,name,mimeType,size,modifiedTime,createdTime,webViewLink,parents,shared,owners)`;
  
  if (query) {
    endpoint += `&q=${encodeURIComponent(query)}`;
  }
  
  if (pageToken) {
    endpoint += `&pageToken=${encodeURIComponent(pageToken)}`;
  }
  
  const result = await driveApiCall(endpoint);
  
  if (result.error) return result;
  
  return {
    files: result.files.map(file => ({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      size: file.size || 0,
      modifiedTime: file.modifiedTime,
      createdTime: file.createdTime,
      webViewLink: file.webViewLink,
      parents: file.parents || [],
      shared: file.shared || false,
      owners: file.owners?.map(o => o.displayName || o.emailAddress) || [],
    })),
    nextPageToken: result.nextPageToken,
  };
};

// Get Drive file
const getDriveFile = async (fileId, fields = 'id,name,mimeType,size,modifiedTime,createdTime,webViewLink,parents,shared,owners,description') => {
  const result = await driveApiCall(`/files/${fileId}?fields=${encodeURIComponent(fields)}`);
  
  if (result.error) return result;
  
  return {
    id: result.id,
    name: result.name,
    mimeType: result.mimeType,
    size: result.size || 0,
    modifiedTime: result.modifiedTime,
    createdTime: result.createdTime,
    webViewLink: result.webViewLink,
    parents: result.parents || [],
    shared: result.shared || false,
    owners: result.owners?.map(o => ({
      displayName: o.displayName,
      emailAddress: o.emailAddress,
    })) || [],
    description: result.description || '',
  };
};

// Get Drive file content
const getDriveFileContent = async (fileId, mimeType = null) => {
  try {
    let endpoint = `/files/${fileId}?alt=media`;
    const config = {
      method: 'GET',
      url: `${DRIVE_API_BASE}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${GOOGLE_ACCESS_TOKEN}`,
      },
      responseType: 'arraybuffer',
    };
    
    const response = await axios(config);
    
    // For text files, return as string
    if (mimeType && mimeType.startsWith('text/')) {
      return {
        id: fileId,
        content: Buffer.from(response.data).toString('utf-8'),
        mimeType: mimeType,
      };
    }
    
    // For other files, return base64
    return {
      id: fileId,
      content: Buffer.from(response.data).toString('base64'),
      mimeType: mimeType || 'application/octet-stream',
      base64: true,
    };
  } catch (error) {
    return { 
      error: error.response?.data?.error?.message || error.message 
    };
  }
};

// Search Drive files
const searchDriveFiles = async (query, pageSize = 20) => {
  // Build Drive query
  const driveQuery = `name contains '${query}' or fullText contains '${query}'`;
  return await listDriveFiles(driveQuery, pageSize);
};

// List files in folder
const listDriveFolderFiles = async (folderId, pageSize = 20) => {
  const query = `'${folderId}' in parents and trashed=false`;
  return await listDriveFiles(query, pageSize);
};

// Get folder hierarchy
const getDriveFolderPath = async (fileId) => {
  const file = await getDriveFile(fileId, 'id,name,parents');
  if (file.error) return file;
  
  const path = [file.name];
  let currentId = file.parents?.[0];
  
  // Traverse up the folder hierarchy (limit to 10 levels to avoid infinite loops)
  let level = 0;
  while (currentId && level < 10) {
    const parent = await getDriveFile(currentId, 'id,name,parents');
    if (parent.error) break;
    path.unshift(parent.name);
    currentId = parent.parents?.[0];
    level++;
  }
  
  return {
    fileId: file.id,
    path: path.join('/'),
  };
};

// Get Drive about info (user info, storage quota, etc.)
const getDriveAbout = async () => {
  const result = await driveApiCall('/about?fields=user,storageQuota');
  
  if (result.error) return result;
  
  return {
    user: {
      displayName: result.user?.displayName || '',
      emailAddress: result.user?.emailAddress || '',
      photoLink: result.user?.photoLink || '',
    },
    storageQuota: {
      limit: result.storageQuota?.limit || '0',
      usage: result.storageQuota?.usage || '0',
      usageInDrive: result.storageQuota?.usageInDrive || '0',
      usageInDriveTrash: result.storageQuota?.usageInDriveTrash || '0',
    },
  };
};

// List shared files
const listDriveSharedFiles = async (pageSize = 20) => {
  const query = 'sharedWithMe=true';
  return await listDriveFiles(query, pageSize);
};

// List recent files
const listDriveRecentFiles = async (pageSize = 20) => {
  return await listDriveFiles('', pageSize, null, 'modifiedTime desc');
};

export default {
  listDriveFiles,
  getDriveFile,
  getDriveFileContent,
  searchDriveFiles,
  listDriveFolderFiles,
  getDriveFolderPath,
  getDriveAbout,
  listDriveSharedFiles,
  listDriveRecentFiles,
  definition: [
    {
      type: 'function',
      function: {
        name: 'list_drive_files',
        description: 'List files in Google Drive with optional query filter',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Drive query string (e.g., "mimeType=\'application/pdf\'", "trashed=false")',
            },
            pageSize: {
              type: 'number',
              description: 'Number of files to return (default 20, max 1000)',
            },
            pageToken: {
              type: 'string',
              description: 'Page token for pagination',
            },
            orderBy: {
              type: 'string',
              description: 'Order by field (e.g., "modifiedTime desc", "name")',
            },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_drive_file',
        description: 'Get metadata for a Google Drive file',
        parameters: {
          type: 'object',
          properties: {
            fileId: {
              type: 'string',
              description: 'Google Drive file ID',
            },
            fields: {
              type: 'string',
              description: 'Comma-separated list of fields to return',
            },
          },
          required: ['fileId'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_drive_file_content',
        description: 'Get the content of a Google Drive file',
        parameters: {
          type: 'object',
          properties: {
            fileId: {
              type: 'string',
              description: 'Google Drive file ID',
            },
            mimeType: {
              type: 'string',
              description: 'MIME type of the file (for text files, content is returned as string)',
            },
          },
          required: ['fileId'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'search_drive_files',
        description: 'Search for files in Google Drive by name or content',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query (searches in file name and content)',
            },
            pageSize: {
              type: 'number',
              description: 'Number of results (default 20)',
            },
          },
          required: ['query'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_drive_folder_files',
        description: 'List files in a specific Google Drive folder',
        parameters: {
          type: 'object',
          properties: {
            folderId: {
              type: 'string',
              description: 'Google Drive folder ID',
            },
            pageSize: {
              type: 'number',
              description: 'Number of files (default 20)',
            },
          },
          required: ['folderId'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_drive_folder_path',
        description: 'Get the full folder path for a Drive file/folder',
        parameters: {
          type: 'object',
          properties: {
            fileId: {
              type: 'string',
              description: 'Google Drive file or folder ID',
            },
          },
          required: ['fileId'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_drive_about',
        description: 'Get Google Drive account information and storage quota',
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
        name: 'list_drive_shared_files',
        description: 'List files shared with the user',
        parameters: {
          type: 'object',
          properties: {
            pageSize: {
              type: 'number',
              description: 'Number of files (default 20)',
            },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_drive_recent_files',
        description: 'List recently modified files in Google Drive',
        parameters: {
          type: 'object',
          properties: {
            pageSize: {
              type: 'number',
              description: 'Number of files (default 20)',
            },
          },
          required: [],
        },
      },
    },
  ],
};

