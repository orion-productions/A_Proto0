import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Notion API configuration
const NOTION_API_BASE_URL = 'https://api.notion.com/v1';
let NOTION_API_TOKEN = '';

// Load Notion credentials from file
try {
  const credentialsPath = path.join(__dirname, '../credentials/notion.env');
  if (fs.existsSync(credentialsPath)) {
    const credentialsContent = fs.readFileSync(credentialsPath, 'utf8');
    const lines = credentialsContent.split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        const value = valueParts.join('=').trim();
        if (key === 'NOTION_API_TOKEN') NOTION_API_TOKEN = value;
      }
    }
    console.log('✅ Notion credentials loaded:', {
      hasToken: !!NOTION_API_TOKEN
    });
  }
} catch (error) {
  console.warn('⚠️ Warning: Could not load Notion credentials:', error.message);
}

// Helper function for Notion API calls
const notionApiCall = async (endpoint, method = 'GET', data = null) => {
  if (!NOTION_API_TOKEN) {
    return { 
      error: 'Notion API token not configured. Please set up notion.env credentials with NOTION_API_TOKEN.' 
    };
  }

  try {
    const config = {
      method,
      url: `${NOTION_API_BASE_URL}/${endpoint}`,
      headers: {
        'Authorization': `Bearer ${NOTION_API_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return response.data;
  } catch (error) {
    const errorMsg = error.response?.data?.message || 
                     error.response?.data?.error || 
                     error.message;
    console.error('❌ Notion API Error:', {
      endpoint,
      status: error.response?.status,
      error: errorMsg
    });
    return { 
      error: errorMsg,
      status: error.response?.status
    };
  }
};

// Helper to extract text content from Notion blocks
const extractTextFromBlocks = (blocks) => {
  if (!blocks || !Array.isArray(blocks)) return '';
  
  return blocks.map(block => {
    const blockType = block.type;
    const blockContent = block[blockType];
    
    if (!blockContent) return '';
    
    // Extract text from rich_text arrays
    if (blockContent.rich_text && Array.isArray(blockContent.rich_text)) {
      return blockContent.rich_text.map(rt => rt.plain_text || '').join('');
    }
    
    // Handle different block types
    switch (blockType) {
      case 'paragraph':
        return blockContent.rich_text?.map(rt => rt.plain_text || '').join('') || '';
      case 'heading_1':
      case 'heading_2':
      case 'heading_3':
        return blockContent.rich_text?.map(rt => rt.plain_text || '').join('') || '';
      case 'bulleted_list_item':
      case 'numbered_list_item':
        return blockContent.rich_text?.map(rt => rt.plain_text || '').join('') || '';
      case 'code':
        return blockContent.rich_text?.map(rt => rt.plain_text || '').join('') || '';
      case 'quote':
        return blockContent.rich_text?.map(rt => rt.plain_text || '').join('') || '';
      default:
        return '';
    }
  }).filter(text => text.length > 0).join('\n');
};

// Search Notion workspace (searches both pages and databases)
const searchNotion = async (query, pageSize = 10, sortBy = 'relevance') => {
  // Search for both pages and databases (remove filter to get both)
  const result = await notionApiCall('search', 'POST', {
    query: query || '',
    page_size: Math.min(pageSize, 100),
    // Don't filter by object type - get both pages and databases
    // Sort by last_edited_time if requested (descending = most recent first)
    ...(sortBy === 'recent' && {
      sort: {
        direction: 'descending',
        timestamp: 'last_edited_time'
      }
    })
  });
  
  if (result.error) return result;
  
  // Sort results by last_edited_time if not already sorted by API
  let sortedResults = result.results || [];
  if (sortBy === 'recent' && !result.sort) {
    sortedResults = sortedResults.sort((a, b) => {
      const timeA = new Date(a.last_edited_time || a.created_time || 0).getTime();
      const timeB = new Date(b.last_edited_time || b.created_time || 0).getTime();
      return timeB - timeA; // Descending (most recent first)
    });
  }
  
  return {
    query,
    total: sortedResults.length,
    results: sortedResults.map(item => {
      // Handle both pages and databases
      const isDatabase = item.object === 'database';
      const title = isDatabase 
        ? (item.title?.[0]?.plain_text || 'Untitled Database')
        : (item.properties?.title?.title?.[0]?.plain_text || 
           item.properties?.Name?.title?.[0]?.plain_text ||
           'Untitled');
      
      return {
        id: item.id,
        object: item.object, // 'page' or 'database'
        title,
        url: item.url,
        created_time: item.created_time,
        last_edited_time: item.last_edited_time,
        parent: item.parent?.type || '',
        archived: item.archived || false,
      };
    }),
    has_more: result.has_more || false,
    next_cursor: result.next_cursor || null,
  };
};

// Fetch Notion page content by ID or URL
const fetchNotionPage = async (pageIdOrUrl) => {
  console.log(`[NOTION] Fetching page with: ${pageIdOrUrl}`);
  
  // Extract page ID from URL if provided
  let pageId = pageIdOrUrl;
  
  // If it's a URL, extract the ID
  if (pageIdOrUrl.includes('notion.so/') || pageIdOrUrl.includes('notion.site/')) {
    // Try to match 32-character hex string (page ID)
    const urlMatch = pageIdOrUrl.match(/([a-f0-9]{32})/);
    if (urlMatch) {
      pageId = urlMatch[1];
      console.log(`[NOTION] Extracted page ID from URL: ${pageId}`);
      // Format as UUID with dashes
      pageId = `${pageId.slice(0, 8)}-${pageId.slice(8, 12)}-${pageId.slice(12, 16)}-${pageId.slice(16, 20)}-${pageId.slice(20)}`;
    } else {
      console.error(`[NOTION] Could not extract page ID from URL: ${pageIdOrUrl}`);
      return { error: `Invalid Notion URL format. Could not extract page ID from: ${pageIdOrUrl}. Please provide the full Notion URL or the page ID (32-character hex string).` };
    }
  }
  
  // Remove dashes if present (Notion API accepts both formats)
  pageId = pageId.replace(/-/g, '');
  
  console.log(`[NOTION] Using page ID: ${pageId}`);
  
  // Get page properties
  const pageResult = await notionApiCall(`pages/${pageId}`);
  
  if (pageResult.error) {
    console.error(`[NOTION] Failed to fetch page ${pageId}:`, pageResult.error);
    if (pageResult.status === 404) {
      return { error: `Page not found. The page ID "${pageIdOrUrl}" might be incorrect, or the page might not be shared with the integration. Make sure the page is shared with "MCP Read-Only (UNSEEN)" integration.` };
    }
    return { error: `Failed to fetch page: ${pageResult.error}. Page ID: ${pageId}` };
  }
  
  // Get page content (blocks)
  const blocksResult = await notionApiCall(`blocks/${pageId}/children`, 'GET');
  
  if (blocksResult.error && blocksResult.status !== 404) {
    // If blocks endpoint fails, still return page info
    console.warn('⚠️ Could not fetch page blocks:', blocksResult.error);
  }
  
  const title = pageResult.properties?.title?.title?.[0]?.plain_text || 
                pageResult.properties?.Name?.title?.[0]?.plain_text ||
                'Untitled';
  
  const content = blocksResult.results ? extractTextFromBlocks(blocksResult.results) : '';
  
  return {
    id: pageResult.id,
    title,
    url: pageResult.url,
    created_time: pageResult.created_time,
    last_edited_time: pageResult.last_edited_time,
    archived: pageResult.archived || false,
    content,
    properties: pageResult.properties || {},
    parent: pageResult.parent || {},
    blocks_count: blocksResult.results?.length || 0,
  };
};

// Fetch Notion database by ID or URL
const fetchNotionDatabase = async (databaseIdOrUrl) => {
  // Extract database ID from URL if provided
  let databaseId = databaseIdOrUrl;
  
  // If it's a URL, extract the ID
  if (databaseIdOrUrl.includes('notion.so/') || databaseIdOrUrl.includes('notion.site/')) {
    const urlMatch = databaseIdOrUrl.match(/([a-f0-9]{32})/);
    if (urlMatch) {
      databaseId = urlMatch[1];
      // Format as UUID with dashes
      databaseId = `${databaseId.slice(0, 8)}-${databaseId.slice(8, 12)}-${databaseId.slice(12, 16)}-${databaseId.slice(16, 20)}-${databaseId.slice(20)}`;
    } else {
      return { error: 'Invalid Notion URL format. Could not extract database ID.' };
    }
  }
  
  // Remove dashes if present
  databaseId = databaseId.replace(/-/g, '');
  
  // Get database info
  const dbResult = await notionApiCall(`databases/${databaseId}`);
  
  if (dbResult.error) return dbResult;
  
  // Query database entries
  const queryResult = await notionApiCall(`databases/${databaseId}/query`, 'POST', {
    page_size: 100
  });
  
  if (queryResult.error && queryResult.status !== 404) {
    console.warn('⚠️ Could not query database:', queryResult.error);
  }
  
  const title = dbResult.title?.[0]?.plain_text || 
                dbResult.properties?.Name?.title?.[0]?.plain_text ||
                'Untitled Database';
  
  return {
    id: dbResult.id,
    title,
    url: dbResult.url,
    created_time: dbResult.created_time,
    last_edited_time: dbResult.last_edited_time,
    archived: dbResult.archived || false,
    properties: dbResult.properties || {},
    entries: (queryResult.results || []).map(entry => {
      // Extract properties from each entry
      const entryProps = {};
      Object.keys(entry.properties || {}).forEach(key => {
        const prop = entry.properties[key];
        const propType = prop.type;
        
        // Extract text values based on property type
        if (prop[propType]) {
          if (Array.isArray(prop[propType])) {
            entryProps[key] = prop[propType].map(item => {
              if (item.plain_text) return item.plain_text;
              if (item.name) return item.name;
              return item;
            }).join(', ');
          } else if (prop[propType].plain_text) {
            entryProps[key] = prop[propType].plain_text;
          } else if (prop[propType].name) {
            entryProps[key] = prop[propType].name;
          } else {
            entryProps[key] = prop[propType];
          }
        }
      });
      
      return {
        id: entry.id,
        url: entry.url,
        created_time: entry.created_time,
        last_edited_time: entry.last_edited_time,
        properties: entryProps,
      };
    }),
    entries_count: queryResult.results?.length || 0,
    has_more: queryResult.has_more || false,
  };
};

export default {
  searchNotion,
  fetchNotionPage,
  fetchNotionDatabase,
  definition: [
    {
      type: 'function',
      function: {
        name: 'notion_search',
        description: 'Search for pages in your Notion workspace. Returns a list of matching pages with their titles, URLs, and metadata.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query to find pages in Notion workspace',
            },
            pageSize: {
              type: 'number',
              description: 'Maximum number of results to return (default 10, max 100)',
            },
            sortBy: {
              type: 'string',
              enum: ['relevance', 'recent'],
              description: 'Sort results by relevance (default) or by most recently edited (recent)',
            },
          },
          required: ['query'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'notion_fetch_page',
        description: 'Retrieve content from a Notion page by its ID or URL. Returns the page title, content, properties, and metadata.',
        parameters: {
          type: 'object',
          properties: {
            pageIdOrUrl: {
              type: 'string',
              description: 'Notion page ID (UUID format) or full Notion page URL',
            },
          },
          required: ['pageIdOrUrl'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'notion_fetch_database',
        description: 'Retrieve content from a Notion database by its ID or URL. Returns the database structure, properties, and all entries.',
        parameters: {
          type: 'object',
          properties: {
            databaseIdOrUrl: {
              type: 'string',
              description: 'Notion database ID (UUID format) or full Notion database URL',
            },
          },
          required: ['databaseIdOrUrl'],
        },
      },
    },
  ],
};
