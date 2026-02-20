import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load JIRA credentials from file
let JIRA_BASE_URL = '';
let JIRA_EMAIL = '';
let JIRA_API_TOKEN = '';

try {
  const credentialsPath = path.join(__dirname, '../credentials/jira.env');
  if (fs.existsSync(credentialsPath)) {
    const credentialsContent = fs.readFileSync(credentialsPath, 'utf8');
    const lines = credentialsContent.split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        const value = valueParts.join('=').trim();
        switch (key) {
          case 'JIRA_BASE_URL': JIRA_BASE_URL = value; break;
          case 'JIRA_EMAIL': JIRA_EMAIL = value; break;
          case 'JIRA_API_TOKEN': JIRA_API_TOKEN = value; break;
        }
      }
    }
    console.log('✅ JIRA credentials loaded:', {
      baseUrl: JIRA_BASE_URL,
      email: JIRA_EMAIL,
      hasToken: !!JIRA_API_TOKEN
    });
  }
} catch (error) {
  console.warn('⚠️ Warning: Could not load JIRA credentials:', error.message);
}

// Helper function for Jira API calls
const jiraApiCall = async (endpoint, method = 'GET', data = null) => {
  try {
    const config = {
      method,
      url: `${JIRA_BASE_URL}/rest/api/3/${endpoint}`,
      auth: {
        username: JIRA_EMAIL,
        password: JIRA_API_TOKEN,
      },
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    };
    
    if (data) {
      if (method === 'GET') {
        // For GET requests, add data as query parameters
        config.params = data;
      } else {
        // For POST/PUT requests, add data as body
        config.data = data;
      }
    }
    
    const response = await axios(config);
    return response.data;
  } catch (error) {
    const errorMsg = error.response?.data?.errorMessages?.join(', ') || 
                     error.response?.data?.message || 
                     error.message;
    console.error('❌ JIRA API Error:', {
      endpoint,
      status: error.response?.status,
      error: errorMsg
    });
    return { 
      error: errorMsg
    };
  }
};

// Get Jira issue
const getJiraIssue = async (issueKey) => {
  const result = await jiraApiCall(`issue/${issueKey}`);
  
  if (result.error) return result;
  
  return {
    key: result.key,
    summary: result.fields.summary,
    description: result.fields.description?.content?.[0]?.content?.[0]?.text || '',
    status: result.fields.status.name,
    assignee: result.fields.assignee?.displayName || 'Unassigned',
    reporter: result.fields.reporter?.displayName || '',
    issueType: result.fields.issuetype.name,
    priority: result.fields.priority?.name || '',
    created: result.fields.created,
    updated: result.fields.updated,
    project: result.fields.project.key,
    labels: result.fields.labels || [],
    components: result.fields.components?.map(c => c.name) || [],
  };
};

// Search Jira issues
// Note: Some JIRA instances require using search/jql endpoint (GET with query params)
const searchJiraIssues = async (jql, maxResults = 50, startAt = 0) => {
  // Try the new search/jql endpoint format (GET with query parameters)
  // Format: /rest/api/3/search/jql?jql=...&maxResults=...&startAt=...
  const jqlEncoded = encodeURIComponent(jql);
  const endpoint = `search/jql?jql=${jqlEncoded}&maxResults=${Math.min(maxResults, 100)}&startAt=${startAt}&fields=summary,status,assignee,issuetype,priority,created,updated`;
  
  const result = await jiraApiCall(endpoint, 'GET');
  
  // If that fails, fall back to POST with body (for older JIRA instances)
  if (result.error && result.error.includes('removed')) {
    console.log('⚠️ search/jql endpoint not available, trying standard search endpoint...');
    const fallbackResult = await jiraApiCall('search', 'POST', {
      jql: jql,
      maxResults: Math.min(maxResults, 100),
      startAt: startAt,
      fields: ['summary', 'status', 'assignee', 'issuetype', 'priority', 'created', 'updated'],
    });
    if (!fallbackResult.error) {
      return processSearchResult(fallbackResult);
    }
  }
  
  if (result.error) return result;
  
  return processSearchResult(result);
};

// Helper function to process search results (handles both old and new API formats)
const processSearchResult = (result) => {
  // New API format uses 'values' array, old format uses 'issues' array
  const issuesArray = result.issues || result.values || [];
  
  return {
    total: result.total || issuesArray.length,
    issues: issuesArray.map(issue => ({
      key: issue.key,
      summary: issue.fields?.summary || issue.summary || 'No summary',
      status: issue.fields?.status?.name || issue.status?.name || 'Unknown',
      assignee: issue.fields?.assignee?.displayName || issue.assignee?.displayName || 'Unassigned',
      issueType: issue.fields?.issuetype?.name || issue.issuetype?.name || 'Unknown',
      priority: issue.fields?.priority?.name || issue.priority?.name || '',
      created: issue.fields?.created || issue.created || '',
      updated: issue.fields?.updated || issue.updated || '',
    })),
  };
};

