// AI Message Generation Service using OpenRouter
const axios = require('axios');

class AIService {
  constructor(licenseService = null) {
    // OpenRouter API endpoint
    this.endpoint = 'https://openrouter.ai/api/v1/chat/completions';

    // License service for API key
    this.licenseService = licenseService;

    // Default API key (will be overridden by license key)
    this.apiKey = licenseService ? licenseService.getApiKey() : null;

    // Available models on OpenRouter (free tier)
    this.models = [
      { id: 'google/gemini-2.0-flash-thinking-exp:free', name: 'Google: Gemini 2.0 Flash Thinking' },
      { id: 'google/gemini-2.5-pro-exp-03-25:free', name: 'Google: Gemini Pro 2.5 Experimental' },
      { id: 'qwen/qwen2.5-vl-72b-instruct:free', name: 'Qwen: Qwen2.5 VL 72B Instruct' },
      { id: 'meta-llama/llama-3-8b-instruct:free', name: 'Meta: Llama 3 8B Instruct' },
      { id: 'deepseek/deepseek-chat:free', name: 'DeepSeek: DeepSeek V3' },
      { id: 'qwen/qwen-2.5-72b-instruct:free', name: 'Qwen2.5 72B Instruct' },
      { id: 'google/gemma-3-12b-it:free', name: 'Google: Gemma 3 12B' },
      { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek: R1' },
    ];
    
    // Default system prompt for message generation
    this.systemPrompt = `You are an expert WhatsApp marketing assistant. Your goal is to create engaging, personalized WhatsApp marketing messages that feel natural and conversational, not spammy. 
      
Each message should:
1. Be concise (under 120 words)
2. Include personalization (using the {name} variable)
3. Have a clear value proposition
4. Include a specific call-to-action
5. Sound like it was written by a human (casual, friendly tone)
6. Avoid excessive emojis or exclamation marks
7. DO NOT include any meta text like "Variation X:" or headers
8. DO NOT include asterisks or formatting characters
9. DO NOT mention that this is a generated message

Your response will be sent directly to customers, so keep it professional and ready to use as-is.`;
  }

  // Update API key (called when license is activated)
  updateApiKey(apiKey) {
    this.apiKey = apiKey;
    return true;
  }

  // Add a custom model
  addCustomModel(modelId, modelName) {
    // Check if model already exists
    const exists = this.models.some(model => model.id === modelId);
    if (!exists) {
      this.models.push({ id: modelId, name: modelName });
      return true;
    }
    return false;
  }

  // Get available models
  getAvailableModels() {
    return this.models;
  }

  // Generate marketing message using OpenRouter
  async generateMarketingMessage(prompt, modelId) {
    try {
      // Get API key from license service if available
      const apiKey = this.licenseService ? this.licenseService.getApiKey() : this.apiKey;
      
      if (!apiKey) {
        throw new Error('No valid API key found. Please activate your license.');
      }
      
      // If no model specified, use the first one from the list
      if (!modelId) {
        modelId = this.models[0].id;
      }

      const response = await axios.post(
        this.endpoint,
        {
          model: modelId,
          messages: [
            { role: 'system', content: this.systemPrompt },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 300
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Extract the message content
      const messageContent = response.data.choices[0].message.content;

      // Clean the response to remove any potential meta text
      return this.cleanResponse(messageContent);
    } catch (error) {
      console.error('OpenRouter API error:', error.response?.data || error.message);
      throw new Error(`OpenRouter API error: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  // Clean the response to remove any meta text
  cleanResponse(response) {
    // Remove any "Variation X:" headers
    let cleaned = response.replace(/^(Variation \d+:).*?\n/gm, '');
    
    // Remove any asterisks that might be used for formatting
    cleaned = cleaned.replace(/\*\*/g, '');
    
    // Remove any markdown-style headers
    cleaned = cleaned.replace(/^#+\s+.*?\n/gm, '');
    
    // Trim any extra whitespace
    cleaned = cleaned.trim();
    
    return cleaned;
  }

  // Generate multiple variations for an AI marketing campaign
  async generateMultipleVariations(prompt, count = 3, modelId) {
    const variations = [];
    
    try {
      // Generate each variation separately to ensure clean, separate messages
      for (let i = 0; i < count; i++) {
        // Slightly modify the prompt for each variation to encourage diversity
        const variationPrompt = `${prompt}\n\nPlease create a unique WhatsApp marketing message for this campaign. This is variation ${i+1} of ${count}, so make it different from other variations.`;
        
        const variation = await this.generateMarketingMessage(variationPrompt, modelId);
        variations.push(variation);
      }
    } catch (error) {
      console.error('Error generating variations:', error);
      // If we failed to generate variations, return a default message
      variations.push(`We couldn't generate marketing variations. Please try again or check network connectivity.`);
    }
    
    return variations;
  }
}

module.exports = AIService;