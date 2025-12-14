// server/controllers/tools.js
const { supabase, query } = require('../config/database');
const logger = require('../utils/logger');

// Tool 1: Get list of cities
async function getCities() {
  try {
    const result = await query('cities', 'select', {
      select: 'id, name, state',
      order: { column: 'name', ascending: true }
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    return {
      success: true,
      cities: result.data,
      message: `Available cities: ${result.data.map(c => c.name).join(', ')}`
    };
  } catch (error) {
    logger.error('getCities error', { error: error.message });
    return {
      success: false,
      error: error.message,
      cities: []
    };
  }
}

// Tool 2: Get bus stops in a city
async function getBusStops(city_name) {
  try {
    // First, find the city
    const cityResult = await query('cities', 'select', {
      select: 'id, name',
      where: { name: city_name }
    });

    if (!cityResult.success || cityResult.data.length === 0) {
      return {
        success: false,
        error: `City "${city_name}" not found`,
        stops: []
      };
    }

    const cityId = cityResult.data[0].id;

    // Get all stops for this city
    const stopsResult = await query('bus_stops', 'select', {
      select: 'id, name, address, latitude, longitude', 
      where: { city_id: cityId },
      order: { column: 'name', ascending: true }
    });

    if (!stopsResult.success) {
      throw new Error(stopsResult.error);
    }

    return {
      success: true,
      city: city_name,
      stops: stopsResult.data,
      message: `Found ${stopsResult.data.length} stops in ${city_name}`
    };
  } catch (error) {
    logger.error('getBusStops error', { error: error.message, city_name });
    return {
      success: false,
      error: error.message,
      stops: []
    };
  }
}

// Tool 3: Get price between two stops
async function getPrice(origin_stop_name, destination_stop_name, city_name = null) {
  try {
    // Find origin stop
    let originQuery = supabase
      .from('bus_stops')
      .select('id, name, city_id')
      .ilike('name', `%${origin_stop_name}%`);
    
    if (city_name) {
      const cityResult = await query('cities', 'select', {
        where: { name: city_name }
      });
      if (cityResult.success && cityResult.data.length > 0) {
        originQuery = originQuery.eq('city_id', cityResult.data[0].id);
      }
    }

    const { data: originStops, error: originError } = await originQuery.limit(1);
    
    if (originError || !originStops || originStops.length === 0) {
      return {
        success: false,
        error: `Could not find stop matching "${origin_stop_name}"`,
        price: null
      };
    }

    // Find destination stop
    let destQuery = supabase
      .from('bus_stops')
      .select('id, name, city_id')
      .ilike('name', `%${destination_stop_name}%`);
    
    if (city_name) {
      const cityResult = await query('cities', 'select', {
        where: { name: city_name }
      });
      if (cityResult.success && cityResult.data.length > 0) {
        destQuery = destQuery.eq('city_id', cityResult.data[0].id);
      }
    }

    const { data: destStops, error: destError } = await destQuery.limit(1);
    
    if (destError || !destStops || destStops.length === 0) {
      return {
        success: false,
        error: `Could not find stop matching "${destination_stop_name}"`,
        price: null
      };
    }

    const originId = originStops[0].id;
    const destId = destStops[0].id;

    // Find route - try direct direction first
    const { data: routes, error: routeError } = await supabase
      .from('routes')
      .select('id, base_price, distance_km, estimated_duration_minutes, is_active')
      .eq('origin_stop_id', originId)
      .eq('destination_stop_id', destId)
      .limit(1);

    if (!routeError && routes && routes.length > 0) {
      const route = routes[0];
      
      if (!route.is_active) {
        return {
          success: false,
          error: 'This route is currently inactive',
          price: null
        };
      }

      return {
        success: true,
        origin: originStops[0].name,
        destination: destStops[0].name,
        price: route.base_price,
        currency: 'NGN',
        distance_km: route.distance_km,
        duration_minutes: route.estimated_duration_minutes,
        message: `₦${route.base_price} from ${originStops[0].name} to ${destStops[0].name} (${route.distance_km}km, ~${route.estimated_duration_minutes} mins)`
      };
    }

    // Try reverse route
    const { data: reverseRoutes, error: reverseError } = await supabase
      .from('routes')
      .select('id, base_price, distance_km, estimated_duration_minutes, is_active')
      .eq('origin_stop_id', destId)
      .eq('destination_stop_id', originId)
      .limit(1);

    if (!reverseError && reverseRoutes && reverseRoutes.length > 0) {
      const route = reverseRoutes[0];
      
      if (!route.is_active) {
        return {
          success: false,
          error: 'This route is currently inactive',
          price: null
        };
      }

      return {
        success: true,
        origin: originStops[0].name,
        destination: destStops[0].name,
        price: route.base_price,
        currency: 'NGN',
        distance_km: route.distance_km,
        duration_minutes: route.estimated_duration_minutes,
        message: `₦${route.base_price} from ${originStops[0].name} to ${destStops[0].name} (${route.distance_km}km, ~${route.estimated_duration_minutes} mins)`
      };
    }

    // No route found
    return {
      success: false,
      error: `No route found between ${originStops[0].name} and ${destStops[0].name}`,
      price: null
    };

  } catch (error) {
    logger.error('getPrice error', { error: error.message });
    return {
      success: false,
      error: error.message,
      price: null
    };
  }
}
// Tool 4: Get bus status and waiting time
async function getBusStatus(stop_name, city_name = null) {
  try {
    // Find the stop
    let stopQuery = supabase
      .from('bus_stops')
      .select('id, name, city_id, latitude, longitude')
      .ilike('name', `%${stop_name}%`);

    if (city_name) {
      const cityResult = await query('cities', 'select', {
        where: { name: city_name }
      });
      if (cityResult.success && cityResult.data.length > 0) {
        stopQuery = stopQuery.eq('city_id', cityResult.data[0].id);
      }
    }

    const { data: stopData, error: stopError } = await stopQuery.limit(1);

    if (stopError || !stopData || stopData.length === 0) {
      return {
        success: false,
        error: 'Bus stop not found',
        status: null
      };
    }

    const stop = stopData[0];

    // Find buses at or near the stop
    const busesResult = await query('buses', 'select', {
      select: 'id, bus_number, status, capacity',
      where: { current_stop_id: stop.id }
    });

    const availableBuses = busesResult.success
      ? busesResult.data.filter(bus => bus.status === 'available').length
      : 0;

    // Get predicted waiting time (stubbed as random for now)
    const currentHour = new Date().getHours();

    // simple heuristic for waiting time
    const isPeak = (currentHour >= 7 && currentHour <= 9) || (currentHour >= 16 && currentHour <= 19);
    const baseWaitTime = isPeak ? 15 : 8;
    const waitTimeVariance = Math.floor(Math.random() * 5); // 0-4 minutes
    const estimatedWait = availableBuses > 0
      ? Math.max(2, baseWaitTime - (availableBuses * 3) + waitTimeVariance)
      : baseWaitTime + 10;

    return {
      success: true,
      stop: stop.name,
      available_buses: availableBuses,
      estimated_wait_minutes: estimatedWait,
      status: availableBuses > 0 ? 'Buses available' : 'No buses currently available',
      message: availableBuses > 0
        ? `There are currently ${availableBuses} buses available at ${stop.name}. Estimated wait time is approximately ${estimatedWait} minutes.`
        : `No buses are currently available at ${stop.name}. Next bus in approximately ${estimatedWait} minutes.`
    };
  } catch (error) {
    logger.error('getBusStatus error', { error: error.message, stop_name, city_name });
    return {
      success: false,
      error: error.message,
      status: null
    };
  }
}

// Tool 5: Find nearest stop from GPS coordinates
async function findNearestStop(latitude, longitude) {
  try {
    // Get all stops
    const { data: stops, error } = await supabase
      .from('bus_stops')
      .select('id, name, address, latitude, longitude, city_id')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);
    if (error || !stops || stops.length === 0) {
      return {
        success: false,
        error: 'No bus stops found in the database',
        nearest_stop: null
      };
    }

    // Calculate distance using Haversine formula
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
      const R = 6371; // Radius of the Earth in km
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c; // Distance in km
    };

    // Find nearest stop
    let nearestStop = null;
    let minDistance = Infinity;

    stops.forEach(stop => {
      const distance = calculateDistance(latitude, longitude, parseFloat(stop.latitude), parseFloat(stop.longitude));

      if (distance < minDistance) {
        minDistance = distance;
        nearestStop = stop;
      }
    });

    if (!nearestStop) {
      return {
        success: false,
        error: 'Could not determine the nearest bus stop',
        nearest_stop: null
      };
    }

    // Get city name
    const cityResult = await query('cities', 'select', {
      select: 'name',
      where: { id: nearestStop.city_id }
    });

    const cityName = cityResult.success && cityResult.data.length > 0 ? cityResult.data[0].name : 'Unknown';

    return {
      success: true,
      nearest_stop: {
        id: nearestStop.id,
        name: nearestStop.name,
        address: nearestStop.address,
        city: cityName,
        distance_km: Math.round(minDistance * 100) / 100 // round to 2 decimals
      },
      message: `The nearest bus stop is ${nearestStop.name} in ${cityName}, approximately ${Math.round(minDistance * 100) / 100} km away.`
    };
  } catch (error) {
    logger.error('findNearestStop error', { error: error.message, latitude, longitude });
    return {
      success: false,
      error: error.message,
      nearest_stop: null
    };
  }
}

