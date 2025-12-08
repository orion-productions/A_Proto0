// Math tool implementation
const addTool = (a, b) => {
  return { result: a + b };
};

// Export tool implementation
export default {
  add: addTool,
  definition: [
    {
      type: 'function',
      function: {
        name: 'add_numbers',
        description: 'Add two numbers together and return the result',
        parameters: {
          type: 'object',
          properties: {
            a: {
              type: 'number',
              description: 'The first number',
            },
            b: {
              type: 'number',
              description: 'The second number',
            },
          },
          required: ['a', 'b'],
        },
      },
    },
  ],
};