// Get Jira project
const getJiraProject = async (projectKey) => {
  const result = await jiraApiCall(`project/${projectKey}`);
  
  if (result.error) return result;
  
  return {
    key: result.key,
    name: result.name,
    description: result.description || '',
    projectTypeKey: result.projectTypeKey,
    lead: result.lead?.displayName || '',
    components: result.components?.map(c => c.name) || [],
    issueTypes: result.issueTypes?.map(it => it.name) || [],
  };
};

// Get Jira projects list
const getJiraProjects = async () => {
  console.log('🔍 Fetching JIRA projects from:', `${JIRA_BASE_URL}/rest/api/3/project`);
  const result = await jiraApiCall('project');
  
  console.log('📊 JIRA projects API response:', {
    hasError: !!result.error,
    isArray: Array.isArray(result),
    count: Array.isArray(result) ? result.length : 0,
    sample: Array.isArray(result) && result.length > 0 ? result[0] : null
  });
  
  if (result.error) return result;
  
  return {
    projects: result.map(project => ({
      key: project.key,
      name: project.name,
      projectTypeKey: project.projectTypeKey,
      lead: project.lead?.displayName || '',
    })),
  };
};

// Get issue comments
const getJiraIssueComments = async (issueKey) => {
  const result = await jiraApiCall(`issue/${issueKey}/comment`);
  
  if (result.error) return result;
  
  return {
    total: result.total,
    comments: result.comments.map(comment => ({
      id: comment.id,
      author: comment.author.displayName,
      body: comment.body?.content?.[0]?.content?.[0]?.text || '',
      created: comment.created,
      updated: comment.updated,
    })),
  };
};

// Get issue transitions (available status changes)
const getJiraIssueTransitions = async (issueKey) => {
  const result = await jiraApiCall(`issue/${issueKey}/transitions`);
  
  if (result.error) return result;
  
  return {
    transitions: result.transitions.map(t => ({
      id: t.id,
      name: t.name,
      to: t.to.name,
    })),
  };
};

// Add comment to JIRA issue
const addJiraIssueComment = async (issueKey, commentText) => {
  const commentBody = {
    body: {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: commentText
            }
          ]
        }
      ]
    }
  };
  
  const result = await jiraApiCall(`issue/${issueKey}/comment`, 'POST', commentBody);
  
  if (result.error) return result;
  
  return {
    id: result.id,
    author: result.author.displayName,
    body: result.body?.content?.[0]?.content?.[0]?.text || commentText,
    created: result.created,
    success: true
  };
};

// Get issue worklog
const getJiraIssueWorklog = async (issueKey) => {
  const result = await jiraApiCall(`issue/${issueKey}/worklog`);
  
  if (result.error) return result;
  
  return {
    total: result.total,
    worklogs: result.worklogs.map(w => ({
      id: w.id,
      author: w.author.displayName,
      timeSpent: w.timeSpent,
      timeSpentSeconds: w.timeSpentSeconds,
      started: w.started,
      comment: w.comment || '',
    })),
  };
};

export default {
  getJiraIssue,
  searchJiraIssues,
  getJiraProject,
  getJiraProjects,
  getJiraIssueComments,
  getJiraIssueTransitions,
  getJiraIssueWorklog,
  addJiraIssueComment,
  definition: [
    {
      type: 'function',
      function: {
        name: 'get_jira_issue',
        description: 'Get detailed information about a Jira issue by its key (e.g., PROJ-123)',
        parameters: {
          type: 'object',
          properties: {
            issueKey: {
              type: 'string',
              description: 'The Jira issue key (e.g., PROJ-123)',
            },
          },
          required: ['issueKey'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'search_jira_issues',
        description: 'Search for Jira issues using JQL (Jira Query Language)',
        parameters: {
          type: 'object',
          properties: {
            jql: {
              type: 'string',
              description: 'JQL query string (e.g., "project = PROJ AND status = Open")',
            },
            maxResults: {
              type: 'number',
              description: 'Maximum number of results (default 50, max 100)',
            },
            startAt: {
              type: 'number',
              description: 'Starting index for pagination (default 0)',
            },
          },
          required: ['jql'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_jira_project',
        description: 'Get information about a Jira project',
        parameters: {
          type: 'object',
          properties: {
            projectKey: {
              type: 'string',
              description: 'The Jira project key (e.g., PROJ)',
            },
          },
          required: ['projectKey'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_jira_projects',
        description: 'Get list of all Jira projects',
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
        name: 'get_jira_issue_comments',
        description: 'Get all comments for a Jira issue',
        parameters: {
          type: 'object',
          properties: {
            issueKey: {
              type: 'string',
              description: 'The Jira issue key',
            },
          },
          required: ['issueKey'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_jira_issue_transitions',
        description: 'Get available status transitions for a Jira issue',
        parameters: {
          type: 'object',
          properties: {
            issueKey: {
              type: 'string',
              description: 'The Jira issue key',
            },
          },
          required: ['issueKey'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_jira_issue_worklog',
        description: 'Get worklog entries (time tracking) for a Jira issue',
        parameters: {
          type: 'object',
          properties: {
            issueKey: {
              type: 'string',
              description: 'The Jira issue key',
            },
          },
          required: ['issueKey'],
        },
      },
    },
  ],
};

