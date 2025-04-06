const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const WhatsAppService = require('./services/whatsapp-service');
const ContactService = require('./services/contact-service');
const CampaignService = require('./services/campaign-service');
const AIService = require('./services/ai-service');
const LicenseService = require('./services/license-service');
const Store = require('electron-store');

let mainWindow;
let whatsappService;
let contactService;
let campaignService;
let aiService;
let licenseService;
let store;

// Create the browser window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
	   devTools: false, // Disable DevTools
	   webSecurity: true
    },
    icon: path.join(__dirname, 'assets/icon.png')
  });

  // Load the index.html file
  mainWindow.loadFile('index.html');
  
  // Open DevTools in development mode
  // mainWindow.webContents.openDevTools();
}

// Disable keyboard shortcuts for DevTools
app.on('browser-window-created', (e, win) => {
  win.webContents.on('before-input-event', (e, input) => {
    if (input.key === 'F12' || 
        (input.control && input.shift && input.key === 'I') || 
        (input.control && input.shift && input.key === 'C')) {
      e.preventDefault();
    }
  });
});

// Initialize app
app.whenReady().then(() => {
  createWindow();
  
  // Initialize services
  initializeServices();
  
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Initialize services
function initializeServices() {
  // Initialize persistent storage
  store = new Store();
  
  // Initialize license service (FIRST)
  licenseService = new LicenseService();
  
  // Initialize contact service
  contactService = new ContactService();
  
  // Initialize WhatsApp service
  whatsappService = new WhatsAppService();
  
  // Initialize AI service with license integration
  aiService = new AIService(licenseService);
  
  // Initialize campaign service
  campaignService = new CampaignService(whatsappService, contactService);
  
  // Set up campaign callbacks
  campaignService.setCallbacks({
    onStatusChange: (status) => {
      mainWindow.webContents.send('campaign-status', status);
    },
    onMessageSent: (contact) => {
      mainWindow.webContents.send('message-sent', contact);
    },
    onMessageFailed: (contact, error) => {
      mainWindow.webContents.send('message-failed', { contact, error });
    },
    onCampaignComplete: () => {
      mainWindow.webContents.send('campaign-complete');
    },
    onLog: (message, type) => {
      mainWindow.webContents.send('campaign-log', { message, type });
    }
  });
  
  // Send initial license status to renderer
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('license-status', {
      isValid: licenseService.isLicenseValid()
    });
  });
}

// IPC handlers
ipcMain.on('connect-whatsapp', (event) => {
  // Check license before allowing connection
  if (!licenseService.isLicenseValid()) {
    mainWindow.webContents.send('whatsapp-error', 'Please activate your license to use this feature');
    return;
  }
  
  console.log('Connect WhatsApp request received');
  
  // Set up WhatsApp callbacks
  whatsappService.setCallbacks({
    onQR: (qr) => {
      mainWindow.webContents.send('whatsapp-qr', qr);
    },
    onReady: () => {
      mainWindow.webContents.send('whatsapp-ready');
    },
    onDisconnected: (reason) => {
      mainWindow.webContents.send('whatsapp-disconnected', reason);
    },
    onError: (error) => {
      mainWindow.webContents.send('whatsapp-error', error.message);
    }
  });
  
  // Initialize WhatsApp
  whatsappService.initialize().catch(err => {
    console.error('Failed to initialize WhatsApp client:', err);
    mainWindow.webContents.send('whatsapp-error', err.message);
  });
});

// Send message (with attachment support)
ipcMain.on('send-message', async (event, data) => {
  // Check license before allowing message sending
  if (!licenseService.isLicenseValid()) {
    mainWindow.webContents.send('message-status', { 
      success: false, 
      error: 'Please activate your license to use this feature' 
    });
    return;
  }
  
  try {
    if (!whatsappService || !whatsappService.isConnected()) {
      mainWindow.webContents.send('message-status', { 
        success: false, 
        error: 'WhatsApp client not connected' 
      });
      return;
    }
    
    const { contact, message, attachment } = data;
    
    // Send message
    const success = await whatsappService.sendMessage(contact, message, attachment);
    
    if (success) {
      console.log('Message sent successfully');
      mainWindow.webContents.send('message-status', { 
        success: true, 
        contact: contact
      });
      
      // Update contact status
      contactService.updateContactStatus(contact.phone, 'Sent');
    } else {
      mainWindow.webContents.send('message-status', { 
        success: false, 
        error: 'Failed to send message',
        contact: contact
      });
    }
  } catch (error) {
    console.error('Error sending message:', error);
    mainWindow.webContents.send('message-status', { 
      success: false, 
      error: error.message 
    });
  }
});

