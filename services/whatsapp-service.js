const puppeteer = require('puppeteer-core');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');


class WhatsAppService {
  constructor() {
    this.client = null;
    this.connected = false;
    this.qrCallback = null;
    this.readyCallback = null;
    this.disconnectedCallback = null;
    this.messageCallback = null;
    this.errorCallback = null;
    
    // Configuration for human-like behavior (anti-ban)
    this.humanConfig = {
      betweenMessages: { min: 10000, max: 30000 }, 
      typingSpeed: { min: 50, max: 150 }, 
      readTime: { min: 1000, max: 3000 }, 
      afterSendDelay: { min: 2000, max: 5000 }, 
      batchSize: 5, 
      batchBreak: { min: 300000, max: 600000 }, 
      maxMessagesPerDay: 30
    };
  }

  // Set event callbacks
  setCallbacks(callbacks) {
    this.qrCallback = callbacks.onQR || null;
    this.readyCallback = callbacks.onReady || null;
    this.disconnectedCallback = callbacks.onDisconnected || null;
    this.messageCallback = callbacks.onMessage || null;
    this.errorCallback = callbacks.onError || null;
  }

// WhatsApp Service initialization
async initialize() {
  try {
    // Create a custom Chrome executable path for production build
    let executablePath;
    let isProduction = !process.defaultApp;
    
    if (isProduction) {
      console.log('Running in production mode, using system Chrome');
      // Use system Chrome instead of the bundled one
      if (process.platform === 'win32') {
        executablePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
        if (!fs.existsSync(executablePath)) {
          executablePath = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
        }
        if (!fs.existsSync(executablePath)) {
          executablePath = path.join(process.env.LOCALAPPDATA, 'Google\\Chrome\\Application\\chrome.exe');
        }
      } else if (process.platform === 'darwin') {
        executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
      } else {
        executablePath = '/usr/bin/google-chrome';
      }
      
      console.log('Using Chrome at:', executablePath);
    }
    
    // Initialize WhatsApp client with proper configuration
    this.client = new Client({
      authStrategy: new LocalAuth({
        clientId: 'whatsapp-marketing-tool',
        dataPath: path.join(process.cwd(), '.wwebjs_auth')
      }),
      puppeteer: {
        headless: false,
        executablePath: executablePath,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-extensions',
          '--disable-web-security',
          '--allow-running-insecure-content',
          '--window-size=1280,720'
        ],
        defaultViewport: null,
        ignoreDefaultArgs: ['--disable-extensions']
      },
      qrTimeoutMs: 90000,
      authTimeoutMs: 90000
    });

    console.log('WhatsApp client initialized');

    // Set up the rest of your event handlers...
	
	

      // QR code event
      this.client.on('qr', (qr) => {
        console.log('QR code received');
        qrcode.generate(qr, { small: true });
        
        if (this.qrCallback) {
          this.qrCallback(qr);
        }
      });

      // Ready event
      this.client.on('ready', () => {
        console.log('WhatsApp client is ready!');
        this.connected = true;
        
        if (this.readyCallback) {
          this.readyCallback();
        }
      });

      // Disconnected event
      this.client.on('disconnected', (reason) => {
        console.log('WhatsApp client disconnected:', reason);
        this.connected = false;
        
        if (this.disconnectedCallback) {
          this.disconnectedCallback(reason);
        }
      });

      // Message event
      this.client.on('message', (message) => {
        if (this.messageCallback) {
          this.messageCallback(message);
        }
      });

      // Initialize the client
      await this.client.initialize();
      return true;
    } catch (error) {
      console.error('Error initializing WhatsApp client:', error);
      
      if (this.errorCallback) {
        this.errorCallback(error);
      }
      
      throw error;
    }
  }

  // Check if connected
  isConnected() {
    return this.connected;
  }

  // Disconnect
  async disconnect() {
    if (this.client) {
      try {
        await this.client.destroy();
        this.connected = false;
        return true;
      } catch (error) {
        console.error('Error disconnecting WhatsApp client:', error);
        
        if (this.errorCallback) {
          this.errorCallback(error);
        }
        
        return false;
      }
    }
    return true;
  }

  // Send a message with attachments
  async sendMessage(contact, messageContent, attachmentOptions = null) {
    if (!this.client || !this.connected) {
      throw new Error('WhatsApp client not connected');
    }
    
    try {
      // Parse contact info
      let numberToUse = contact.phone;
      let name = contact.name || '';
      
      // Clean the number
      let formattedNumber = numberToUse.replace(/\D/g, '');
      if (!formattedNumber.startsWith('+')) {
        formattedNumber = '+' + formattedNumber;
      }
      
      // Format for WhatsApp API
      const chatId = `${formattedNumber.replace('+', '')}@c.us`;
      const displayName = name || formattedNumber;
      
      console.log(`Preparing to message ${displayName}...`);
      
      // 1. Ensure we can get chat
      const chat = await this.client.getChatById(chatId);
      console.log(`Chat found, opening conversation...`);
      
      // 2. Wait briefly like reading
      await new Promise(resolve => setTimeout(resolve, 
        this.getRandomInRange(this.humanConfig.readTime.min, this.humanConfig.readTime.max)));
      
      // 3. Simulate typing
      console.log(`Typing message...`);
      
      // Start typing indication
      await chat.sendStateTyping();
      
      // Calculate natural typing time based on message length and typing speed
      const charPerSecond = this.getRandomInRange(
        this.humanConfig.typingSpeed.min, 
        this.humanConfig.typingSpeed.max
      );
      
      // Make sure messageContent is a string
      const messageText = (messageContent || '').toString().trim();
      
      const typingTimeMs = Math.min(
        Math.max(1000, messageText.length * (1000 / charPerSecond)),
        10000 // Cap at 10 seconds max
      );
      
      // Wait for the calculated typing time
      await new Promise(resolve => setTimeout(resolve, typingTimeMs));
      
      // 4. Clear typing state
      await chat.clearState();
      console.log(`Sending message...`);
      
      let result;
      
      // Check if we have an attachment
      if (attachmentOptions && attachmentOptions.filePath) {
        try {
          // Process attachment
          const media = await this.createMediaFromFile(attachmentOptions.filePath);
          
          if (media && messageText) {
            // IMPORTANT FIX: Always set the caption
            media.caption = messageText;
            
            // Send media with caption
            result = await this.client.sendMessage(chatId, media);
            console.log('Sent attachment with caption:', messageText);
          } 
          else if (media) {
            // Send media without caption if no message text
            result = await this.client.sendMessage(chatId, media);
            console.log('Sent attachment without caption');
          }
          else if (messageText) {
            // Send just text if media failed but we have a message
            result = await this.client.sendMessage(chatId, messageText);
            console.log('Media failed, sent text only:', messageText);
          } 
          else {
            throw new Error('No message content and media creation failed');
          }
          
          // Additional safety: Send text separately if we have an attachment
          // This ensures the message text is sent even if the caption fails
          if (media && messageText) {
            try {
              // Small delay to not look automated
              await new Promise(resolve => setTimeout(resolve, 500));
              // Send text as a separate message for redundancy
              await this.client.sendMessage(chatId, messageText);
              console.log('Also sent message text separately for redundancy');
            } catch (textError) {
              console.log('Failed to send redundant text message, but attachment with caption was sent');
            }
          }
        } catch (mediaError) {
          console.error(`Error with media:`, mediaError);
          
          // If there's an error with the media, try to send just the text
          if (messageText) {
            result = await this.client.sendMessage(chatId, messageText);
            console.log('Failed with media, sent text only');
          } else {
            throw new Error('No message content and media sending failed');
          }
        }
      } else if (messageText) {
        // Send text message only
        result = await this.client.sendMessage(chatId, messageText);
        console.log('Sent text message:', messageText);
      } else {
        throw new Error('No message content to send');
      }
      
      // 5. Wait briefly after sending
      await new Promise(resolve => setTimeout(resolve, 
        this.getRandomInRange(this.humanConfig.afterSendDelay.min, this.humanConfig.afterSendDelay.max)));
      
      return true;
    } catch (error) {
      console.error(`Error sending to ${contact.phone}:`, error);
      
      if (this.errorCallback) {
        this.errorCallback(error);
      }
      
      return false;
    }
  }
  
  // Create Media object from file
  async createMediaFromFile(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`File does not exist: ${filePath}`);
      }
      
      const mimeType = this.getMimeType(filePath);
      const base64Data = fs.readFileSync(filePath, {encoding: 'base64'});
      const fileName = path.basename(filePath);
      
      return new MessageMedia(mimeType, base64Data, fileName);
    } catch (error) {
      console.error('Error creating media from file:', error);
      return null;
    }
  }
  
  // Get MIME type based on file extension
  getMimeType(filePath) {
    const extension = path.extname(filePath).toLowerCase();
    
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.mp3': 'audio/mpeg',
      '.mp4': 'video/mp4',
      '.wav': 'audio/wav',
      '.txt': 'text/plain',
      '.csv': 'text/csv'
    };
    
    return mimeTypes[extension] || 'application/octet-stream';
  }

  // Helper function to get random number in range
  getRandomInRange(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}

module.exports = WhatsAppService;