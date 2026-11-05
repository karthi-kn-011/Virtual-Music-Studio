/**
 * Virtual Music Studio - Recording Engine
 * Synchronized dual-mode recording: MIDI-style event timeline & high-res Web Audio PCM/MediaRecorder capture.
 */

class RecordingEngine {
  constructor() {
    this.isRecording = false;
    this.isPaused = false;
    this.recordStartTime = 0;
    this.pausedDuration = 0;
    this.lastPauseTime = 0;
    this.activeNoteEvents = new Map(); // midiNote -> eventObj
    this.recordedEvents = []; // Array of completed note events
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.recordedAudioBlob = null;
    this.recordedAudioUrl = null;
    this.timerInterval = null;
    this.elapsedSeconds = 0;
    this.takes = [];
    this.onStateChangeCallbacks = [];
  }

  async startRecording(countInBeats = 0) {
    if (this.isRecording) return;
    await window.audioEngine.ensureContext();

    if (countInBeats > 0) {
      await this._playCountIn(countInBeats);
    }

    this.isRecording = true;
    this.isPaused = false;
    this.recordStartTime = performance.now();
    this.pausedDuration = 0;
    this.recordedEvents = [];
    this.activeNoteEvents.clear();
    this.audioChunks = [];
    this.elapsedSeconds = 0;

    // Start Audio Stream Recorder
    if (window.audioEngine.mediaStreamDestination) {
      try {
        const stream = window.audioEngine.mediaStreamDestination.stream;
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm';

        this.mediaRecorder = new MediaRecorder(stream, { mimeType });
        this.mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) this.audioChunks.push(e.data);
        };
        this.mediaRecorder.onstop = () => {
          this.recordedAudioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
          if (this.recordedAudioUrl) URL.revokeObjectURL(this.recordedAudioUrl);
          this.recordedAudioUrl = URL.createObjectURL(this.recordedAudioBlob);
          console.log('[RecordingEngine] Audio recording finalized, blob size:', this.recordedAudioBlob.size);
        };
        this.mediaRecorder.start(100);
      } catch (err) {
        console.warn('[RecordingEngine] MediaRecorder init error:', err);
      }
    }

    // Start timer and waveform visualizer update
    this._startTimer();
    this._notifyState();
    console.log('[RecordingEngine] Recording started.');
  }

  _playCountIn(beats) {
    return new Promise(resolve => {
      let currentBeat = 0;
      const bpm = (window.trackManager ? window.trackManager.bpm : 120);
      const beatInterval = (60 / bpm) * 1000;
      const toast = document.getElementById('studio-toast');

      const countInterval = setInterval(() => {
        currentBeat++;
        // Play click sound
        this._playMetronomeTick(currentBeat === 1);
        if (toast) {
          toast.textContent = `Count-In: ${currentBeat} / ${beats}`;
          toast.classList.add('show');
        }

        if (currentBeat >= beats) {
          clearInterval(countInterval);
          setTimeout(() => {
            if (toast) toast.classList.remove('show');
            resolve();
          }, beatInterval);
        }
      }, beatInterval);
    });
  }

  _playMetronomeTick(isAccent) {
    if (!window.audioEngine.ctx) return;
    const ctx = window.audioEngine.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = isAccent ? 1600 : 800;
    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.04);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  }

  pauseRecording() {
    if (!this.isRecording || this.isPaused) return;
    this.isPaused = true;
    this.lastPauseTime = performance.now();
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
    }
    clearInterval(this.timerInterval);
    this._notifyState();
  }

  resumeRecording() {
    if (!this.isRecording || !this.isPaused) return;
    this.isPaused = false;
    this.pausedDuration += performance.now() - this.lastPauseTime;
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
    }
    this._startTimer();
    this._notifyState();
  }

  stopRecording() {
    if (!this.isRecording) return;
    this.isRecording = false;
    this.isPaused = false;
    clearInterval(this.timerInterval);

    // Close any unreleased active notes
    const currentTimeMs = (performance.now() - this.recordStartTime) - this.pausedDuration;
    for (const [midiNote, ev] of this.activeNoteEvents.entries()) {
      ev.durationMs = Math.max(50, currentTimeMs - ev.startTimeMs);
      this.recordedEvents.push(ev);
    }
    this.activeNoteEvents.clear();

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    // Save as take
    if (this.recordedEvents.length > 0 || this.audioChunks.length > 0) {
      const take = {
        id: `take_${Date.now()}`,
        name: `Take ${this.takes.length + 1} (${window.instrumentManager.currentInstrument.name})`,
        instrumentId: window.instrumentManager.currentInstrument.id,
        durationSeconds: this.elapsedSeconds,
        events: [...this.recordedEvents],
        timestamp: new Date().toLocaleTimeString()
      };
      this.takes.unshift(take);
      this._updateTakesList();
    }

    this._notifyState();
    console.log(`[RecordingEngine] Recording stopped. Total events captured: ${this.recordedEvents.length}`);
    return this.recordedEvents;
  }

  recordNoteOn(arg1, arg2, arg3) {
    if (!this.isRecording || this.isPaused) return;
    let instrumentId, midiNote, velocity;
    if (typeof arg1 === 'string') {
      instrumentId = arg1;
      midiNote = arg2;
      velocity = arg3 !== undefined ? arg3 : 0.8;
    } else {
      instrumentId = (window.instrumentManager && window.instrumentManager.currentInstrument)
        ? window.instrumentManager.currentInstrument.id
        : 'classical_piano';
      midiNote = arg1;
      velocity = arg2 !== undefined ? arg2 : 0.8;
    }
    const timeMs = (performance.now() - this.recordStartTime) - this.pausedDuration;
    const event = {
      instrumentId,
      midiNote,
      velocity,
      startTimeMs: timeMs,
      durationMs: 0
    };
    this.activeNoteEvents.set(midiNote, event);
  }

  recordNoteOff(midiNote) {
    if (!this.isRecording || this.isPaused) return;
    const event = this.activeNoteEvents.get(midiNote);
    if (event) {
      const timeMs = (performance.now() - this.recordStartTime) - this.pausedDuration;
      event.durationMs = Math.max(40, timeMs - event.startTimeMs);
      this.recordedEvents.push(event);
      this.activeNoteEvents.delete(midiNote);
    }
  }

  _startTimer() {
    this.timerInterval = setInterval(() => {
      const now = performance.now();
      const ms = (now - this.recordStartTime) - this.pausedDuration;
      this.elapsedSeconds = ms / 1000;
      const timerEl = document.getElementById('record-timer-display');
      if (timerEl) {
        const m = Math.floor(this.elapsedSeconds / 60);
        const s = Math.floor(this.elapsedSeconds % 60);
        const msFrac = Math.floor((this.elapsedSeconds % 1) * 10);
        timerEl.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${msFrac}`;
      }
    }, 100);
  }

  _notifyState() {
    const state = {
      isRecording: this.isRecording,
      isPaused: this.isPaused,
      elapsedSeconds: this.elapsedSeconds,
      eventCount: this.recordedEvents.length
    };
    this.onStateChangeCallbacks.forEach(cb => {
      try { cb(state); } catch (e) {}
    });

    const statusBadge = document.getElementById('record-status-indicator');
    if (statusBadge) {
      if (this.isRecording && !this.isPaused) {
        statusBadge.className = 'status-badge recording';
        statusBadge.innerHTML = '<span class="rec-dot"></span> RECORDING';
      } else if (this.isPaused) {
        statusBadge.className = 'status-badge paused';
        statusBadge.innerHTML = '<span class="pause-dot"></span> PAUSED';
      } else {
        statusBadge.className = 'status-badge idle';
        statusBadge.innerHTML = 'READY';
      }
    }
  }

  onStateChange(cb) {
    this.onStateChangeCallbacks.push(cb);
  }

  _updateTakesList() {
    const listEl = document.getElementById('recording-takes-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (this.takes.length === 0) {
      listEl.innerHTML = '<div class="empty-takes-msg">No recordings yet. Click Record to capture your performance!</div>';
      return;
    }

    this.takes.forEach((take, index) => {
      const item = document.createElement('div');
      item.className = 'take-card';
      item.innerHTML = `
        <div class="take-info">
          <span class="take-title">${take.name}</span>
          <span class="take-meta">${take.timestamp} • ${take.durationSeconds.toFixed(1)}s • ${take.events.length} notes</span>
        </div>
        <div class="take-actions">
          <button class="btn btn-sm btn-ghost play-take-btn" title="Replay">▶ Play</button>
          <button class="btn btn-sm btn-ghost add-to-track-btn" title="Add to Multi-Track Arranger">+ Add Track</button>
          <button class="btn btn-sm btn-ghost delete-take-btn" title="Delete">🗑</button>
        </div>
      `;

      item.querySelector('.play-take-btn').addEventListener('click', () => {
        this.replayTake(take);
      });

      item.querySelector('.add-to-track-btn').addEventListener('click', () => {
        if (window.trackManager) {
          window.trackManager.addTrackFromTake(take);
          window.app.switchView('timeline');
        }
      });

      item.querySelector('.delete-take-btn').addEventListener('click', () => {
        this.takes.splice(index, 1);
        this._updateTakesList();
      });

      listEl.appendChild(item);
    });
  }

  replayTake(take) {
    if (!take || !take.events || take.events.length === 0) return;
    window.audioEngine.ensureContext().then(() => {
      const inst = window.instrumentManager.getInstrument(take.instrumentId) || window.instrumentManager.currentInstrument;
      const ctx = window.audioEngine.ctx;
      const baseAudioTime = ctx.currentTime + 0.1;

      take.events.forEach(ev => {
        const noteStartAudioTime = baseAudioTime + (ev.startTimeMs / 1000);
        setTimeout(() => {
          const voice = window.soundFontManager.playNote(inst, ev.midiNote, ev.velocity || 0.8, null, noteStartAudioTime);
          if (voice) {
            setTimeout(() => {
              voice.stop();
            }, ev.durationMs || 300);
          }
        }, ev.startTimeMs);
      });
    });
  }
}

window.recordingEngine = new RecordingEngine();
