// server/services/llama.js
const axios = require('axios');
const logger = require('../utils/logger');
require('dotenv').config();

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = process.env.GROQ_MODEL || 'llama-3.1-70b-versatile';

const SYSTEM_PROMPT = `You are ShuttlyAI, a helpful WhatsApp assistant for a Nigerian transport company. You help passengers:
1. Check bus prices between locations
2. Find out bus status and waiting times
3. Get route information
4. Log complaints or feedback

IMPORTANT: When users need to make choices, tell them to use the buttons/lists provided. Don't ask them to type if there are interactive options available.

You have access to these tools:
- getCities: Get list of available cities
- getBusStops: Get bus stops in a specific city
- getPrice: Calculate price between two stops
- getBusStatus: Check bus availability and waiting time
- logComplaint: Record customer complaints

Always be friendly, concise (this is WhatsApp), and use Nigerian English naturally. 

For greetings like "Hello" or "Hi", respond warmly and let them know they can use the buttons below to get started.

Always call the appropriate tool to get real-time data. Never make up prices or times.`;

// Tool definitions for Llama
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'getCities',
      description: 'Get list of available cities where shuttle service operates',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getBusStops',
      description: 'Get all bus stops in a specific city',
      parameters: {
        type: 'object',
        properties: {
          city_name: {
            type: 'string',
            description: 'Name of the city (e.g., Lagos, Ibadan, Ilorin, Minna)'
          }
        },
        required: ['city_name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getPrice',
      description: 'Calculate transport price between two bus stops',
      parameters: {
        type: 'object',
        properties: {
          origin_stop_name: {
            type: 'string',
            description: 'Name of starting bus stop'
          },
          destination_stop_name: {
            type: 'string',
            description: 'Name of destination bus stop'
          },
          city_name: {
            type: 'string',
            description: 'City name for context'
          }
        },
        required: ['origin_stop_name', 'destination_stop_name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getBusStatus',
      description: 'Check bus availability and waiting time at a specific bus stop. Use the stop name from the conversation.',
      parameters: {
        type: 'object',
        properties: {
          stop_name: {
            type: 'string',
            description: 'The name of the bus stop to check'
          }
        },
        required: ['stop_name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'findNearestStop',
      description: 'Find the nearest bus stop to given GPS coordinates',
      parameters: {
        type: 'object',
        properties: {
          latitude: {
            type: 'number',
            description: 'Latitude coordinate'
          },
          longitude: {
            type: 'number',
            description: 'Longitude coordinate'
          }
        },
        required: ['latitude', 'longitude']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'logComplaint',
      description: 'Record a customer complaint or feedback',
      parameters: {
        type: 'object',
        properties: {
          complaint_text: {
            type: 'string',
            description: 'The customer complaint or feedback'
          },
          category: {
            type: 'string',
            enum: ['delay', 'service', 'cleanliness', 'driver_behavior', 'other'],
            description: 'Category of complaint'
          }
        },
        required: ['complaint_text', 'category']
      }
    }
  }
];

// Call Groq API with tool support
async function callLlama(messages, tools = TOOLS, toolChoice = 'auto') {
  try {
    const requestBody = {
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages
      ],
      tools: tools,
      tool_choice: toolChoice,
      temperature: 0.7,
      max_tokens: 1024
    };

    logger.debug('Calling Llama API', { messageCount: messages.length });

    const response = await axios.post(GROQ_API_URL, requestBody, {
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 second timeout
    });

    const result = response.data;
    logger.debug('Llama API response received', { 
      finishReason: result.choices[0]?.finish_reason 
    });

    return {
      success: true,
      message: result.choices[0]?.message,
      usage: result.usage
    };

  } catch (error) {
    logger.error('Llama API error', { 
      error: error.message,
      status: error.response?.status,
      errorData: JSON.stringify(error.response?.data)  // ← Add this
    });

    return {
      success: false,
      error: error.message,
      fallbackMessage: "I'm having trouble processing your request right now. Please try again in a moment. 🙏"
    };
  }
}

// Process tool calls from Llama response
function extractToolCalls(message) {
  if (!message.tool_calls || message.tool_calls.length === 0) {
    return [];
  }

  return message.tool_calls.map(toolCall => ({
    id: toolCall.id,
    name: toolCall.function.name,
    arguments: JSON.parse(toolCall.function.arguments)
  }));
}

// Main conversation handler with ReAct pattern
async function handleConversation(userMessage, conversationHistory = [], toolExecutor) {
  const messages = [
    ...conversationHistory,
    { role: 'user', content: userMessage }
  ];

  let iterations = 0;
  const maxIterations = 5; // Prevent infinite loops
  let finalResponse = null;

  while (iterations < maxIterations) {
    iterations++;

    // Call Llama
    const result = await callLlama(messages);

    if (!result.success) {
      return {
        success: false,
        response: result.fallbackMessage,
        conversationHistory: messages
      };
    }

    const assistantMessage = result.message;
    messages.push(assistantMessage);

    // Check if Llama wants to call tools
    const toolCalls = extractToolCalls(assistantMessage);

    if (toolCalls.length === 0) {
      // No tool calls, Llama has final answer
      finalResponse = assistantMessage.content;
      break;
    }

    // Execute each tool call
    for (const toolCall of toolCalls) {
      logger.tool(toolCall.name, toolCall.arguments, { iteration: iterations });

      // Execute the tool
      const toolResult = await toolExecutor(toolCall.name, toolCall.arguments);

      // Add tool result to conversation
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        name: toolCall.name,
        content: JSON.stringify(toolResult)
      });
    }

    // Continue loop to let Llama process tool results
  }

  if (!finalResponse && iterations >= maxIterations) {
    finalResponse = "I apologize, I'm having trouble completing your request. Could you please try rephrasing your question? 🙏";
  }

  return {
    success: true,
    response: finalResponse,
    conversationHistory: messages,
    iterations
  };
}

module.exports = {
  callLlama,
  extractToolCalls,
  handleConversation,
  SYSTEM_PROMPT,
  TOOLS
};