// Tool 6: Log complaint
async function logComplaint(complaint_text, category, userId = null, busId = null) {
  try {
    // Simple sentiment analysis (mock - could use real NLP)
    const negativeSentimentWords = ['bad', 'terrible', 'awful', 'worst', 'hate', 'angry', 'disappointed', 'horrible'];
    const positiveSentimentWords = ['good', 'great', 'excellent', 'love', 'happy', 'satisfied', 'wonderful', 'amazing'];
    const lowerText = (complaint_text || '').toLowerCase();
    const negativeCount = negativeSentimentWords.filter(word => lowerText.includes(word)).length;
    const positiveCount = positiveSentimentWords.filter(word => lowerText.includes(word)).length;

    const sentimentScore = positiveCount > 0 || negativeCount > 0
      ? (positiveCount - negativeCount) / Math.max(positiveCount + negativeCount, 1)
      : 0; // Neutral if no sentiment words

    const complaintData = {
      user_id: userId,
      complaint_text: complaint_text,
      category: category || 'other',
      sentiment_score: sentimentScore,
      status: 'open',
      bus_id: busId
    };

    const result = await query('complaints', 'insert', {
      data: complaintData,
      select: 'id'
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    logger.info('Complaint logged', { complaintId: result.data[0].id, category, sentimentScore });

    return {
      success: true,
      complaint_id: result.data[0].id,
      message: 'Your complaint has been logged and we will review this shortly. Thank you for your feedback.'
    };
  } catch (error) {
    logger.error('logComplaint error', { error: error.message, complaint_text, category, userId, busId });
    return {
      success: false,
      error: error.message,
      complaint_id: null
    };
  }
}

// Tool executor - routes tool calls to appropriate functions
async function executeTool(toolName, toolArgs = {}, userId = null) {
  logger.debug(`Executing tool: ${toolName}`, toolArgs);
  switch (toolName) {
    case 'getCities':
      return await getCities();
    case 'getBusStops':
      return await getBusStops(toolArgs.city_name);
    case 'getPrice':
      return await getPrice(toolArgs.origin_stop_name, toolArgs.destination_stop_name, toolArgs.city_name);
    case 'getBusStatus':
      return await getBusStatus(toolArgs.stop_name, toolArgs.city_name);
    case 'findNearestStop':
      return await findNearestStop(toolArgs.latitude, toolArgs.longitude);
    case 'logComplaint':
      return await logComplaint(toolArgs.complaint_text, toolArgs.category, userId, toolArgs.bus_id || null);
    default:
      return {
        success: false,
        error: `Unknown tool: ${toolName}`
      };
  }
}

module.exports = {
  getCities,
  getBusStops,
  getPrice,
  getBusStatus,
  findNearestStop,
  logComplaint,
  executeTool
};