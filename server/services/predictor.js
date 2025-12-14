
// server/services/predictor.js
const axios = require('axios');
const logger = require('../utils/logger');

// Call Python ML service for predictions
async function predictWaitingTime(stopId, dayOfWeek, hourOfDay) {
  try {
    const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:5000';
    
    const response = await axios.post(`${mlServiceUrl}/predict`, {
      stop_id: stopId,
      day_of_week: dayOfWeek,
      hour_of_day: hourOfDay
    }, {
      timeout: 5000
    });

    return {
      success: true,
      predicted_wait_minutes: response.data.predicted_wait_minutes
    };

  } catch (error) {
    logger.error('ML prediction error', { error: error.message });
    
    // Fallback to simple heuristic if ML service unavailable
    const isPeakHour = (hourOfDay >= 7 && hourOfDay <= 9) || (hourOfDay >= 16 && hourOfDay <= 19);
    const baseWait = isPeakHour ? 15 : 8;
    
    return {
      success: false,
      predicted_wait_minutes: baseWait,
      fallback: true
    };
  }
}

module.exports = {
  predictWaitingTime
};