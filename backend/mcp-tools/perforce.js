import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Perforce credentials from file
let P4_PORT = '';
let P4_USER = '';
let P4_CLIENT = '';
let P4_PASSWD = '';

try {
  const credentialsPath = path.join(__dirname, '../credentials/perforce.env');
  if (fs.existsSync(credentialsPath)) {
    const credentialsContent = fs.readFileSync(credentialsPath, 'utf8');
    const lines = credentialsContent.split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        const value = valueParts.join('=').trim();
        switch (key) {
          case 'P4PORT': P4_PORT = value; break;
          case 'P4USER': P4_USER = value; break;
          case 'P4CLIENT': P4_CLIENT = value; break;
          case 'P4PASSWD': P4_PASSWD = value; break;
        }
      }
    }
  }
} catch (error) {
  console.warn('Warning: Could not load Perforce credentials:', error.message);
}

// Helper function to build P4 command
const buildP4Command = (command, args = []) => {
  let cmd = 'p4';
  
  // Quote all credential parameters to handle special characters (like | & ; etc.)
  if (P4_PORT) cmd += ` -p "${P4_PORT}"`;
  if (P4_USER) cmd += ` -u "${P4_USER}"`;
  if (P4_CLIENT) cmd += ` -c "${P4_CLIENT}"`;
  if (P4_PASSWD) cmd += ` -P "${P4_PASSWD}"`;
  
  cmd += ` ${command}`;
  if (args.length > 0) {
    cmd += ` ${args.map(arg => `"${arg}"`).join(' ')}`;
  }
  
  return cmd;
};

// Execute P4 command and parse output
const executeP4Command = async (command, args = []) => {
  try {
    const cmd = buildP4Command(command, args);
    const { stdout, stderr } = await execAsync(cmd, { 
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    });
    
    if (stderr && !stderr.includes('info:')) {
      return { error: stderr };
    }
    
    return { output: stdout };
  } catch (error) {
    return { error: error.message };
  }
};

