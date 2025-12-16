// server/utils/interactive-responses.js

// Generate welcome message with action buttons
function getWelcomeButtons() {
  return {
    bodyText: `👋 *Welcome to ShuttlyAI!*\n\nI can help you with bus travel in Nigeria. What would you like to do?`,
    buttons: [
      { id: 'check_price', title: '💰 Check Price' },
      { id: 'bus_status', title: '🚌 Bus Status' },
      { id: 'complaint', title: '📝 Complaint' }
    ]
  };
}

// Generate city selection list
function getCityList(cities) {
  return {
    bodyText: '📍 *Select Your City*\n\nChoose the city you\'re traveling from:',
    buttonText: 'Select City',
    sections: [
      {
        title: 'Available Cities',
        rows: cities.map(city => ({
          id: `city_${city.id}`,
          title: city.name,
          description: city.state
        }))
      }
    ]
  };
}

// Generate bus stops list for a city
function getBusStopsList(cityName, stops, context = 'origin') {
  const title = context === 'origin' ? 'Where are you starting from?' : 'Where are you going?';
  
  return {
    bodyText: `📍 *${title}*\n\nSelect a bus stop in ${cityName}:`,
    buttonText: 'Select Stop',
    sections: [
      {
        title: `${cityName} Bus Stops`,
        rows: stops.slice(0, 10).map(stop => ({
          id: `stop_${context}_${stop.id}`,
          title: stop.name,
          description: stop.address || 'Bus stop'
        }))
      }
    ]
  };
}

// Generate action buttons after price quote
function getPriceActionButtons(price) {
  return {
    bodyText: `Great! The fare is *₦${price}*.\n\nWhat would you like to do next?`,
    buttons: [
      { id: 'check_status', title: '🚌 Check Bus' },
      { id: 'new_price', title: '🔄 New Route' },
      { id: 'done', title: '✅ Done' }
    ]
  };
}

// Generate complaint category buttons
function getComplaintButtons() {
  return {
    bodyText: '📝 *What type of complaint?*\n\nPlease select a category:',
    buttons: [
      { id: 'complaint_delay', title: '⏰ Delay' },
      { id: 'complaint_service', title: '😟 Service' },
      { id: 'complaint_clean', title: '🧹 Cleanliness' }
    ]
  };
}

// Check if user sent a button reply
function isButtonReply(message) {
  return message.type === 'interactive' && 
         (message.buttonReply || message.listReply);
}

// Parse button/list reply
function parseInteractiveReply(message) {
  if (message.buttonReply) {
    return {
      type: 'button',
      id: message.buttonReply.id,
      title: message.buttonReply.title
    };
  }
  
  if (message.listReply) {
    return {
      type: 'list',
      id: message.listReply.id,
      title: message.listReply.title
    };
  }
  
  return null;
}

module.exports = {
  getWelcomeButtons,
  getCityList,
  getBusStopsList,
  getPriceActionButtons,
  getComplaintButtons,
  isButtonReply,
  parseInteractiveReply
};