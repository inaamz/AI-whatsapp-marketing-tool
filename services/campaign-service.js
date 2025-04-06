// Campaign service for automated messaging with anti-ban features
class CampaignService {
  constructor(whatsappService, contactService) {
    this.whatsappService = whatsappService;
    this.contactService = contactService;
    
    // Campaign state
    this.running = false;
    this.paused = false;
    this.currentBatch = [];
    this.currentIndex = 0;
    this.processingTimeout = null;
    
    // AI Configuration
    this.aiConfig = {
      enabled: false,
      modelId: null,
      prompt: '',
      contactsPerVariation: 10,
      aiService: null,
      currentVariations: [],
      currentVariationIndex: 0
    };
    
    // Attachment
    this.attachment = null;
    
    // Callbacks
    this.onStatusChange = null;
    this.onMessageSent = null;
    this.onMessageFailed = null;
    this.onCampaignComplete = null;
    this.onLog = null;
    
    // Anti-ban settings (customizable)
    this.settings = {
      // Number of messages to process in a batch before taking a longer break
      batchSize: 5,
      
      // Delay between messages (random within range in seconds)
      messageDelay: {
        min: 20,
        max: 45
      },
      
      // Delay between batches (random within range in minutes)
      batchDelay: {
        min: 5,
        max: 15
      },
      
      // Daily limits
      messagesPerDay: 30,
      
      // Human simulation
      humanTypingSpeed: {
        min: 50,  // characters per minute (slow)
        max: 120  // characters per minute (fast)
      },
      
      // Message variations
      useVariations: true,
      
      // Random emojis
      addRandomEmoji: true,
      
      // Typing indicators
      useTypingIndicator: true,
      
      // Randomize contact order
      randomizeOrder: true
    };
  }
  
  // Set callbacks
  setCallbacks(callbacks) {
    this.onStatusChange = callbacks.onStatusChange || null;
    this.onMessageSent = callbacks.onMessageSent || null;
    this.onMessageFailed = callbacks.onMessageFailed || null;
    this.onCampaignComplete = callbacks.onCampaignComplete || null;
    this.onLog = callbacks.onLog || null;
  }
  
