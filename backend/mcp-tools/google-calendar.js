import axios from 'axios';

// Google Calendar API configuration
const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';
const GOOGLE_ACCESS_TOKEN = process.env.GOOGLE_ACCESS_TOKEN || '';

// Helper function for Calendar API calls
const calendarApiCall = async (endpoint, method = 'GET', data = null) => {
  try {
    const config = {
      method,
      url: `${CALENDAR_API_BASE}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${GOOGLE_ACCESS_TOKEN}`,
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
      error: error.response?.data?.error?.message || error.message 
    };
  }
};

// List calendar events
const listCalendarEvents = async (calendarId = 'primary', timeMin = null, timeMax = null, maxResults = 20, singleEvents = true, orderBy = 'startTime') => {
  let endpoint = `/calendars/${encodeURIComponent(calendarId)}/events?maxResults=${Math.min(maxResults, 2500)}&singleEvents=${singleEvents}&orderBy=${orderBy}`;
  
  if (timeMin) endpoint += `&timeMin=${encodeURIComponent(timeMin)}`;
  if (timeMax) endpoint += `&timeMax=${encodeURIComponent(timeMax)}`;
  
  const result = await calendarApiCall(endpoint);
  
  if (result.error) return result;
  
  return {
    events: result.items.map(event => ({
      id: event.id,
      summary: event.summary || '',
      description: event.description || '',
      location: event.location || '',
      start: event.start?.dateTime || event.start?.date || '',
      end: event.end?.dateTime || event.end?.date || '',
      timeZone: event.start?.timeZone || '',
      attendees: event.attendees?.map(a => ({
        email: a.email,
        displayName: a.displayName || '',
        responseStatus: a.responseStatus,
      })) || [],
      organizer: event.organizer ? {
        email: event.organizer.email,
        displayName: event.organizer.displayName || '',
      } : null,
      status: event.status,
      htmlLink: event.htmlLink,
      created: event.created,
      updated: event.updated,
    })),
    nextPageToken: result.nextPageToken,
  };
};

// Get calendar event
const getCalendarEvent = async (calendarId, eventId) => {
  const result = await calendarApiCall(`/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`);
  
  if (result.error) return result;
  
  return {
    id: result.id,
    summary: result.summary || '',
    description: result.description || '',
    location: result.location || '',
    start: result.start?.dateTime || result.start?.date || '',
    end: result.end?.dateTime || result.end?.date || '',
    timeZone: result.start?.timeZone || '',
    attendees: result.attendees?.map(a => ({
      email: a.email,
      displayName: a.displayName || '',
      responseStatus: a.responseStatus,
    })) || [],
    organizer: result.organizer ? {
      email: result.organizer.email,
      displayName: result.organizer.displayName || '',
    } : null,
    status: result.status,
    htmlLink: result.htmlLink,
    created: result.created,
    updated: result.updated,
    recurrence: result.recurrence || [],
    reminders: result.reminders || {},
  };
};

// Get calendar list
const listCalendars = async () => {
  const result = await calendarApiCall('/users/me/calendarList');
  
  if (result.error) return result;
  
  return {
    calendars: result.items.map(cal => ({
      id: cal.id,
      summary: cal.summary || '',
      description: cal.description || '',
      timeZone: cal.timeZone || '',
      backgroundColor: cal.backgroundColor || '',
      foregroundColor: cal.foregroundColor || '',
      accessRole: cal.accessRole,
      primary: cal.primary || false,
    })),
  };
};

// Get calendar
const getCalendar = async (calendarId) => {
  const result = await calendarApiCall(`/calendars/${encodeURIComponent(calendarId)}`);
  
  if (result.error) return result;
  
  return {
    id: result.id,
    summary: result.summary || '',
    description: result.description || '',
    timeZone: result.timeZone || '',
    location: result.location || '',
  };
};

// Search calendar events
const searchCalendarEvents = async (calendarId = 'primary', query, timeMin = null, timeMax = null, maxResults = 20) => {
  // Calendar API doesn't have a direct search, so we filter after fetching
  const eventsResult = await listCalendarEvents(calendarId, timeMin, timeMax, maxResults * 2, true, 'startTime');
  
  if (eventsResult.error) return eventsResult;
  
  const queryLower = query.toLowerCase();
  const filtered = eventsResult.events.filter(event => 
    event.summary.toLowerCase().includes(queryLower) ||
    (event.description && event.description.toLowerCase().includes(queryLower)) ||
    (event.location && event.location.toLowerCase().includes(queryLower))
  ).slice(0, maxResults);
  
  return {
    events: filtered,
    query: query,
  };
};

