// ===== State Management =====
const state = {
  apiKey: null,
  transcript: null,
  videoInfo: null,
  currentVideoId: null,
  history: [],
  isOnYouTube: false,
};

// ===== DOM Elements =====
const elements = {
  // States
  apiKeyMissing: document.getElementById('apiKeyMissing'),
  notYouTube: document.getElementById('notYouTube'),
  readyState: document.getElementById('readyState'),
  
  // Settings
  settingsPanel: document.getElementById('settingsPanel'),
  settingsBtn: document.getElementById('settingsBtn'),
  backFromSettings: document.getElementById('backFromSettings'),
  openSettingsBtn: document.getElementById('openSettingsBtn'),
  apiKeyInput: document.getElementById('apiKeyInput'),
  saveApiKeyBtn: document.getElementById('saveApiKeyBtn'),
  toggleApiKeyVisibility: document.getElementById('toggleApiKeyVisibility'),
  apiKeySaved: document.getElementById('apiKeySaved'),
  clearHistoryBtn: document.getElementById('clearHistoryBtn'),
  
  // History
  historyPanel: document.getElementById('historyPanel'),
  historyBtn: document.getElementById('historyBtn'),
  backFromHistory: document.getElementById('backFromHistory'),
  historyList: document.getElementById('historyList'),
  emptyHistory: document.getElementById('emptyHistory'),
  
  // Video Info
  videoThumbnail: document.getElementById('videoThumbnail'),
  videoTitle: document.getElementById('videoTitle'),
  videoDuration: document.getElementById('videoDuration'),
  
  // Transcript
  transcriptStatus: document.getElementById('transcriptStatus'),
  loadTranscriptBtn: document.getElementById('loadTranscriptBtn'),
  loadingTranscript: document.getElementById('loadingTranscript'),
  transcriptError: document.getElementById('transcriptError'),
  errorMessage: document.getElementById('errorMessage'),
  retryTranscriptBtn: document.getElementById('retryTranscriptBtn'),
  
  // Question/Answer
  questionSection: document.getElementById('questionSection'),
  questionInput: document.getElementById('questionInput'),
  askBtn: document.getElementById('askBtn'),
  loadingAnswer: document.getElementById('loadingAnswer'),
  answerSection: document.getElementById('answerSection'),
  answerContent: document.getElementById('answerContent'),
  copyAnswerBtn: document.getElementById('copyAnswerBtn'),
};

// ===== Initialization =====
document.addEventListener('DOMContentLoaded', init);

async function init() {
  await loadState();
  setupEventListeners();
  await checkCurrentTab();
}

async function loadState() {
  const stored = await chrome.storage.local.get(['apiKey', 'history']);
  state.apiKey = stored.apiKey || null;
  state.history = stored.history || [];
}

// ===== Event Listeners =====
function setupEventListeners() {
  // Settings Panel
  elements.settingsBtn.addEventListener('click', openSettings);
  elements.openSettingsBtn.addEventListener('click', openSettings);
  elements.backFromSettings.addEventListener('click', closeSettings);
  elements.saveApiKeyBtn.addEventListener('click', saveApiKey);
  elements.toggleApiKeyVisibility.addEventListener('click', toggleApiKeyVisibility);
  elements.clearHistoryBtn.addEventListener('click', clearHistory);
  
  // History Panel
  elements.historyBtn.addEventListener('click', openHistory);
  elements.backFromHistory.addEventListener('click', closeHistory);
  
  // Transcript
  elements.loadTranscriptBtn.addEventListener('click', loadTranscript);
  elements.retryTranscriptBtn.addEventListener('click', loadTranscript);
  
  // Question/Answer
  elements.questionInput.addEventListener('input', handleQuestionInput);
  elements.questionInput.addEventListener('keydown', handleQuestionKeydown);
  elements.askBtn.addEventListener('click', askQuestion);
  elements.copyAnswerBtn.addEventListener('click', copyAnswer);
}

// ===== Tab & YouTube Detection =====
async function checkCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab?.url?.includes('youtube.com/watch')) {
      state.isOnYouTube = true;
      const videoId = getVideoIdFromUrl(tab.url);
      state.currentVideoId = videoId;
      
      await getVideoInfo(tab);
      showMainInterface();
    } else {
      state.isOnYouTube = false;
      showNotYouTubeState();
    }
  } catch (error) {
    console.error('Error checking tab:', error);
    showNotYouTubeState();
  }
}

