# MCP Tools Configuration Guide

This document explains how to configure environment variables for each MCP tool service.

## General Setup

Create a `.env` file in the `backend/` directory (or set environment variables in your system) with the following variables:

## Slack

```env
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
```

**How to get a Slack token:**
1. Go to https://api.slack.com/apps
2. Create a new app or select an existing one
3. Go to "OAuth & Permissions"
4. Add the following scopes:
   - `channels:read`
   - `channels:history`
   - `groups:read`
   - `groups:history`
   - `users:read`
   - `search:read`
5. Install the app to your workspace
6. Copy the "Bot User OAuth Token" (starts with `xoxb-`)

## Jira

```env
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-api-token
```

**How to get a Jira API token:**
1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click "Create API token"
3. Give it a label and copy the token
4. Use your Jira email and this token for authentication

## GitHub

```env
GITHUB_TOKEN=ghp_your-personal-access-token
```

**How to get a GitHub token:**
1. Go to https://github.com/settings/tokens
2. Click "Generate new token" → "Generate new token (classic)"
3. Select scopes:
   - `repo` (for private repos)
   - `public_repo` (for public repos only)
   - `read:org` (for organization repos)
4. Copy the token (starts with `ghp_`)

**Note:** For public repositories, you can use the tools without a token, but rate limits will be stricter.

## Perforce

```env
P4PORT=perforce-server:1666
P4USER=your-username
P4CLIENT=your-workspace-name
P4PASSWD=your-password
```

**Setup:**
1. Ensure `p4` command-line tool is installed and in your PATH
2. Configure your Perforce server connection details
3. Set up authentication (password or ticket)

**Note:** Perforce tools require the `p4` command-line client to be installed.

## Confluence

```env
CONFLUENCE_BASE_URL=https://your-domain.atlassian.net
CONFLUENCE_EMAIL=your-email@example.com
CONFLUENCE_API_TOKEN=your-api-token
```

**How to get a Confluence API token:**
1. Same as Jira - use your Atlassian account API token
2. Go to https://id.atlassian.com/manage-profile/security/api-tokens
3. Create an API token if you don't have one
4. Use your email and this token

## Testing Your Configuration

After setting up environment variables, restart the backend server. The tools will automatically be available if properly configured.

You can test individual tools by making API calls or using them through the chat interface.

## Google Workspace (Gmail, Calendar, Drive)

All Google Workspace tools use a single OAuth2 access token:

```env
GOOGLE_ACCESS_TOKEN=ya29.your-access-token-here
```

**How to get a Google Access Token:**

### Option 1: OAuth2 Flow (Recommended for Production)
1. Go to https://console.cloud.google.com/
2. Create a new project or select an existing one
3. Enable the following APIs:
   - Gmail API
   - Google Calendar API
   - Google Drive API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Configure OAuth consent screen
6. Set authorized redirect URIs
7. Use OAuth2 flow to get access token

### Option 2: Service Account (For Server-to-Server)
1. Create a service account in Google Cloud Console
2. Download the JSON key file
3. Enable domain-wide delegation if needed
4. Use the service account to generate tokens

### Option 3: Quick Test with OAuth2 Playground
1. Go to https://developers.google.com/oauthplayground/
2. Select scopes:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/calendar.readonly`
   - `https://www.googleapis.com/auth/drive.readonly`
3. Authorize and get access token
4. Copy the access token to `GOOGLE_ACCESS_TOKEN`

**Required Scopes:**
- Gmail: `https://www.googleapis.com/auth/gmail.readonly`
- Calendar: `https://www.googleapis.com/auth/calendar.readonly`
- Drive: `https://www.googleapis.com/auth/drive.readonly`

**Note:** Access tokens expire. For production, implement token refresh using refresh tokens.

## Discord

```env
DISCORD_BOT_TOKEN=your-bot-token-here
```

**How to get a Discord bot token:**

1. Go to https://discord.com/developers/applications
2. Click "New Application" and give it a name
3. Go to the "Bot" section in the left sidebar
4. Click "Add Bot" and confirm
5. Under "Token", click "Reset Token" or "Copy" to get your bot token
6. Enable the following Privileged Gateway Intents (if needed):
   - Server Members Intent (for member-related operations)
   - Message Content Intent (for reading message content)
7. Go to "OAuth2" → "URL Generator"
8. Select scopes:
   - `bot`
   - `applications.commands` (optional, for slash commands)
9. Select bot permissions:
   - `Read Messages/View Channels`
   - `Read Message History`
   - `View Server Insights` (optional)
10. Copy the generated URL and open it in a browser
11. Select a server to invite the bot to
12. Copy the bot token to `DISCORD_BOT_TOKEN`

**Required Permissions:**
- Read Messages
- View Channels
- Read Message History

**Note:** The bot must be a member of the servers you want to read from.

## Audio Transcription

The transcription feature uses Hugging Face Inference API. While some models work without authentication, you may need a free API token for better reliability and rate limits.

```env
HUGGINGFACE_API_TOKEN=hf_your-token-here
```

**How to get a free Hugging Face API token:**
1. Go to https://huggingface.co/
2. Sign up for a free account (if you don't have one)
3. Go to https://huggingface.co/settings/tokens
4. Click "New token"
5. Give it a name (e.g., "MCP Tools Transcription")
6. Select "Read" permissions
7. Copy the token (starts with `hf_`)
8. Add it to your `.env` file as `HUGGINGFACE_API_TOKEN`

**Note:** The token is optional but recommended for better reliability and higher rate limits.

## Security Notes

- **Never commit `.env` files to version control**
- Store API tokens securely
- Use environment-specific tokens when possible
- Rotate tokens regularly
- Use the minimum required permissions/scopes for each service
- Google access tokens expire - implement refresh token flow for production use

