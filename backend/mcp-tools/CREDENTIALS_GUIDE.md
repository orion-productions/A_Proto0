# MCP Tools Credentials & Configuration Guide

This guide lists all the credentials and configuration you need to provide for each MCP tool service.

## Quick Reference: Environment Variables

Create a `.env` file in the `backend/` directory with the following variables:

```env
# Google Workspace (Gmail, Calendar, Drive)
GOOGLE_ACCESS_TOKEN=ya29.your-access-token-here

# Jira
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-api-token

# Slack
SLACK_BOT_TOKEN=xoxb-your-bot-token-here

# GitHub
GITHUB_TOKEN=ghp_your-personal-access-token

# Perforce
P4PORT=perforce-server:1666
P4USER=your-username
P4CLIENT=your-workspace-name
P4PASSWD=your-password

# Confluence
CONFLUENCE_BASE_URL=https://your-domain.atlassian.net
CONFLUENCE_EMAIL=your-email@example.com
CONFLUENCE_API_TOKEN=your-api-token

# Discord
DISCORD_BOT_TOKEN=your-bot-token-here
```

---

## Detailed Setup Instructions

### 1. Google Workspace (Gmail, Calendar, Drive)

**Required:** `GOOGLE_ACCESS_TOKEN`

**What you need:**
- A Google account
- Access to Google Cloud Console

**Steps to get token:**

#### Option A: OAuth2 Playground (Quick Test)
1. Go to https://developers.google.com/oauthplayground/
2. Click the gear icon (⚙️) in top right → Check "Use your own OAuth credentials"
3. In the left panel, find and select these scopes:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/calendar.readonly`
   - `https://www.googleapis.com/auth/drive.readonly`
4. Click "Authorize APIs"
5. Sign in with your Google account and grant permissions
6. Click "Exchange authorization code for tokens"
7. Copy the `access_token` value (starts with `ya29.`)
8. Set `GOOGLE_ACCESS_TOKEN=ya29.your-token-here`

**Note:** This token expires in ~1 hour. For production, use Option B.

#### Option B: OAuth2 Application (Production)
1. Go to https://console.cloud.google.com/
2. Create a new project or select existing
3. Enable APIs:
   - Gmail API
   - Google Calendar API
   - Google Drive API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Configure OAuth consent screen
6. Set authorized redirect URIs
7. Implement OAuth2 flow to get access token and refresh token
8. Use refresh token to get new access tokens when they expire

---

### 2. Jira

**Required:**
- `JIRA_BASE_URL` - Your Jira instance URL
- `JIRA_EMAIL` - Your Jira account email
- `JIRA_API_TOKEN` - Your Jira API token

**Steps to get credentials:**

1. **JIRA_BASE_URL:**
   - Format: `https://your-domain.atlassian.net`
   - Example: `https://mycompany.atlassian.net`

2. **JIRA_EMAIL:**
   - Your Jira account email address
   - Example: `john.doe@company.com`

