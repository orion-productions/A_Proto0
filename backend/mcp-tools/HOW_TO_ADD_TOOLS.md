# How to Add New MCP Tools

## Quick Start

1. **Create a new tool file**: `backend/mcp-tools/your-tool.js`
2. **Follow the template** from `jira.js.example`
3. **Register it** in `backend/mcp-tools/index.js`
4. **Add to executeTool()** in `backend/server.js`
5. **Update frontend mapping** in `frontend/src/components/CenterPanel.jsx` if needed

## Example: Adding GitHub Tool

### Step 1: Create `backend/mcp-tools/github.js`

```javascript
import axios from 'axios';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

// Get GitHub issue
const getGitHubIssue = async (owner, repo, issueNumber) => {
  try {
    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`,
      {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );
    
    return {
      number: response.data.number,
      title: response.data.title,
      state: response.data.state,
      author: response.data.user.login,
      body: response.data.body
    };
  } catch (error) {
    return { error: error.message };
  }
};

export default {
  getGitHubIssue,
  definition: [
    {
      type: 'function',
      function: {
        name: 'get_github_issue',
        description: 'Get a GitHub issue by repository and issue number',
        parameters: {
          type: 'object',
          properties: {
            owner: { type: 'string', description: 'Repository owner' },
            repo: { type: 'string', description: 'Repository name' },
            issueNumber: { type: 'number', description: 'Issue number' }
          },
          required: ['owner', 'repo', 'issueNumber']
        }
      }
    }
  ]
};
```

### Step 2: Register in `backend/mcp-tools/index.js`

```javascript
import github from './github.js';

export const mcpTools = {
  ...weather,
  ...math,
  ...github,  // Add this
};

export const toolsDefinition = [
  ...weather.definition,
  ...math.definition,
  ...github.definition,  // Add this
];
```

### Step 3: Add to `executeTool()` in `backend/server.js`

```javascript
async function executeTool(toolName, params) {
  switch(toolName) {
    case 'get_weather':
      return await mcpTools.weather(params.city);
    case 'add_numbers':
      return mcpTools.add(params.a, params.b);
    case 'get_github_issue':  // Add this
      return await mcpTools.getGitHubIssue(params.owner, params.repo, params.issueNumber);
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}
```

### Step 4: Update frontend tool name mapping (if needed)

In `frontend/src/components/CenterPanel.jsx`:

```javascript
const toolIdMap = {
  'get_weather': 'weather',
  'add_numbers': 'add',
  'get_github_issue': 'github'  // Add this if you have a GitHub UI component
};
```

## Tool File Structure

Every tool file should export:
- **Tool functions**: Actual implementations
- **definition array**: JSON Schema for LLM function calling

## Naming Convention

- **File**: `github.js`, `jira.js`, `slack.js`
- **Tool function**: `getGitHubIssue`, `createJiraIssue`, `sendSlackMessage`
- **LLM function name**: `get_github_issue`, `create_jira_issue`, `send_slack_message`
- **Frontend ID** (optional): `github`, `jira`, `slack`

## Testing

After adding a tool:
1. Restart the backend server
2. Test with: "get GitHub issue 123 from owner/repo"
3. Check backend logs for tool execution
4. Verify frontend UI shows tool activity

