const GladlyClient = require('./gladly-client');
const EnterpretClient = require('./enterpret-client');
const StateManager = require('./state-manager');
const Transformer = require('./transformer');
const logger = require('./logger');

class GladlyImporter {
  constructor(config) {
    this.config = config;
    this.gladlyClient = new GladlyClient(config.gladly);
    this.enterpretClient = new EnterpretClient(config.enterpret);
    this.stateManager = new StateManager(config.stateFilePath || './import-state.json');
    this.transformer = new Transformer();
    this.batchSize = config.batchSize || 100;
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 5000;
  }

  /**
   * Run the import process
   * @param {Object} options Import options
   * @returns {Object} Import results summary
   */
  async import(options = {}) {
    const { isFullImport = false, startDate, endDate, limit } = options;
    
    const metrics = {
      conversationsCount: 0,
      itemsCount: 0,
      customersCount: 0,
      errorsCount: 0,
      startTime: new Date(),
      endTime: null
    };

    try {
      // 1. Initialize and validate connection to both APIs
      await this._validateConnections();
      
      // 2. Determine the start date for the import
      const importStartDate = await this._determineStartDate(isFullImport, startDate);
      const importEndDate = endDate ? new Date(endDate) : new Date();
      
      logger.info(`Starting ${isFullImport ? 'full' : 'incremental'} import from ${importStartDate.toISOString()} to ${importEndDate.toISOString()}`);
      
      // 3. Fetch conversations from Gladly
      const conversations = await this._fetchConversations(importStartDate, importEndDate, limit);
      metrics.conversationsCount = conversations.length;
      
      logger.info(`Found ${conversations.length} conversations to import`);
      
      // 4. Process each conversation
      for (const conversation of conversations) {
        try {
          // 4.1 Fetch conversation items
          const items = await this._fetchConversationItems(conversation.id);
          metrics.itemsCount += items.length;
          
          // 4.2 Fetch customer data if needed
          const customer = await this._fetchCustomer(conversation.customerId);
          if (customer) metrics.customersCount++;
          
          // 4.3 Transform data to Enterpret format
          const transformedData = this.transformer.transformConversation(conversation, items, customer);
          
          // 4.4 Send to Enterpret
          await this.enterpretClient.importFeedback(transformedData);
          
          logger.debug(`Imported conversation ${conversation.id} with ${items.length} items`);
        } catch (error) {
          metrics.errorsCount++;
          logger.error(`Error processing conversation ${conversation.id}: ${error.message}`);
        }
      }
      
      // 5. Update last import state if successful
      if (metrics.errorsCount === 0) {
        await this.stateManager.updateLastImportTime(importEndDate);
        logger.info(`Updated last import time to ${importEndDate.toISOString()}`);
      } else {
        logger.warn(`Import completed with ${metrics.errorsCount} errors. Last import time not updated.`);
      }
      
      metrics.endTime = new Date();
      return metrics;
    } catch (error) {
      logger.error(`Import failed: ${error.message}`);
      throw error;
    }
  }

  async _validateConnections() {
    try {
      logger.debug('Validating connection to Gladly API...');
      await this.gladlyClient.validateConnection();
      
      logger.debug('Validating connection to Enterpret API...');
      await this.enterpretClient.validateConnection();
      
      logger.info('API connections validated successfully');
    } catch (error) {
      logger.error(`Connection validation failed: ${error.message}`);
      throw new Error(`Connection validation failed: ${error.message}`);
    }
  }

  async _determineStartDate(isFullImport, userStartDate) {
    if (userStartDate) {
      return new Date(userStartDate);
    }
    
    if (isFullImport) {
      return new Date('2010-01-01T00:00:00Z');
    }
    
    const lastImportTime = await this.stateManager.getLastImportTime();
    if (lastImportTime) {
      return new Date(lastImportTime);
    }
    
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() - 30);
    logger.info(`No previous import found. Using default start date: ${defaultDate.toISOString()}`);
    return defaultDate;
  }

  async _fetchConversations(startDate, endDate, limit) {
    const allConversations = [];
    let hasMore = true;
    let page = 1;
    
    while (hasMore) {
      logger.debug(`Fetching conversations page ${page}...`);
      
      const result = await this.gladlyClient.fetchConversations({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        page,
        pageSize: this.batchSize
      });
      
      allConversations.push(...result.conversations);
      
      hasMore = result.hasMore && (!limit || allConversations.length < limit);
      page++;
      
      if (limit && allConversations.length >= limit) {
        logger.info(`Reached limit of ${limit} conversations`);
        allConversations.splice(limit); // Truncate to limit
        break;
      }
      
      if (hasMore) {
        await this._delay(300);
      }
    }
    
    return allConversations;
  }

  async _fetchConversationItems(conversationId) {
    try {
      logger.debug(`Fetching items for conversation ${conversationId}...`);
      return await this.gladlyClient.fetchConversationItems(conversationId);
    } catch (error) {
      logger.error(`Error fetching conversation items for ${conversationId}: ${error.message}`);
      return [];
    }
  }

  async _fetchCustomer(customerId) {
    try {
      logger.debug(`Fetching customer ${customerId}...`);
      return await this.gladlyClient.fetchCustomer(customerId);
    } catch (error) {
      logger.error(`Error fetching customer ${customerId}: ${error.message}`);
      return null;
    }
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = GladlyImporter;