function getVideoIdFromUrl(url) {
  const urlParams = new URLSearchParams(new URL(url).search);
  return urlParams.get('v');
}

async function getVideoInfo(tab) {
  try {
    // Get video info from the page
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const titleEl = document.querySelector('h1.ytd-video-primary-info-renderer, h1.ytd-watch-metadata');
        const title = titleEl?.textContent?.trim() || document.title.replace(' - YouTube', '');
        const durationEl = document.querySelector('.ytp-time-duration');
        const duration = durationEl?.textContent || '';
        return { title, duration };
      }
    });
    
    if (results?.[0]?.result) {
      state.videoInfo = results[0].result;
      updateVideoCard();
    }
  } catch (error) {
    console.error('Error getting video info:', error);
    state.videoInfo = { title: 'YouTube Video', duration: '' };
    updateVideoCard();
  }
}

function updateVideoCard() {
  if (state.currentVideoId) {
    elements.videoThumbnail.src = `https://i.ytimg.com/vi/${state.currentVideoId}/mqdefault.jpg`;
  }
  elements.videoTitle.textContent = state.videoInfo?.title || 'Loading...';
  elements.videoDuration.textContent = state.videoInfo?.duration || '';
}

// ===== UI State Management =====
function showMainInterface() {
  if (!state.apiKey) {
    showApiKeyMissingState();
    return;
  }
  
  hideAllStates();
  elements.readyState.classList.remove('hidden');
}

function showApiKeyMissingState() {
  hideAllStates();
  elements.apiKeyMissing.classList.remove('hidden');
}

function showNotYouTubeState() {
  if (!state.apiKey) {
    showApiKeyMissingState();
    return;
  }
  
  hideAllStates();
  elements.notYouTube.classList.remove('hidden');
}

function hideAllStates() {
  elements.apiKeyMissing.classList.add('hidden');
  elements.notYouTube.classList.add('hidden');
  elements.readyState.classList.add('hidden');
}

// ===== Settings =====
function openSettings() {
  elements.settingsPanel.classList.remove('hidden');
  if (state.apiKey) {
    elements.apiKeyInput.value = state.apiKey;
  }
}

function closeSettings() {
  elements.settingsPanel.classList.add('hidden');
  elements.apiKeySaved.classList.add('hidden');
  
  // Refresh UI state
  if (state.isOnYouTube) {
    showMainInterface();
  } else {
    showNotYouTubeState();
  }
}

async function saveApiKey() {
  const apiKey = elements.apiKeyInput.value.trim();
  
  if (!apiKey) {
    return;
  }
  
  state.apiKey = apiKey;
  await chrome.storage.local.set({ apiKey });
  
  // Show success toast
  elements.apiKeySaved.classList.remove('hidden');
  setTimeout(() => {
    elements.apiKeySaved.classList.add('hidden');
  }, 2000);
}

function toggleApiKeyVisibility() {
  const input = elements.apiKeyInput;
  const eyeIcon = document.getElementById('eyeIcon');
  
  if (input.type === 'password') {
    input.type = 'text';
    eyeIcon.innerHTML = `
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    `;
  } else {
    input.type = 'password';
    eyeIcon.innerHTML = `
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    `;
  }
}

// ===== History =====
function openHistory() {
  elements.historyPanel.classList.remove('hidden');
  renderHistory();
}

function closeHistory() {
  elements.historyPanel.classList.add('hidden');
}

function renderHistory() {
  if (state.history.length === 0) {
    elements.historyList.classList.add('hidden');
    elements.emptyHistory.classList.remove('hidden');
    return;
  }
  
  elements.emptyHistory.classList.add('hidden');
  elements.historyList.classList.remove('hidden');
  
  elements.historyList.innerHTML = state.history
    .slice()
    .reverse()
    .map((item, index) => `
      <div class="history-item" data-index="${state.history.length - 1 - index}">
        <div class="history-question">${escapeHtml(item.question)}</div>
        <div class="history-meta">
          <span class="history-video-title">${escapeHtml(item.videoTitle)}</span>
          <span>${formatDate(item.timestamp)}</span>
        </div>
      </div>
    `)
    .join('');
  
  // Add click handlers
  elements.historyList.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', () => {
      const index = parseInt(item.dataset.index);
      loadHistoryItem(index);
    });
  });
}

function loadHistoryItem(index) {
  const item = state.history[index];
  if (item) {
    closeHistory();
    elements.questionInput.value = item.question;
    elements.answerContent.innerHTML = formatAnswer(item.answer);
    elements.answerSection.classList.remove('hidden');
    handleQuestionInput();
  }
}

