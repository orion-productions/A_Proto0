// Math tool implementations
const addTool = (a, b) => {
  return { result: a + b };
};

const calculateExpression = (expression) => {
  if (typeof expression !== 'string' || !expression.trim()) {
    return { error: 'expression must be a non-empty string' };
  }

  // Strip trailing punctuation like ? ! and locale variants
  let expr = expression.trim().replace(/[?!？！，、。]+$/g, '');

  // Normalize common symbols
  expr = expr.replace(/π/g, 'pi');

  // Allow digits, operators, parentheses, decimals, commas, letters, and question marks (strip any remaining)
  if (/[^0-9+\-*/^().,\sA-Za-z?]/.test(expr)) {
    return { error: 'expression contains unsupported characters' };
  }
  expr = expr.replace(/\?/g, '').trim();

  // Replace caret with exponent operator
  expr = expr.replace(/\^/g, '**');

  // Whitelist identifiers (functions/constants)
  const allowed = new Set([
    'sin', 'cos', 'tan',
    'asin', 'acos', 'atan',
    'sinh', 'cosh', 'tanh',
    'exp', 'log', 'ln', 'sqrt', 'abs',
    'pow', 'min', 'max',
    'pi', 'e', 'PI', 'E'
  ]);

  const idRegex = /[A-Za-z_][A-Za-z0-9_]*/g;
  const ids = expr.match(idRegex) || [];
  for (const id of ids) {
    if (!allowed.has(id)) {
      return { error: `identifier not allowed: ${id}` };
    }
  }

  try {
    // Build safe scope from Math
    const log10 = Math.log10 || ((x) => Math.log(x) / Math.LN10);
    const scope = {
      sin: Math.sin,
      cos: Math.cos,
      tan: Math.tan,
      asin: Math.asin,
      acos: Math.acos,
      atan: Math.atan,
      sinh: Math.sinh,
      cosh: Math.cosh,
      tanh: Math.tanh,
      exp: Math.exp,
      log: log10,   // base-10 log
      ln: Math.log, // natural log
      sqrt: Math.sqrt,
      abs: Math.abs,
      pow: Math.pow,
      min: Math.min,
      max: Math.max,
      pi: Math.PI,
      PI: Math.PI,
      e: Math.E,
      E: Math.E,
    };

    const fn = Function(...Object.keys(scope), `"use strict"; return (${expr});`);
    const result = fn(...Object.values(scope));

    if (typeof result !== 'number' || !isFinite(result)) {
      return { error: 'expression did not produce a finite number' };
    }
    return { result };
  } catch (err) {
    return { error: `failed to evaluate expression: ${err.message}` };
  }
};

// Export tool implementation
export default {
  add: addTool,
  calculator: calculateExpression,
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
    {
      type: 'function',
      function: {
        name: 'calculator',
        description: 'Evaluate a math expression (supports + - * / ^, parentheses, sin/cos/tan, asin/acos/atan, exp, log/ln, sqrt, abs, min/max, pi, e) and return the numeric result.',
        parameters: {
          type: 'object',
          properties: {
            expression: {
              type: 'string',
              description: 'Math expression, e.g., "5+1", "12.3 * 4", "(2+3)/5"',
            },
          },
          required: ['expression'],
        },
      },
    },
  ],
};

