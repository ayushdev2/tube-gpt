// TubeGPT Content Script
// Handles transcript extraction and floating screenshot button

console.log('[TubeGPT] Content script loading...');

(function() {
  'use strict';

  // ===== Message Listener for Popup =====
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getTranscript') {
      getTranscript().then(sendResponse);
      return true;
    }
    if (request.action === 'seekVideo') {
      seekVideo(request.time);
      sendResponse({ success: true });
    }
    if (request.action === 'getVideoInfo') {
      sendResponse(getVideoInfo());
    }
  });

  // ===== Video Info =====
  function getVideoInfo() {
    const title = document.querySelector('h1.ytd-watch-metadata')?.textContent?.trim() 
      || document.title.replace(' - YouTube', '');
    const duration = document.querySelector('.ytp-time-duration')?.textContent || '';
    const videoId = new URLSearchParams(location.search).get('v');
    return { title, duration, videoId };
  }

  // ===== Transcript Extraction =====
  async function getTranscript() {
    try {
      const transcript = await tryPlayerResponse();
      if (transcript) return { success: true, transcript };
      return { success: false, error: 'No transcript available' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async function tryPlayerResponse() {
    const playerResponse = getPlayerResponse();
    if (!playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks) {
      return null;
    }

    const tracks = playerResponse.captions.playerCaptionsTracklistRenderer.captionTracks;
    const track = tracks.find(t => t.languageCode === 'en') || tracks[0];
    if (!track?.baseUrl) return null;

    const response = await fetch(track.baseUrl);
    if (!response.ok) return null;
    
    const xml = await response.text();
    return parseTranscriptXml(xml);
  }

  function getPlayerResponse() {
    if (window.ytInitialPlayerResponse) return window.ytInitialPlayerResponse;
    
    for (const script of document.querySelectorAll('script')) {
      const text = script.textContent || '';
      if (text.includes('ytInitialPlayerResponse')) {
        const match = text.match(/ytInitialPlayerResponse\s*=\s*({.+?});/s);
        if (match) {
          try { return JSON.parse(match[1]); } catch {}
        }
      }
    }
    return null;
  }

  function parseTranscriptXml(xml) {
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    return Array.from(doc.querySelectorAll('text')).map(t => ({
      text: t.textContent?.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n)) || '',
      start: parseFloat(t.getAttribute('start') || '0'),
      duration: parseFloat(t.getAttribute('dur') || '0')
    })).filter(t => t.text.trim());
  }

  function seekVideo(seconds) {
    const video = document.querySelector('video');
    if (video) {
      video.currentTime = seconds;
      video.play().catch(() => {});
    }
  }

  // ===== Floating Screenshot Button =====
  let retryCount = 0;
  
  function createScreenshotButton() {
    if (document.getElementById('tubegpt-ss-btn')) {
      console.log('[TubeGPT] Button already exists');
      return;
    }
    
    // Try multiple selectors
    const player = document.getElementById('movie_player') 
      || document.querySelector('.html5-video-player')
      || document.querySelector('#player-container-inner')
      || document.querySelector('ytd-player');
    
    if (!player) {
      retryCount++;
      console.log('[TubeGPT] Player not found, retry', retryCount);
      if (retryCount < 20) {
        setTimeout(createScreenshotButton, 500);
      }
      return;
    }

    console.log('[TubeGPT] Found player:', player.id || player.className);

    const btn = document.createElement('button');
    btn.id = 'tubegpt-ss-btn';
    btn.innerHTML = '📷';
    btn.title = 'Take Screenshot (TubeGPT)';
    
    // Inline styles for reliability
    btn.style.cssText = `
      position: absolute !important;
      top: 10px !important;
      right: 10px !important;
      z-index: 99999999 !important;
      width: 42px !important;
      height: 42px !important;
      font-size: 20px !important;
      border: none !important;
      border-radius: 50% !important;
      background: rgba(0,0,0,0.8) !important;
      cursor: pointer !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      box-shadow: 0 2px 10px rgba(0,0,0,0.5) !important;
      transition: transform 0.2s, background 0.2s !important;
    `;

    btn.onmouseenter = () => {
      btn.style.background = '#6366f1';
      btn.style.transform = 'scale(1.1)';
    };
    
    btn.onmouseleave = () => {
      btn.style.background = 'rgba(0,0,0,0.8)';
      btn.style.transform = 'scale(1)';
    };

    btn.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const originalText = btn.innerHTML;
      btn.innerHTML = '⏳';
      
      try {
        const video = document.querySelector('video');
        if (!video) {
          console.error('[TubeGPT] No video element found');
          throw new Error('No video found');
        }
        
        // Wait for video to have dimensions
        if (video.videoWidth === 0 || video.videoHeight === 0) {
          console.error('[TubeGPT] Video has no dimensions:', video.videoWidth, video.videoHeight);
          throw new Error('Video not ready');
        }
        
        console.log('[TubeGPT] Capturing video:', video.videoWidth, 'x', video.videoHeight);
        
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        let dataUrl;
        try {
          dataUrl = canvas.toDataURL('image/png');
        } catch (canvasErr) {
          console.error('[TubeGPT] Canvas toDataURL failed (CORS?):', canvasErr);
          throw new Error('Cannot capture - try refreshing the page');
        }
        
        const screenshot = {
          id: Date.now(),
          dataUrl: dataUrl,
          timestamp: video.currentTime,
          videoId: new URLSearchParams(location.search).get('v'),
          videoTitle: document.title.replace(' - YouTube', ''),
          createdAt: Date.now()
        };
        
        console.log('[TubeGPT] Saving screenshot, size:', dataUrl.length);
        
        const { screenshots = [] } = await chrome.storage.local.get('screenshots');
        screenshots.push(screenshot);
        if (screenshots.length > 100) screenshots.shift();
        await chrome.storage.local.set({ screenshots });
        
        console.log('[TubeGPT] Screenshot saved successfully');
        btn.innerHTML = '✅';
        showToast('Screenshot saved!');
        
      } catch (err) {
        console.error('[TubeGPT] Screenshot error:', err.message || err);
        btn.innerHTML = '❌';
        showToast(err.message || 'Failed to capture', true);
      }
      
      setTimeout(() => btn.innerHTML = originalText, 1500);
    };

    // Ensure player positioning
    if (getComputedStyle(player).position === 'static') {
      player.style.position = 'relative';
    }

    player.appendChild(btn);
    console.log('[TubeGPT] Screenshot button added');
  }

  function showToast(message, isError = false) {
    let toast = document.getElementById('tubegpt-toast');
    if (toast) toast.remove();
    
    toast = document.createElement('div');
    toast.id = 'tubegpt-toast';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed !important;
      bottom: 80px !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
      z-index: 99999999 !important;
      padding: 12px 24px !important;
      background: ${isError ? '#ef4444' : '#10b981'} !important;
      color: white !important;
      font-family: system-ui, sans-serif !important;
      font-size: 14px !important;
      font-weight: 500 !important;
      border-radius: 8px !important;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
    `;
    
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
  }

  // ===== Initialize =====
  function init() {
    console.log('[TubeGPT] Init called, path:', location.pathname);
    if (location.pathname === '/watch') {
      retryCount = 0;
      setTimeout(createScreenshotButton, 1000);
    }
  }

  // Watch for YouTube SPA navigation
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      document.getElementById('tubegpt-ss-btn')?.remove();
      init();
    }
  }).observe(document.body, { childList: true, subtree: true });

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  console.log('[TubeGPT] Content script ready');
})();
