import axios from 'axios';

// Jira API configuration
const JIRA_BASE_URL = process.env.JIRA_BASE_URL || '';
const JIRA_EMAIL = process.env.JIRA_EMAIL || '';
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || '';

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
      config.data = data;
    }
    
    const response = await axios(config);
    return response.data;
  } catch (error) {
    return { 
      error: error.response?.data?.errorMessages?.join(', ') || error.message 
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
const searchJiraIssues = async (jql, maxResults = 50, startAt = 0) => {
  const result = await jiraApiCall('search', 'POST', {
    jql,
    maxResults: Math.min(maxResults, 100),
    startAt,
    fields: ['summary', 'status', 'assignee', 'issuetype', 'priority', 'created', 'updated'],
  });
  
  if (result.error) return result;
  
  return {
    total: result.total,
    issues: result.issues.map(issue => ({
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status.name,
      assignee: issue.fields.assignee?.displayName || 'Unassigned',
      issueType: issue.fields.issuetype.name,
      priority: issue.fields.priority?.name || '',
      created: issue.fields.created,
      updated: issue.fields.updated,
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
  const result = await jiraApiCall('project');
  
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

