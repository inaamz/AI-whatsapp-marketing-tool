# WhatsApp Marketing Tool

A desktop application for automated WhatsApp marketing campaigns with AI-powered message generation and anti-ban measures.
OPENROUTER API KEY REQUIRED FOR AI CAMPAIGNS


<a href="https://ibb.co/4RnBsj3h"><img src="https://i.ibb.co/9HkRwqSQ/image.png" alt="image" border="0"></a>
<br>
<a href="https://ibb.co/ynPJLf2b"><img src="https://i.ibb.co/RpbWLv8V/image.png" alt="image" border="0"></a>
<br>
<a href="https://ibb.co/Ng9n201S"><img src="https://i.ibb.co/Kc2zxtNw/image.png" alt="image" border="0"></a>
<br>
<a href="https://ibb.co/m56jMhyX"><img src="https://i.ibb.co/tp8GWY2x/image.png" alt="image" border="0"></a>
<br>
<a href="https://ibb.co/NgtbWVTT"><img src="https://i.ibb.co/ymd7gf44/image.png" alt="image" border="0"></a>
<br>
<a href="https://ibb.co/39w7B9QK"><img src="https://i.ibb.co/q3zdk3V6/image.png" alt="image" border="0"></a>

## Features

- **WhatsApp Integration**: Connect via QR code scanning, real-time status updates, attachment support
- **Contact Management**: Import contacts from Excel/CSV, track message delivery status
- **AI Message Generation**: Integration with OpenRouter API, multiple AI models for variety
- **Campaign Automation**: Batch processing with configurable delays, human-like messaging patterns
- **Anti-Ban Measures**: Random delays, message variations, typing indicators, daily limits

## Prerequisites

- Node.js (v14+)
- npm or yarn
- Electron

## Installation
1. Clone this repository
2. Run `npm install`
3. Start with `npm start`

## Usage

1. **Connect WhatsApp**: Launch the app and scan the QR code with your WhatsApp mobile app
2. **Import Contacts**: Upload your contacts from CSV/Excel files
3. **Create Messages**: Type your message or use AI to generate variations
4. **Configure Campaign**: Set up anti-ban measures and campaign settings
5. **Launch Campaign**: Start the automated messaging campaign
6. **OpenRouter**: Create free account on OpenRouter and get free API

## Project Structure

- `main.js` - Main Electron process
- `index.html` - Application UI
- `css/styles.css` - UI styling
- `services/` - Core functionality
- `whatsapp-service.js` - WhatsApp Web integration
- `contact-service.js` - Contact management
- `campaign-service.js` - Automated campaign processing
- `ai-service.js` - AI integration with OpenRouter

## Anti-Ban Features

To minimize the risk of WhatsApp banning your account:

- **Variable Delays**: Random waits between messages
- **Human Typing Simulation**: Natural typing speed based on message length
- **Message Variations**: Random minor changes in wording and punctuation
- **Batch Processing**: Messages sent in small batches with longer breaks between
- **Daily Limits**: Configurable maximum messages per day

## OpenRouter AI Integration

This tool uses OpenRouter's API to access multiple AI models for message generation:
- Google Gemini models
- Qwen models
- Meta Llama models
- DeepSeek models

## Disclaimer

This tool is for educational purposes only. Users are responsible for complying with WhatsApp's terms of service. Mass messaging may violate WhatsApp's policies and could result in account bans. Use responsibly and at your own risk.

## License

[MIT License](LICENSE)
