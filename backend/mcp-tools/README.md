# MCP Tools Directory

This directory contains all MCP (Model Context Protocol) tool implementations.

## Structure

Each tool file should export:
1. **Tool implementations** - The actual functions that execute the tool
2. **Tool definitions** - JSON Schema definitions for LLM function calling

## Adding a New Tool

1. Create a new file: `backend/mcp-tools/your-tool.js`
2. Follow this template:

```javascript
// Tool implementation
const yourTool = async (param1, param2) => {
  // Implementation here
  return { result: 'something' };
};

// Export tool implementation
export default {
  toolName: yourTool,  // The function name matches the executeTool() call
  definition: [
    {
      type: 'function',
      function: {
        name: 'tool_function_name',  // Used in executeTool()
        description: 'What the tool does',
        parameters: {
          type: 'object',
          properties: {
            param1: {
              type: 'string',
              description: 'Parameter description',
            },
          },
          required: ['param1'],
        },
      },
    },
  ],
};
```

3. Import it in `backend/mcp-tools/index.js`:
```javascript
import yourTool from './your-tool.js';

export const mcpTools = {
  ...yourTool,
  // ...
};

export const toolsDefinition = [
  ...yourTool.definition,
  // ...
];
```

4. Update `executeTool()` in `backend/server.js` to map function names to implementations

## Tool Naming Convention

- **Tool file**: `jira.js`, `slack.js`, `github.js`
- **Tool function name**: `getJiraIssue`, `sendSlackMessage`, `createGitHubIssue`
- **LLM function name**: `get_jira_issue`, `send_slack_message`, `create_github_issue`

## Example Tools to Implement

- ✅ `weather.js` - Weather information (done)
- ✅ `math.js` - Basic math operations (done)
- ⏳ `jira.js` - Jira issue management
- ⏳ `slack.js` - Slack messaging
- ⏳ `github.js` - GitHub repository operations
- ⏳ `confluence.js` - Confluence page operations
- ⏳ `perforce.js` - Perforce version control

