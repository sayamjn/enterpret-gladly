const winston = require('winston');
const { format, transports } = winston;

const customFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  format.errors({ stack: true }),
  format.splat(),
  format.printf(info => {
    const { timestamp, level, message, ...rest } = info;
    const restString = Object.keys(rest).length ? JSON.stringify(rest, null, 2) : '';
    return `${timestamp} [${level.toUpperCase()}]: ${message} ${restString}`;
  })
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info', // Default level
  format: customFormat,
  defaultMeta: { service: 'gladly-import' },
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        customFormat
      )
    }),
    
    new transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    new transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

/**
 * Set the logging level
 * 
 * @param {string} level Logging level (error, warn, info, http, verbose, debug, silly)
 */
logger.setLevel = function(level) {
  logger.level = level;
  logger.debug(`Logging level set to ${level}`);
};

module.exports = logger;