async function clearHistory() {
  state.history = [];
  await chrome.storage.local.set({ history: [] });
  renderHistory();
}

// ===== Transcript =====
async function loadTranscript() {
  // Show loading state
  elements.loadTranscriptBtn.classList.add('hidden');
  elements.transcriptError.classList.add('hidden');
  elements.loadingTranscript.classList.remove('hidden');
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Execute content script to get transcript
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractTranscript
    });
    
    if (results?.[0]?.result?.success) {
      state.transcript = results[0].result.transcript;
      showTranscriptLoaded();
    } else {
      throw new Error(results?.[0]?.result?.error || 'Failed to extract transcript');
    }
  } catch (error) {
    console.error('Error loading transcript:', error);
    showTranscriptError(error.message);
  }
}

function showTranscriptLoaded() {
  elements.loadingTranscript.classList.add('hidden');
  elements.transcriptError.classList.add('hidden');
  elements.loadTranscriptBtn.classList.add('hidden');
  
  // Update status
  const statusDot = elements.transcriptStatus.querySelector('.status-dot');
  const statusText = elements.transcriptStatus.querySelector('.status-text');
  statusDot.classList.add('loaded');
  statusText.textContent = 'Transcript loaded';
  
  // Show question section
  elements.questionSection.classList.remove('hidden');
}

function showTranscriptError(message) {
  elements.loadingTranscript.classList.add('hidden');
  elements.loadTranscriptBtn.classList.remove('hidden');
  elements.transcriptError.classList.remove('hidden');
  elements.errorMessage.textContent = message || 'This video may not have captions enabled.';
  
  // Update status
  const statusDot = elements.transcriptStatus.querySelector('.status-dot');
  const statusText = elements.transcriptStatus.querySelector('.status-text');
  statusDot.classList.add('error');
  statusText.textContent = 'Transcript failed';
}

