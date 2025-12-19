import axios from 'axios';

// GitHub API configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_API_BASE = 'https://api.github.com';

// Helper function for GitHub API calls
const githubApiCall = async (endpoint, method = 'GET', data = null) => {
  try {
    const config = {
      method,
      url: `${GITHUB_API_BASE}${endpoint}`,
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'AI-Unseen-Workspace',
      },
    };
    
    if (GITHUB_TOKEN) {
      config.headers['Authorization'] = `token ${GITHUB_TOKEN}`;
    }
    
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

// Get GitHub issue
const getGitHubIssue = async (owner, repo, issueNumber) => {
  const result = await githubApiCall(`/repos/${owner}/${repo}/issues/${issueNumber}`);
  
  if (result.error) return result;
  
  return {
    number: result.number,
    title: result.title,
    body: result.body || '',
    state: result.state,
    author: result.user.login,
    assignees: result.assignees.map(a => a.login),
    labels: result.labels.map(l => l.name),
    milestone: result.milestone?.title || null,
    created_at: result.created_at,
    updated_at: result.updated_at,
    closed_at: result.closed_at,
    comments: result.comments,
    pull_request: result.pull_request ? true : false,
  };
};

// Get GitHub repository
const getGitHubRepo = async (owner, repo) => {
  const result = await githubApiCall(`/repos/${owner}/${repo}`);
  
  if (result.error) return result;
  
  return {
    name: result.name,
    full_name: result.full_name,
    description: result.description || '',
    language: result.language,
    stars: result.stargazers_count,
    forks: result.forks_count,
    open_issues: result.open_issues_count,
    default_branch: result.default_branch,
    created_at: result.created_at,
    updated_at: result.updated_at,
    topics: result.topics || [],
    visibility: result.visibility,
  };
};

// List repository issues
const listGitHubIssues = async (owner, repo, state = 'open', limit = 30) => {
  const result = await githubApiCall(
    `/repos/${owner}/${repo}/issues?state=${state}&per_page=${Math.min(limit, 100)}`
  );
  
  if (result.error) return result;
  
  return {
    issues: result.map(issue => ({
      number: issue.number,
      title: issue.title,
      state: issue.state,
      author: issue.user.login,
      labels: issue.labels.map(l => l.name),
      created_at: issue.created_at,
      comments: issue.comments,
      pull_request: issue.pull_request ? true : false,
    })),
  };
};

// Get pull request
const getGitHubPullRequest = async (owner, repo, pullNumber) => {
  const result = await githubApiCall(`/repos/${owner}/${repo}/pulls/${pullNumber}`);
  
  if (result.error) return result;
  
  return {
    number: result.number,
    title: result.title,
    body: result.body || '',
    state: result.state,
    author: result.user.login,
    assignees: result.assignees.map(a => a.login),
    reviewers: result.requested_reviewers.map(r => r.login),
    labels: result.labels.map(l => l.name),
    head_branch: result.head.ref,
    base_branch: result.base.ref,
    mergeable: result.mergeable,
    merged: result.merged,
    created_at: result.created_at,
    updated_at: result.updated_at,
    closed_at: result.closed_at,
    merged_at: result.merged_at,
  };
};

// List pull requests
const listGitHubPullRequests = async (owner, repo, state = 'open', limit = 30) => {
  const result = await githubApiCall(
    `/repos/${owner}/${repo}/pulls?state=${state}&per_page=${Math.min(limit, 100)}`
  );
  
  if (result.error) return result;
  
  return {
    pull_requests: result.map(pr => ({
      number: pr.number,
      title: pr.title,
      state: pr.state,
      author: pr.user.login,
      head_branch: pr.head.ref,
      base_branch: pr.base.ref,
      created_at: pr.created_at,
      merged: pr.merged,
    })),
  };
};

// Get issue/PR comments
const getGitHubIssueComments = async (owner, repo, issueNumber) => {
  const result = await githubApiCall(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`);
  
  if (result.error) return result;
  
  return {
    comments: result.map(comment => ({
      id: comment.id,
      author: comment.user.login,
      body: comment.body,
      created_at: comment.created_at,
      updated_at: comment.updated_at,
    })),
  };
};

// Get repository commits
const getGitHubCommits = async (owner, repo, branch = null, limit = 30) => {
  const endpoint = branch 
    ? `/repos/${owner}/${repo}/commits?sha=${branch}&per_page=${Math.min(limit, 100)}`
    : `/repos/${owner}/${repo}/commits?per_page=${Math.min(limit, 100)}`;
  
  const result = await githubApiCall(endpoint);
  
  if (result.error) return result;
  
  return {
    commits: result.map(commit => ({
      sha: commit.sha,
      message: commit.commit.message,
      author: commit.commit.author.name,
      date: commit.commit.author.date,
      url: commit.html_url,
    })),
  };
};

// Search repositories
const searchGitHubRepos = async (query, limit = 30) => {
  const result = await githubApiCall(
    `/search/repositories?q=${encodeURIComponent(query)}&per_page=${Math.min(limit, 100)}`
  );
  
  if (result.error) return result;
  
  return {
    total_count: result.total_count,
    repositories: result.items.map(repo => ({
      full_name: repo.full_name,
      description: repo.description || '',
      language: repo.language,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      open_issues: repo.open_issues_count,
    })),
  };
};

export default {
  getGitHubIssue,
  getGitHubRepo,
  listGitHubIssues,
  getGitHubPullRequest,
  listGitHubPullRequests,
  getGitHubIssueComments,
  getGitHubCommits,
  searchGitHubRepos,
  definition: [
    {
      type: 'function',
      function: {
        name: 'get_github_issue',
        description: 'Get a GitHub issue by repository and issue number',
        parameters: {
          type: 'object',
          properties: {
            owner: {
              type: 'string',
              description: 'Repository owner (username or organization)',
            },
            repo: {
              type: 'string',
              description: 'Repository name',
            },
            issueNumber: {
              type: 'number',
              description: 'Issue number',
            },
          },
          required: ['owner', 'repo', 'issueNumber'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_github_repo',
        description: 'Get information about a GitHub repository',
        parameters: {
          type: 'object',
          properties: {
            owner: {
              type: 'string',
              description: 'Repository owner',
            },
            repo: {
              type: 'string',
              description: 'Repository name',
            },
          },
          required: ['owner', 'repo'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_github_issues',
        description: 'List issues in a GitHub repository',
        parameters: {
          type: 'object',
          properties: {
            owner: {
              type: 'string',
              description: 'Repository owner',
            },
            repo: {
              type: 'string',
              description: 'Repository name',
            },
            state: {
              type: 'string',
              description: 'Issue state',
              enum: ['open', 'closed', 'all'],
            },
            limit: {
              type: 'number',
              description: 'Maximum number of issues to return (default 30, max 100)',
            },
          },
          required: ['owner', 'repo'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_github_pull_request',
        description: 'Get a GitHub pull request by repository and PR number',
        parameters: {
          type: 'object',
          properties: {
            owner: {
              type: 'string',
              description: 'Repository owner',
            },
            repo: {
              type: 'string',
              description: 'Repository name',
            },
            pullNumber: {
              type: 'number',
              description: 'Pull request number',
            },
          },
          required: ['owner', 'repo', 'pullNumber'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_github_pull_requests',
        description: 'List pull requests in a GitHub repository',
        parameters: {
          type: 'object',
          properties: {
            owner: {
              type: 'string',
              description: 'Repository owner',
            },
            repo: {
              type: 'string',
              description: 'Repository name',
            },
            state: {
              type: 'string',
              description: 'PR state',
              enum: ['open', 'closed', 'all'],
            },
            limit: {
              type: 'number',
              description: 'Maximum number of PRs to return (default 30, max 100)',
            },
          },
          required: ['owner', 'repo'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_github_issue_comments',
        description: 'Get comments for a GitHub issue or pull request',
        parameters: {
          type: 'object',
          properties: {
            owner: {
              type: 'string',
              description: 'Repository owner',
            },
            repo: {
              type: 'string',
              description: 'Repository name',
            },
            issueNumber: {
              type: 'number',
              description: 'Issue or PR number',
            },
          },
          required: ['owner', 'repo', 'issueNumber'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_github_commits',
        description: 'Get commit history for a GitHub repository',
        parameters: {
          type: 'object',
          properties: {
            owner: {
              type: 'string',
              description: 'Repository owner',
            },
            repo: {
              type: 'string',
              description: 'Repository name',
            },
            branch: {
              type: 'string',
              description: 'Branch name (optional, defaults to default branch)',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of commits (default 30, max 100)',
            },
          },
          required: ['owner', 'repo'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'search_github_repos',
        description: 'Search for GitHub repositories',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query (e.g., "language:python", "stars:>100")',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results (default 30, max 100)',
            },
          },
          required: ['query'],
        },
      },
    },
  ],
};

