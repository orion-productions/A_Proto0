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
  
  // Quote credential parameters (except password - we'll use env var)
  if (P4_PORT) cmd += ` -p "${P4_PORT}"`;
  if (P4_USER) cmd += ` -u "${P4_USER}"`;
  if (P4_CLIENT) cmd += ` -c "${P4_CLIENT}"`;
  // NOTE: P4PASSWD is now set via environment variable (see execP4Command)
  
  cmd += ` ${command}`;
  if (args.length > 0) {
    cmd += ` ${args.map(arg => `"${arg}"`).join(' ')}`;
  }
  
  return cmd;
};

// Execute P4 command and parse output
// Helper function to login to Perforce and get a ticket
const loginToPerforce = async () => {
  if (!P4_PASSWD) {
    return { error: 'P4PASSWD not set in credentials/perforce.env' };
  }
  
  try {
    // Use echo to pipe password to p4 login command
    const loginCmd = `echo '${P4_PASSWD.replace(/'/g, "'\\''")}' | p4 -p "${P4_PORT}" -u "${P4_USER}" login`;
    const { stdout, stderr } = await execAsync(loginCmd, { 
      maxBuffer: 10 * 1024 * 1024 
    });
    
    if (stderr && stderr.includes('logged in')) {
      console.log('✅ Perforce login successful');
      return { success: true };
    } else if (stderr) {
      return { error: stderr };
    }
    
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
};

const executeP4Command = async (command, args = []) => {
  try {
    const cmd = buildP4Command(command, args);
    
    // Perforce uses ticket-based authentication
    // Try command first, if it fails with password error, login and retry
    
    const { stdout, stderr } = await execAsync(cmd, { 
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    });
    
    // Check for authentication errors
    if (stderr && stderr.includes('Perforce password (P4PASSWD) invalid or unset')) {
      console.log('⚠️ Perforce ticket expired or missing, attempting to login...');
      
      // Try to login
      const loginResult = await loginToPerforce();
      if (loginResult.error) {
        return { error: `Login failed: ${loginResult.error}` };
      }
      
      // Retry the command after successful login
      console.log('🔄 Retrying command after login...');
      const retryResult = await execAsync(cmd, { 
        maxBuffer: 10 * 1024 * 1024 
      });
      
      if (retryResult.stderr && !retryResult.stderr.includes('info:')) {
        return { error: retryResult.stderr };
      }
      
      return { output: retryResult.stdout };
    }
    
    if (stderr && !stderr.includes('info:')) {
      return { error: stderr };
    }
    
    return { output: stdout };
  } catch (error) {
    // If execution fails, try to login and retry once
    if (error.message.includes('Perforce password') || error.message.includes('not logged in')) {
      console.log('⚠️ Command failed with auth error, attempting to login...');
      
      const loginResult = await loginToPerforce();
      if (loginResult.error) {
        return { error: `Login failed: ${loginResult.error}` };
      }
      
      // Retry the command
      try {
        console.log('🔄 Retrying command after login...');
        const cmd = buildP4Command(command, args);
        const { stdout, stderr } = await execAsync(cmd, { 
          maxBuffer: 10 * 1024 * 1024 
        });
        
        if (stderr && !stderr.includes('info:')) {
          return { error: stderr };
        }
        
        return { output: stdout };
      } catch (retryError) {
        return { error: retryError.message };
      }
    }
    
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
  // Normalize username if provided
  // Handle various formats: "Pierre Maury" / "Pierre.Maury" / "pierre maury" → "pierre_maury"
  const normalizedUser = user ? user.toLowerCase().replace(/[\s.]+/g, '_') : null;
  
  // Fetch both submitted AND pending changelists, then merge them
  // By default, 'p4 changes' only shows submitted, we need '-s pending' for pending ones
  
  const allChangelists = [];
  
  // 1. Get submitted changelists
  const submittedArgs = ['-m', limit.toString()];
  if (normalizedUser) submittedArgs.push('-u', normalizedUser);
  submittedArgs.push('//...');
  
  const submittedResult = await executeP4Command('changes', submittedArgs);
  if (!submittedResult.error) {
    const lines = submittedResult.output.split('\n').filter(l => l.trim());
    for (const line of lines) {
      const match = line.match(/Change (\d+) on (.+?) by (.+?)@(.+?) '(.+?)'/);
      if (match) {
        allChangelists.push({
          changelist: match[1],
          date: match[2],
          user: match[3],
          client: match[4],
          description: match[5],
          status: 'submitted'
        });
      }
    }
  }
  
  // 2. Get pending changelists
  const pendingArgs = ['-m', limit.toString(), '-s', 'pending'];
  if (normalizedUser) pendingArgs.push('-u', normalizedUser);
  pendingArgs.push('//...');
  
  const pendingResult = await executeP4Command('changes', pendingArgs);
  if (!pendingResult.error) {
    const lines = pendingResult.output.split('\n').filter(l => l.trim());
    for (const line of lines) {
      const match = line.match(/Change (\d+) on (.+?) by (.+?)@(.+?) \*pending\* '(.+?)'/);
      if (match) {
        allChangelists.push({
          changelist: match[1],
          date: match[2],
          user: match[3],
          client: match[4],
          description: match[5],
          status: 'pending'
        });
      }
    }
  }
  
  // 3. Sort by changelist number (descending) and limit
  allChangelists.sort((a, b) => parseInt(b.changelist) - parseInt(a.changelist));
  const changelists = allChangelists.slice(0, limit);
  
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

// List directories in a path
const listPerforceDirectories = async (path = '//*') => {
  const result = await executeP4Command('dirs', [path]);
  
  if (result.error) return result;
  
  const directories = [];
  const lines = result.output.split('\n').filter(l => l.trim());
  
  for (const line of lines) {
    if (line.trim()) {
      directories.push(line.trim());
    }
  }
  
  return { directories, total: directories.length };
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
  let currentKey = null;
  let currentValue = [];
  
  for (const line of lines) {
    // Skip comment lines
    if (line.trim().startsWith('#')) continue;
    
    // Check if this is a key:value line (using tabs or spaces after colon)
    const match = line.match(/^([A-Za-z]+):\s*(.*)$/);
    if (match) {
      // Save previous key if exists
      if (currentKey) {
        info[currentKey] = currentValue.length > 1 ? currentValue : (currentValue[0] || '');
      }
      // Start new key
      currentKey = match[1].trim();
      currentValue = match[2].trim() ? [match[2].trim()] : [];
    } else if (currentKey && line.trim() && !line.startsWith('#')) {
      // This is a continuation line (like additional View mappings)
      currentValue.push(line.trim());
    }
  }
  
  // Save last key
  if (currentKey) {
    info[currentKey] = currentValue.length > 1 ? currentValue : (currentValue[0] || '');
  }
  
  return info;
};

export default {
  getPerforceChangelist,
  listPerforceChangelists,
  getPerforceFileInfo,
  listPerforceFiles,
  listPerforceDirectories,
  getPerforceFileContent,
  getPerforceFileHistory,
  getPerforceClient,
  definition: [
    {
      type: 'function',
      function: {
        name: 'get_perforce_changelist',
        description: 'Get detailed information about a specific Perforce changelist (commit/change), including files changed, description, user, and date.',
        parameters: {
          type: 'object',
          properties: {
            changelist: {
              type: 'string',
              description: 'Changelist number (e.g., "12345")',
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
        description: 'List recent Perforce changelists (commits/changes). Use this to see recent commits, changes, or submissions by users in Perforce.',
        parameters: {
          type: 'object',
          properties: {
            user: {
              type: 'string',
              description: 'Filter by username (e.g., "jose_vieira", "julien_merceron"). Optional - omit to see all users.',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of changelists to return (default 50)',
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
        description: 'List FILES (not directories) in a specific Perforce directory. Use list_perforce_directories first to explore depot structure, then use this to see files in a specific path.',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'REQUIRED: Specific directory path (e.g., //Unseen/Main/Src/)',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of files to return (default 100)',
            },
          },
          required: ['path'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_perforce_directories',
        description: 'PERFORCE DEPOT EXPLORER: Use this when user asks "show me the depot", "what\'s in the depot", or wants to explore Perforce depot structure. Lists all directories/subdirectories. Call with NO parameters to show all top-level depots (//Unseen/, //Engine/, etc.)',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'OPTIONAL: Specific path pattern (e.g., //Unseen/* for subdirs in Unseen). Leave empty to show ALL depots.',
            },
          },
          required: [],
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