// Validate license key
ipcMain.handle('validate-license', async (event, apiKey) => {
  try {
    const result = await licenseService.validateApiKey(apiKey);
    
    if (result.success) {
      // Update AI service with new API key
      aiService.updateApiKey(apiKey);
    }
    
    return result;
  } catch (error) {
    console.error('License validation error:', error);
    return { 
      success: false, 
      error: error.message,
      message: `Error validating license: ${error.message}`
    };
  }
});

// Get license status
ipcMain.handle('get-license-status', () => {
  return {
    isValid: licenseService.isLicenseValid()
  };
});

// Clear license
ipcMain.handle('clear-license', () => {
  const success = licenseService.clearLicense();
  return {
    success,
    message: success ? 'License cleared successfully' : 'Failed to clear license'
  };
});

// Select attachment file
ipcMain.handle('select-attachment', async () => {
  // Check license first
  if (!licenseService.isLicenseValid()) {
    return { 
      success: false, 
      error: 'Please activate your license to use this feature' 
    };
  }
  
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'All Files', extensions: ['*'] },
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif'] },
        { name: 'Documents', extensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt'] }
      ]
    });
    
    if (canceled || filePaths.length === 0) {
      return { success: false };
    }
    
    return {
      success: true,
      filePath: filePaths[0],
      fileName: path.basename(filePaths[0])
    };
  } catch (error) {
    console.error('Error selecting attachment:', error);
    return { success: false, error: error.message };
  }
});

// Start campaign
ipcMain.on('start-campaign', (event, data) => {
  // Check license first
  if (!licenseService.isLicenseValid()) {
    mainWindow.webContents.send('campaign-start-status', {
      success: false,
      message: 'Please activate your license to use this feature'
    });
    return;
  }
  
  try {
    const { messageTemplate, useAI, aiConfig, attachment } = data;
    
    // If using AI, set up the campaign to generate variations
    if (useAI && aiConfig) {
      campaignService.setAIConfig({
        enabled: true,
        modelId: aiConfig.modelId,
        prompt: aiConfig.prompt,
        contactsPerVariation: aiConfig.contactsPerVariation || 10,
        aiService: aiService
      });
    } else {
      campaignService.setAIConfig({ enabled: false });
    }
    
    // Set attachment if provided
    if (attachment && attachment.filePath) {
      campaignService.setAttachment(attachment);
    } else {
      campaignService.setAttachment(null);
    }
    
    const success = campaignService.startCampaign(messageTemplate);
    
    mainWindow.webContents.send('campaign-start-status', {
      success,
      message: success ? 'Campaign started successfully' : 'Failed to start campaign'
    });
  } catch (error) {
    console.error('Error starting campaign:', error);
    mainWindow.webContents.send('campaign-start-status', {
      success: false,
      error: error.message,
      message: `Error starting campaign: ${error.message}`
    });
  }
});

// Pause campaign
ipcMain.on('pause-campaign', () => {
  // Check license first
  if (!licenseService.isLicenseValid()) {
    mainWindow.webContents.send('campaign-pause-status', {
      success: false,
      message: 'Please activate your license to use this feature'
    });
    return;
  }
  
  const success = campaignService.pauseCampaign();
  
  mainWindow.webContents.send('campaign-pause-status', {
    success,
    message: success ? 'Campaign paused' : 'Failed to pause campaign'
  });
});

// Resume campaign
ipcMain.on('resume-campaign', () => {
  // Check license first
  if (!licenseService.isLicenseValid()) {
    mainWindow.webContents.send('campaign-resume-status', {
      success: false,
      message: 'Please activate your license to use this feature'
    });
    return;
  }
  
  const success = campaignService.resumeCampaign();
  
  mainWindow.webContents.send('campaign-resume-status', {
    success,
    message: success ? 'Campaign resumed' : 'Failed to resume campaign'
  });
});