3. **JIRA_API_TOKEN:**
   - Go to https://id.atlassian.com/manage-profile/security/api-tokens
   - Click "Create API token"
   - Give it a label (e.g., "MCP Tools")
   - Copy the token immediately (you won't see it again)
   - Set `JIRA_API_TOKEN=your-token-here`

**Example:**
```env
JIRA_BASE_URL=https://mycompany.atlassian.net
JIRA_EMAIL=john.doe@company.com
JIRA_API_TOKEN=ATATT3xFfGF0...
```

---

### 3. Slack

**Required:** `SLACK_BOT_TOKEN`

**Steps to get token:**

1. Go to https://api.slack.com/apps
2. Click "Create New App" → "From scratch"
3. Give your app a name and select your workspace
4. Go to "OAuth & Permissions" in the left sidebar
5. Scroll to "Scopes" → "Bot Token Scopes" and add:
   - `channels:read`
   - `channels:history`
   - `groups:read`
   - `groups:history`
   - `users:read`
   - `search:read`
6. Scroll up and click "Install to Workspace"
7. Authorize the app
8. Copy the "Bot User OAuth Token" (starts with `xoxb-`)
9. Set `SLACK_BOT_TOKEN=xoxb-your-token-here`

**Note:** The bot must be added to channels you want to read from.

---

### 4. GitHub

**Required:** `GITHUB_TOKEN`

**Steps to get token:**

1. Go to https://github.com/settings/tokens
2. Click "Generate new token" → "Generate new token (classic)"
3. Give it a name (e.g., "MCP Tools")
4. Select expiration (or "No expiration" for long-term use)
5. Select scopes:
   - `repo` (for private repos) OR
   - `public_repo` (for public repos only)
   - `read:org` (if you need organization repos)
6. Click "Generate token"
7. Copy the token immediately (starts with `ghp_`)
8. Set `GITHUB_TOKEN=ghp_your-token-here`

**Note:** For public repositories only, you can leave this empty, but rate limits will be stricter.

---

### 5. Perforce

**Required:**
- `P4PORT` - Perforce server address
- `P4USER` - Your Perforce username
- `P4CLIENT` - Your workspace/client name
- `P4PASSWD` - Your Perforce password

**Steps to get credentials:**

1. **P4PORT:**
   - Format: `server-hostname:port` or `server-hostname:1666`
   - Example: `perforce.company.com:1666`

2. **P4USER:**
   - Your Perforce username
   - Example: `jdoe`

3. **P4CLIENT:**
   - Your workspace/client name
   - Example: `jdoe-workspace`
   - Find it with: `p4 clients -u your-username`

4. **P4PASSWD:**
   - Your Perforce password
   - Or use a ticket: `p4 login -p` to get a ticket

**Additional Setup:**
- Ensure `p4` command-line tool is installed and in your PATH
- Test connection: `p4 -p $P4PORT -u $P4USER info`

**Example:**
```env
P4PORT=perforce.company.com:1666
P4USER=jdoe
P4CLIENT=jdoe-workspace
P4PASSWD=your-password-or-ticket
```

---

### 6. Confluence

**Required:**
- `CONFLUENCE_BASE_URL` - Your Confluence instance URL
- `CONFLUENCE_EMAIL` - Your Confluence account email
- `CONFLUENCE_API_TOKEN` - Your Atlassian API token

**Steps to get credentials:**

1. **CONFLUENCE_BASE_URL:**
   - Format: `https://your-domain.atlassian.net`
   - Example: `https://mycompany.atlassian.net`
   - Same as Jira if they're on the same instance

2. **CONFLUENCE_EMAIL:**
   - Your Confluence account email
   - Example: `john.doe@company.com`
   - Same as Jira if using the same account

3. **CONFLUENCE_API_TOKEN:**
   - Same as Jira API token!
   - Go to https://id.atlassian.com/manage-profile/security/api-tokens
   - Use the same token you created for Jira (or create a new one)
   - Set `CONFLUENCE_API_TOKEN=your-token-here`

**Note:** If Jira and Confluence are on the same Atlassian instance, you can reuse the same credentials.

**Example:**
```env
CONFLUENCE_BASE_URL=https://mycompany.atlassian.net
CONFLUENCE_EMAIL=john.doe@company.com
CONFLUENCE_API_TOKEN=ATATT3xFfGF0...  # Same as JIRA_API_TOKEN
```

---

### 7. Discord

**Required:** `DISCORD_BOT_TOKEN`

**Steps to get token:**

1. Go to https://discord.com/developers/applications
2. Click "New Application"
3. Give it a name (e.g., "MCP Tools Bot")
4. Go to the "Bot" section in the left sidebar
5. Click "Add Bot" and confirm
6. Under "Token", click "Reset Token" or "Copy"
7. Copy the token (you'll only see it once)
8. **Important:** Enable Privileged Gateway Intents:
   - "Server Members Intent" (for member operations)
   - "Message Content Intent" (for reading message content)
9. Go to "OAuth2" → "URL Generator"
10. Select scopes:
    - `bot`
    - `applications.commands` (optional)
11. Select bot permissions:
    - "Read Messages/View Channels"
    - "Read Message History"
12. Copy the generated URL at the bottom
13. Open the URL in a browser and select a server to invite the bot
14. Set `DISCORD_BOT_TOKEN=your-token-here`

**Note:** The bot must be a member of servers you want to read from.

---

## Complete .env File Example

```env
# Google Workspace
GOOGLE_ACCESS_TOKEN=ya29.a0AfH6SMBx...

# Jira
JIRA_BASE_URL=https://mycompany.atlassian.net
JIRA_EMAIL=john.doe@company.com
JIRA_API_TOKEN=ATATT3xFfGF0...

# Slack
SLACK_BOT_TOKEN=xoxb-1234567890-1234567890123-...

# GitHub
GITHUB_TOKEN=ghp_1234567890abcdefghijklmnopqrstuvwxyz

# Perforce
P4PORT=perforce.company.com:1666
P4USER=jdoe
P4CLIENT=jdoe-workspace
P4PASSWD=your-password

# Confluence
CONFLUENCE_BASE_URL=https://mycompany.atlassian.net
CONFLUENCE_EMAIL=john.doe@company.com
CONFLUENCE_API_TOKEN=ATATT3xFfGF0...

# Discord
DISCORD_BOT_TOKEN=MTIzNDU2Nzg5MDEyMzQ1Njc4OQ...
```

---

## Security Best Practices

1. **Never commit `.env` files to version control**
   - Already in `.gitignore`, but double-check

2. **Use environment-specific tokens**
   - Different tokens for dev/staging/production

3. **Rotate tokens regularly**
   - Especially if exposed or compromised

4. **Use minimum required permissions**
   - Only grant read-only scopes when possible

5. **Store tokens securely**
   - Use secret management services in production
   - Don't share tokens in chat/email

6. **Monitor token usage**
   - Check API logs for unusual activity

---

## Testing Your Configuration

After setting up credentials, restart the backend server:

```bash
# Stop the server (Ctrl+C)
# Then restart
npm run dev
```

Test individual tools by asking the LLM:
- "What's the weather in Paris?" (Weather - no config needed)
- "Show me my Gmail messages" (Gmail - needs GOOGLE_ACCESS_TOKEN)
- "List Jira issues in project PROJ" (Jira - needs Jira credentials)
- etc.

---

## Troubleshooting

### "401 Unauthorized" or "403 Forbidden"
- Check that your token/credentials are correct
- Verify token hasn't expired
- Ensure proper permissions/scopes are granted

### "404 Not Found"
- Check that URLs are correct (no trailing slashes)
- Verify the resource exists (channel ID, issue key, etc.)

### "Rate limit exceeded"
- Wait a few minutes and try again
- Consider implementing rate limiting in your code

### Perforce: "Command not found"
- Ensure `p4` CLI tool is installed
- Check that `p4` is in your system PATH

---

## Quick Checklist

- [ ] Google Workspace: OAuth token obtained
- [ ] Jira: Base URL, email, and API token set
- [ ] Slack: Bot token created and app installed to workspace
- [ ] GitHub: Personal access token created
- [ ] Perforce: Server, user, client, and password configured
- [ ] Confluence: Base URL, email, and API token set (can reuse Jira token)
- [ ] Discord: Bot token created and bot invited to servers
- [ ] All credentials added to `.env` file in `backend/` directory
- [ ] Backend server restarted after adding credentials

---

## Need Help?

Refer to the detailed documentation in:
- `backend/mcp-tools/CONFIGURATION.md` - Detailed setup for each service
- `backend/mcp-tools/README.md` - General MCP tools documentation

