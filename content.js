// Content script for TubeGPT
// Handles transcript extraction and video seeking

console.log('[TubeGPT] Content script starting...');

(function() {
  'use strict';

  console.log('[TubeGPT] Content script loaded on:', window.location.href);

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getTranscript') {
      getTranscript().then(sendResponse);
      return true; // Keep channel open for async response
    }
    
    if (request.action === 'seekVideo') {
      seekVideo(request.time);
      sendResponse({ success: true });
    }
    
    if (request.action === 'getVideoInfo') {
      const info = getVideoInfo();
      sendResponse(info);
    }
  });

  // Get video information
  function getVideoInfo() {
    const titleEl = document.querySelector('h1.ytd-video-primary-info-renderer, h1.ytd-watch-metadata yt-formatted-string');
    const title = titleEl?.textContent?.trim() || document.title.replace(' - YouTube', '');
    
    const durationEl = document.querySelector('.ytp-time-duration');
    const duration = durationEl?.textContent || '';
    
    const videoId = new URLSearchParams(window.location.search).get('v');
    
    return { title, duration, videoId };
  }

  // Extract transcript using multiple methods
  async function getTranscript() {
    try {
      // Method 1: Try YouTube's internal player response
      let transcript = await tryPlayerResponse();
      if (transcript) return { success: true, transcript };

      // Method 2: Try timedtext API
      transcript = await tryTimedTextApi();
      if (transcript) return { success: true, transcript };

      // Method 3: Try scraping transcript panel
      transcript = await tryTranscriptPanel();
      if (transcript) return { success: true, transcript };

      return { success: false, error: 'No transcript available for this video' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Method 1: Use YouTube's internal player response
  async function tryPlayerResponse() {
    try {
      const playerResponse = await getPlayerResponse();
      
      if (!playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks) {
        return null;
      }

      const tracks = playerResponse.captions.playerCaptionsTracklistRenderer.captionTracks;
      
      // Prefer English, then auto-generated, then first available
      const track = tracks.find(t => t.languageCode === 'en' && !t.kind) ||
                    tracks.find(t => t.languageCode === 'en') ||
                    tracks[0];

      if (!track?.baseUrl) return null;

      const response = await fetch(track.baseUrl);
      if (!response.ok) return null;
      
      const xml = await response.text();
      if (!xml.includes('<text')) return null;
      
      return parseTranscriptXml(xml);
    } catch (error) {
      console.error('tryPlayerResponse error:', error);
      return null;
    }
  }

  // Method 2: Use timedtext API
  async function tryTimedTextApi() {
    try {
      const videoId = new URLSearchParams(window.location.search).get('v');
      if (!videoId) return null;
      
      // Try to get caption tracks from the page
      const playerResponse = await getPlayerResponse();
      if (playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks) {
        const tracks = playerResponse.captions.playerCaptionsTracklistRenderer.captionTracks;
        const track = tracks.find(t => t.languageCode === 'en' && !t.kind) ||
                      tracks.find(t => t.languageCode === 'en') ||
                      tracks[0];
        
        if (track?.baseUrl) {
          const response = await fetch(track.baseUrl);
          if (response.ok) {
            const xml = await response.text();
            if (xml.includes('<text')) {
              return parseTranscriptXml(xml);
            }
          }
        }
      }

      return null;
    } catch (error) {
      console.error('tryTimedTextApi error:', error);
      return null;
    }
  }
  
  // Get player response from page
  async function getPlayerResponse() {
    // Try window variable first
    if (window.ytInitialPlayerResponse) {
      return window.ytInitialPlayerResponse;
    }
    
    // Try to extract from page scripts
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      const text = script.textContent || '';
      if (text.includes('ytInitialPlayerResponse')) {
        const match = text.match(/ytInitialPlayerResponse\s*=\s*({.+?});/s);
        if (match) {
          try {
            return JSON.parse(match[1]);
          } catch (e) {
            continue;
          }
        }
      }
    }
    
    return null;
  }

  // Method 3: Scrape transcript panel
  async function tryTranscriptPanel() {
    try {
      // Look for transcript button
      const transcriptButton = document.querySelector(
        'button[aria-label="Show transcript"], ' +
        'ytd-button-renderer:has([aria-label*="transcript" i])'
      );
      
      if (!transcriptButton) return null;

      // Click to open transcript
      transcriptButton.click();
      await waitFor(1500);

      // Try to find transcript segments
      const transcriptItems = document.querySelectorAll(
        'ytd-transcript-segment-renderer, ' +
        'ytd-transcript-segment-list-renderer ytd-transcript-segment-renderer'
      );

      if (transcriptItems.length === 0) {
        // Try closing if we opened it
        transcriptButton.click();
        return null;
      }

      const transcript = Array.from(transcriptItems).map(item => {
        const timestampEl = item.querySelector('.segment-timestamp, [class*="timestamp"]');
        const textEl = item.querySelector('.segment-text, [class*="text"]');
        
        const timestamp = timestampEl?.textContent?.trim() || '0:00';
        const text = textEl?.textContent?.trim() || '';
        
        return {
          text,
          start: parseTimestamp(timestamp),
          duration: 0
        };
      }).filter(item => item.text);

      // Close transcript panel
      const closeButton = document.querySelector(
        'ytd-engagement-panel-section-list-renderer button[aria-label="Close transcript"]'
      );
      if (closeButton) {
        closeButton.click();
      } else {
        transcriptButton.click();
      }

      return transcript.length > 0 ? transcript : null;
    } catch (error) {
      console.error('tryTranscriptPanel error:', error);
      return null;
    }
  }

  // Parse XML transcript format
  function parseTranscriptXml(xml) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    const texts = doc.querySelectorAll('text');

    return Array.from(texts).map(text => ({
      text: decodeHtmlEntities(text.textContent || ''),
      start: parseFloat(text.getAttribute('start') || '0'),
      duration: parseFloat(text.getAttribute('dur') || '0')
    })).filter(item => item.text.trim());
  }

  // Parse timestamp string to seconds
  function parseTimestamp(timestamp) {
    const parts = timestamp.split(':').map(Number);
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return 0;
  }

  // Decode HTML entities
  function decodeHtmlEntities(text) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
  }

  // Seek video to specific time
  function seekVideo(seconds) {
    const video = document.querySelector('video');
    if (video) {
      video.currentTime = seconds;
      // Try to play if paused
      if (video.paused) {
        video.play().catch(() => {});
      }
    }
  }

  // Wait helper
  function waitFor(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ===== Floating Screenshot Button (Always Visible) =====
  function injectStyles() {
    if (document.getElementById('tubegpt-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'tubegpt-styles';
    style.textContent = `
      #tubegpt-screenshot-btn {
        position: absolute;
        top: 12px;
        right: 12px;
        z-index: 2147483647;
        width: 44px;
        height: 44px;
        border: none;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.75);
        color: white;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        opacity: 0;
        pointer-events: none;
      }
      
      #tubegpt-screenshot-btn:hover {
        background: #6366f1;
        transform: scale(1.1);
      }
      
      #tubegpt-screenshot-btn:active {
        transform: scale(0.95);
      }
      
      #tubegpt-screenshot-btn svg {
        width: 22px;
        height: 22px;
      }
      
      /* Show button when hovering over player */
      #movie_player:hover #tubegpt-screenshot-btn,
      .html5-video-player:hover #tubegpt-screenshot-btn {
        opacity: 1;
        pointer-events: auto;
      }
      
      /* Keep visible when hovering the button itself */
      #tubegpt-screenshot-btn:hover {
        opacity: 1 !important;
        pointer-events: auto !important;
      }
      
      @keyframes tubegpt-pulse {
        0% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.7); }
        70% { box-shadow: 0 0 0 10px rgba(99, 102, 241, 0); }
        100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
      }
      
      @keyframes tubegpt-slide-up {
        from { opacity: 0; transform: translateX(-50%) translateY(20px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
      
      #tubegpt-toast {
        position: fixed;
        bottom: 100px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 2147483647;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 20px;
        background: #10b981;
        color: white;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        font-weight: 500;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: tubegpt-slide-up 0.3s ease;
      }
      
      #tubegpt-toast.error {
        background: #ef4444;
      }
    `;
    document.head.appendChild(style);
  }
  
  function createFloatingButton() {
    // Check if already exists
    if (document.getElementById('tubegpt-screenshot-btn')) {
      return;
    }
    
    // Find YouTube player
    const player = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
    if (!player) {
      // Retry after a short delay
      setTimeout(createFloatingButton, 500);
      return;
    }

    // Inject styles first
    injectStyles();

    // Create button
    const btn = document.createElement('button');
    btn.id = 'tubegpt-screenshot-btn';
    btn.title = 'Take Screenshot (TubeGPT)';
    btn.setAttribute('aria-label', 'Take Screenshot');
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
        <circle cx="12" cy="13" r="4"/>
      </svg>
    `;

    // Click handler
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Visual feedback
      btn.style.animation = 'tubegpt-pulse 0.5s ease';
      setTimeout(() => btn.style.animation = '', 500);
      
      const result = await captureAndSaveScreenshot();
      showFloatingToast(result.success ? 'Screenshot saved!' : 'Failed to capture', !result.success);
    });

    // Ensure player has position for absolute child
    const playerStyle = window.getComputedStyle(player);
    if (playerStyle.position === 'static') {
      player.style.position = 'relative';
    }
    
    player.appendChild(btn);
    console.log('[TubeGPT] Screenshot button added to player');
  }

  // Capture and save screenshot
  async function captureAndSaveScreenshot() {
    try {
      const video = document.querySelector('video');
      if (!video) {
        return { success: false, error: 'No video found' };
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const dataUrl = canvas.toDataURL('image/png');
      const timestamp = video.currentTime;
      const videoId = new URLSearchParams(window.location.search).get('v');
      const videoTitle = document.title.replace(' - YouTube', '');
      
      const screenshot = {
        id: Date.now(),
        dataUrl,
        timestamp,
        videoId,
        videoTitle,
        createdAt: Date.now()
      };
      
      // Save to storage
      const stored = await chrome.storage.local.get(['screenshots']);
      let screenshots = stored.screenshots || [];
      screenshots.push(screenshot);
      
      // Keep only last 100
      if (screenshots.length > 100) {
        screenshots = screenshots.slice(-100);
      }
      
      await chrome.storage.local.set({ screenshots });
      
      return { success: true };
    } catch (error) {
      console.error('[TubeGPT] Screenshot error:', error);
      return { success: false, error: error.message };
    }
  }

  // Show floating toast notification
  function showFloatingToast(message, isError = false) {
    // Remove existing toast
    const existing = document.getElementById('tubegpt-toast');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.id = 'tubegpt-toast';
    if (isError) toast.classList.add('error');
    toast.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        ${isError 
          ? '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'
          : '<polyline points="20,6 9,17 4,12"/>'
        }
      </svg>
      <span>${message}</span>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  // Initialize floating button
  function initFloatingButton() {
    if (window.location.pathname === '/watch') {
      // Small delay to let YouTube's player initialize
      setTimeout(createFloatingButton, 1000);
    }
  }

  // Clean up button when leaving video page
  function removeFloatingButton() {
    const btn = document.getElementById('tubegpt-screenshot-btn');
    if (btn) btn.remove();
  }

  // Watch for navigation (YouTube is SPA)
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      removeFloatingButton();
      initFloatingButton();
    }
  }).observe(document.body, { subtree: true, childList: true });

  // Initial load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFloatingButton);
  } else {
    initFloatingButton();
  }

  console.log('[TubeGPT] Content script initialized');
})();
