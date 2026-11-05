/**
 * Virtual Music Studio - Multi-Track Manager & Timeline Arranger
 * Complete DAW track engine: independent instrument routing, solo/mute/pan/gain,
 * synchronized multi-track playback, timeline ruler, playhead, loop markers, and event sequencing.
 */

class TrackManager {
  constructor() {
    this.tracks = [];
    this.bpm = 120;
    this.timeSignature = [4, 4]; // 4/4
    this.isPlaying = false;
    this.isPaused = false;
    this.playheadPositionMs = 0;
    this.loopStartMs = 0;
    this.loopEndMs = 16000; // 4 bars at 120bpm = 8000ms, default 8 bars
    this.isLooping = false;
    this.zoomLevel = 1.0; // pixels per ms ratio
    this.pixelsPerSecond = 80;
    this.activePlaybackSchedulers = [];
    this.playStartTime = 0;
    this.animationFrameId = null;
    this.selectedTrackId = null;
    this.onTimelineUpdateCallbacks = [];
    this.onBpmChangeCallbacks = [];
  }

  init() {
    // Add default starter track: Classical Piano
    if (this.tracks.length === 0) {
      this.createTrack('classical_piano', 'Piano Melodies');
      this.createTrack('violin', 'Violin Harmony');
      this.createTrack('classical_guitar', 'Guitar Chords');
    }
    this.renderArrangerUI();
  }