  // Update settings
  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
  }
  
  // Set AI configuration
  setAIConfig(config) {
    this.aiConfig.enabled = config.enabled || false;
    
    if (config.enabled) {
      this.aiConfig.modelId = config.modelId || null;
      this.aiConfig.prompt = config.prompt || '';
      this.aiConfig.contactsPerVariation = config.contactsPerVariation || 10;
      this.aiConfig.aiService = config.aiService || null;
      this.aiConfig.currentVariations = [];
      this.aiConfig.currentVariationIndex = 0;
    }
  }
  
  // Set attachment
  setAttachment(attachment) {
    this.attachment = attachment;
  }
  
  // Log message
  log(message, type = 'info') {
    if (this.onLog) {
      this.onLog(message, type);
    }
  }
  
  // Start campaign
  async startCampaign(messageTemplate) {
    if (this.running) {
      this.log('Campaign is already running', 'info');
      return false;
    }
    
    if (!this.whatsappService.isConnected()) {
      this.log('WhatsApp is not connected', 'error');
      return false;
    }
    
    // Get pending contacts
    const allContacts = this.contactService.getPendingContacts();
    
    if (allContacts.length === 0) {
      this.log('No pending contacts to process', 'info');
      return false;
    }
    
    // Set campaign state
    this.running = true;
    this.paused = false;
    this.messageTemplate = messageTemplate;
    
    // Apply daily limit
    const contactsToProcess = allContacts.slice(0, Math.min(this.settings.messagesPerDay, allContacts.length));
    
    // Randomize order if needed
    if (this.settings.randomizeOrder) {
      contactsToProcess.sort(() => 0.5 - Math.random());
    }
    
    this.currentBatch = contactsToProcess;
    this.currentIndex = 0;
    
    // Status change
    if (this.onStatusChange) {
      this.onStatusChange('running');
    }
    
    // If using AI, generate initial message variations
    if (this.aiConfig.enabled && this.aiConfig.aiService) {
      try {
        this.log('Generating AI message variations...', 'info');
        
        // Generate 3 variations to start with
        this.aiConfig.currentVariations = await this.aiConfig.aiService.generateMultipleVariations(
          this.aiConfig.prompt,
          3,
          this.aiConfig.modelId
        );
        
        if (this.aiConfig.currentVariations.length === 0) {
          this.log('Failed to generate AI message variations. Falling back to template.', 'error');
          this.aiConfig.enabled = false;
        } else {
          this.log(`Generated ${this.aiConfig.currentVariations.length} AI message variations`, 'success');
        }
      } catch (error) {
        this.log(`Error generating AI messages: ${error.message}. Falling back to template.`, 'error');
        this.aiConfig.enabled = false;
      }
    }
    
    this.log(`Starting campaign with ${contactsToProcess.length} contacts`, 'info');
    
    // Start processing
    this.processNextBatch();
    
    return true;
  }
  
  // Pause campaign
  pauseCampaign() {
    if (!this.running || this.paused) {
      return false;
    }
    
    this.paused = true;
    this.clearTimeouts();
    
    this.log('Campaign paused', 'info');
    
    // Status change
    if (this.onStatusChange) {
      this.onStatusChange('paused');
    }
    
    return true;
  }
  
  // Resume campaign
  resumeCampaign() {
    if (!this.running || !this.paused) {
      return false;
    }
    
    this.paused = false;
    
    this.log('Campaign resumed', 'info');
    
    // Status change
    if (this.onStatusChange) {
      this.onStatusChange('running');
    }
    
    // Continue processing
    this.processNextBatch();
    
    return true;
  }
  
  // Stop campaign
  stopCampaign() {
    if (!this.running) {
      return false;
    }
    
    this.running = false;
    this.paused = false;
    this.clearTimeouts();
    
    this.log('Campaign stopped', 'info');
    
    // Status change
    if (this.onStatusChange) {
      this.onStatusChange('stopped');
    }
    
    return true;
  }
  
  // Clear any pending timeouts
  clearTimeouts() {
    if (this.processingTimeout) {
      clearTimeout(this.processingTimeout);
      this.processingTimeout = null;
    }
  }
  
  // Process next batch of contacts
  processNextBatch() {
    if (!this.running || this.paused) {
      return;
    }
    
    // Calculate batch end index
    const batchStart = this.currentIndex;
    const batchEnd = Math.min(this.currentIndex + this.settings.batchSize, this.currentBatch.length);
    
    // Check if we have more contacts to process
    if (batchStart >= this.currentBatch.length) {
      this.campaignComplete();
      return;
    }
    
    // Get batch of contacts
    const batchContacts = this.currentBatch.slice(batchStart, batchEnd);
    
    this.log(`Processing batch ${Math.floor(batchStart / this.settings.batchSize) + 1}: ${batchContacts.length} contacts`, 'info');
    
    // Process each contact in the batch
    this.processContact(0, batchContacts);
  }
  
  // Process a specific contact in the batch
  async processContact(index, batchContacts) {
    if (!this.running || this.paused) {
      return;
    }
    
    // Check if we've processed all contacts in this batch
    if (index >= batchContacts.length) {
      // Move to the next batch
      this.currentIndex += this.settings.batchSize;
      
      // If we have more contacts to process, take a longer break between batches
      if (this.currentIndex < this.currentBatch.length) {
        const batchDelayMinutes = this.getRandomInRange(this.settings.batchDelay.min, this.settings.batchDelay.max);
        const batchDelayMs = batchDelayMinutes * 60 * 1000;
        
        this.log(`Batch complete. Taking a break for ${batchDelayMinutes} minutes...`, 'info');
        
        // If using AI, generate new variations for next batch
        if (this.aiConfig.enabled && 
            this.aiConfig.aiService && 
            this.currentIndex % this.aiConfig.contactsPerVariation === 0) {
          try {
            this.log('Generating new AI message variations for next batch...', 'info');
            this.aiConfig.currentVariations = await this.aiConfig.aiService.generateMultipleVariations(
              this.aiConfig.prompt,
              3,
              this.aiConfig.modelId
            );
            this.aiConfig.currentVariationIndex = 0;
          } catch (error) {
            this.log(`Failed to generate new AI variations: ${error.message}. Using existing variations.`, 'error');
          }
        }
        
        this.processingTimeout = setTimeout(() => {
          this.processNextBatch();
        }, batchDelayMs);
      } else {
        // Campaign complete
        this.campaignComplete();
      }
      
      return;
    }
    
    const contact = batchContacts[index];
    
    try {
      // Get the message to send (either template, AI-generated, or with variations)
      let messageToSend;
      
      if (this.aiConfig.enabled && this.aiConfig.currentVariations.length > 0) {
        // Use AI-generated message
        const variationIndex = this.aiConfig.currentVariationIndex % this.aiConfig.currentVariations.length;
        const aiTemplate = this.aiConfig.currentVariations[variationIndex];
        
        // Increment variation index every few contacts
        if ((index + 1) % Math.ceil(batchContacts.length / this.aiConfig.currentVariations.length) === 0) {
          this.aiConfig.currentVariationIndex++;
        }
        
        // Personalize the AI template
        messageToSend = this.personalizeMessage(contact, aiTemplate);
      } else {
        // Use regular template with variations
        messageToSend = this.personalizeMessage(contact, this.messageTemplate);
      }
      
      // Send message (with attachment if present)
      const success = await this.whatsappService.sendMessage(
        contact, 
        messageToSend,
        this.attachment
      );
      
      if (success) {
        this.contactService.updateContactStatus(contact.phone, 'Sent');
        this.log(`Message sent to ${contact.name || contact.phone}`, 'success');
        
        if (this.onMessageSent) {
          this.onMessageSent(contact);
        }
      } else {
        this.contactService.updateContactStatus(contact.phone, 'Failed');
        this.log(`Failed to send message to ${contact.name || contact.phone}`, 'error');
        
        if (this.onMessageFailed) {
          this.onMessageFailed(contact, 'Send failed');
        }
      }
    } catch (error) {
      this.contactService.updateContactStatus(contact.phone, 'Failed');
      this.log(`Error sending to ${contact.name || contact.phone}: ${error.message}`, 'error');
      
      if (this.onMessageFailed) {
        this.onMessageFailed(contact, error.message);
      }
    }
    
    // Proceed to the next contact with a random delay
    if (this.running && !this.paused) {
      const delaySeconds = this.getRandomInRange(this.settings.messageDelay.min, this.settings.messageDelay.max);
      this.log(`Waiting ${delaySeconds} seconds before next message...`, 'info');
      
      this.processingTimeout = setTimeout(() => {
        this.processContact(index + 1, batchContacts);
      }, delaySeconds * 1000);
    }
  }
  
  // Campaign complete
  campaignComplete() {
    this.running = false;
    this.log('Campaign completed!', 'success');
    
    // Status change
    if (this.onStatusChange) {
      this.onStatusChange('completed');
    }
    
    // Callback
    if (this.onCampaignComplete) {
      this.onCampaignComplete();
    }
  }
  
  // Personalize message with contact info and anti-ban variations
  personalizeMessage(contact, template) {
    // Base personalization: replace {name} with contact name
    let message = template.replace(/{name}/g, contact.name || '');
    
    // Apply anti-ban variations
    if (this.settings.useVariations) {
      message = this.addMessageVariations(message);
    }
    
    return message;
  }
  
  // Add natural variations to avoid spam detection
  addMessageVariations(message) {
    // 1. Add random emojis occasionally
    if (this.settings.addRandomEmoji && Math.random() > 0.7) {
      const emojis = ['😊', '👍', '🙏', '✨', '💼', '👋', '📱', '💯', '🔥'];
      const emoji = emojis[Math.floor(Math.random() * emojis.length)];
      
      // Add emoji at the end of a sentence
      if (message.includes('!')) {
        message = message.replace(/!([^!]*)$/, `! ${emoji}$1`);
      } else if (message.includes('.')) {
        message = message.replace(/\.([^.]*)$/, `. ${emoji}$1`);
      } else {
        message += ` ${emoji}`;
      }
    }
    
    // 2. Add small variations to punctuation
    if (Math.random() > 0.8) {
      // Sometimes double punctuation for emphasis
      message = message.replace(/!(?!\s)/g, '!!');
    }
    
    // 3. Add small typos and corrections (very realistic human behavior)
    if (Math.random() > 0.9) {
      const words = message.split(' ');
      const randomIndex = Math.floor(Math.random() * words.length);
      const word = words[randomIndex];
      
      if (word.length > 3) {
        // Swap two adjacent letters
        const pos = Math.floor(Math.random() * (word.length - 2)) + 1;
        const typo = word.substring(0, pos) + word.charAt(pos + 1) + word.charAt(pos) + word.substring(pos + 2);
        
        // Replace with typo
        words[randomIndex] = typo;
        
        // Join back
        message = words.join(' ');
      }
    }
    
    return message;
  }
  
  // Get random number in range
  getRandomInRange(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}

module.exports = CampaignService;