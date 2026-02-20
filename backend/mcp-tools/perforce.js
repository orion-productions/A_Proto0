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
  
  if (!P4_PORT || !P4_USER) {
    return { error: 'P4PORT and P4USER must be set in credentials/perforce.env' };
  }
  
  try {
    // On Windows, use PowerShell's echo or cmd's echo
    // Try multiple methods for cross-platform compatibility
    const isWindows = process.platform === 'win32';
    
    let loginCmd;
    if (isWindows) {
      // Windows: Use PowerShell or cmd to pipe password
      // Escape the password properly for Windows
      const escapedPassword = P4_PASSWD.replace(/"/g, '\\"').replace(/\$/g, '`$');
      // Use PowerShell's echo with proper escaping
      loginCmd = `echo "${escapedPassword}" | p4 -p "${P4_PORT}" -u "${P4_USER}" login`;
    } else {
      // Unix/Linux: Use standard echo
      const escapedPassword = P4_PASSWD.replace(/'/g, "'\\''");
      loginCmd = `echo '${escapedPassword}' | p4 -p "${P4_PORT}" -u "${P4_USER}" login`;
    }
    
    console.log(`[PERFORCE] Attempting login for user: ${P4_USER} on ${P4_PORT}`);
    const { stdout, stderr } = await execAsync(loginCmd, { 
      maxBuffer: 10 * 1024 * 1024,
      shell: isWindows ? 'powershell.exe' : '/bin/bash'
    });
    
    const combinedOutput = (stdout || '') + (stderr || '');
    
    // Check for success indicators
    if (combinedOutput.toLowerCase().includes('logged in') || 
        combinedOutput.toLowerCase().includes('user') && combinedOutput.toLowerCase().includes('logged')) {
      console.log('✅ Perforce login successful');
      return { success: true };
    }
    
    // Check for error indicators
    if (combinedOutput.toLowerCase().includes('invalid') ||
        combinedOutput.toLowerCase().includes('incorrect') ||
        combinedOutput.toLowerCase().includes('failed') ||
        combinedOutput.toLowerCase().includes('error')) {
      console.error('❌ Perforce login failed:', combinedOutput);
      return { error: `Login failed: ${combinedOutput.substring(0, 300)}` };
    }
    
    // If no clear success/error, assume success if no error message
    if (!combinedOutput || combinedOutput.trim().length === 0) {
      console.log('✅ Perforce login successful (no output, assuming success)');
      return { success: true };
    }
    
    // Log the output for debugging
    console.log(`[PERFORCE] Login output: ${combinedOutput.substring(0, 200)}`);
    return { success: true };
  } catch (error) {
    const errorMessage = error.message || error.toString();
    console.error('❌ Perforce login exception:', errorMessage);
    return { error: `Login exception: ${errorMessage}` };
  }
};

// Helper function to check if an error is authentication-related
const isAuthError = (errorText) => {
  if (!errorText) return false;
  const lowerError = errorText.toLowerCase();
  return (
    lowerError.includes('perforce password') ||
    lowerError.includes('not logged in') ||
    lowerError.includes('session has expired') ||
    lowerError.includes('ticket expired') ||
    lowerError.includes('authentication failed') ||
    lowerError.includes('access denied') ||
    lowerError.includes('login required') ||
    lowerError.includes('invalid or unset')
  );
};

const executeP4Command = async (command, args = []) => {
  try {
    const cmd = buildP4Command(command, args);
    
    // Perforce uses ticket-based authentication
    // Try command first, if it fails with password error, login and retry
    
    const { stdout, stderr } = await execAsync(cmd, { 
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    });
    
    // Check for authentication errors in both stdout and stderr
    const combinedOutput = (stdout || '') + (stderr || '');
    if (isAuthError(combinedOutput)) {
      console.log('⚠️ Perforce authentication error detected, attempting to login...');
      console.log(`   Error details: ${combinedOutput.substring(0, 200)}`);
      
      // Try to login
      const loginResult = await loginToPerforce();
      if (loginResult.error) {
        console.error('❌ Perforce login failed:', loginResult.error);
        return { error: `Perforce login failed: ${loginResult.error}. Please check your credentials in backend/credentials/perforce.env` };
      }
      
      // Retry the command after successful login
      console.log('🔄 Retrying command after successful login...');
      const retryResult = await execAsync(cmd, { 
        maxBuffer: 10 * 1024 * 1024 
      });
      
      // Check for errors in retry
      const retryCombined = (retryResult.stdout || '') + (retryResult.stderr || '');
      if (isAuthError(retryCombined)) {
        return { error: `Perforce authentication still failing after login attempt. Please verify your credentials. Error: ${retryCombined.substring(0, 200)}` };
      }
      
      if (retryResult.stderr && !retryResult.stderr.includes('info:')) {
        // Non-auth error, return it
        return { error: retryResult.stderr };
      }
      
      return { output: retryResult.stdout };
    }
    
    // Check for non-auth errors in stderr
    if (stderr && !stderr.includes('info:')) {
      return { error: stderr };
    }
    
    return { output: stdout };
  } catch (error) {
    // If execution fails, check if it's an auth error and try to login
    const errorMessage = error.message || error.toString();
    if (isAuthError(errorMessage)) {
      console.log('⚠️ Command failed with auth error, attempting to login...');
      console.log(`   Error: ${errorMessage}`);
      
      const loginResult = await loginToPerforce();
      if (loginResult.error) {
        return { error: `Perforce login failed: ${loginResult.error}. Please check your credentials in backend/credentials/perforce.env` };
      }
      
      // Retry the command
      try {
        console.log('🔄 Retrying command after successful login...');
        const cmd = buildP4Command(command, args);
        const { stdout, stderr } = await execAsync(cmd, { 
          maxBuffer: 10 * 1024 * 1024 
        });
        
        // Check for auth errors in retry
        const retryCombined = (stdout || '') + (stderr || '');
        if (isAuthError(retryCombined)) {
          return { error: `Perforce authentication still failing after login attempt. Please verify your credentials.` };
        }
        
        if (stderr && !stderr.includes('info:')) {
          return { error: stderr };
        }
        
        return { output: stdout };
      } catch (retryError) {
        const retryErrorMessage = retryError.message || retryError.toString();
        if (isAuthError(retryErrorMessage)) {
          return { error: `Perforce authentication failed after login retry. Please check your credentials in backend/credentials/perforce.env` };
        }
        return { error: retryErrorMessage };
      }
    }
    
    return { error: errorMessage };
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
  // Handle various formats: "Pierre Maury" / "Pierre.Maury" / "pierre maury" → try multiple formats
  let normalizedUser = null;
  let usernameVariants = [];
  
  if (user) {
    const lowerUser = user.toLowerCase().trim();
    // Try multiple formats: pierre_maury, pierre.maury, pierremaury
    usernameVariants = [
      lowerUser.replace(/[\s.]+/g, '_'),  // "pierre maury" → "pierre_maury"
      lowerUser.replace(/[\s_]+/g, '.'),  // "pierre maury" → "pierre.maury"
      lowerUser.replace(/[\s._]+/g, ''),   // "pierre maury" → "pierremaury"
      lowerUser.replace(/\s+/g, ''),      // "pierre maury" → "pierremaury" (same as above but explicit)
    ];
    // Remove duplicates
    usernameVariants = [...new Set(usernameVariants)];
    normalizedUser = usernameVariants[0]; // Start with first variant
    console.log(`[PERFORCE] Searching changelists for user: "${user}" (trying variants: ${usernameVariants.join(', ')})`);
  }
  
  // Fetch both submitted AND pending changelists, then merge them
  // By default, 'p4 changes' only shows submitted, we need '-s pending' for pending ones
  
  const allChangelists = [];
  let lastError = null;
  
  // Try each username variant if first one returns empty
  for (let variantIndex = 0; variantIndex < usernameVariants.length; variantIndex++) {
    const currentUser = usernameVariants[variantIndex];
    const allChangelistsForVariant = [];
    
    // 1. Get submitted changelists
    const submittedArgs = ['-m', limit.toString()];
    if (currentUser) submittedArgs.push('-u', currentUser);
    submittedArgs.push('//...');
    
    const submittedResult = await executeP4Command('changes', submittedArgs);
    if (submittedResult.error) {
      lastError = submittedResult.error;
    } else {
      const lines = submittedResult.output.split('\n').filter(l => l.trim());
      for (const line of lines) {
        const match = line.match(/Change (\d+) on (.+?) by (.+?)@(.+?) '(.+?)'/);
        if (match) {
          allChangelistsForVariant.push({
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
    if (currentUser) pendingArgs.push('-u', currentUser);
    pendingArgs.push('//...');
    
    const pendingResult = await executeP4Command('changes', pendingArgs);
    if (pendingResult.error && !lastError) {
      lastError = pendingResult.error;
    } else {
      const lines = pendingResult.output.split('\n').filter(l => l.trim());
      for (const line of lines) {
        const match = line.match(/Change (\d+) on (.+?) by (.+?)@(.+?) \*pending\* '(.+?)'/);
        if (match) {
          allChangelistsForVariant.push({
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
    
    // If we found changelists with this variant, use it and break
    if (allChangelistsForVariant.length > 0) {
      allChangelists.push(...allChangelistsForVariant);
      console.log(`[PERFORCE] Found ${allChangelistsForVariant.length} changelists using username variant: "${currentUser}"`);
      break; // Found results, no need to try other variants
    } else if (variantIndex === usernameVariants.length - 1) {
      // Last variant, log that we tried all
      console.log(`[PERFORCE] No changelists found for any username variant. Tried: ${usernameVariants.join(', ')}`);
    }
  }
  
  // If no user specified, get all changelists
  if (!user) {
    // 1. Get submitted changelists
    const submittedArgs = ['-m', limit.toString(), '//...'];
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
    const pendingArgs = ['-m', limit.toString(), '-s', 'pending', '//...'];
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
  }
  
  // 3. Sort by changelist number (descending) and limit
  allChangelists.sort((a, b) => parseInt(b.changelist) - parseInt(a.changelist));
  const changelists = allChangelists.slice(0, limit);
  
  // If no changelists found and user was specified, provide helpful message
  if (changelists.length === 0 && user) {
    return { 
      changelists: [],
      message: `No changelists found for user "${user}". Tried username variants: ${usernameVariants.join(', ')}. The user might not exist, have no changelists, or use a different username format in Perforce.`,
      triedVariants: usernameVariants
    };
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
  // Strip trailing slashes to avoid double slashes (e.g., //Unseen/Main/ becomes //Unseen/Main)
  const cleanPath = path?.replace(/\/+$/, '') || '';
  
  // Use Perforce's -m flag to limit results at the server level (prevents buffer overflow)
  const result = await executeP4Command('files', [`-m${limit}`, `${cleanPath}/...`]);
  
  if (result.error) return result;
  
  const files = [];
  const lines = result.output.split('\n').filter(l => l.trim());
  
  for (const line of lines) {
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
  
  return { files, total: files.length, limited: files.length >= limit };
};

// List directories in a path
const listPerforceDirectories = async (path = '//*') => {
  // For root paths (//*), use as-is
  // For specific paths, use wildcard to get immediate subdirectories
  // p4 dirs //Unseen/Main returns just the path itself
  // p4 dirs //Unseen/Main/* returns actual subdirectories
  let searchPath = path;
  if (path !== '//*' && !path.endsWith('/*') && !path.endsWith('/...')) {
    // Add wildcard to get immediate subdirectories
    searchPath = path.endsWith('/') ? `${path}*` : `${path}/*`;
  }
  
  const result = await executeP4Command('dirs', [searchPath]);
  
  if (result.error) {
    // If error is "no such file(s)", the path might not exist or have no subdirectories
    if (result.error.includes('no such file(s)')) {
      return { directories: [], total: 0, message: `The path "${path}" does not exist or has no subdirectories.` };
    }
    return result;
  }
  
  const directories = [];
  const lines = result.output.split('\n').filter(l => l.trim());
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed) {
      // Filter out the path itself if it's returned (p4 dirs sometimes returns the queried path)
      // Only include it if it's different from what we searched for
      if (trimmed !== path || path === '//*') {
        directories.push(trimmed);
      }
    }
  }
  
  // If no directories found and we got a result, the directory exists but has no subdirectories
  if (directories.length === 0 && !result.error) {
    return { directories: [], total: 0, message: `The directory "${path}" exists but has no subdirectories.` };
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
  console.log(`[PERFORCE] getPerforceFileHistory called with filePath: "${filePath}", limit: ${limit}`);
  
  if (!filePath) {
    console.error('[PERFORCE] ERROR: filePath is missing or undefined');
    return { error: 'File path is required for get_perforce_file_history. Please provide a valid Perforce depot path (e.g., //Unseen/Main/path/to/file.txt)' };
  }
  
  const result = await executeP4Command('filelog', ['-m', limit.toString(), filePath]);
  
  console.log(`[PERFORCE] filelog result:`, result.error ? `ERROR: ${result.error}` : `SUCCESS (${result.output?.split('\n').length || 0} lines)`);
  
  if (result.error) {
    // Improve error message for common issues
    if (result.error.includes('no such file')) {
      return { error: `The file "${filePath}" does not exist in the Perforce depot. Please verify the path is correct.` };
    }
    return result;
  }
  
  const history = [];
  const lines = result.output.split('\n');
  let currentRev = null;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Revision lines start with "... #" (e.g., "... #2 change 14726 integrate on 2023/11/22 by user@client")
    // Format: ... #revision change changelist action on date by user@client (type) 'description'
    if (trimmed.startsWith('... #') && !trimmed.startsWith('... ...')) {
      const match = trimmed.match(/\.\.\. #(\d+) change (\d+) (\w+) on (.+?) by (.+?)@(.+?) \(([^)]+)\) '(.+?)'/);
      if (match) {
        currentRev = {
          revision: match[1],
          changelist: match[2],
          action: match[3],
          date: match[4],
          user: match[5],
          client: match[6],
          type: match[7],
          description: match[8],
          integrations: [],
        };
        history.push(currentRev);
      }
    } 
    // Integration lines start with "... ..." (e.g., "... ... branch into //path/file#revision")
    else if (trimmed.startsWith('... ...') && currentRev) {
      const integrationMatch = trimmed.match(/\.\.\. \.\.\. (\w+) into (.+?)#(\d+)/);
      if (integrationMatch) {
        currentRev.integrations.push({
          action: integrationMatch[1],
          into: integrationMatch[2],
          revision: integrationMatch[3],
        });
      }
    }
  }
  
  if (history.length === 0) {
    return { 
      error: `No revision history found for "${filePath}". The file might not exist in the Perforce depot, or it may have no revisions. Please verify the path is correct.`,
      history: [],
      total: 0
    };
  }
  
  return { 
    history, 
    total: history.length,
    filePath: filePath,
    message: `Found ${history.length} revision(s) for ${filePath}`
  };
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
        description: 'List FILES (not directories) in a specific Perforce directory. Large directories are automatically limited to prevent buffer overflow. Use list_perforce_directories first to explore depot structure, then use this to see files in a specific path.',
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

