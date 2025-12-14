// server/utils/logger.js
const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Log levels
const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

// Format timestamp
function getTimestamp() {
  return new Date().toISOString();
}

// Write to log file
function writeToFile(level, message, metadata = {}) {
  const logEntry = {
    timestamp: getTimestamp(),
    level,
    message,
    ...metadata
  };
  
  const logLine = JSON.stringify(logEntry) + '\n';
  const logFile = path.join(logsDir, `${new Date().toISOString().split('T')[0]}.log`);
  
  fs.appendFile(logFile, logLine, (err) => {
    if (err) console.error('Failed to write log:', err);
  });
}

// Console output with colors
function consoleLog(level, message, metadata) {
  const colors = {
    ERROR: '\x1b[31m', // Red
    WARN: '\x1b[33m',  // Yellow
    INFO: '\x1b[36m',  // Cyan
    DEBUG: '\x1b[90m'  // Gray
  };
  
  const reset = '\x1b[0m';
  const timestamp = getTimestamp();
  
  console.log(
    `${colors[level]}[${timestamp}] [${level}]${reset} ${message}`,
    metadata && Object.keys(metadata).length > 0 ? metadata : ''
  );
}

// Main logging functions
const logger = {
  error: (message, metadata = {}) => {
    writeToFile(LOG_LEVELS.ERROR, message, metadata);
    consoleLog(LOG_LEVELS.ERROR, message, metadata);
  },
  
  warn: (message, metadata = {}) => {
    writeToFile(LOG_LEVELS.WARN, message, metadata);
    consoleLog(LOG_LEVELS.WARN, message, metadata);
  },
  
  info: (message, metadata = {}) => {
    writeToFile(LOG_LEVELS.INFO, message, metadata);
    consoleLog(LOG_LEVELS.INFO, message, metadata);
  },
  
  debug: (message, metadata = {}) => {
    if (process.env.NODE_ENV === 'development') {
      writeToFile(LOG_LEVELS.DEBUG, message, metadata);
      consoleLog(LOG_LEVELS.DEBUG, message, metadata);
    }
  },
  
  // Log WhatsApp interactions (with privacy protection)
  whatsapp: (phoneHash, direction, message) => {
    const metadata = {
      type: 'whatsapp',
      phoneHash,
      direction, // 'incoming' or 'outgoing'
      messageLength: message ? message.length : 0
    };
    
    logger.info(`WhatsApp ${direction}`, metadata);
    writeToFile(LOG_LEVELS.INFO, `WhatsApp ${direction}`, {
      ...metadata,
      messageSample: message ? message.substring(0, 50) : '' // Only log first 50 chars
    });
  },
  
  // Log tool calls
  tool: (toolName, params, result) => {
    logger.debug(`Tool called: ${toolName}`, {
      tool: toolName,
      params,
      resultSuccess: result?.success || false
    });
  }
};

module.exports = logger;