// Get free/busy information
const getCalendarFreeBusy = async (timeMin, timeMax, calendarIds = ['primary']) => {
  const result = await calendarApiCall('/freeBusy', 'POST', {
    timeMin,
    timeMax,
    items: calendarIds.map(id => ({ id })),
  });
  
  if (result.error) return result;
  
  return {
    calendars: result.calendars,
    groups: result.groups || {},
  };
};

// Get upcoming events
const getCalendarUpcomingEvents = async (calendarId = 'primary', maxResults = 10) => {
  const now = new Date().toISOString();
  return await listCalendarEvents(calendarId, now, null, maxResults, true, 'startTime');
};

export default {
  listCalendarEvents,
  getCalendarEvent,
  listCalendars,
  getCalendar,
  searchCalendarEvents,
  getCalendarFreeBusy,
  getCalendarUpcomingEvents,
  definition: [
    {
      type: 'function',
      function: {
        name: 'list_calendar_events',
        description: 'List events from a Google Calendar',
        parameters: {
          type: 'object',
          properties: {
            calendarId: {
              type: 'string',
              description: 'Calendar ID (default: "primary")',
            },
            timeMin: {
              type: 'string',
              description: 'Lower bound (exclusive) for an event\'s start time (ISO 8601 format)',
            },
            timeMax: {
              type: 'string',
              description: 'Upper bound (exclusive) for an event\'s end time (ISO 8601 format)',
            },
            maxResults: {
              type: 'number',
              description: 'Maximum number of events (default 20, max 2500)',
            },
            singleEvents: {
              type: 'boolean',
              description: 'Whether to expand recurring events into instances',
            },
            orderBy: {
              type: 'string',
              description: 'Order of events',
              enum: ['startTime', 'updated'],
            },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_calendar_event',
        description: 'Get a specific calendar event by ID',
        parameters: {
          type: 'object',
          properties: {
            calendarId: {
              type: 'string',
              description: 'Calendar ID (default: "primary")',
            },
            eventId: {
              type: 'string',
              description: 'Event ID',
            },
          },
          required: ['eventId'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_calendars',
        description: 'List all calendars accessible to the user',
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
        name: 'get_calendar',
        description: 'Get information about a specific calendar',
        parameters: {
          type: 'object',
          properties: {
            calendarId: {
              type: 'string',
              description: 'Calendar ID',
            },
          },
          required: ['calendarId'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'search_calendar_events',
        description: 'Search for calendar events by text query',
        parameters: {
          type: 'object',
          properties: {
            calendarId: {
              type: 'string',
              description: 'Calendar ID (default: "primary")',
            },
            query: {
              type: 'string',
              description: 'Search query (searches in title, description, location)',
            },
            timeMin: {
              type: 'string',
              description: 'Lower bound for search (ISO 8601 format)',
            },
            timeMax: {
              type: 'string',
              description: 'Upper bound for search (ISO 8601 format)',
            },
            maxResults: {
              type: 'number',
              description: 'Maximum number of results (default 20)',
            },
          },
          required: ['query'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_calendar_free_busy',
        description: 'Get free/busy information for calendars',
        parameters: {
          type: 'object',
          properties: {
            timeMin: {
              type: 'string',
              description: 'Start time (ISO 8601 format)',
            },
            timeMax: {
              type: 'string',
              description: 'End time (ISO 8601 format)',
            },
            calendarIds: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of calendar IDs to check (default: ["primary"])',
            },
          },
          required: ['timeMin', 'timeMax'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_calendar_upcoming_events',
        description: 'Get upcoming events from now',
        parameters: {
          type: 'object',
          properties: {
            calendarId: {
              type: 'string',
              description: 'Calendar ID (default: "primary")',
            },
            maxResults: {
              type: 'number',
              description: 'Maximum number of events (default 10)',
            },
          },
          required: [],
        },
      },
    },
  ],
};

