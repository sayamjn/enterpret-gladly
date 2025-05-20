const axios = require('axios');
const logger = require('./logger');

class GladlyClient {
  /**
   * Create a new Gladly API client
   * 
   * @param {Object} config Configuration options
   * @param {string} config.apiUrl Base URL for Gladly API
   * @param {string} config.username Gladly API username (email)
   * @param {string} config.apiToken Gladly API token
   */
  constructor(config) {
    this.config = config;
    this.baseUrl = config.apiUrl;
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      auth: {
        username: config.username,
        password: config.apiToken
      },
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
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
      const response = await this.client.get('/api/v1/organization');
      logger.debug(`Connected to Gladly organization: ${response.data.name}`);
      return true;
    } catch (error) {
      throw new Error(`Failed to connect to Gladly API: ${error.message}`);
    }
  }

  /**
   * Fetch conversations with optional filtering
   * 
   * @param {Object} options Options for fetching conversations
   * @param {string} options.startDate Start date (ISO 8601)
   * @param {string} options.endDate End date (ISO 8601)
   * @param {number} options.page Page number
   * @param {number} options.pageSize Number of items per page
   * @returns {Object} Object containing conversations and pagination info
   */
  async fetchConversations(options) {
    try {
      // Implement a custom endpoint to get conversations by date
      // Note: This is a simplified approach - in practice we will need 
      // to use a combination of endpoints or export API
      
      const params = {
        startAt: options.startDate,
        endAt: options.endDate
      };
      
      // For pagination simulation - in practice we will use Gladly's pagination mechanism
      const offset = (options.page - 1) * options.pageSize;
      params.offset = offset;
      params.limit = options.pageSize;
      
      // In practice we'd use the export API endpoint for larger datasets
      // This is a simplified approach using the conversations endpoint
      // GET /api/v1/export/jobs with appropriate parameters would be better for large imports
      
      const response = await this.client.get('/api/v1/export/jobs', { params });
      
      if (!response.data || !Array.isArray(response.data)) {
        return { conversations: [], hasMore: false };
      }
      
      const conversations = [];
      for (const job of response.data) {
        if (job.status === 'COMPLETED' && 
            job.parameters && 
            job.parameters.type === 'CONVERSATIONS') {
          
          // For each job, get the conversation data
          // In practice, we will download the files from the job
          const jobDetails = await this.client.get(`/api/v1/export/jobs/${job.id}`);
          
          if (jobDetails.data && jobDetails.data.files) {
            for (const file of jobDetails.data.files) {
              if (file.includes('conversation')) {
                const fileData = await this.client.get(`/api/v1/export/jobs/${job.id}/files/${file}`);
                
                const lines = fileData.data.split('\n').filter(line => line.trim());
                for (const line of lines) {
                  try {
                    const conversation = JSON.parse(line);
                    conversations.push(conversation);
                  } catch (e) {
                    logger.error(`Failed to parse conversation data: ${e.message}`);
                  }
                }
              }
            }
          }
        }
      }
      
      const hasMore = conversations.length >= options.pageSize;
      
      return {
        conversations,
        hasMore
      };
    } catch (error) {
      logger.error(`Error fetching conversations: ${error.message}`);
      throw new Error(`Failed to fetch conversations: ${error.message}`);
    }
  }

  /**
   * Fetch all items for a conversation
   * 
   * @param {string} conversationId Gladly conversation ID
   * @returns {Array} Array of conversation items
   */
  async fetchConversationItems(conversationId) {
    try {
      const response = await this.client.get(`/api/v1/conversations/${conversationId}/items`);
      
      if (!response.data || !Array.isArray(response.data)) {
        return [];
      }
      
      return response.data;
    } catch (error) {
      logger.error(`Error fetching conversation items for ${conversationId}: ${error.message}`);
      throw new Error(`Failed to fetch conversation items: ${error.message}`);
    }
  }

  /**
   * Fetch customer details
   * 
   * @param {string} customerId Gladly customer ID
   * @returns {Object} Customer data
   */
  async fetchCustomer(customerId) {
    try {
      const response = await this.client.get(`/api/v1/customer-profiles/${customerId}`);
      return response.data;
    } catch (error) {
      if (error.response && error.response.status === 301) {
        const newId = error.response.headers.location.split('/').pop();
        logger.info(`Customer ${customerId} has been merged into ${newId}. Fetching new ID.`);
        return this.fetchCustomer(newId);
      }
      
      logger.error(`Error fetching customer ${customerId}: ${error.message}`);
      throw new Error(`Failed to fetch customer: ${error.message}`);
    }
  }


  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = GladlyClient;