// Get changelist information
const getPerforceChangelist = async (changelist) => {
  const result = await executeP4Command('describe', [changelist]);
  
  if (result.error) return result;
  
  // Parse p4 describe output
  const lines = result.output.split('\n');
  const changelistInfo = {
    changelist: changelist,
    description: '',
    user: '',
    date: '',
    files: [],
  };
  
  let inDescription = false;
  let inFiles = false;
  
  for (const line of lines) {
    if (line.startsWith('Change')) {
      const match = line.match(/Change (\d+) by (.+?)@(.+?) on (.+)/);
      if (match) {
        changelistInfo.changelist = match[1];
        changelistInfo.user = match[2];
        changelistInfo.client = match[3];
        changelistInfo.date = match[4];
      }
    } else if (line.startsWith('Affected files')) {
      inFiles = true;
      inDescription = false;
    } else if (inFiles && line.trim() && !line.startsWith('Diff')) {
      const fileMatch = line.match(/^\.\.\. (.+?) (?:#\d+ )?(.+?)$/);
      if (fileMatch) {
        changelistInfo.files.push({
          path: fileMatch[1],
          action: fileMatch[2],
        });
      }
    } else if (!inFiles && line.trim() && !line.startsWith('Change')) {
      changelistInfo.description += line.trim() + '\n';
    }
  }
  
  changelistInfo.description = changelistInfo.description.trim();
  
  return changelistInfo;
};

// List changelists
const listPerforceChangelists = async (user = null, limit = 50) => {
  const args = ['-m', limit.toString()];
  if (user) {
    args.push(`-u ${user}`);
  }
  
  const result = await executeP4Command('changes', args);
  
  if (result.error) return result;
  
  const changelists = [];
  const lines = result.output.split('\n').filter(l => l.trim());
  
  for (const line of lines) {
    const match = line.match(/Change (\d+) on (.+?) by (.+?)@(.+?) '(.+?)'/);
    if (match) {
      changelists.push({
        changelist: match[1],
        date: match[2],
        user: match[3],
        client: match[4],
        description: match[5],
      });
    }
  }
  
  return { changelists };
};

// Get file information
const getPerforceFileInfo = async (filePath) => {
  const result = await executeP4Command('fstat', [filePath]);
  
  if (result.error) return result;
  
  const info = {};
  const lines = result.output.split('\n');
  
  for (const line of lines) {
    if (line.includes('...')) {
      const match = line.match(/\.\.\. (.+?) (.+)/);
      if (match) {
        const key = match[1];
        const value = match[2];
        info[key] = value;
      }
    }
  }
  
  return {
    path: filePath,
    depotFile: info.depotFile || '',
    clientFile: info.clientFile || '',
    headRev: info.headRev || '',
    headChange: info.headChange || '',
    headType: info.headType || '',
    haveRev: info.haveRev || '',
    action: info.action || '',
  };
};

// List files in a directory
const listPerforceFiles = async (path, limit = 100) => {
  const result = await executeP4Command('files', [`${path}/...`]);
  
  if (result.error) return result;
  
  const files = [];
  const lines = result.output.split('\n').filter(l => l.trim());
  
  for (let i = 0; i < Math.min(lines.length, limit); i++) {
    const line = lines[i];
    const match = line.match(/^(.+?) - (.+?) change (\d+) \((.+?)\)$/);
    if (match) {
      files.push({
        path: match[1],
        revision: match[2],
        changelist: match[3],
        action: match[4],
      });
    }
  }
  
  return { files, total: lines.length };
};

// Get file content
const getPerforceFileContent = async (filePath, revision = null) => {
  const args = revision ? [`${filePath}#${revision}`] : [filePath];
  const result = await executeP4Command('print', args);
  
  if (result.error) return result;
  
  // Remove Perforce header lines
  const lines = result.output.split('\n');
  const contentStart = lines.findIndex(l => l.startsWith('===='));
  const content = lines.slice(contentStart + 1).join('\n');
  
  return {
    path: filePath,
    revision: revision || 'head',
    content: content,
  };
};

// Get file history
const getPerforceFileHistory = async (filePath, limit = 50) => {
  const result = await executeP4Command('filelog', ['-m', limit.toString(), filePath]);
  
  if (result.error) return result;
  
  const history = [];
  const lines = result.output.split('\n');
  let currentRev = null;
  
  for (const line of lines) {
    if (line.startsWith('//')) {
      const match = line.match(/^(.+?) - (.+?) change (\d+) \((.+?)\)$/);
      if (match) {
        currentRev = {
          path: match[1],
          revision: match[2],
          changelist: match[3],
          action: match[4],
          integrations: [],
        };
        history.push(currentRev);
      }
    } else if (line.trim().startsWith('...') && currentRev) {
      const integrationMatch = line.match(/\.\.\. (.+?) from (.+?)#(\d+)/);
      if (integrationMatch) {
        currentRev.integrations.push({
          action: integrationMatch[1],
          from: integrationMatch[2],
          revision: integrationMatch[3],
        });
      }
    }
  }
  
  return { history };
};

// Get workspace/client information
const getPerforceClient = async (clientName = null) => {
  const args = clientName ? [clientName] : [];
  const result = await executeP4Command('client', ['-o', ...args]);
  
  if (result.error) return result;
  
  const info = {};
  const lines = result.output.split('\n');
  
  for (const line of lines) {
    const match = line.match(/^(.+?):\s*(.+)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      info[key] = value;
    }
  }
  
  return info;
};

export default {
  getPerforceChangelist,
  listPerforceChangelists,
  getPerforceFileInfo,
  listPerforceFiles,
  getPerforceFileContent,
  getPerforceFileHistory,
  getPerforceClient,
  definition: [
    {
      type: 'function',
      function: {
        name: 'get_perforce_changelist',
        description: 'Get information about a Perforce changelist',
        parameters: {
          type: 'object',
          properties: {
            changelist: {
              type: 'string',
              description: 'Changelist number',
            },
          },
          required: ['changelist'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_perforce_changelists',
        description: 'List recent Perforce changelists',
        parameters: {
          type: 'object',
          properties: {
            user: {
              type: 'string',
              description: 'Filter by user (optional)',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of changelists (default 50)',
            },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_perforce_file_info',
        description: 'Get information about a file in Perforce',
        parameters: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: 'File path in depot (e.g., //depot/path/to/file.txt)',
            },
          },
          required: ['filePath'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_perforce_files',
        description: 'List files in a Perforce directory',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Directory path in depot (e.g., //depot/path/to/dir)',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of files (default 100)',
            },
          },
          required: ['path'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_perforce_file_content',
        description: 'Get the content of a file from Perforce',
        parameters: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: 'File path in depot',
            },
            revision: {
              type: 'string',
              description: 'Revision number (optional, defaults to head)',
            },
          },
          required: ['filePath'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_perforce_file_history',
        description: 'Get revision history for a Perforce file',
        parameters: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: 'File path in depot',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of revisions (default 50)',
            },
          },
          required: ['filePath'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_perforce_client',
        description: 'Get Perforce workspace/client information',
        parameters: {
          type: 'object',
          properties: {
            clientName: {
              type: 'string',
              description: 'Client name (optional, uses default if not provided)',
            },
          },
          required: [],
        },
      },
    },
  ],
};