  createTrack(instrumentId = 'classical_piano', customName = null) {
    const inst = (window.instrumentManager && window.instrumentManager.getInstrument(instrumentId)) 
      || (window.INSTRUMENTS_CATALOG && window.INSTRUMENTS_CATALOG[0])
      || { id: instrumentId, name: 'Instrument' };

    const trackId = `trk_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const newTrack = {
      id: trackId,
      name: customName || `${inst.name} ${this.tracks.length + 1}`,
      instrumentId: inst.id,
      color: inst.badgeColor || '#8B5CF6',
      volume: 0.8,
      pan: 0, // -1 to +1
      isMuted: false,
      isSolo: false,
      isArmed: this.tracks.length === 0, // Arm first track by default
      events: [] // Array of { id, midiNote, startTimeMs, durationMs, velocity }
    };

    this.tracks.push(newTrack);
    if (!this.selectedTrackId) this.selectedTrackId = trackId;
    if (window.mixerEngine) window.mixerEngine.syncWithTracks(this.tracks);
    this.renderArrangerUI();
    return newTrack;
  }

  deleteTrack(trackId) {
    const idx = this.tracks.findIndex(t => t.id === trackId);
    if (idx !== -1) {
      this.tracks.splice(idx, 1);
      if (this.selectedTrackId === trackId) {
        this.selectedTrackId = this.tracks[0] ? this.tracks[0].id : null;
      }
      if (window.mixerEngine) window.mixerEngine.syncWithTracks(this.tracks);
      if (window.clipManager && window.clipManager.clips) {
        for (const [cId, clip] of window.clipManager.clips.entries()) {
          if (clip.trackId === trackId) {
            window.clipManager.clips.delete(cId);
          }
        }
      }
      if (window.automationEngine && window.automationEngine.lanes) {
        window.automationEngine.lanes.delete(trackId);
      }
      this.renderArrangerUI();
    }
  }

  duplicateTrack(trackId) {
    const track = this.tracks.find(t => t.id === trackId);
    if (!track) return;
    const duplicated = {
      ...JSON.parse(JSON.stringify(track)),
      id: `trk_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: `${track.name} (Copy)`,
      events: track.events.map(ev => ({ ...ev, id: `ev_${Date.now()}_${Math.random()}` }))
    };
    this.tracks.push(duplicated);
    if (window.mixerEngine) window.mixerEngine.syncWithTracks(this.tracks);
    this.renderArrangerUI();
  }

  addTrackFromTake(take) {
    const track = this.createTrack(take.instrumentId, take.name);
    track.events = take.events.map(ev => ({
      ...ev,
      id: `ev_${Date.now()}_${Math.random()}`
    }));
    this.renderArrangerUI();
  }

  onBpmChange(cb) {
    this.onBpmChangeCallbacks.push(cb);
  }

  setBpm(newBpm) {
    const val = parseInt(newBpm, 10);
    if (isNaN(val)) return;
    this.bpm = Math.max(40, Math.min(260, val));

    // Update top toolbar input
    const bpmDisplay = document.getElementById('studio-bpm-input');
    if (bpmDisplay && parseInt(bpmDisplay.value, 10) !== this.bpm) {
      bpmDisplay.value = this.bpm;
    }

    // Sync drum machine
    if (window.drumMachine) {
      window.drumMachine.bpm = this.bpm;
    }

    // Update Session Overview immediately
    const sessionBpm = document.getElementById('dash-session-bpm');
    if (sessionBpm) {
      sessionBpm.textContent = `${this.bpm} BPM`;
    }

    // Update current project if active
    if (window.projectManager && window.projectManager.currentProject) {
      window.projectManager.currentProject.bpm = this.bpm;
    }

    // Notify listeners
    this.onBpmChangeCallbacks.forEach(cb => {
      try { cb(this.bpm); } catch (e) { console.error(e); }
    });
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  async play() {
    await window.audioEngine.ensureContext();
    if (this.isPlaying) return;

    this.isPlaying = true;
    this.isPaused = false;
    this.playStartTime = performance.now() - this.playheadPositionMs;

    this._schedulePlayback();
    if (window.clipManager) window.clipManager.schedulePlayback(this.playheadPositionMs);
    if (window.automationEngine) window.automationEngine.schedulePlayback(this.playheadPositionMs / 1000);
    this._startPlayheadAnimation();
    this._updateTransportUI();
    console.log('[TrackManager] Multi-track playback initiated at', this.playheadPositionMs, 'ms');
  }

  pause() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    this.isPaused = true;
    this._cancelPlaybackSchedulers();
    if (window.clipManager) window.clipManager.stopPlayback();
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    this._updateTransportUI();
    console.log('[TrackManager] Multi-track paused at', this.playheadPositionMs, 'ms');
  }

  stop() {
    this.isPlaying = false;
    this.isPaused = false;
    this.playheadPositionMs = 0;
    this._cancelPlaybackSchedulers();
    if (window.clipManager) window.clipManager.stopPlayback();
    if (window.automationEngine) window.automationEngine.applyAutomationAt(0);
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    this._updatePlayheadUI(0);
    this._updateTransportUI();
    console.log('[TrackManager] Multi-track stopped and rewound to 0ms.');
  }

  seekTo(timeMs) {
    this.playheadPositionMs = Math.max(0, timeMs);
    this._updatePlayheadUI(this.playheadPositionMs);
    if (window.clipManager) window.clipManager.stopPlayback();

    if (this.isPlaying) {
      this._cancelPlaybackSchedulers();
      this.playStartTime = performance.now() - this.playheadPositionMs;
      this._schedulePlayback();
      if (window.clipManager) window.clipManager.schedulePlayback(this.playheadPositionMs);
      if (window.automationEngine) window.automationEngine.schedulePlayback(this.playheadPositionMs / 1000);
    } else {
      if (window.automationEngine) window.automationEngine.applyAutomationAt(this.playheadPositionMs / 1000);
    }
  }

  _schedulePlayback() {
    this._cancelPlaybackSchedulers();
    const hasSolo = this.tracks.some(t => t.isSolo);
    const ctx = window.audioEngine.ctx;
    const nowAudio = ctx.currentTime;
    const nowPerf = performance.now();

    this.tracks.forEach(track => {
      if (track.isMuted) return;
      if (hasSolo && !track.isSolo) return;

      const inst = window.instrumentManager.getInstrument(track.instrumentId) || window.instrumentManager.currentInstrument;

      // Route directly into the track's persistent Web Audio mixer channel strip
      const trackDest = window.mixerEngine ? window.mixerEngine.getTrackInputNode(track.id) : (window.audioEngine.destinationNode || ctx.destination);

      const events = track.events || track.notes || [];
      events.forEach(ev => {
        const evStartMs = ev.startTimeMs !== undefined ? ev.startTimeMs : (ev.startTime * 1000 || 0);
        const evDurMs = ev.durationMs !== undefined ? ev.durationMs : (ev.duration * 1000 || 300);
        const evMidi = ev.midiNote !== undefined ? ev.midiNote : ev.noteNumber;

        if (evStartMs >= this.playheadPositionMs) {
          const delayUntilEventMs = evStartMs - this.playheadPositionMs;
          const targetAudioTime = nowAudio + (delayUntilEventMs / 1000);

          const timerId = setTimeout(() => {
            if (!this.isPlaying) return;
            const voice = window.soundFontManager.playNote(inst, evMidi, (ev.velocity || 0.8), trackDest, targetAudioTime);
            if (voice) {
              const stopTimer = setTimeout(() => {
                voice.stop();
              }, evDurMs);
              this.activePlaybackSchedulers.push(stopTimer);
            }
          }, delayUntilEventMs);

          this.activePlaybackSchedulers.push(timerId);
        }
      });
    });
  }

  _cancelPlaybackSchedulers() {
    this.activePlaybackSchedulers.forEach(id => clearTimeout(id));
    this.activePlaybackSchedulers = [];
    if (window.keyboardController) {
      window.keyboardController.stopAllNotes();
    }
  }

  _startPlayheadAnimation() {
    const loop = () => {
      if (!this.isPlaying) return;
      const elapsed = performance.now() - this.playStartTime;
      this.playheadPositionMs = elapsed;

      // Loop handling
      if (this.isLooping && this.playheadPositionMs >= this.loopEndMs) {
        this.seekTo(this.loopStartMs);
        return;
      }

      this._updatePlayheadUI(this.playheadPositionMs);
      this.animationFrameId = requestAnimationFrame(loop);
    };
    this.animationFrameId = requestAnimationFrame(loop);
  }

  _updatePlayheadUI(timeMs) {
    const px = (timeMs / 1000) * this.pixelsPerSecond;
    const playheadEl = document.getElementById('timeline-playhead');
    if (playheadEl) {
      playheadEl.style.left = `${px + 220}px`; // 220px track header offset
    }

    // Time & Bar display
    const timeDisplay = document.getElementById('current-time-code');
    if (timeDisplay) {
      const sec = timeMs / 1000;
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      const ms = Math.floor((sec % 1) * 100);
      // Compute bar / beat: 120 bpm = 2 beats per sec (at 4/4 = 0.5 bars per sec)
      const beatsTotal = (sec * (this.bpm / 60));
      const bar = Math.floor(beatsTotal / 4) + 1;
      const beat = Math.floor(beatsTotal % 4) + 1;
      timeDisplay.textContent = `${String(bar).padStart(2, '0')}.${beat} | ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
    }
  }

  _updateTransportUI() {
    const playBtn = document.getElementById('transport-play-btn');
    if (playBtn) {
      if (this.isPlaying) {
        playBtn.classList.add('playing');
        playBtn.innerHTML = '⏸ Pause';
      } else {
        playBtn.classList.remove('playing');
        playBtn.innerHTML = '▶ Play';
      }
    }
  }

  renderArrangerUI() {
    const tracksContainer = document.getElementById('arranger-tracks-container');
    if (!tracksContainer) return;
    tracksContainer.innerHTML = '';

    this.tracks.forEach((track, index) => {
      const trackRow = document.createElement('div');
      trackRow.className = `track-row ${this.selectedTrackId === track.id ? 'selected' : ''}`;
      trackRow.dataset.trackId = track.id;

      // Track Header
      const header = document.createElement('div');
      header.className = 'track-header';
      header.innerHTML = `
        <div class="track-color-indicator" style="background: ${track.color}"></div>
        <div class="track-title-area">
          <input type="text" class="track-name-input" value="${track.name}" spellcheck="false" />
          <span class="track-inst-name">${(window.instrumentManager.getInstrument(track.instrumentId) || {}).name || track.instrumentId}</span>
        </div>
        <div class="track-buttons">
          <button class="trk-btn btn-mute ${track.isMuted ? 'active' : ''}" title="Mute">M</button>
          <button class="trk-btn btn-solo ${track.isSolo ? 'active' : ''}" title="Solo">S</button>
          <button class="trk-btn btn-arm ${track.isArmed ? 'active' : ''}" title="Arm for Recording">●</button>
          <button class="trk-btn btn-edit-notes" title="Open in Piano Roll">🎹</button>
          <button class="trk-btn btn-del" title="Delete Track">✕</button>
        </div>
        <div class="track-faders">
          <div class="fader-group">
            <label>VOL</label>
            <input type="range" class="vol-slider" min="0" max="1" step="0.05" value="${track.volume}" />
          </div>
          <div class="fader-group">
            <label>PAN</label>
            <input type="range" class="pan-slider" min="-1" max="1" step="0.1" value="${track.pan}" />
          </div>
        </div>
      `;

      // Track Events Lane
      const lane = document.createElement('div');
      lane.className = 'track-lane';
      lane.style.width = '3200px';

      // Render note blocks
      const events = track.events || track.notes || [];
      events.forEach(ev => {
        const evStartMs = ev.startTimeMs !== undefined ? ev.startTimeMs : (ev.startTime * 1000 || 0);
        const evDurMs = ev.durationMs !== undefined ? ev.durationMs : (ev.duration * 1000 || 300);
        const evMidi = ev.midiNote !== undefined ? ev.midiNote : ev.noteNumber;

        const leftPx = (evStartMs / 1000) * this.pixelsPerSecond;
        const widthPx = Math.max(12, (evDurMs / 1000) * this.pixelsPerSecond);
        const noteInfo = window.noteMapper.getNoteInfoFromMidi(evMidi);

        const block = document.createElement('div');
        block.className = 'track-note-block';
        block.style.left = `${leftPx}px`;
        block.style.width = `${widthPx}px`;
        block.style.backgroundColor = track.color;
        block.title = `${noteInfo.noteName} (${(evDurMs/1000).toFixed(2)}s) • Double-click to edit in Piano Roll`;
        block.innerHTML = `<span>${noteInfo.noteName}</span>`;
        block.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          this.selectedTrackId = track.id;
          if (window.pianoRoll) {
            window.pianoRoll.openTrack(track);
          }
        });
        lane.appendChild(block);
      });

      // Render audio clips on this track lane
      if (window.clipManager) {
        window.clipManager.renderClipsForTrack(lane, track.id);
      }

      // Events
      header.querySelector('.track-name-input').addEventListener('change', (e) => {
        track.name = e.target.value;
      });

      header.querySelector('.btn-mute').addEventListener('click', () => {
        track.isMuted = !track.isMuted;
        this.renderArrangerUI();
      });

      header.querySelector('.btn-solo').addEventListener('click', () => {
        track.isSolo = !track.isSolo;
        this.renderArrangerUI();
      });

      header.querySelector('.btn-arm').addEventListener('click', () => {
        this.tracks.forEach(t => t.isArmed = false);
        track.isArmed = true;
        window.instrumentManager.selectInstrument(track.instrumentId);
        this.renderArrangerUI();
      });

      header.querySelector('.btn-edit-notes').addEventListener('click', () => {
        this.selectedTrackId = track.id;
        if (window.pianoRoll) {
          window.pianoRoll.openTrack(track);
        }
      });

      header.querySelector('.btn-del').addEventListener('click', () => {
        this.deleteTrack(track.id);
      });

      header.querySelector('.vol-slider').addEventListener('input', (e) => {
        track.volume = parseFloat(e.target.value);
      });

      header.querySelector('.pan-slider').addEventListener('input', (e) => {
        track.pan = parseFloat(e.target.value);
      });

      trackRow.addEventListener('click', (e) => {
        if (!e.target.classList.contains('trk-btn') && !e.target.tagName.includes('INPUT')) {
          this.selectedTrackId = track.id;
          document.querySelectorAll('.track-row').forEach(r => r.classList.remove('selected'));
          trackRow.classList.add('selected');
        }
      });

      lane.addEventListener('click', (e) => {
        const rect = lane.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const seekTimeMs = (clickX / this.pixelsPerSecond) * 1000;
        this.seekTo(seekTimeMs);
      });

      lane.addEventListener('dblclick', () => {
        this.selectedTrackId = track.id;
        if (window.pianoRoll) {
          window.pianoRoll.openTrack(track);
        }
      });

      trackRow.appendChild(header);
      trackRow.appendChild(lane);
      tracksContainer.appendChild(trackRow);
    });

    if (window.automationEngine) {
      window.automationEngine.render();
    }
    if (window.arrangementManager) {
      window.arrangementManager.render();
    }
  }

  addTrack(instrumentId, customName) {
    return this.createTrack(instrumentId, customName);
  }
}

window.trackManager = new TrackManager();
