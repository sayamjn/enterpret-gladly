const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

class StateManager {
  /**
   * Create a new state manager
   * 
   * @param {string} stateFilePath Path to the state file
   */
  constructor(stateFilePath) {
    this.stateFilePath = stateFilePath;
  }

  /**
   * Get the timestamp of the last successful import
   * 
   * @returns {string|null} ISO string of last import time or null if no previous import
   */
  async getLastImportTime() {
    try {
      await fs.access(this.stateFilePath);
      
      const data = await fs.readFile(this.stateFilePath, 'utf8');
      const state = JSON.parse(data);
      
      if (state && state.lastImportTime) {
        logger.debug(`Found last import time: ${state.lastImportTime}`);
        return state.lastImportTime;
      }
      
      logger.debug('No last import time found in state file');
      return null;
    } catch (error) {
      logger.debug(`State file not available: ${error.message}`);
      return null;
    }
  }

  /**
   * Update the last import time
   * 
   * @param {Date} timestamp Timestamp of the successful import
   * @returns {boolean} True if successful
   */
  async updateLastImportTime(timestamp) {
    try {
      const isoTimestamp = timestamp instanceof Date 
        ? timestamp.toISOString() 
        : new Date(timestamp).toISOString();
      
      const dir = path.dirname(this.stateFilePath);
      await fs.mkdir(dir, { recursive: true });
      
      const state = {
        lastImportTime: isoTimestamp,
        updatedAt: new Date().toISOString()
      };
      
      await fs.writeFile(this.stateFilePath, JSON.stringify(state, null, 2), 'utf8');
      logger.debug(`Updated last import time to ${isoTimestamp}`);
      return true;
    } catch (error) {
      logger.error(`Failed to update state file: ${error.message}`);
      return false;
    }
  }

  /**
   * Reset the import state
   * 
   * @returns {boolean} True if successful
   */
  async resetState() {
    try {
      try {
        await fs.access(this.stateFilePath);
        await fs.unlink(this.stateFilePath);
      } catch (e) {
      }
      
      logger.info('Import state has been reset');
      return true;
    } catch (error) {
      logger.error(`Failed to reset state: ${error.message}`);
      return false;
    }
  }
}

module.exports = StateManager;