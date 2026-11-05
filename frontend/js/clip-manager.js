/**
 * Virtual Music Studio - Advanced Audio Clip Engine
 * High-resolution waveform decoding, timeline clip operations (move, slip/trim, split, duplicate, fades, gain, loop),
 * audio file import (WAV, MP3, OGG), take-to-clip conversion, synchronized Web Audio playback, and IndexedDB persistence.
 */

class ClipManager {
  constructor() {
    this.clips = new Map(); // clipId -> Clip
    this.activeSourceNodes = []; // Array of active { source, gainNode, stop }
    this.selectedClipId = null;
    this.clipboardClip = null;
    this.pixelsPerSecond = 80;
  }

  init() {
    console.log('[ClipManager] Advanced Audio Clip Subsystem Initialized.');
  }

  /**
   * Imports an external audio file (WAV, MP3, OGG), decodes it to an AudioBuffer,
   * converts to persistent Base64, and places it as an audio clip on the target track.
   */
  async importAudioFile(file, trackId, startTimeMs = 0) {
    if (!file) return;
    await window.audioEngine.ensureContext();
    const ctx = window.audioEngine.ctx;

    try {
      const arrayBuffer = await file.arrayBuffer();
      // Decode audio
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
      // Convert to base64 for reliable IndexedDB storage
      const base64Data = this._arrayBufferToBase64(arrayBuffer);

      const durationMs = Math.round(audioBuffer.duration * 1000);
      const clipId = `clip_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

      const track = window.trackManager ? window.trackManager.tracks.find(t => t.id === trackId) : null;
      const color = track ? track.color : '#06B6D4';

      const clip = {
        id: clipId,
        trackId: trackId,
        name: file.name.replace(/\.[^/.]+$/, ''),
        startTimeMs: Math.max(0, startTimeMs),
        offsetMs: 0,
        durationMs: durationMs,
        sourceDurationMs: durationMs,
        gain: 1.0,
        fadeInMs: 50,
        fadeOutMs: 100,
        isLooping: false,
        color: color,
        audioBuffer: audioBuffer,
        audioData: base64Data, // Persisted in IndexedDB
        mimeType: file.type || 'audio/wav'
      };

      this.clips.set(clipId, clip);

      if (window.trackManager) window.trackManager.renderArrangerUI();

      if (window.app && typeof window.app.showToast === 'function') {
        window.app.showToast(`Imported audio clip: "${clip.name}" (${(durationMs / 1000).toFixed(1)}s)`);
      }

      return clip;
    } catch (err) {
      console.error('[ClipManager] Audio file decode failed:', err);
      alert('Failed to import audio file: ' + err.message);
    }
  }

  /**
   * Creates an audio clip from a recording engine take
   */
  async createClipFromTake(take, trackId, startTimeMs = 0) {
    if (!take) return;
    await window.audioEngine.ensureContext();
    const ctx = window.audioEngine.ctx;

    // If take has a recordedAudioBlob
    let audioBuffer = null;
    let base64Data = null;

    if (window.recordingEngine && window.recordingEngine.recordedAudioBlob) {
      try {
        const arrayBuffer = await window.recordingEngine.recordedAudioBlob.arrayBuffer();
        audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
        base64Data = this._arrayBufferToBase64(arrayBuffer);
      } catch (e) {
        console.warn('[ClipManager] Could not decode recorded blob, synthesizing preview buffer:', e);
      }
    }

    const durationMs = audioBuffer ? Math.round(audioBuffer.duration * 1000) : (take.durationSeconds * 1000 || 4000);
    const clipId = `clip_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const track = window.trackManager ? window.trackManager.tracks.find(t => t.id === trackId) : null;
    const color = track ? track.color : '#8B5CF6';

    const clip = {
      id: clipId,
      trackId: trackId,
      name: take.name || 'Recorded Take',
      startTimeMs: Math.max(0, startTimeMs),
      offsetMs: 0,
      durationMs: durationMs,
      sourceDurationMs: durationMs,
      gain: 1.0,
      fadeInMs: 30,
      fadeOutMs: 80,
      isLooping: false,
      color: color,
      audioBuffer: audioBuffer,
      audioData: base64Data
    };

    this.clips.set(clipId, clip);
    if (window.trackManager) window.trackManager.renderArrangerUI();
    return clip;
  }

  getClipsForTrack(trackId) {
    const list = [];
    for (const [id, clip] of this.clips.entries()) {
      if (clip.trackId === trackId) list.push(clip);
    }
    return list;
  }

  getClip(clipId) {
    return this.clips.get(clipId);
  }

  deleteClip(clipId) {
    this.clips.delete(clipId);
    if (this.selectedClipId === clipId) this.selectedClipId = null;
    if (window.trackManager) window.trackManager.renderArrangerUI();
  }

  duplicateClip(clipId) {
    const original = this.clips.get(clipId);
    if (!original) return;

    const newClip = {
      ...original,
      id: `clip_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: `${original.name} (Copy)`,
      startTimeMs: original.startTimeMs + original.durationMs + 250 // Place immediately after
    };

    this.clips.set(newClip.id, newClip);
    if (window.trackManager) window.trackManager.renderArrangerUI();
    return newClip;
  }

  splitClip(clipId, splitTimeMs) {
    const original = this.clips.get(clipId);
    if (!original) return;

    const clipStart = original.startTimeMs;
    const clipEnd = clipStart + original.durationMs;

    if (splitTimeMs <= clipStart + 100 || splitTimeMs >= clipEnd - 100) return;

    const firstDuration = splitTimeMs - clipStart;
    const secondDuration = clipEnd - splitTimeMs;
    const secondOffset = original.offsetMs + firstDuration;

    // Update first half
    original.durationMs = firstDuration;

    // Create second half
    const secondClip = {
      ...original,
      id: `clip_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: `${original.name} (Split)`,
      startTimeMs: splitTimeMs,
      offsetMs: secondOffset,
      durationMs: secondDuration
    };

    this.clips.set(secondClip.id, secondClip);
    if (window.trackManager) window.trackManager.renderArrangerUI();
  }

  /**
   * Renders the HTML clip block with true waveform Canvas
   */
  renderClipElement(clip) {
    const leftPx = (clip.startTimeMs / 1000) * this.pixelsPerSecond;
    const widthPx = Math.max(30, (clip.durationMs / 1000) * this.pixelsPerSecond);

    const clipEl = document.createElement('div');
    clipEl.className = `track-audio-clip ${this.selectedClipId === clip.id ? 'selected' : ''}`;
    clipEl.style.left = `${leftPx}px`;
    clipEl.style.width = `${widthPx}px`;
    clipEl.style.borderColor = clip.color || '#06B6D4';
    clipEl.dataset.clipId = clip.id;

    clipEl.innerHTML = `
      <!-- Left Trim Handle -->
      <div class="clip-trim-handle left" title="Slip / Trim Left Edge"></div>

      <!-- Header with Name, Gain, and Split Button -->
      <div class="clip-header-bar" style="background: ${clip.color || '#06B6D4'}">
        <span class="clip-title-text" title="${clip.name}">${clip.name}</span>
        <div style="display: flex; align-items: center; gap: 4px;">
          <span style="font-size: 8px; opacity: 0.85;">${(clip.durationMs / 1000).toFixed(2)}s</span>
          <button class="clip-quick-btn split-btn" title="Split clip at playhead">✂</button>
          <button class="clip-quick-btn del-btn" title="Delete clip">✕</button>
        </div>
      </div>

      <!-- Waveform Canvas -->
      <canvas class="clip-waveform-canvas" width="${Math.round(widthPx)}" height="48"></canvas>

      <!-- Right Trim Handle -->
      <div class="clip-trim-handle right" title="Trim Right Edge"></div>
    `;

    // Draw Waveform on canvas
    const canvas = clipEl.querySelector('.clip-waveform-canvas');
    if (canvas) {
      this._drawClipWaveform(clip, canvas);
    }

    // Interaction Bindings
    this._bindClipInteractions(clipEl, clip);

    return clipEl;
  }

  _drawClipWaveform(clip, canvas) {
    const ctx2d = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx2d.clearRect(0, 0, width, height);

    if (!clip.audioBuffer) {
      // Synthetic waveform fallback
      ctx2d.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx2d.fillRect(0, height / 2 - 1, width, 2);
      return;
    }

    const channelData = clip.audioBuffer.getChannelData(0);
    const sampleRate = clip.audioBuffer.sampleRate;
    const startSample = Math.floor((clip.offsetMs / 1000) * sampleRate);
    const totalSamples = Math.floor((clip.durationMs / 1000) * sampleRate);
    const endSample = Math.min(channelData.length, startSample + totalSamples);

    const step = Math.ceil((endSample - startSample) / width);
    const amp = height / 2;

    ctx2d.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx2d.strokeStyle = clip.color || '#06B6D4';
    ctx2d.lineWidth = 1;

    ctx2d.beginPath();
    ctx2d.moveTo(0, amp);

    for (let x = 0; x < width; x++) {
      const idx = startSample + (x * step);
      let min = 1.0;
      let max = -1.0;

      for (let j = 0; j < step && (idx + j) < endSample; j++) {
        const val = channelData[idx + j];
        if (val < min) min = val;
        if (val > max) max = val;
      }

      if (max < min) { min = 0; max = 0; }
      const yMin = (1 + min * clip.gain) * amp;
      const yMax = (1 + max * clip.gain) * amp;

      ctx2d.lineTo(x, yMin);
      ctx2d.lineTo(x, yMax);
    }

    ctx2d.stroke();
  }

  _bindClipInteractions(el, clip) {
    const leftHandle = el.querySelector('.clip-trim-handle.left');
    const rightHandle = el.querySelector('.clip-trim-handle.right');
    const splitBtn = el.querySelector('.split-btn');
    const delBtn = el.querySelector('.del-btn');

    // Select clip on click
    el.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('clip-trim-handle') || e.target.tagName === 'BUTTON') return;
      e.stopPropagation();
      this.selectedClipId = clip.id;
      document.querySelectorAll('.track-audio-clip').forEach(c => c.classList.remove('selected'));
      el.classList.add('selected');
      this._startClipMove(e, clip, el);
    });

    // Left Handle: Trim / Slip Start
    leftHandle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      this._startTrimLeft(e, clip, el);
    });

    // Right Handle: Trim Duration
    rightHandle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      this._startTrimRight(e, clip, el);
    });

    // Split at current playhead
    splitBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const playheadMs = (window.trackManager && window.trackManager.playheadPositionMs) || 0;
      this.splitClip(clip.id, playheadMs);
    });

    // Delete
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.deleteClip(clip.id);
    });
  }

  _startClipMove(e, clip, el) {
    const startX = e.clientX;
    const initialStartMs = clip.startTimeMs;

    const onMouseMove = (moveEv) => {
      const dx = moveEv.clientX - startX;
      const dTime = (dx / this.pixelsPerSecond) * 1000;
      let newStart = Math.max(0, initialStartMs + dTime);

      // Snap to 1/16 beat
      const bpm = (window.trackManager && window.trackManager.bpm) || 120;
      const snapMs = (60 / bpm) * 250;
      newStart = Math.round(newStart / snapMs) * snapMs;

      clip.startTimeMs = newStart;
      el.style.left = `${(newStart / 1000) * this.pixelsPerSecond}px`;
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      if (window.trackManager) window.trackManager.renderArrangerUI();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  _startTrimRight(e, clip, el) {
    const startX = e.clientX;
    const initialDurMs = clip.durationMs;

    const onMouseMove = (moveEv) => {
      const dx = moveEv.clientX - startX;
      const dTime = (dx / this.pixelsPerSecond) * 1000;
      let newDur = Math.max(100, initialDurMs + dTime);

      // Don't exceed source duration unless looping
      if (!clip.isLooping && (clip.offsetMs + newDur) > clip.sourceDurationMs) {
        newDur = Math.max(100, clip.sourceDurationMs - clip.offsetMs);
      }

      clip.durationMs = newDur;
      const widthPx = (newDur / 1000) * this.pixelsPerSecond;
      el.style.width = `${widthPx}px`;
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      if (window.trackManager) window.trackManager.renderArrangerUI();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  _startTrimLeft(e, clip, el) {
    const startX = e.clientX;
    const initialStart = clip.startTimeMs;
    const initialOffset = clip.offsetMs;
    const initialDur = clip.durationMs;

    const onMouseMove = (moveEv) => {
      const dx = moveEv.clientX - startX;
      const dTime = (dx / this.pixelsPerSecond) * 1000;

      const newOffset = Math.max(0, initialOffset + dTime);
      const actualShift = newOffset - initialOffset;
      const newStart = initialStart + actualShift;
      const newDur = Math.max(100, initialDur - actualShift);

      clip.offsetMs = newOffset;
      clip.startTimeMs = newStart;
      clip.durationMs = newDur;

      el.style.left = `${(newStart / 1000) * this.pixelsPerSecond}px`;
      el.style.width = `${(newDur / 1000) * this.pixelsPerSecond}px`;
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      if (window.trackManager) window.trackManager.renderArrangerUI();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  /**
   * Synchronized Playback Scheduling for all Audio Clips
   */
  schedulePlayback(startPlayheadMs) {
    this.stopPlayback();
    if (!window.audioEngine || !window.audioEngine.ctx) return;
    const ctx = window.audioEngine.ctx;
    const nowAudio = ctx.currentTime;

    for (const [id, clip] of this.clips.entries()) {
      if (!clip.audioBuffer) continue;

      const track = window.trackManager ? window.trackManager.tracks.find(t => t.id === clip.trackId) : null;
      if (track && track.isMuted) continue;

      const clipStart = clip.startTimeMs;
      const clipEnd = clipStart + clip.durationMs;

      // Check if clip is in range of playback
      if (clipEnd > startPlayheadMs) {
        let delaySec = 0;
        let bufferOffsetSec = clip.offsetMs / 1000;
        let playDurationSec = clip.durationMs / 1000;

        if (startPlayheadMs > clipStart) {
          // Playhead is in the middle of this clip!
          const elapsedInClipSec = (startPlayheadMs - clipStart) / 1000;
          bufferOffsetSec += elapsedInClipSec;
          playDurationSec -= elapsedInClipSec;
          delaySec = 0;
        } else {
          // Clip starts in future
          delaySec = (clipStart - startPlayheadMs) / 1000;
        }

        const source = ctx.createBufferSource();
        source.buffer = clip.audioBuffer;
        source.loop = !!clip.isLooping;

        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(clip.gain || 1.0, nowAudio);

        // Fade in
        if (clip.fadeInMs > 0 && bufferOffsetSec <= (clip.offsetMs / 1000 + 0.05)) {
          gainNode.gain.setValueAtTime(0.001, nowAudio + delaySec);
          gainNode.gain.linearRampToValueAtTime(clip.gain || 1.0, nowAudio + delaySec + (clip.fadeInMs / 1000));
        }

        // Fade out
        if (clip.fadeOutMs > 0) {
          const fadeOutStart = nowAudio + delaySec + playDurationSec - (clip.fadeOutMs / 1000);
          if (fadeOutStart > nowAudio) {
            gainNode.gain.setValueAtTime(clip.gain || 1.0, fadeOutStart);
            gainNode.gain.linearRampToValueAtTime(0.001, nowAudio + delaySec + playDurationSec);
          }
        }

        // Route to track's mixer channel
        const dest = window.mixerEngine ? window.mixerEngine.getTrackInputNode(clip.trackId) : (window.audioEngine.destinationNode || ctx.destination);

        source.connect(gainNode);
        gainNode.connect(dest);

        const startTime = nowAudio + delaySec;
        source.start(startTime, bufferOffsetSec, playDurationSec);

        this.activeSourceNodes.push({
          source,
          gainNode,
          stop: () => {
            try { source.stop(); source.disconnect(); gainNode.disconnect(); } catch (e) {}
          }
        });
      }
    }
  }

  stopPlayback() {
    this.activeSourceNodes.forEach(item => {
      try { item.stop(); } catch (e) {}
    });
    this.activeSourceNodes = [];
  }

  _arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  _base64ToArrayBuffer(base64) {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

// Global Singleton Instance
window.clipManager = new ClipManager();
