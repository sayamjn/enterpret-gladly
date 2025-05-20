const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');


async function loadConfig(configPath) {
  const defaultConfig = {
    gladly: {
      apiUrl: process.env.GLADLY_API_URL || 'https://organization.gladly.com',
      username: process.env.GLADLY_USERNAME,
      apiToken: process.env.GLADLY_API_TOKEN
    },
    enterpret: {
      apiUrl: process.env.ENTERPRET_API_URL || 'https://api.enterpret.com',
      apiKey: process.env.ENTERPRET_API_KEY
    },
    stateFilePath: process.env.STATE_FILE_PATH || './import-state.json',
    batchSize: parseInt(process.env.BATCH_SIZE || '100', 10),
    maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
    retryDelay: parseInt(process.env.RETRY_DELAY || '5000', 10)
  };

  try {
    if (configPath) {
      logger.debug(`Loading config from ${configPath}`);
      
      try {
        await fs.access(configPath);
      } catch (e) {
        logger.warn(`Config file ${configPath} not found, using default config and environment variables`);
        return validateConfig(defaultConfig);
      }
      
      const fileData = await fs.readFile(configPath, 'utf8');
      const fileConfig = JSON.parse(fileData);
      
      const mergedConfig = {
        ...defaultConfig,
        ...fileConfig,
        gladly: {
          ...defaultConfig.gladly,
          ...(fileConfig.gladly || {})
        },
        enterpret: {
          ...defaultConfig.enterpret,
          ...(fileConfig.enterpret || {})
        }
      };
      
      return validateConfig(mergedConfig);
    }
  } catch (error) {
    logger.error(`Error loading config: ${error.message}`);
    logger.info('Falling back to default configuration');
  }
  
  return validateConfig(defaultConfig);
}

function validateConfig(config) {
  if (!config.gladly.username) {
    throw new Error('Gladly username is required in config or GLADLY_USERNAME env var');
  }
  
  if (!config.gladly.apiToken) {
    throw new Error('Gladly API token is required in config or GLADLY_API_TOKEN env var');
  }
  
  if (!config.enterpret.apiKey) {
    throw new Error('Enterpret API key is required in config or ENTERPRET_API_KEY env var');
  }
  
  config.gladly.apiUrl = normalizeUrl(config.gladly.apiUrl);
  config.enterpret.apiUrl = normalizeUrl(config.enterpret.apiUrl);
  
  if (isNaN(config.batchSize) || config.batchSize < 1) {
    config.batchSize = 100;
    logger.warn('Invalid batchSize, using default: 100');
  }
  
  if (isNaN(config.maxRetries) || config.maxRetries < 0) {
    config.maxRetries = 3;
    logger.warn('Invalid maxRetries, using default: 3');
  }
  
  if (isNaN(config.retryDelay) || config.retryDelay < 0) {
    config.retryDelay = 5000;
    logger.warn('Invalid retryDelay, using default: 5000');
  }
  
  return config;
}

function normalizeUrl(url) {
  if (!url) return url;
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

module.exports = {
  loadConfig
};