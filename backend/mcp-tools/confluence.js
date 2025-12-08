import axios from 'axios';

// Confluence API configuration
const CONFLUENCE_BASE_URL = process.env.CONFLUENCE_BASE_URL || '';
const CONFLUENCE_EMAIL = process.env.CONFLUENCE_EMAIL || '';
const CONFLUENCE_API_TOKEN = process.env.CONFLUENCE_API_TOKEN || '';

// Helper function for Confluence API calls
const confluenceApiCall = async (endpoint, method = 'GET', data = null) => {
  try {
    const config = {
      method,
      url: `${CONFLUENCE_BASE_URL}/rest/api/${endpoint}`,
      auth: {
        username: CONFLUENCE_EMAIL,
        password: CONFLUENCE_API_TOKEN,
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
      error: error.response?.data?.message || error.message 
    };
  }
};

// Get Confluence page
const getConfluencePage = async (pageId) => {
  const result = await confluenceApiCall(`content/${pageId}?expand=body.storage,version,space`);
  
  if (result.error) return result;
  
  return {
    id: result.id,
    title: result.title,
    body: result.body?.storage?.value || '',
    space: result.space?.name || '',
    spaceKey: result.space?.key || '',
    version: result.version?.number || 1,
    author: result.version?.by?.displayName || '',
    created: result.version?.when || '',
    url: `${CONFLUENCE_BASE_URL}/pages/viewpage.action?pageId=${result.id}`,
  };
};

// Search Confluence pages
const searchConfluencePages = async (query, limit = 25, spaceKey = null) => {
  const cql = spaceKey 
    ? `text ~ "${query}" AND space = ${spaceKey}`
    : `text ~ "${query}"`;
  
  const result = await confluenceApiCall(
    `content/search?cql=${encodeURIComponent(cql)}&limit=${Math.min(limit, 100)}&expand=space,version`
  );
  
  if (result.error) return result;
  
  return {
    total: result.size,
    pages: result.results.map(page => ({
      id: page.id,
      title: page.title,
      space: page.space?.name || '',
      spaceKey: page.space?.key || '',
      excerpt: page.excerpt || '',
      url: `${CONFLUENCE_BASE_URL}/pages/viewpage.action?pageId=${page.id}`,
    })),
  };
};

// Get Confluence space
const getConfluenceSpace = async (spaceKey) => {
  const result = await confluenceApiCall(`space/${spaceKey}?expand=homepage`);
  
  if (result.error) return result;
  
  return {
    key: result.key,
    name: result.name,
    type: result.type,
    description: result.description?.plain?.value || '',
    homepage: result.homepage?.id || null,
  };
};

// List Confluence spaces
const listConfluenceSpaces = async (limit = 25) => {
  const result = await confluenceApiCall(`space?limit=${Math.min(limit, 100)}`);
  
  if (result.error) return result;
  
  return {
    spaces: result.results.map(space => ({
      key: space.key,
      name: space.name,
      type: space.type,
    })),
  };
};

// Get pages in a space
const getConfluenceSpacePages = async (spaceKey, limit = 25) => {
  const result = await confluenceApiCall(
    `content?spaceKey=${spaceKey}&type=page&limit=${Math.min(limit, 100)}&expand=space,version`
  );
  
  if (result.error) return result;
  
  return {
    spaceKey,
    pages: result.results.map(page => ({
      id: page.id,
      title: page.title,
      version: page.version?.number || 1,
      author: page.version?.by?.displayName || '',
      created: page.version?.when || '',
      url: `${CONFLUENCE_BASE_URL}/pages/viewpage.action?pageId=${page.id}`,
    })),
  };
};

// Get page children (sub-pages)
const getConfluencePageChildren = async (pageId, limit = 25) => {
  const result = await confluenceApiCall(
    `content/${pageId}/child/page?limit=${Math.min(limit, 100)}&expand=space,version`
  );
  
  if (result.error) return result;
  
  return {
    parentId: pageId,
    children: result.results.map(page => ({
      id: page.id,
      title: page.title,
      space: page.space?.name || '',
      version: page.version?.number || 1,
      url: `${CONFLUENCE_BASE_URL}/pages/viewpage.action?pageId=${page.id}`,
    })),
  };
};

// Get page attachments
const getConfluencePageAttachments = async (pageId) => {
  const result = await confluenceApiCall(`content/${pageId}/child/attachment`);
  
  if (result.error) return result;
  
  return {
    pageId,
    attachments: result.results.map(att => ({
      id: att.id,
      title: att.title,
      mediaType: att.metadata?.mediaType || '',
      fileSize: att.extensions?.fileSize || 0,
      downloadUrl: `${CONFLUENCE_BASE_URL}${att._links.download}`,
    })),
  };
};

// Get page comments
const getConfluencePageComments = async (pageId, limit = 25) => {
  const result = await confluenceApiCall(
    `content/${pageId}/child/comment?limit=${Math.min(limit, 100)}&expand=version`
  );
  
  if (result.error) return result;
  
  return {
    pageId,
    comments: result.results.map(comment => ({
      id: comment.id,
      author: comment.version?.by?.displayName || '',
      body: comment.body?.storage?.value || '',
      created: comment.version?.when || '',
    })),
  };
};

export default {
  getConfluencePage,
  searchConfluencePages,
  getConfluenceSpace,
  listConfluenceSpaces,
  getConfluenceSpacePages,
  getConfluencePageChildren,
  getConfluencePageAttachments,
  getConfluencePageComments,
  definition: [
    {
      type: 'function',
      function: {
        name: 'get_confluence_page',
        description: 'Get a Confluence page by its ID',
        parameters: {
          type: 'object',
          properties: {
            pageId: {
              type: 'string',
              description: 'Confluence page ID',
            },
          },
          required: ['pageId'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'search_confluence_pages',
        description: 'Search for Confluence pages by text query',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query text',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results (default 25, max 100)',
            },
            spaceKey: {
              type: 'string',
              description: 'Filter by space key (optional)',
            },
          },
          required: ['query'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_confluence_space',
        description: 'Get information about a Confluence space',
        parameters: {
          type: 'object',
          properties: {
            spaceKey: {
              type: 'string',
              description: 'Space key (e.g., DEMO)',
            },
          },
          required: ['spaceKey'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_confluence_spaces',
        description: 'List all Confluence spaces',
        parameters: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of spaces (default 25, max 100)',
            },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_confluence_space_pages',
        description: 'Get all pages in a Confluence space',
        parameters: {
          type: 'object',
          properties: {
            spaceKey: {
              type: 'string',
              description: 'Space key',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of pages (default 25, max 100)',
            },
          },
          required: ['spaceKey'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_confluence_page_children',
        description: 'Get child pages (sub-pages) of a Confluence page',
        parameters: {
          type: 'object',
          properties: {
            pageId: {
              type: 'string',
              description: 'Parent page ID',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of children (default 25, max 100)',
            },
          },
          required: ['pageId'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_confluence_page_attachments',
        description: 'Get attachments for a Confluence page',
        parameters: {
          type: 'object',
          properties: {
            pageId: {
              type: 'string',
              description: 'Page ID',
            },
          },
          required: ['pageId'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_confluence_page_comments',
        description: 'Get comments for a Confluence page',
        parameters: {
          type: 'object',
          properties: {
            pageId: {
              type: 'string',
              description: 'Page ID',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of comments (default 25, max 100)',
            },
          },
          required: ['pageId'],
        },
      },
    },
  ],
};

