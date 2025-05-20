const axios = require('axios');
const logger = require('./logger');

/**
 * Client for interacting with the Enterpret API
 */
class EnterpretClient {
  /**
   * Create a new Enterpret API client
   * 
   * @param {Object} config Configuration options
   * @param {string} config.apiUrl Base URL for Enterpret API
   * @param {string} config.apiKey Enterpret API key
   */
  constructor(config) {
    this.config = config;
    this.baseUrl = config.apiUrl;
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-API-Key': config.apiKey
      }
    });
    
    this.client.interceptors.response.use(
      response => response,
      async error => {
        if (error.response && error.response.status === 429) {
          const retryAfter = error.response.headers['retry-after'] || 2;
          logger.warn(`Rate limit hit. Retrying after ${retryAfter} seconds.`);
          await this._delay(retryAfter * 1000);
          return this.client(error.config);
        }
        return Promise.reject(error);
      }
    );
  }

  async validateConnection() {
    try {
      const response = await this.client.get('/api/v1/status');
      logger.debug('Connected to Enterpret API successfully');
      return true;
    } catch (error) {
      throw new Error(`Failed to connect to Enterpret API: ${error.message}`);
    }
  }

  /**
   * Import feedback data into Enterpret
   * 
   * @param {Object} feedbackData Transformed feedback data
   * @returns {Object} Import response
   */
  async importFeedback(feedbackData) {
    try {
      this._validateFeedbackData(feedbackData);
      
      const response = await this.client.post('/api/v1/feedback', feedbackData);
      
      logger.debug(`Successfully imported feedback: ${feedbackData.id}`);
      return response.data;
    } catch (error) {
      logger.error(`Error importing feedback ${feedbackData.id}: ${error.message}`);
      throw new Error(`Failed to import feedback: ${error.message}`);
    }
  }

  /**
   * Import multiple feedback records in batch
   * 
   * @param {Array} feedbackItems Array of feedback data objects
   * @returns {Object} Batch import response
   */
  async importFeedbackBatch(feedbackItems) {
    try {
      if (!feedbackItems || !Array.isArray(feedbackItems) || feedbackItems.length === 0) {
        throw new Error('No feedback items provided for batch import');
      }
      
      feedbackItems.forEach(item => this._validateFeedbackData(item));
      
      const response = await this.client.post('/api/v1/feedback/batch', { items: feedbackItems });
      
      logger.debug(`Successfully imported batch of ${feedbackItems.length} feedback items`);
      return response.data;
    } catch (error) {
      logger.error(`Error importing feedback batch: ${error.message}`);
      throw new Error(`Failed to import feedback batch: ${error.message}`);
    }
  }

  /**
   * Validate feedback data before import
   * 
   * @param {Object} data Feedback data to validate
   * @throws {Error} If validation fails
   */
  _validateFeedbackData(data) {
    if (!data.id) {
      throw new Error('Feedback data missing required field: id');
    }
    
    if (!data.source) {
      throw new Error('Feedback data missing required field: source');
    }
    
    if (!data.timestamp) {
      throw new Error('Feedback data missing required field: timestamp');
    }
    
    if (!data.content && !data.metadata) {
      throw new Error('Feedback data must have either content or metadata');
    }
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = EnterpretClient;