// Stop campaign
ipcMain.on('stop-campaign', () => {
  // Check license first
  if (!licenseService.isLicenseValid()) {
    mainWindow.webContents.send('campaign-stop-status', {
      success: false,
      message: 'Please activate your license to use this feature'
    });
    return;
  }
  
  const success = campaignService.stopCampaign();
  
  mainWindow.webContents.send('campaign-stop-status', {
    success,
    message: success ? 'Campaign stopped' : 'Failed to stop campaign'
  });
});

// Update campaign settings
ipcMain.handle('update-campaign-settings', (event, settings) => {
  // Check license before allowing settings update
  if (!licenseService.isLicenseValid()) {
    return { 
      success: false, 
      message: 'Please activate your license to use this feature' 
    };
  }
  
  try {
    campaignService.updateSettings(settings);
    return { success: true, message: 'Campaign settings updated' };
  } catch (error) {
    console.error('Error updating campaign settings:', error);
    return { success: false, error: error.message, message: 'Failed to update campaign settings' };
  }
});

// Generate AI message variations
ipcMain.handle('generate-ai-messages', async (event, data) => {
  // Check license before allowing AI generation
  if (!licenseService.isLicenseValid()) {
    return { 
      success: false, 
      message: 'Please activate your license to use AI features' 
    };
  }
  
  try {
    const { prompt, modelId, count } = data;
    
    // Generate multiple variations
    const variations = await aiService.generateMultipleVariations(prompt, count, modelId);
    
    return { 
      success: true, 
      variations,
      message: `Generated ${variations.length} message variations`
    };
  } catch (error) {
    console.error('Error generating AI messages:', error);
    return { 
      success: false, 
      error: error.message,
      message: `Error generating AI messages: ${error.message}`
    };
  }
});

// Add custom AI model
ipcMain.handle('add-custom-model', (event, data) => {
  // Check license before allowing custom model addition
  if (!licenseService.isLicenseValid()) {
    return { 
      success: false, 
      message: 'Please activate your license to use this feature' 
    };
  }
  
  try {
    const { modelId, modelName } = data;
    
    if (!modelId || !modelName) {
      return { 
        success: false, 
        message: 'Model ID and name are required'
      };
    }
    
    const success = aiService.addCustomModel(modelId, modelName);
    
    return { 
      success, 
      message: success ? 'Custom model added successfully' : 'This model already exists'
    };
  } catch (error) {
    console.error('Error adding custom model:', error);
    return { 
      success: false, 
      error: error.message,
      message: `Error adding custom model: ${error.message}`
    };
  }
});

// Get AI model options
ipcMain.handle('get-ai-models', () => {
  return {
    success: true,
    models: aiService.getAvailableModels()
  };
});

// Import contacts
ipcMain.handle('import-contacts', async () => {
  // Check license before allowing contact import
  if (!licenseService.isLicenseValid()) {
    return { 
      success: false, 
      message: 'Please activate your license to use this feature' 
    };
  }
  
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Spreadsheets', extensions: ['xlsx', 'xls', 'csv'] }
      ]
    });
    
    if (canceled) {
      return { success: false, message: 'Import canceled' };
    }
    
    const filePath = filePaths[0];
    const count = contactService.importFromExcel(filePath);
    
    return {
      success: true,
      count: count,
      message: `Successfully imported ${count} contacts`
    };
  } catch (error) {
    console.error('Error importing contacts:', error);
    return {
      success: false,
      error: error.message,
      message: `Error importing contacts: ${error.message}`
    };
  }
});

// Get all contacts
ipcMain.handle('get-contacts', () => {
  return contactService.getAllContacts();
});

// Get contact stats
ipcMain.handle('get-contact-stats', () => {
  return contactService.getStats();
});

// Clear contacts
ipcMain.handle('clear-contacts', () => {
  // Check license before allowing contacts to be cleared
  if (!licenseService.isLicenseValid()) {
    return { 
      success: false, 
      message: 'Please activate your license to use this feature' 
    };
  }
  
  const count = contactService.clearContacts();
  return {
    success: true,
    count: count,
    message: `Cleared ${count} contacts`
  };
});

// Remove contact
ipcMain.handle('remove-contact', (event, index) => {
  // Check license before allowing contact removal
  if (!licenseService.isLicenseValid()) {
    return { 
      success: false, 
      message: 'Please activate your license to use this feature' 
    };
  }
  
  const success = contactService.removeContact(index);
  return {
    success: success,
    message: success ? 'Contact removed' : 'Failed to remove contact'
  };
});