# TubeGPT 🎬

A modern Chrome extension that lets you ask questions about YouTube videos using AI-powered transcript analysis.

![TubeGPT](https://img.shields.io/badge/Chrome-Extension-green?logo=googlechrome)
![Gemini](https://img.shields.io/badge/Powered%20by-Gemini%202.0-blue?logo=google)

## Demo

[![Watch Demo](https://img.shields.io/badge/▶️_Watch_Demo-Google_Drive-4285F4?style=for-the-badge&logo=googledrive&logoColor=white)](https://drive.google.com/file/d/1jSOkq6owIjoJ3fn_sJByF-WIrVpg0f2U/view?usp=sharing)

<a href="https://drive.google.com/file/d/1jSOkq6owIjoJ3fn_sJByF-WIrVpg0f2U/view?usp=sharing">
  <img src="https://drive.google.com/thumbnail?id=1jSOkq6owIjoJ3fn_sJByF-WIrVpg0f2U&sz=w1000" alt="TubeGPT Demo" width="600">
</a>

## Features

### 🤖 AI-Powered Learning
- **Smart Q&A** - Ask any question about the video content and get accurate answers
- **Clickable Timestamps** - Jump to any referenced moment in the video
- **What to Watch Next** - AI recommends personalized learning paths based on your questions

### 📸 Screenshot & Study Tools
- **Floating Screenshot Button** - 📷 button on video player (works without opening popup)
- **Screenshot Gallery** - View, download, and manage all your captures
- **Play/Pause Controls** - Control video playback from the extension

### 📚 Organization
- **Auto Transcript Extraction** - Automatically pulls transcripts from YouTube videos
- **History Panel** - Keep track of your previous questions and answers
- **Export & Share** - Download screenshots for your notes

### 🔐 Privacy & Design
- **Secure** - Your API key is stored locally and never shared
- **Modern UI** - Clean, minimal design that feels like a research tool

## Screenshots

| Main Interface | Screenshot Button | What to Watch Next |
|----------------|-------------------|-------------------|
| Ask questions about videos | 📷 floating on video player | AI-powered recommendations |

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

### Ask Questions
1. Navigate to any YouTube video
2. Click the TubeGPT extension icon
3. Click **"Load Transcript"** to extract the video's captions
4. Type your question in the input box
5. Press Enter or click the send button
6. Click any timestamp in the answer to jump to that moment!

### Take Screenshots
- **Option 1**: Click the 📷 button floating on the YouTube video player
- **Option 2**: Open extension popup and click "Screenshot" button
- Access all screenshots from the gallery (📷 icon in header)

### Get Recommendations
1. Watch a video and ask some questions
2. Click the ▶| icon in the extension header
3. Click "Generate Recommendations"
4. Get personalized suggestions for what to learn next!

## Project Structure

```
tube-gpt/
├── manifest.json         # Chrome extension manifest (v3)
├── background.js         # Service worker for API calls
├── content.js            # YouTube page interaction & floating screenshot
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

## Tech Stack

- **Chrome Extension Manifest V3**
- **Vanilla JavaScript** (no frameworks)
- **Google Gemini 2.0 Flash API**
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