const logger = require('./logger');

/**
 * Transformer for converting Gladly data to Enterpret format
 */
class Transformer {
  constructor() {
    this.channelMap = {
      'CHAT_MESSAGE': 'chat',
      'EMAIL': 'email',
      'SMS': 'sms',
      'TWITTER': 'social',
      'FACEBOOK_MESSENGER': 'social',
      'INSTAGRAM_DIRECT': 'social',
      'WHATSAPP': 'messaging',
      'PHONE_CALL': 'voice',
      'VOICEMAIL': 'voice',
      'CUSTOMER_ACTIVITY': 'other'
    };
  }

  /**
   * Transform a Gladly conversation into Enterpret's format
   * 
   * @param {Object} conversation Gladly conversation object
   * @param {Array} items Gladly conversation items
   * @param {Object} customer Gladly customer profile
   * @returns {Object} Transformed data in Enterpret format
   */
  transformConversation(conversation, items, customer) {
    try {
      const primaryChannel = this._determinePrimaryChannel(items);
      
      const transformedRecord = {
        id: `gladly_${conversation.id}`,
        source: 'Gladly',
        channel: primaryChannel,
        timestamp: conversation.createdAt,
        status: conversation.status.toLowerCase(),
        metadata: {
          gladly_conversation_id: conversation.id,
          inboxId: conversation.inboxId
        }
      };
      
      if (conversation.agentId) {
        transformedRecord.agent = {
          id: conversation.agentId
        };
      }
      
      if (customer) {
        transformedRecord.customer = this._transformCustomer(customer);
      }
      
      if (conversation.topicIds && conversation.topicIds.length > 0) {
        transformedRecord.tags = conversation.topicIds;
      }
      
      transformedRecord.content = this._processConversationItems(items);
      
      if (conversation.customAttributes && conversation.customAttributes.length > 0) {
        transformedRecord.customAttributes = this._transformCustomAttributes(conversation.customAttributes);
      }
      
      return transformedRecord;
    } catch (error) {
      logger.error(`Error transforming conversation ${conversation.id}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Determine the primary channel based on conversation items
   * 
   * @param {Array} items Gladly conversation items
   * @returns {string} Primary channel
   */
  _determinePrimaryChannel(items) {
    if (!items || items.length === 0) {
      return 'other';
    }
    
    const channelCounts = {};
    
    for (const item of items) {
      if (item.content && item.content.type) {
        const channel = this.channelMap[item.content.type] || 'other';
        channelCounts[channel] = (channelCounts[channel] || 0) + 1;
      }
    }
    
    let primaryChannel = 'other';
    let maxCount = 0;
    
    for (const [channel, count] of Object.entries(channelCounts)) {
      if (count > maxCount) {
        maxCount = count;
        primaryChannel = channel;
      }
    }
    
    return primaryChannel;
  }

  /**
   * Transform Gladly customer to Enterpret format
   * 
   * @param {Object} customer Gladly customer object
   * @returns {Object} Transformed customer data
   */
  _transformCustomer(customer) {
    const transformedCustomer = {
      id: customer.id,
    };
    
    if (customer.name) {
      transformedCustomer.name = customer.name;
    }
    
    if (customer.emails && customer.emails.length > 0) {
      const primaryEmail = customer.emails.find(email => email.primary) || customer.emails[0];
      transformedCustomer.email = primaryEmail.normalized || primaryEmail.original;
    }
    
    if (customer.phones && customer.phones.length > 0) {
      const primaryPhone = customer.phones.find(phone => phone.primary) || customer.phones[0];
      transformedCustomer.phone = primaryPhone.normalized || primaryPhone.original;
    }
    
    if (customer.externalCustomerId) {
      transformedCustomer.externalId = customer.externalCustomerId;
    }
    
    return transformedCustomer;
  }

  /**
   * Process conversation items to extract content
   * 
   * @param {Array} items Gladly conversation items
   * @returns {string} Combined conversation content
   */
  _processConversationItems(items) {
    if (!items || items.length === 0) {
      return '';
    }
    
    const sortedItems = [...items].sort((a, b) => 
      new Date(a.timestamp) - new Date(b.timestamp)
    );
    
    const contentParts = [];
    
    for (const item of sortedItems) {
      if (!item.content) continue;
      
      const type = item.content.type;
      const initiatorType = item.initiator ? item.initiator.type : 'UNKNOWN';
      const timestamp = new Date(item.timestamp).toISOString();
      
      let formattedContent = '';
      
      switch (type) {
        case 'CHAT_MESSAGE':
          formattedContent = `[${timestamp}] ${initiatorType}: ${item.content.content || ''}`;
          break;
          
        case 'EMAIL':
          const subject = item.content.subject ? `Subject: ${item.content.subject}\n` : '';
          const bodyContent = item.content.bodyPlain || item.content.content || '';
          formattedContent = `[${timestamp}] ${initiatorType} - EMAIL:\n${subject}${bodyContent}`;
          break;
          
        case 'SMS':
          formattedContent = `[${timestamp}] ${initiatorType} - SMS: ${item.content.body || ''}`;
          break;
          
        case 'PHONE_CALL':
          const duration = item.content.completedAt && item.content.answeredAt ? 
            (new Date(item.content.completedAt) - new Date(item.content.answeredAt)) / 1000 : 'unknown';
          formattedContent = `[${timestamp}] ${initiatorType} - CALL: Duration ${duration}s`;
          break;
          
        case 'CONVERSATION_NOTE':
          formattedContent = `[${timestamp}] NOTE: ${item.content.body || ''}`;
          break;
          
        case 'TOPIC_CHANGE':
          if (item.content.addedTopicIds && item.content.addedTopicIds.length > 0) {
            formattedContent = `[${timestamp}] TOPICS ADDED: ${item.content.addedTopicIds.join(', ')}`;
          }
          if (item.content.removedTopicIds && item.content.removedTopicIds.length > 0) {
            formattedContent = `[${timestamp}] TOPICS REMOVED: ${item.content.removedTopicIds.join(', ')}`;
          }
          break;
          
        case 'CONVERSATION_STATUS_CHANGE':
          formattedContent = `[${timestamp}] STATUS CHANGED TO: ${item.content.status || ''}`;
          break;
          
        case 'CUSTOMER_ACTIVITY':
          formattedContent = `[${timestamp}] ACTIVITY: ${item.content.title || ''}\n${item.content.body || ''}`;
          break;
          
        default:
          continue;
      }
      
      if (formattedContent) {
        contentParts.push(formattedContent);
      }
    }
    
    return contentParts.join('\n\n');
  }

  /**
   * Transform Gladly custom attributes to Enterpret format
   * 
   * @param {Array} customAttributes Gladly custom attributes
   * @returns {Object} Transformed custom attributes
   */
  _transformCustomAttributes(customAttributes) {
    const transformed = {};
    
    if (!customAttributes || !Array.isArray(customAttributes)) {
      return transformed;
    }
    
    for (const attr of customAttributes) {
      if (attr.id && attr.value !== undefined) {
        transformed[attr.id] = attr.value;
      }
    }
    
    return transformed;
  }
}

module.exports = Transformer;