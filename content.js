// Content script for TubeGPT
// Handles transcript extraction and video seeking

(function() {
  'use strict';

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

  // ===== Floating Screenshot Button in YouTube Controls =====
  let buttonRetryCount = 0;
  const MAX_RETRIES = 10;
  
  function createFloatingButton() {
    // Check if already exists
    if (document.getElementById('tubegpt-screenshot-btn')) {
      console.log('[TubeGPT] Screenshot button already exists');
      return;
    }
    
    // Find YouTube's right controls (where fullscreen button is)
    const rightControls = document.querySelector('.ytp-right-controls');
    if (!rightControls) {
      buttonRetryCount++;
      if (buttonRetryCount < MAX_RETRIES) {
        console.log('[TubeGPT] Waiting for controls... retry', buttonRetryCount);
        setTimeout(createFloatingButton, 1000);
      }
      return;
    }

    console.log('[TubeGPT] Found right controls, adding screenshot button');

    // Create button that matches YouTube's style
    const btn = document.createElement('button');
    btn.id = 'tubegpt-screenshot-btn';
    btn.className = 'ytp-button tubegpt-screenshot';
    btn.title = 'Take Screenshot (TubeGPT)';
    btn.setAttribute('aria-label', 'Take Screenshot');
    btn.innerHTML = `
      <svg height="100%" version="1.1" viewBox="0 0 36 36" width="100%">
        <path d="M12 8l2-3h8l2 3h5c1.1 0 2 .9 2 2v14c0 1.1-.9 2-2 2H7c-1.1 0-2-.9-2-2V10c0-1.1.9-2 2-2h5zm6 13c2.2 0 4-1.8 4-4s-1.8-4-4-4-4 1.8-4 4 1.8 4 4 4z" fill="#fff"/>
      </svg>
    `;
    
    // YouTube-like button styles
    btn.style.cssText = `
      width: 48px;
      height: 100%;
      border: none;
      background: transparent;
      cursor: pointer;
      display: inline-flex !important;
      align-items: center;
      justify-content: center;
      opacity: 0.9;
      transition: opacity 0.1s;
      vertical-align: top;
    `;

    // Hover effect
    btn.addEventListener('mouseenter', () => {
      btn.style.opacity = '1';
    });
    
    btn.addEventListener('mouseleave', () => {
      btn.style.opacity = '0.9';
    });

    // Click handler
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const result = await captureAndSaveScreenshot();
      if (result.success) {
        showFloatingToast('Screenshot saved!');
      } else {
        showFloatingToast('Failed to capture', true);
      }
    });

    // Insert before fullscreen button (first child of right controls)
    const fullscreenBtn = rightControls.querySelector('.ytp-fullscreen-button');
    if (fullscreenBtn) {
      rightControls.insertBefore(btn, fullscreenBtn);
    } else {
      rightControls.insertBefore(btn, rightControls.firstChild);
    }
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
      console.error('Screenshot error:', error);
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
    toast.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        ${isError 
          ? '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'
          : '<polyline points="20,6 9,17 4,12"/>'
        }
      </svg>
      <span>${message}</span>
    `;
    
    toast.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 99999;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 20px;
      background: ${isError ? '#ef4444' : '#10b981'};
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      animation: tubegpt-slide-up 0.3s ease;
    `;
    
    // Add animation keyframes
    if (!document.getElementById('tubegpt-styles')) {
      const style = document.createElement('style');
      style.id = 'tubegpt-styles';
      style.textContent = `
        @keyframes tubegpt-slide-up {
          from { opacity: 0; transform: translateX(-50%) translateY(20px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  // Initialize floating button when page loads
  function initFloatingButton() {
    if (window.location.pathname === '/watch') {
      createFloatingButton();
    }
  }

  // Watch for navigation (YouTube is SPA)
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(initFloatingButton, 1000);
    }
  }).observe(document.body, { subtree: true, childList: true });

  // Initial load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFloatingButton);
  } else {
    initFloatingButton();
  }

  // Notify that content script is ready
  console.log('TubeGPT content script loaded');
})();
