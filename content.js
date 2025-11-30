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
      const ytInitialPlayerResponse = window.ytInitialPlayerResponse;
      
      if (!ytInitialPlayerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks) {
        return null;
      }

      const tracks = ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer.captionTracks;
      
      // Prefer English, then auto-generated, then first available
      const track = tracks.find(t => t.languageCode === 'en' && !t.kind) ||
                    tracks.find(t => t.languageCode === 'en') ||
                    tracks[0];

      if (!track?.baseUrl) return null;

      const response = await fetch(track.baseUrl);
      const xml = await response.text();
      
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
      
      // Try JSON format first
      const jsonUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=json3`;
      let response = await fetch(jsonUrl);
      
      if (response.ok) {
        const data = await response.json();
        if (data.events) {
          return data.events
            .filter(e => e.segs)
            .map(e => ({
              text: e.segs.map(s => s.utf8 || '').join('').trim(),
              start: (e.tStartMs || 0) / 1000,
              duration: (e.dDurationMs || 0) / 1000
            }))
            .filter(item => item.text);
        }
      }

      // Try XML format
      const xmlUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en`;
      response = await fetch(xmlUrl);
      
      if (response.ok) {
        const xml = await response.text();
        if (xml.includes('<text')) {
          return parseTranscriptXml(xml);
        }
      }

      return null;
    } catch (error) {
      console.error('tryTimedTextApi error:', error);
      return null;
    }
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

  // Notify that content script is ready
  console.log('TubeGPT content script loaded');
})();
