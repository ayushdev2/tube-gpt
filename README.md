# TubeGPT 🎬

A modern Chrome extension that lets you ask questions about YouTube videos using AI-powered transcript analysis.

![TubeGPT](https://img.shields.io/badge/Chrome-Extension-green?logo=googlechrome)
![Gemini](https://img.shields.io/badge/Powered%20by-Gemini-blue?logo=google)

## Demo

[![Watch Demo](https://img.shields.io/badge/▶️_Watch_Demo-Google_Drive-4285F4?style=for-the-badge&logo=googledrive&logoColor=white)](https://drive.google.com/file/d/1jSOkq6owIjoJ3fn_sJByF-WIrVpg0f2U/view?usp=sharing)

<a href="https://drive.google.com/file/d/1jSOkq6owIjoJ3fn_sJByF-WIrVpg0f2U/view?usp=sharing">
  <img src="https://drive.google.com/thumbnail?id=1jSOkq6owIjoJ3fn_sJByF-WIrVpg0f2U&sz=w1000" alt="TubeGPT Demo" width="600">
</a>

## Features

✨ **Smart Q&A** - Ask any question about the video content and get accurate answers  
🕐 **Clickable Timestamps** - Jump to any referenced moment in the video  
📜 **Auto Transcript Extraction** - Automatically pulls transcripts from YouTube videos  
📚 **History Panel** - Keep track of your previous questions and answers  
🔐 **Secure** - Your API key is stored locally and never shared  
🎨 **Modern UI** - Clean, minimal design that feels like a research tool

## Screenshots

| API Key Setup | Main Interface | Answer with Timestamps |
|---------------|----------------|------------------------|
| Enter your Gemini API key | Load transcript and ask questions | Clickable timestamps in answers |

## Installation

### From Source (Developer Mode)

1. Clone this repository:
   ```bash
   git clone https://github.com/ayushdev2/tube-gpt.git
   cd tube-gpt
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable **Developer mode** (toggle in top right)

4. Click **Load unpacked** and select the `tube-gpt` folder

5. The TubeGPT icon will appear in your extensions toolbar

## Setup

1. **Get a Gemini API Key** (free):
   - Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
   - Click "Create API Key"
   - Copy your new API key

2. **Add your API Key**:
   - Click the TubeGPT extension icon
   - Click the settings (⚙️) icon or "Add API Key" button
   - Paste your API key and click "Save"

## Usage

1. Navigate to any YouTube video
2. Click the TubeGPT extension icon
3. Click **"Load Transcript"** to extract the video's captions
4. Type your question in the input box
5. Press Enter or click the send button
6. Click any timestamp in the answer to jump to that moment!

## Project Structure

```
tube-gpt/
├── manifest.json         # Chrome extension manifest (v3)
├── background.js         # Service worker for API calls
├── content.js            # YouTube page interaction
├── popup/
│   ├── popup.html        # Extension popup UI
│   ├── popup.css         # Styles
│   └── popup.js          # Popup logic
├── icons/
│   ├── icon16.png        # Toolbar icon
│   ├── icon48.png        # Extension page icon
│   └── icon128.png       # Chrome Web Store icon
└── README.md
```

## UI States

The extension handles multiple states gracefully:

- **Missing API Key** - Prompts user to add their Gemini API key
- **Not on YouTube** - Shows message when not on a YouTube video page
- **Ready** - Main interface with video info card
- **Loading Transcript** - Spinner while extracting captions
- **Transcript Error** - Clear error message with retry option
- **Loading Answer** - Spinner while waiting for AI response
- **Answer Display** - Formatted response with clickable timestamps

## Tech Stack

- **Chrome Extension Manifest V3**
- **Vanilla JavaScript** (no frameworks)
- **Google Gemini 1.5 Flash API**
- **YouTube Transcript API** (built-in extraction)

## Privacy

- Your API key is stored locally in Chrome's storage
- Transcripts are sent to Gemini API only when you ask a question
- No data is collected or sent to third parties
- All processing happens through Google's official APIs

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this project however you'd like.

---

Made with ❤️ for YouTube researchers and learners