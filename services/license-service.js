// License Service for API Key validation
const axios = require('axios');
const Store = require('electron-store');

class LicenseService {
  constructor() {
    this.store = new Store({ name: 'license', encryptionKey: 'whatsapp-marketing-tool-key' });
    this.isValidated = false;
    this.endpoint = 'https://openrouter.ai/api/v1/auth/key';
    
    // Load stored license on startup
    this.apiKey = this.store.get('apiKey', null);
    if (this.apiKey) {
      this.isValidated = this.store.get('validated', false);
    }
  }

  // Validate API key with OpenRouter
  async validateApiKey(apiKey) {
    try {
      // Make a verification request to OpenRouter
      const response = await axios.get(this.endpoint, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      // If we get a successful response, the key is valid
      if (response.status === 200) {
        this.apiKey = apiKey;
        this.isValidated = true;
        
        // Store the validated key securely
        this.store.set('apiKey', apiKey);
        this.store.set('validated', true);
        this.store.set('validatedDate', new Date().toISOString());
        
        return { 
          success: true, 
          message: 'License key validated successfully!'
        };
      }
      
      return { 
        success: false, 
        message: 'License validation failed. Invalid API key.'
      };
    } catch (error) {
      console.error('License validation error:', error);
      return { 
        success: false, 
        message: `License validation failed: ${error.response?.data?.error || error.message}`
      };
    }
  }

  // Check if license is valid
  isLicenseValid() {
    return this.isValidated && this.apiKey !== null;
  }

  // Get API key
  getApiKey() {
    return this.apiKey;
  }

  // Clear license
  clearLicense() {
    this.apiKey = null;
    this.isValidated = false;
    this.store.delete('apiKey');
    this.store.delete('validated');
    this.store.delete('validatedDate');
    return true;
  }
}

module.exports = LicenseService;