// Transcript extraction function (runs in page context)
function extractTranscript() {
  return new Promise(async (resolve) => {
    try {
      // Method 1: Try to get from YouTube's internal data
      const ytInitialPlayerResponse = window.ytInitialPlayerResponse;
      
      if (ytInitialPlayerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks) {
        const tracks = ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer.captionTracks;
        const track = tracks.find(t => t.languageCode === 'en') || tracks[0];
        
        if (track?.baseUrl) {
          const response = await fetch(track.baseUrl);
          const xml = await response.text();
          const transcript = parseTranscriptXml(xml);
          resolve({ success: true, transcript });
          return;
        }
      }
      
      // Method 2: Try to get from timedtext API
      const videoId = new URLSearchParams(window.location.search).get('v');
      const apiUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=json3`;
      
      const response = await fetch(apiUrl);
      if (response.ok) {
        const data = await response.json();
        if (data.events) {
          const transcript = data.events
            .filter(e => e.segs)
            .map(e => ({
              text: e.segs.map(s => s.utf8).join(''),
              start: e.tStartMs / 1000,
              duration: e.dDurationMs / 1000
            }));
          resolve({ success: true, transcript });
          return;
        }
      }
      
      // Method 3: Try to scrape from transcript panel
      const transcriptButton = document.querySelector('[aria-label="Show transcript"]');
      if (transcriptButton) {
        transcriptButton.click();
        await new Promise(r => setTimeout(r, 1000));
        
        const transcriptItems = document.querySelectorAll('ytd-transcript-segment-renderer');
        if (transcriptItems.length > 0) {
          const transcript = Array.from(transcriptItems).map(item => {
            const timestamp = item.querySelector('.segment-timestamp')?.textContent?.trim() || '0:00';
            const text = item.querySelector('.segment-text')?.textContent?.trim() || '';
            return {
              text,
              start: parseTimestamp(timestamp),
              duration: 0
            };
          });
          
          // Close transcript panel
          transcriptButton.click();
          
          resolve({ success: true, transcript });
          return;
        }
      }
      
      resolve({ success: false, error: 'No transcript available for this video' });
    } catch (error) {
      resolve({ success: false, error: error.message });
    }
  });
  
  function parseTranscriptXml(xml) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    const texts = doc.querySelectorAll('text');
    
    return Array.from(texts).map(text => ({
      text: text.textContent?.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"') || '',
      start: parseFloat(text.getAttribute('start') || '0'),
      duration: parseFloat(text.getAttribute('dur') || '0')
    }));
  }
  
  function parseTimestamp(timestamp) {
    const parts = timestamp.split(':').map(Number);
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return 0;
  }
}

// ===== Question & Answer =====
function handleQuestionInput() {
  const hasText = elements.questionInput.value.trim().length > 0;
  elements.askBtn.disabled = !hasText;
}

function handleQuestionKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!elements.askBtn.disabled) {
      askQuestion();
    }
  }
}

async function askQuestion() {
  const question = elements.questionInput.value.trim();
  if (!question || !state.transcript) return;
  
  // Show loading
  elements.loadingAnswer.classList.remove('hidden');
  elements.answerSection.classList.add('hidden');
  elements.askBtn.disabled = true;
  
  try {
    const answer = await callGeminiApi(question);
    
    // Display answer
    elements.answerContent.innerHTML = formatAnswer(answer);
    elements.answerSection.classList.remove('hidden');
    
    // Setup timestamp click handlers
    setupTimestampHandlers();
    
    // Save to history
    await addToHistory(question, answer);
    
  } catch (error) {
    console.error('Error asking question:', error);
    elements.answerContent.innerHTML = `<p style="color: var(--danger);">Error: ${escapeHtml(error.message)}</p>`;
    elements.answerSection.classList.remove('hidden');
  } finally {
    elements.loadingAnswer.classList.add('hidden');
    elements.askBtn.disabled = false;
  }
}

async function callGeminiApi(question) {
  if (!state.apiKey) {
    throw new Error('API key not set');
  }
  
  // Format transcript for the prompt
  const transcriptText = state.transcript
    .map(item => `[${formatTimestamp(item.start)}] ${item.text}`)
    .join('\n');
  
  const prompt = `You are analyzing a YouTube video transcript. Answer the user's question based ONLY on the information in the transcript below.

IMPORTANT RULES:
1. Only use information from the transcript
2. Include relevant timestamps in your answer using the format [MM:SS] or [HH:MM:SS]
3. If the information is not in the transcript, say so
4. Be concise and direct
5. Quote relevant parts when helpful

TRANSCRIPT:
${transcriptText}

USER QUESTION: ${question}

Please provide a helpful answer with timestamps where relevant:`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${state.apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024,
      }
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'API request failed');
  }
  
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated';
}

function formatAnswer(text) {
  // Escape HTML first
  let formatted = escapeHtml(text);
  
  // Convert timestamps to clickable links
  // Match [MM:SS] or [HH:MM:SS] or MM:SS or HH:MM:SS patterns
  formatted = formatted.replace(/\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?/g, (match, timestamp) => {
    const seconds = parseTimestampToSeconds(timestamp);
    return `<span class="timestamp" data-time="${seconds}">${timestamp}</span>`;
  });
  
  // Convert line breaks to paragraphs
  formatted = formatted
    .split('\n\n')
    .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
  
  return formatted;
}

function parseTimestampToSeconds(timestamp) {
  const parts = timestamp.split(':').map(Number);
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
}

function formatTimestamp(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function setupTimestampHandlers() {
  elements.answerContent.querySelectorAll('.timestamp').forEach(el => {
    el.addEventListener('click', () => {
      const time = parseFloat(el.dataset.time);
      seekVideo(time);
    });
  });
}

async function seekVideo(seconds) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (time) => {
        const video = document.querySelector('video');
        if (video) {
          video.currentTime = time;
          video.play();
        }
      },
      args: [seconds]
    });
  } catch (error) {
    console.error('Error seeking video:', error);
  }
}

async function copyAnswer() {
  const text = elements.answerContent.innerText;
  
  try {
    await navigator.clipboard.writeText(text);
    
    // Show success state
    elements.copyAnswerBtn.classList.add('copy-success');
    setTimeout(() => {
      elements.copyAnswerBtn.classList.remove('copy-success');
    }, 1500);
  } catch (error) {
    console.error('Error copying:', error);
  }
}

// ===== History Management =====
async function addToHistory(question, answer) {
  const historyItem = {
    question,
    answer,
    videoId: state.currentVideoId,
    videoTitle: state.videoInfo?.title || 'Unknown Video',
    timestamp: Date.now()
  };
  
  state.history.push(historyItem);
  
  // Keep only last 50 items
  if (state.history.length > 50) {
    state.history = state.history.slice(-50);
  }
  
  await chrome.storage.local.set({ history: state.history });
}

// ===== Utilities =====
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  
  return date.toLocaleDateString();
}
