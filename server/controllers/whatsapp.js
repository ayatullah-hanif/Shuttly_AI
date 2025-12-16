// server/controllers/whatsapp.js
const axios = require('axios');
const { query } = require('../config/database');
const { hashPhoneNumber } = require('../utils/privacy');
const { handleConversation } = require('../services/llama');
const { executeTool } = require('./tools');
const logger = require('../utils/logger');
const {
  getWelcomeButtons,
  getCityList,
  getBusStopsList,
  isButtonReply,
  parseInteractiveReply
} = require('../utils/interactive-responses');

const WHATSAPP_API_URL = `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

// Get or create user from phone number
async function getOrCreateUser(phoneNumber, whatsappName = null) {
  const phoneHash = hashPhoneNumber(phoneNumber);
  
  try {
    // Check if user exists
    const existingUser = await query('users', 'select', {
      where: { phone_hash: phoneHash }
    });

    if (existingUser.success && existingUser.data.length > 0) {
      // Update last interaction
      await query('users', 'update', {
        where: { phone_hash: phoneHash },
        data: { last_interaction: new Date().toISOString() }
      });
      
      return existingUser.data[0];
    }

    // Create new user
    const newUser = await query('users', 'insert', {
      data: {
        phone_hash: phoneHash,
        whatsapp_name: whatsappName,
        total_queries: 0
      },
      select: '*'
    });

    if (!newUser.success) {
      throw new Error('Failed to create user');
    }

    logger.info('New user created', { phoneHash });
    return newUser.data[0];

  } catch (error) {
    logger.error('getOrCreateUser error', { error: error.message });
    return null;
  }
}

// Send WhatsApp message
async function sendWhatsAppMessage(to, message, messageType = 'text') {
  try {
    let messageBody = {
      messaging_product: 'whatsapp',
      to: to,
      type: messageType
    };

    if (messageType === 'text') {
      messageBody.text = { body: message };
    } else if (messageType === 'interactive') {
      messageBody.interactive = message;
    } else if (messageType === 'location') {
      messageBody.location = message;
    }

    const response = await axios.post(WHATSAPP_API_URL, messageBody, {
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    logger.whatsapp(hashPhoneNumber(to), 'outgoing', message);
    return { success: true, messageId: response.data.messages[0].id };

  } catch (error) {
    logger.error('sendWhatsAppMessage error', { 
      error: error.message,
      response: error.response?.data 
    });
    return { success: false, error: error.message };
  }
}

// Send interactive buttons
async function sendButtons(to, bodyText, buttons) {
  const interactiveMessage = {
    type: 'button',
    body: { text: bodyText },
    action: {
      buttons: buttons.map((btn, idx) => ({
        type: 'reply',
        reply: {
          id: btn.id || `btn_${idx}`,
          title: btn.title.substring(0, 20) // WhatsApp limit
        }
      }))
    }
  };

  return await sendWhatsAppMessage(to, interactiveMessage, 'interactive');
}

// Send list menu (for selecting cities/stops)
async function sendListMenu(to, bodyText, buttonText, sections) {
  const interactiveMessage = {
    type: 'list',
    body: { text: bodyText },
    action: {
      button: buttonText,
      sections: sections
    }
  };

  return await sendWhatsAppMessage(to, interactiveMessage, 'interactive');
}

// Request location from user
async function requestLocation(to) {
  const message = "📍 Please share your current location so I can find the nearest bus stop.\n\nTap the 📎 icon → Location → Send your current location";
  return await sendWhatsAppMessage(to, message);
}

// Parse incoming WhatsApp message
function parseIncomingMessage(webhookBody) {
  try {
    const entry = webhookBody.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const messages = value?.messages;

    if (!messages || messages.length === 0) {
      return null;
    }

    const message = messages[0];
    const from = message.from;
    const messageId = message.id;
    const timestamp = message.timestamp;

    // Parse different message types
    let parsedMessage = {
      from,
      messageId,
      timestamp,
      type: message.type,
      profileName: value.contacts?.[0]?.profile?.name
    };

    if (message.type === 'text') {
      parsedMessage.text = message.text.body;
    } else if (message.type === 'location') {
      parsedMessage.location = {
        latitude: message.location.latitude,
        longitude: message.location.longitude,
        name: message.location.name,
        address: message.location.address
      };
    } else if (message.type === 'interactive') {
      if (message.interactive.type === 'button_reply') {
        parsedMessage.buttonReply = {
          id: message.interactive.button_reply.id,
          title: message.interactive.button_reply.title
        };
        parsedMessage.text = message.interactive.button_reply.title; // Treat as text
      } else if (message.interactive.type === 'list_reply') {
        parsedMessage.listReply = {
          id: message.interactive.list_reply.id,
          title: message.interactive.list_reply.title,
          description: message.interactive.list_reply.description
        };
        parsedMessage.text = message.interactive.list_reply.title; // Treat as text
      }
    }

    return parsedMessage;

  } catch (error) {
    logger.error('parseIncomingMessage error', { error: error.message });
    return null;
  }
}

// Log conversation to database
async function logConversation(userId, userMessage, botResponse, intent = null, sessionId = null) {
  try {
    await query('conversations', 'insert', {
      data: {
        user_id: userId,
        message_type: 'text',
        user_message: userMessage,
        bot_response: botResponse,
        intent: intent,
        session_id: sessionId || Date.now().toString()
      }
    });

    // Update user query count
    await query('users', 'update', {
      where: { id: userId },
      data: { 
        total_queries: userId // Will need to increment, Supabase specific syntax
      }
    });

  } catch (error) {
    logger.error('logConversation error', { error: error.message });
  }
}

// Main webhook handler
async function handleWebhook(req, res) {
  try {
    const message = parseIncomingMessage(req.body);

    if (!message) {
      return res.sendStatus(200); 
    }

    logger.whatsapp(hashPhoneNumber(message.from), 'incoming', message.text || message.type);

    // Get or create user
    const user = await getOrCreateUser(message.from, message.profileName);
    if (!user) {
      await sendWhatsAppMessage(message.from, 'Sorry, we encountered an error. Please try again. 🙏');
      return res.sendStatus(200);
    }

    // Handle location messages
    if (message.type === 'location') {
      const { latitude, longitude } = message.location;
      
      // Find nearest stop
      const nearestResult = await executeTool('findNearestStop', { latitude, longitude }, user.id);
      
      if (nearestResult.success) {
        const responseText = `📍 ${nearestResult.message}\n\nWhat would you like to know about ${nearestResult.nearest_stop.name}?\n\n1️⃣ Check bus status\n2️⃣ Get prices to other stops\n3️⃣ Something else`;
        
        await sendWhatsAppMessage(message.from, responseText);
      } else {
        await sendWhatsAppMessage(message.from, 'Sorry, I could not find a nearby bus stop. Please try selecting a city from the menu.');
      }

      return res.sendStatus(200);
    }

  // Handle interactive button/list replies
    let userMessage = message.text || 'Hello';
    let interactiveReply = null;
  
    if (isButtonReply(message)) {
      interactiveReply = parseInteractiveReply(message);
      userMessage = interactiveReply.title; // Use the button text as message
  
      logger.info('Interactive reply received', {
        type: interactiveReply.type,
        id: interactiveReply.id
      });
    }
  
    // Handle button actions directly
    if (interactiveReply) {
      const buttonId = interactiveReply.id;
  
      // Check price button
      if (buttonId === 'check_price') {
        const citiesResult = await executeTool('getCities', {}, user.id);
        if (citiesResult.success) {
          const cityList = getCityList(citiesResult.cities);
          await sendListMenu(message.from, cityList.bodyText, cityList.buttonText, cityList.sections);
          return res.sendStatus(200);
        }
      }
  
      // City selected - show bus stops
      if (buttonId.startsWith('city_')) {
        const cityId = buttonId.split('_')[1];
        // Get city name from database
        const { data: cities } = await query('cities', 'select', {
          where: { id: cityId }
        });
  
        if (cities && cities.length > 0) {
          const cityName = cities[0].name;
          const stopsResult = await executeTool('getBusStops', { city_name: cityName }, user.id);
  
          if (stopsResult.success) {
            const stopsList = getBusStopsList(cityName, stopsResult.stops, 'origin');
            await sendListMenu(message.from, stopsList.bodyText, stopsList.buttonText, stopsList.sections);
            return res.sendStatus(200);
          }
        }
      }
  
      // Bus status button
      if (buttonId === 'bus_status') {
        await sendWhatsAppMessage(message.from, 'Which bus stop would you like to check?\n\nPlease type the stop name (e.g., "Maryland" or "Ojota")');
        return res.sendStatus(200);
      }
  
      // Complaint button
      if (buttonId === 'complaint') {
        await sendWhatsAppMessage(message.from, '📝 Please tell me about your complaint. What happened?');
        return res.sendStatus(200);
      }
    }
  
    // Check for greeting to send welcome buttons
    const greetings = ['hello', 'hi', 'hey', 'start', 'menu'];
  if (greetings.some(g => userMessage.toLowerCase().includes(g))) {
    const welcome = getWelcomeButtons();
    await sendButtons(message.from, welcome.bodyText, welcome.buttons);
    return res.sendStatus(200);
}
    
    // Tool executor for Llama
    const toolExecutor = async (toolName, toolArgs) => {
      return await executeTool(toolName, toolArgs, user.id);
    };

    // Get conversation history (last 5 messages for context)
    const historyResult = await query('conversations', 'select', {
      select: 'user_message, bot_response',
      where: { user_id: user.id },
      order: { column: 'created_at', ascending: false },
      limit: 5
    });

    const conversationHistory = [];
    if (historyResult.success && historyResult.data.length > 0) {
      // Reverse to get chronological order
      historyResult.data.reverse().forEach(conv => {
        if (conv.user_message) {
          conversationHistory.push({ role: 'user', content: conv.user_message });
        }
        if (conv.bot_response) {
          conversationHistory.push({ role: 'assistant', content: conv.bot_response });
        }
      });
    }

    // Call Llama with conversation context
    const llamaResult = await handleConversation(
      userMessage,
      conversationHistory,
      toolExecutor
    );

    let responseText = llamaResult.success 
      ? llamaResult.response 
      : "I'm having trouble right now. Please try again in a moment. 🙏";

    // Send response
    await sendWhatsAppMessage(message.from, responseText);

    // Log conversation
    await logConversation(user.id, userMessage, responseText, null, Date.now().toString());

    res.sendStatus(200);

  } catch (error) {
    logger.error('handleWebhook error', { error: error.message });
    res.sendStatus(500);
  }
}

// Webhook verification (for WhatsApp setup)
function verifyWebhook(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    logger.info('Webhook verified successfully');
    res.status(200).send(challenge);
  } else {
    logger.warn('Webhook verification failed');
    res.sendStatus(403);
  }
}

module.exports = {
  handleWebhook,
  verifyWebhook,
  sendWhatsAppMessage,
  sendButtons,
  sendListMenu,
  requestLocation,
  parseIncomingMessage,
  getOrCreateUser
};

