// MCP Tools Registry - Loads all tools dynamically
import weather from './weather.js';
import math from './math.js';
import jira from './jira.js';
import slack from './slack.js';
import github from './github.js';
import confluence from './confluence.js';
import perforce from './perforce.js';
import gmail from './gmail.js';
import googleCalendar from './google-calendar.js';
import googleDrive from './google-drive.js';
import discord from './discord.js';
import transcripts from './transcripts.js';

// Helper to extract tools (excluding 'definition')
const extractTools = (module) => {
  const { definition, ...tools } = module;
  return tools;
};

// Export all tool implementations
export const mcpTools = {
  ...extractTools(weather),
  ...extractTools(math),
  ...extractTools(jira),
  ...extractTools(slack),
  ...extractTools(github),
  ...extractTools(confluence),
  ...extractTools(perforce),
  ...extractTools(gmail),
  ...extractTools(googleCalendar),
  ...extractTools(googleDrive),
  ...extractTools(discord),
  ...extractTools(transcripts),
};

// Export all tool definitions for LLM function calling
export const toolsDefinition = [
  ...weather.definition,
  ...math.definition,
  ...jira.definition,
  ...slack.definition,
  ...github.definition,
  ...confluence.definition,
  ...perforce.definition,
  ...gmail.definition,
  ...googleCalendar.definition,
  ...googleDrive.definition,
  ...discord.definition,
  ...transcripts.definition,
];

