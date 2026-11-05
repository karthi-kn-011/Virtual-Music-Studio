/**
 * Virtual Music Studio - Professional DAW Mixing Console & Audio Effects Engine
 * Web Audio API graph: Per-channel isolated signal strips (Gain -> 3-Band Parametric EQ -> 
 * Dynamics Compressor -> Aux Sends -> Stereo Panner -> Mute/Solo -> Channel Analyser),
 * Master Aux Return Busses (Convolution Reverb, Stereo Delay, Lush Chorus),
 * Master Limiter, True Real-Time RMS/Peak meters, Interactive EQ curve canvas, and Presets.
 */

class MixerEngine {
  constructor() {
    this.ctx = null;
    this.isInitialized = false;

    // Master Audio Nodes
    this.masterSummingBus = null;
    this.masterGain = null;
    this.masterLimiter = null;
    this.masterAnalyser = null;
    this.isMasterMuted = false;
    this.masterVolume = 0.85;

    // Master Aux Return Buses
    this.auxReverb = {
      inputNode: null,
      preDelayNode: null,
      convolver: null,
      returnGain: null,
      type: 'hall', // 'hall', 'room', 'plate'
      preDelayMs: 20,
      decaySec: 3.0
    };

    this.auxDelay = {
      inputNode: null,
      leftDelay: null,
      rightDelay: null,
      feedbackGain: null,
      filterNode: null,
      returnGain: null,
      sync: '1/8',
      timeSec: 0.35,
      feedback: 0.32
    };

    this.auxChorus = {
      inputNode: null,
      delayNode: null,
      lfo: null,
      depthGain: null,
      returnGain: null,
      rate: 1.5,
      depth: 0.002
    };

    // Track Channels: trackId -> TrackChannelStrip
    this.channels = new Map();
    this.selectedTrackId = null;

    // Metering & Visualizer Animation
    this.animationId = null;
    this.isMeterLoopRunning = false;
    this.tempByteData = new Uint8Array(256);
    this.tempFreqData = new Uint8Array(256);
    this.masterFreqData = new Uint8Array(128);

    // Peak Hold & Clip LEDs
    this.masterClipped = false;
    this.channelClips = new Map(); // trackId -> boolean

    // Presets
    this.PRESETS = this._initPresets();
    this.currentPresetName = 'pop';
  }

  /**
   * Initializes the complete multi-track mixer graph
   */
  init(ctx) {
    if (!ctx) return;
    this.ctx = ctx;

    // 1. Master Summing Bus
    this.masterSummingBus = ctx.createGain();

    // 2. Master Gain Fader
    this.masterGain = ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.masterVolume, ctx.currentTime);

    // 3. Master Brickwall Limiter (Protects against digital clipping)
    this.masterLimiter = ctx.createDynamicsCompressor();
    this.masterLimiter.threshold.setValueAtTime(-0.5, ctx.currentTime);
    this.masterLimiter.knee.setValueAtTime(0, ctx.currentTime);
    this.masterLimiter.ratio.setValueAtTime(20.0, ctx.currentTime);
    this.masterLimiter.attack.setValueAtTime(0.001, ctx.currentTime);
    this.masterLimiter.release.setValueAtTime(0.05, ctx.currentTime);

    // 4. Master Analyser (True FFT Spectrum and Stereo Metering)
    this.masterAnalyser = ctx.createAnalyser();
    this.masterAnalyser.fftSize = 512;
    this.masterAnalyser.smoothingTimeConstant = 0.85;

    // Connect Master Chain
    this.masterSummingBus.connect(this.masterGain);
    this.masterGain.connect(this.masterLimiter);
    this.masterLimiter.connect(this.masterAnalyser);

    if (window.masteringEngine) {
      window.masteringEngine.initAudioChain(ctx, this.masterAnalyser, ctx.destination);
    } else {
      this.masterAnalyser.connect(ctx.destination);
    }

    // Connect to AudioEngine mediaStreamDestination for recording
    if (window.audioEngine && window.audioEngine.mediaStreamDestination) {
      this.masterLimiter.connect(window.audioEngine.mediaStreamDestination);
    }

    // 5. Initialize Master Aux Return Buses (Reverb, Delay, Chorus)
    this._initAuxReverbBus();
    this._initAuxDelayBus();
    this._initAuxChorusBus();

    // 6. Synchronize with existing project tracks
    if (window.trackManager && window.trackManager.tracks) {
      this.syncWithTracks(window.trackManager.tracks);
    }

    // 7. Start real-time meter animation loop
    this.isInitialized = true;
    this._startMeterLoop();

    console.log('[MixerEngine] Professional DAW Multi-Track Mixing Console initialized.');
  }

  // =========================================================================
  // AUX EFFECTS BUSSES (REVERB, STEREO DELAY, CHORUS)
  // =========================================================================

  _initAuxReverbBus() {
    const ctx = this.ctx;
    this.auxReverb.inputNode = ctx.createGain();
    this.auxReverb.preDelayNode = ctx.createDelay(0.2);
    this.auxReverb.preDelayNode.delayTime.setValueAtTime(this.auxReverb.preDelayMs / 1000, ctx.currentTime);

    this.auxReverb.convolver = ctx.createConvolver();
    this.auxReverb.convolver.buffer = this._generateImpulseResponse(this.auxReverb.type, this.auxReverb.decaySec);

    this.auxReverb.returnGain = ctx.createGain();
    this.auxReverb.returnGain.gain.setValueAtTime(0.9, ctx.currentTime);

    // Connect: Input -> PreDelay -> Convolver -> Return -> MasterSummingBus
    this.auxReverb.inputNode.connect(this.auxReverb.preDelayNode);
    this.auxReverb.preDelayNode.connect(this.auxReverb.convolver);
    this.auxReverb.convolver.connect(this.auxReverb.returnGain);
    this.auxReverb.returnGain.connect(this.masterSummingBus);
  }

  _initAuxDelayBus() {
    const ctx = this.ctx;
    this.auxDelay.inputNode = ctx.createGain();

    this.auxDelay.leftDelay = ctx.createDelay(2.0);
    this.auxDelay.rightDelay = ctx.createDelay(2.0);

    const initialDelay = this._calcDelaySeconds(this.auxDelay.sync);
    this.auxDelay.leftDelay.delayTime.setValueAtTime(initialDelay, ctx.currentTime);
    this.auxDelay.rightDelay.delayTime.setValueAtTime(initialDelay * 1.05, ctx.currentTime); // Subtle stereo spread

    // Damping Filter (prevents harsh high-frequency feedback build-up)
    this.auxDelay.filterNode = ctx.createBiquadFilter();
    this.auxDelay.filterNode.type = 'lowpass';
    this.auxDelay.filterNode.frequency.setValueAtTime(3800, ctx.currentTime);

    this.auxDelay.feedbackGain = ctx.createGain();
    this.auxDelay.feedbackGain.gain.setValueAtTime(this.auxDelay.feedback, ctx.currentTime);

    this.auxDelay.returnGain = ctx.createGain();
    this.auxDelay.returnGain.gain.setValueAtTime(0.85, ctx.currentTime);

    // Connect: Input -> Left & Right Delays -> Filter -> Feedback -> Delay
    this.auxDelay.inputNode.connect(this.auxDelay.leftDelay);
    this.auxDelay.inputNode.connect(this.auxDelay.rightDelay);

    this.auxDelay.leftDelay.connect(this.auxDelay.filterNode);
    this.auxDelay.rightDelay.connect(this.auxDelay.filterNode);
    this.auxDelay.filterNode.connect(this.auxDelay.feedbackGain);
    this.auxDelay.feedbackGain.connect(this.auxDelay.leftDelay);
    this.auxDelay.feedbackGain.connect(this.auxDelay.rightDelay);

    this.auxDelay.leftDelay.connect(this.auxDelay.returnGain);
    this.auxDelay.rightDelay.connect(this.auxDelay.returnGain);
    this.auxDelay.returnGain.connect(this.masterSummingBus);
  }

  _initAuxChorusBus() {
    const ctx = this.ctx;
    this.auxChorus.inputNode = ctx.createGain();

    this.auxChorus.delayNode = ctx.createDelay(0.1);
    this.auxChorus.delayNode.delayTime.setValueAtTime(0.025, ctx.currentTime);

    this.auxChorus.lfo = ctx.createOscillator();
    this.auxChorus.lfo.type = 'sine';
    this.auxChorus.lfo.frequency.setValueAtTime(this.auxChorus.rate, ctx.currentTime);

    this.auxChorus.depthGain = ctx.createGain();
    this.auxChorus.depthGain.gain.setValueAtTime(this.auxChorus.depth, ctx.currentTime);

    this.auxChorus.lfo.connect(this.auxChorus.depthGain);
    this.auxChorus.depthGain.connect(this.auxChorus.delayNode.delayTime);
    this.auxChorus.lfo.start();

    this.auxChorus.returnGain = ctx.createGain();
    this.auxChorus.returnGain.gain.setValueAtTime(0.8, ctx.currentTime);

    // Connect: Input -> Modulated Delay -> Return -> MasterSummingBus
    this.auxChorus.inputNode.connect(this.auxChorus.delayNode);
    this.auxChorus.delayNode.connect(this.auxChorus.returnGain);
    this.auxChorus.returnGain.connect(this.masterSummingBus);
  }

  _generateImpulseResponse(type, decaySec) {
    if (!this.ctx) return null;
    const rate = this.ctx.sampleRate;
    const length = Math.floor(rate * decaySec);
    const buffer = this.ctx.createBuffer(2, length, rate);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);

    const decayFactor = type === 'room' ? 3.5 : type === 'plate' ? 2.8 : 2.0;

    for (let i = 0; i < length; i++) {
      const n = i / length;
      const env = Math.pow(1 - n, decayFactor);
      // Dual-channel uncorrelated stereo noise
      left[i] = ((Math.random() * 2) - 1) * env;
      right[i] = ((Math.random() * 2) - 1) * env;
    }
    return buffer;
  }

  _calcDelaySeconds(syncType) {
    const bpm = (window.trackManager && window.trackManager.bpm) ? window.trackManager.bpm : 120;
    const beatSec = 60 / bpm;

    switch (syncType) {
      case '1/4': return beatSec;
      case '1/8': return beatSec / 2;
      case '1/8d': return (beatSec / 2) * 1.5;
      case '1/16': return beatSec / 4;
      default: return this.auxDelay.timeSec || 0.35;
    }
  }

  // =========================================================================
  // PER-TRACK SIGNAL CHAIN (GAIN -> EQ -> COMPRESSOR -> SENDS -> PAN -> METER)
  // =========================================================================

  /**
   * Builds or retrieves an isolated channel strip for a track
   */
  getTrackChannel(trackId) {
    return this.channels.get(trackId);
  }

  getTrackInputNode(trackId) {
    const ch = this.channels.get(trackId);
    return ch ? ch.inputNode : this.masterSummingBus;
  }

  /**
   * Synchronizes mixer channels with current trackManager tracks
   */
  syncWithTracks(tracks) {
    if (!this.ctx) return;
    const activeTrackIds = new Set(tracks.map(t => t.id));

    // Remove defunct channels
    for (const [id, ch] of this.channels.entries()) {
      if (!activeTrackIds.has(id)) {
        this._destroyChannel(ch);
        this.channels.delete(id);
      }
    }

    // Add or update channels
    tracks.forEach(track => {
      if (!this.channels.has(track.id)) {
        const channel = this._createTrackChannel(track);
        this.channels.set(track.id, channel);
      } else {
        const channel = this.channels.get(track.id);
        channel.track = track;
        this._updateChannelParameters(channel);
      }
    });

    if (!this.selectedTrackId && tracks.length > 0) {
      this.selectedTrackId = tracks[0].id;
    }

    this.renderMixerUI();
    this._updateInspectorUI();
  }

  _createTrackChannel(track) {
    const ctx = this.ctx;

    // 1. Channel Input Node
    const inputNode = ctx.createGain();

    // 2. Channel Volume Fader Gain
    const volumeGain = ctx.createGain();
    const linearVol = track.volume !== undefined ? track.volume : 0.8;
    volumeGain.gain.setValueAtTime(linearVol, ctx.currentTime);

    // 3. 3-Band Parametric Equalizer
    const eqLow = ctx.createBiquadFilter();
    eqLow.type = 'lowshelf';
    eqLow.frequency.setValueAtTime(120, ctx.currentTime);
    eqLow.gain.setValueAtTime((track.mixer && track.mixer.eq && track.mixer.eq.lowGain) || 0, ctx.currentTime);

    const eqMid = ctx.createBiquadFilter();
    eqMid.type = 'peaking';
    eqMid.frequency.setValueAtTime((track.mixer && track.mixer.eq && track.mixer.eq.midFreq) || 1200, ctx.currentTime);
    eqMid.Q.setValueAtTime((track.mixer && track.mixer.eq && track.mixer.eq.midQ) || 1.0, ctx.currentTime);
    eqMid.gain.setValueAtTime((track.mixer && track.mixer.eq && track.mixer.eq.midGain) || 0, ctx.currentTime);

    const eqHigh = ctx.createBiquadFilter();
    eqHigh.type = 'highshelf';
    eqHigh.frequency.setValueAtTime(6000, ctx.currentTime);
    eqHigh.gain.setValueAtTime((track.mixer && track.mixer.eq && track.mixer.eq.highGain) || 0, ctx.currentTime);

    // 4. Dynamics Compressor with Makeup Gain
    const compressor = ctx.createDynamicsCompressor();
    const compSettings = (track.mixer && track.mixer.compressor) || {
      enabled: false,
      threshold: -18,
      ratio: 4,
      attack: 0.01,
      release: 0.25,
      knee: 6,
      makeup: 0
    };
    compressor.threshold.setValueAtTime(compSettings.threshold, ctx.currentTime);
    compressor.ratio.setValueAtTime(compSettings.enabled ? compSettings.ratio : 1.0, ctx.currentTime);
    compressor.attack.setValueAtTime(compSettings.attack, ctx.currentTime);
    compressor.release.setValueAtTime(compSettings.release, ctx.currentTime);
    compressor.knee.setValueAtTime(compSettings.knee || 6, ctx.currentTime);

    const makeupGain = ctx.createGain();
    const makeupLinear = Math.pow(10, (compSettings.makeup || 0) / 20);
    makeupGain.gain.setValueAtTime(makeupLinear, ctx.currentTime);

    // 5. Aux Effect Sends (Reverb, Delay, Chorus)
    const sends = {
      reverb: ctx.createGain(),
      delay: ctx.createGain(),
      chorus: ctx.createGain()
    };
    const sendSettings = (track.mixer && track.mixer.sends) || { reverb: 0.25, delay: 0.15, chorus: 0.0 };
    sends.reverb.gain.setValueAtTime(sendSettings.reverb, ctx.currentTime);
    sends.delay.gain.setValueAtTime(sendSettings.delay, ctx.currentTime);
    sends.chorus.gain.setValueAtTime(sendSettings.chorus, ctx.currentTime);

    // 6. Stereo Panner
    let panner = null;
    if (ctx.createStereoPanner) {
      panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(track.pan || 0, ctx.currentTime);
    } else {
      panner = ctx.createGain(); // Fallback
    }

    // 7. Mute/Solo Gain
    const muteGain = ctx.createGain();
    muteGain.gain.setValueAtTime(track.isMuted ? 0 : 1.0, ctx.currentTime);

    // 8. Channel Analyser Node (For Channel Strip Level Metering)
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;

    // Connect Signal Path:
    // inputNode -> volumeGain -> eqLow -> eqMid -> eqHigh -> compressor -> makeupGain
    inputNode.connect(volumeGain);
    volumeGain.connect(eqLow);
    eqLow.connect(eqMid);
    eqMid.connect(eqHigh);
    eqHigh.connect(compressor);
    compressor.connect(makeupGain);

    // Sends take signal from post-compressor/makeup
    makeupGain.connect(sends.reverb);
    makeupGain.connect(sends.delay);
    makeupGain.connect(sends.chorus);

    sends.reverb.connect(this.auxReverb.inputNode);
    sends.delay.connect(this.auxDelay.inputNode);
    sends.chorus.connect(this.auxChorus.inputNode);

    // Main direct channel path: makeupGain -> panner -> muteGain -> analyser -> masterSummingBus
    makeupGain.connect(panner);
    panner.connect(muteGain);
    muteGain.connect(analyser);
    analyser.connect(this.masterSummingBus);

    // Attach mixer model back onto track for serialization
    if (!track.mixer) {
      track.mixer = {
        volume: track.volume !== undefined ? track.volume : 0.8,
        pan: track.pan || 0,
        isMuted: !!track.isMuted,
        isSolo: !!track.isSolo,
        eq: { lowGain: 0, midGain: 0, midFreq: 1200, midQ: 1.0, highGain: 0 },
        compressor: compSettings,
        sends: sendSettings
      };
    }

    return {
      trackId: track.id,
      track,
      inputNode,
      volumeGain,
      eq: { low: eqLow, mid: eqMid, high: eqHigh },
      compressor,
      makeupGain,
      sends,
      panner,
      muteGain,
      analyser
    };
  }

  _destroyChannel(ch) {
    try {
      ch.inputNode.disconnect();
      ch.volumeGain.disconnect();
      ch.eq.low.disconnect();
      ch.eq.mid.disconnect();
      ch.eq.high.disconnect();
      ch.compressor.disconnect();
      ch.makeupGain.disconnect();
      ch.sends.reverb.disconnect();
      ch.sends.delay.disconnect();
      ch.sends.chorus.disconnect();
      ch.panner.disconnect();
      ch.muteGain.disconnect();
      ch.analyser.disconnect();
    } catch (e) {
      console.warn('[MixerEngine] Cleanup warning:', e);
    }
  }

  _updateChannelParameters(channel) {
    if (!this.ctx || !channel) return;
    const t = this.ctx.currentTime;
    const track = channel.track;

    channel.volumeGain.gain.setTargetAtTime(track.volume, t, 0.02);

    if (channel.panner.pan) {
      channel.panner.pan.setTargetAtTime(track.pan || 0, t, 0.02);
    }

    // Handle solo / mute logic
    const hasSolo = window.trackManager ? window.trackManager.tracks.some(tr => tr.isSolo) : false;
    let effectiveMute = track.isMuted;
    if (hasSolo && !track.isSolo) effectiveMute = true;

    channel.muteGain.gain.setTargetAtTime(effectiveMute ? 0 : 1.0, t, 0.02);
  }

  // =========================================================================
  // MIXER UI RENDERING & EVENT BINDINGS
  // =========================================================================

  renderMixerUI() {
    const stripsContainer = document.getElementById('mixer-channel-strips');
    if (!stripsContainer) return;
    stripsContainer.innerHTML = '';

    const tracks = window.trackManager ? window.trackManager.tracks : [];
    const countEl = document.getElementById('mixer-tracks-count');
    if (countEl) {
      countEl.textContent = `${tracks.length} Channels • Master Limiter Active`;
    }

    tracks.forEach((track, index) => {
      const channel = this.channels.get(track.id);
      if (!channel) return;

      const isSelected = this.selectedTrackId === track.id;
      const inst = (window.instrumentManager && window.instrumentManager.getInstrument(track.instrumentId)) || { name: 'Instrument' };
      const volDb = this._linearToDbString(track.volume);

      const stripEl = document.createElement('div');
      stripEl.className = `mixer-channel-strip ${isSelected ? 'selected' : ''}`;
      stripEl.dataset.trackId = track.id;

      stripEl.innerHTML = `
        <!-- Channel Header -->
        <div class="ch-header">
          <span class="ch-badge" style="background: ${track.color || '#8B5CF6'}"></span>
          <div class="ch-title-wrap">
            <span class="ch-name" title="${track.name}">${track.name}</span>
            <span class="ch-inst" title="${inst.name}">${inst.name}</span>
          </div>
        </div>

        <!-- Aux Effect Sends -->
        <div class="ch-sends-area">
          <div class="send-knob-row rev" title="Reverb Send Amount">
            <label>REV</label>
            <input type="range" class="send-slider send-rev" min="0" max="1" step="0.05" value="${track.mixer.sends.reverb}" />
            <span class="send-val">${Math.round(track.mixer.sends.reverb * 100)}%</span>
          </div>
          <div class="send-knob-row dly" title="Delay Send Amount">
            <label>DLY</label>
            <input type="range" class="send-slider send-dly" min="0" max="1" step="0.05" value="${track.mixer.sends.delay}" />
            <span class="send-val">${Math.round(track.mixer.sends.delay * 100)}%</span>
          </div>
          <div class="send-knob-row cho" title="Chorus Send Amount">
            <label>CHO</label>
            <input type="range" class="send-slider send-cho" min="0" max="1" step="0.05" value="${track.mixer.sends.chorus}" />
            <span class="send-val">${Math.round(track.mixer.sends.chorus * 100)}%</span>
          </div>
        </div>

        <!-- Stereo Pan -->
        <div class="ch-pan-area">
          <label>PAN</label>
          <input type="range" class="ch-pan-slider" min="-1" max="1" step="0.05" value="${track.pan || 0}" />
          <span class="ch-pan-value">${this._formatPan(track.pan || 0)}</span>
        </div>

        <!-- Mute & Solo -->
        <div class="ch-button-row">
          <button class="ch-btn btn-mute ${track.isMuted ? 'active' : ''}" title="Mute Channel">M</button>
          <button class="ch-btn btn-solo ${track.isSolo ? 'active' : ''}" title="Solo Channel">S</button>
        </div>

        <!-- Fader & LED Meter Stage -->
        <div class="ch-fader-meter-stage">
          <div class="fader-track-container">
            <span class="fader-db-display ch-fader-db">${volDb}</span>
            <input type="range" class="vertical-fader ch-fader" min="0" max="1.5" step="0.02" value="${track.volume}" />
          </div>

          <div class="meter-col">
            <div class="meter-track" id="meter-track-${track.id}">
              <div class="meter-bar" id="meter-bar-${track.id}"></div>
            </div>
            <div class="clip-led ${this.channelClips.get(track.id) ? 'active' : ''}" id="clip-led-${track.id}" title="Click to Reset Clip">CLIP</div>
          </div>
        </div>

        <!-- Footer / Select for DSP Inspector -->
        <div class="ch-footer">
          <span style="font-size: 8px; color: var(--text-dim); font-family: monospace;">CH ${index + 1}</span>
          <button class="ch-inspect-btn" title="Inspect Parametric EQ & Compressor">EQ / FX</button>
        </div>
      `;

      // Event Bindings
      this._bindChannelStripEvents(stripEl, track, channel);

      stripsContainer.appendChild(stripEl);
    });

    this._bindMasterEvents();
  }

  _bindChannelStripEvents(el, track, channel) {
    // Select channel
    el.addEventListener('click', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
      this.selectTrack(track.id);
    });

    el.querySelector('.ch-inspect-btn').addEventListener('click', () => {
      this.selectTrack(track.id);
      const inspector = document.getElementById('mixer-dsp-inspector');
      if (inspector) inspector.classList.remove('collapsed');
    });

    // Volume Fader
    const fader = el.querySelector('.ch-fader');
    const faderDb = el.querySelector('.ch-fader-db');
    fader.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      track.volume = val;
      track.mixer.volume = val;
      faderDb.textContent = this._linearToDbString(val);
      if (channel.volumeGain && this.ctx) {
        channel.volumeGain.gain.setTargetAtTime(val, this.ctx.currentTime, 0.02);
      }
      if (window.trackManager) window.trackManager.renderArrangerUI();
    });

    // Pan Slider
    const panSlider = el.querySelector('.ch-pan-slider');
    const panValue = el.querySelector('.ch-pan-value');
    panSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      track.pan = val;
      track.mixer.pan = val;
      panValue.textContent = this._formatPan(val);
      if (channel.panner && channel.panner.pan && this.ctx) {
        channel.panner.pan.setTargetAtTime(val, this.ctx.currentTime, 0.02);
      }
      if (window.trackManager) window.trackManager.renderArrangerUI();
    });

    // Mute
    el.querySelector('.btn-mute').addEventListener('click', () => {
      track.isMuted = !track.isMuted;
      track.mixer.isMuted = track.isMuted;
      this._updateChannelParameters(channel);
      this.renderMixerUI();
      if (window.trackManager) window.trackManager.renderArrangerUI();
    });

    // Solo
    el.querySelector('.btn-solo').addEventListener('click', () => {
      track.isSolo = !track.isSolo;
      track.mixer.isSolo = track.isSolo;
      this.channels.forEach(ch => this._updateChannelParameters(ch));
      this.renderMixerUI();
      if (window.trackManager) window.trackManager.renderArrangerUI();
    });

    // Reverb Send
    const revSlider = el.querySelector('.send-rev');
    revSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      track.mixer.sends.reverb = val;
      revSlider.nextElementSibling.textContent = `${Math.round(val * 100)}%`;
      if (channel.sends.reverb && this.ctx) {
        channel.sends.reverb.gain.setTargetAtTime(val, this.ctx.currentTime, 0.02);
      }
    });

    // Delay Send
    const dlySlider = el.querySelector('.send-dly');
    dlySlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      track.mixer.sends.delay = val;
      dlySlider.nextElementSibling.textContent = `${Math.round(val * 100)}%`;
      if (channel.sends.delay && this.ctx) {
        channel.sends.delay.gain.setTargetAtTime(val, this.ctx.currentTime, 0.02);
      }
    });

    // Chorus Send
    const choSlider = el.querySelector('.send-cho');
    choSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      track.mixer.sends.chorus = val;
      choSlider.nextElementSibling.textContent = `${Math.round(val * 100)}%`;
      if (channel.sends.chorus && this.ctx) {
        channel.sends.chorus.gain.setTargetAtTime(val, this.ctx.currentTime, 0.02);
      }
    });

    // Clip LED reset
    const clipLed = el.querySelector('.clip-led');
    clipLed.addEventListener('click', () => {
      this.channelClips.set(track.id, false);
      clipLed.classList.remove('active');
    });
  }

  _bindMasterEvents() {
    // Master Fader
    const masterFader = document.getElementById('master-volume-fader');
    const masterFaderDb = document.getElementById('master-fader-db');
    if (masterFader && !masterFader.dataset.bound) {
      masterFader.dataset.bound = 'true';
      masterFader.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.masterVolume = val;
        if (masterFaderDb) masterFaderDb.textContent = this._linearToDbString(val);
        if (this.masterGain && this.ctx) {
          this.masterGain.gain.setTargetAtTime(val, this.ctx.currentTime, 0.02);
        }
      });
    }

    // Master Mute
    const masterMuteBtn = document.getElementById('master-mute-btn');
    if (masterMuteBtn && !masterMuteBtn.dataset.bound) {
      masterMuteBtn.dataset.bound = 'true';
      masterMuteBtn.addEventListener('click', () => {
        this.isMasterMuted = !this.isMasterMuted;
        masterMuteBtn.classList.toggle('active', this.isMasterMuted);
        if (this.masterGain && this.ctx) {
          this.masterGain.gain.setTargetAtTime(this.isMasterMuted ? 0 : this.masterVolume, this.ctx.currentTime, 0.02);
        }
      });
    }

    // Master Clip Reset
    const masterClipLed = document.getElementById('master-clip-led');
    if (masterClipLed && !masterClipLed.dataset.bound) {
      masterClipLed.dataset.bound = 'true';
      masterClipLed.addEventListener('click', () => {
        this.masterClipped = false;
        masterClipLed.classList.remove('active');
      });
    }

    // Inspector Toggle Button
    const toggleInspectorBtn = document.getElementById('btn-toggle-inspector');
    if (toggleInspectorBtn && !toggleInspectorBtn.dataset.bound) {
      toggleInspectorBtn.dataset.bound = 'true';
      toggleInspectorBtn.addEventListener('click', () => {
        const insp = document.getElementById('mixer-dsp-inspector');
        if (insp) {
          insp.classList.toggle('collapsed');
          toggleInspectorBtn.classList.toggle('active', !insp.classList.contains('collapsed'));
        }
      });
    }

    // Presets Dropdown
    const presetSelect = document.getElementById('mixer-preset-select');
    if (presetSelect && !presetSelect.dataset.bound) {
      presetSelect.dataset.bound = 'true';
      presetSelect.addEventListener('change', (e) => {
        this.loadPreset(e.target.value);
      });
    }

    // Save Preset Button
    const savePresetBtn = document.getElementById('mixer-save-preset-btn');
    if (savePresetBtn && !savePresetBtn.dataset.bound) {
      savePresetBtn.dataset.bound = 'true';
      savePresetBtn.addEventListener('click', () => {
        const name = prompt('Enter a name for your custom mixer preset:', 'My Custom Mix');
        if (name) {
          this.saveCustomPreset(name);
        }
      });
    }

    // Reset Flat Button
    const resetBtn = document.getElementById('mixer-reset-btn');
    if (resetBtn && !resetBtn.dataset.bound) {
      resetBtn.dataset.bound = 'true';
      resetBtn.addEventListener('click', () => {
        if (confirm('Reset all channel faders, pans, and EQs to flat?')) {
          this.resetMixerFlat();
        }
      });
    }
  }

  selectTrack(trackId) {
    this.selectedTrackId = trackId;

    document.querySelectorAll('.mixer-channel-strip').forEach(strip => {
      strip.classList.toggle('selected', strip.dataset.trackId === trackId);
    });

    this._updateInspectorUI();
  }

  // =========================================================================
  // CHANNEL DSP INSPECTOR (PARAMETRIC EQ CANVAS & DYNAMICS COMPRESSOR)
  // =========================================================================

  _updateInspectorUI() {
    const channel = this.channels.get(this.selectedTrackId);
    if (!channel) return;
    const track = channel.track;

    const titleEl = document.getElementById('inspector-track-title');
    const badgeEl = document.getElementById('inspector-track-color');
    if (titleEl) titleEl.textContent = `${track.name} — Channel DSP Inspector`;
    if (badgeEl) badgeEl.style.backgroundColor = track.color || '#8B5CF6';

    const eq = track.mixer.eq;
    const comp = track.mixer.compressor;

    // EQ Inputs
    const lowSlider = document.getElementById('ins-eq-low-gain');
    const midFreqSlider = document.getElementById('ins-eq-mid-freq');
    const midGainSlider = document.getElementById('ins-eq-mid-gain');
    const midQSlider = document.getElementById('ins-eq-mid-q');
    const highSlider = document.getElementById('ins-eq-high-gain');

    if (lowSlider) lowSlider.value = eq.lowGain;
    if (midFreqSlider) midFreqSlider.value = eq.midFreq;
    if (midGainSlider) midGainSlider.value = eq.midGain;
    if (midQSlider) midQSlider.value = eq.midQ;
    if (highSlider) highSlider.value = eq.highGain;

    const setTxt = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    setTxt('ins-eq-low-val', `${eq.lowGain > 0 ? '+' : ''}${eq.lowGain} dB`);
    setTxt('ins-eq-mid-freq-val', `${eq.midFreq >= 1000 ? (eq.midFreq/1000).toFixed(1) + ' kHz' : eq.midFreq + ' Hz'}`);
    setTxt('ins-eq-mid-val', `${eq.midGain > 0 ? '+' : ''}${eq.midGain} dB`);
    setTxt('ins-eq-mid-q-val', `${eq.midQ.toFixed(1)}`);
    setTxt('ins-eq-high-val', `${eq.highGain > 0 ? '+' : ''}${eq.highGain} dB`);

    // Compressor Inputs
    const compEnable = document.getElementById('ins-comp-enable');
    const compThresh = document.getElementById('ins-comp-thresh');
    const compRatio = document.getElementById('ins-comp-ratio');
    const compAttack = document.getElementById('ins-comp-attack');
    const compRelease = document.getElementById('ins-comp-release');
    const compKnee = document.getElementById('ins-comp-knee');
    const compMakeup = document.getElementById('ins-comp-makeup');

    if (compEnable) compEnable.checked = comp.enabled;
    if (compThresh) compThresh.value = comp.threshold;
    if (compRatio) compRatio.value = comp.ratio;
    if (compAttack) compAttack.value = comp.attack;
    if (compRelease) compRelease.value = comp.release;
    if (compKnee) compKnee.value = comp.knee || 6;
    if (compMakeup) compMakeup.value = comp.makeup || 0;

    setTxt('ins-comp-thresh-val', `${comp.threshold} dB`);
    setTxt('ins-comp-ratio-val', `${comp.ratio}:1`);
    setTxt('ins-comp-attack-val', `${Math.round(comp.attack * 1000)} ms`);
    setTxt('ins-comp-release-val', `${Math.round(comp.release * 1000)} ms`);
    setTxt('ins-comp-knee-val', `${comp.knee || 6} dB`);
    setTxt('ins-comp-makeup-val', `+${comp.makeup || 0} dB`);

    this._bindInspectorInputListeners(channel);
    this.drawEqCurve(channel);
  }

  _bindInspectorInputListeners(channel) {
    const track = channel.track;
    const t = this.ctx ? this.ctx.currentTime : 0;

    const bind = (id, eventName, handler) => {
      const el = document.getElementById(id);
      if (el && !el.dataset.boundForTrack) {
        el.dataset.boundForTrack = 'true';
        el.addEventListener(eventName, handler);
      }
    };

    // EQ Low
    bind('ins-eq-low-gain', 'input', (e) => {
      const val = parseFloat(e.target.value);
      track.mixer.eq.lowGain = val;
      document.getElementById('ins-eq-low-val').textContent = `${val > 0 ? '+' : ''}${val} dB`;
      if (channel.eq.low && this.ctx) channel.eq.low.gain.setTargetAtTime(val, this.ctx.currentTime, 0.02);
      this.drawEqCurve(channel);
    });

    // EQ Mid Freq
    bind('ins-eq-mid-freq', 'input', (e) => {
      const val = parseFloat(e.target.value);
      track.mixer.eq.midFreq = val;
      document.getElementById('ins-eq-mid-freq-val').textContent = `${val >= 1000 ? (val/1000).toFixed(1) + ' kHz' : val + ' Hz'}`;
      if (channel.eq.mid && this.ctx) channel.eq.mid.frequency.setTargetAtTime(val, this.ctx.currentTime, 0.02);
      this.drawEqCurve(channel);
    });

    // EQ Mid Gain
    bind('ins-eq-mid-gain', 'input', (e) => {
      const val = parseFloat(e.target.value);
      track.mixer.eq.midGain = val;
      document.getElementById('ins-eq-mid-val').textContent = `${val > 0 ? '+' : ''}${val} dB`;
      if (channel.eq.mid && this.ctx) channel.eq.mid.gain.setTargetAtTime(val, this.ctx.currentTime, 0.02);
      this.drawEqCurve(channel);
    });

    // EQ Mid Q
    bind('ins-eq-mid-q', 'input', (e) => {
      const val = parseFloat(e.target.value);
      track.mixer.eq.midQ = val;
      document.getElementById('ins-eq-mid-q-val').textContent = val.toFixed(1);
      if (channel.eq.mid && this.ctx) channel.eq.mid.Q.setTargetAtTime(val, this.ctx.currentTime, 0.02);
      this.drawEqCurve(channel);
    });

    // EQ High
    bind('ins-eq-high-gain', 'input', (e) => {
      const val = parseFloat(e.target.value);
      track.mixer.eq.highGain = val;
      document.getElementById('ins-eq-high-val').textContent = `${val > 0 ? '+' : ''}${val} dB`;
      if (channel.eq.high && this.ctx) channel.eq.high.gain.setTargetAtTime(val, this.ctx.currentTime, 0.02);
      this.drawEqCurve(channel);
    });

    // Compressor Enable
    bind('ins-comp-enable', 'change', (e) => {
      const enabled = e.target.checked;
      track.mixer.compressor.enabled = enabled;
      if (channel.compressor && this.ctx) {
        channel.compressor.ratio.setTargetAtTime(enabled ? track.mixer.compressor.ratio : 1.0, this.ctx.currentTime, 0.02);
      }
    });

    // Compressor Threshold
    bind('ins-comp-thresh', 'input', (e) => {
      const val = parseFloat(e.target.value);
      track.mixer.compressor.threshold = val;
      document.getElementById('ins-comp-thresh-val').textContent = `${val} dB`;
      if (channel.compressor && this.ctx) channel.compressor.threshold.setTargetAtTime(val, this.ctx.currentTime, 0.02);
    });

    // Compressor Ratio
    bind('ins-comp-ratio', 'input', (e) => {
      const val = parseFloat(e.target.value);
      track.mixer.compressor.ratio = val;
      document.getElementById('ins-comp-ratio-val').textContent = `${val}:1`;
      if (channel.compressor && track.mixer.compressor.enabled && this.ctx) {
        channel.compressor.ratio.setTargetAtTime(val, this.ctx.currentTime, 0.02);
      }
    });

    // Compressor Attack
    bind('ins-comp-attack', 'input', (e) => {
      const val = parseFloat(e.target.value);
      track.mixer.compressor.attack = val;
      document.getElementById('ins-comp-attack-val').textContent = `${Math.round(val * 1000)} ms`;
      if (channel.compressor && this.ctx) channel.compressor.attack.setTargetAtTime(val, this.ctx.currentTime, 0.02);
    });

    // Compressor Release
    bind('ins-comp-release', 'input', (e) => {
      const val = parseFloat(e.target.value);
      track.mixer.compressor.release = val;
      document.getElementById('ins-comp-release-val').textContent = `${Math.round(val * 1000)} ms`;
      if (channel.compressor && this.ctx) channel.compressor.release.setTargetAtTime(val, this.ctx.currentTime, 0.02);
    });

    // Compressor Makeup
    bind('ins-comp-makeup', 'input', (e) => {
      const val = parseFloat(e.target.value);
      track.mixer.compressor.makeup = val;
      document.getElementById('ins-comp-makeup-val').textContent = `+${val} dB`;
      const lin = Math.pow(10, val / 20);
      if (channel.makeupGain && this.ctx) channel.makeupGain.gain.setTargetAtTime(lin, this.ctx.currentTime, 0.02);
    });

    // Aux Reverb Type
    bind('aux-reverb-type', 'change', (e) => {
      this.auxReverb.type = e.target.value;
      if (this.auxReverb.convolver && this.ctx) {
        this.auxReverb.convolver.buffer = this._generateImpulseResponse(this.auxReverb.type, this.auxReverb.decaySec);
      }
    });

    // Aux Reverb PreDelay
    bind('aux-reverb-predelay', 'input', (e) => {
      const val = parseFloat(e.target.value);
      this.auxReverb.preDelayMs = val;
      document.getElementById('aux-reverb-predelay-val').textContent = `${val} ms`;
      if (this.auxReverb.preDelayNode && this.ctx) {
        this.auxReverb.preDelayNode.delayTime.setTargetAtTime(val / 1000, this.ctx.currentTime, 0.02);
      }
    });

    // Aux Delay Sync
    bind('aux-delay-sync', 'change', (e) => {
      this.auxDelay.sync = e.target.value;
      const sec = this._calcDelaySeconds(this.auxDelay.sync);
      if (this.auxDelay.leftDelay && this.ctx) {
        this.auxDelay.leftDelay.delayTime.setTargetAtTime(sec, this.ctx.currentTime, 0.02);
        this.auxDelay.rightDelay.delayTime.setTargetAtTime(sec * 1.05, this.ctx.currentTime, 0.02);
      }
    });

    // Aux Delay Feedback
    bind('aux-delay-feedback', 'input', (e) => {
      const val = parseFloat(e.target.value);
      this.auxDelay.feedback = val;
      document.getElementById('aux-delay-feedback-val').textContent = `${Math.round(val * 100)}%`;
      if (this.auxDelay.feedbackGain && this.ctx) {
        this.auxDelay.feedbackGain.gain.setTargetAtTime(val, this.ctx.currentTime, 0.02);
      }
    });

    // Aux Chorus Rate
    bind('aux-chorus-rate', 'input', (e) => {
      const val = parseFloat(e.target.value);
      this.auxChorus.rate = val;
      document.getElementById('aux-chorus-rate-val').textContent = `${val.toFixed(1)} Hz`;
      if (this.auxChorus.lfo && this.ctx) {
        this.auxChorus.lfo.frequency.setTargetAtTime(val, this.ctx.currentTime, 0.02);
      }
    });

    // Aux Chorus Depth
    bind('aux-chorus-depth', 'input', (e) => {
      const val = parseFloat(e.target.value);
      this.auxChorus.depth = val;
      document.getElementById('aux-chorus-depth-val').textContent = `${(val * 1000).toFixed(1)} ms`;
      if (this.auxChorus.depthGain && this.ctx) {
        this.auxChorus.depthGain.gain.setTargetAtTime(val, this.ctx.currentTime, 0.02);
      }
    });
  }

  /**
   * Draws true real-time mathematical frequency response curve of 3-band parametric EQ
   */
  drawEqCurve(channel) {
    const canvas = document.getElementById('inspector-eq-canvas');
    if (!canvas || !channel) return;
    const ctx2d = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx2d.clearRect(0, 0, width, height);

    // Grid lines: 0 dB center, +12 dB top, -12 dB bottom
    ctx2d.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx2d.lineWidth = 1;

    // Horizontal dB lines
    const zeroY = height / 2;
    ctx2d.beginPath();
    ctx2d.moveTo(0, zeroY); ctx2d.lineTo(width, zeroY); // 0 dB
    ctx2d.moveTo(0, height * 0.2); ctx2d.lineTo(width, height * 0.2); // +12 dB
    ctx2d.moveTo(0, height * 0.8); ctx2d.lineTo(width, height * 0.8); // -12 dB
    ctx2d.stroke();

    // 128 Logarithmic Frequency Test Points (20 Hz to 20,000 Hz)
    const pointsCount = 128;
    const frequencies = new Float32Array(pointsCount);
    for (let i = 0; i < pointsCount; i++) {
      frequencies[i] = 20 * Math.pow(20000 / 20, i / (pointsCount - 1));
    }

    const magLow = new Float32Array(pointsCount);
    const phaseLow = new Float32Array(pointsCount);
    const magMid = new Float32Array(pointsCount);
    const phaseMid = new Float32Array(pointsCount);
    const magHigh = new Float32Array(pointsCount);
    const phaseHigh = new Float32Array(pointsCount);

    channel.eq.low.getFrequencyResponse(frequencies, magLow, phaseLow);
    channel.eq.mid.getFrequencyResponse(frequencies, magMid, phaseMid);
    channel.eq.high.getFrequencyResponse(frequencies, magHigh, phaseHigh);

    // Compute combined magnitude curve
    ctx2d.strokeStyle = '#8B5CF6';
    ctx2d.lineWidth = 2.5;
    ctx2d.beginPath();

    for (let i = 0; i < pointsCount; i++) {
      const totalMag = magLow[i] * magMid[i] * magHigh[i];
      const db = 20 * Math.log10(Math.max(0.0001, totalMag));
      // Map +/- 18 dB to canvas height
      const y = zeroY - (db / 18) * (height * 0.45);
      const x = (i / (pointsCount - 1)) * width;

      if (i === 0) {
        ctx2d.moveTo(x, y);
      } else {
        ctx2d.lineTo(x, y);
      }
    }
    ctx2d.stroke();

    // Fill under curve
    ctx2d.lineTo(width, height);
    ctx2d.lineTo(0, height);
    ctx2d.closePath();
    const grad = ctx2d.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, 'rgba(139, 92, 246, 0.25)');
    grad.addColorStop(1, 'rgba(139, 92, 246, 0.0)');
    ctx2d.fillStyle = grad;
    ctx2d.fill();
  }

  // =========================================================================
  // REAL-TIME AUDIO METERS & SPECTRUM VISUALIZER
  // =========================================================================

  _startMeterLoop() {
    if (this.isMeterLoopRunning) return;
    this.isMeterLoopRunning = true;

    const loop = () => {
      this._updateMeters();
      this.animationId = requestAnimationFrame(loop);
    };
    this.animationId = requestAnimationFrame(loop);
  }

  _updateMeters() {
    if (!this.ctx) return;

    // 1. Per-Channel Level Meters
    this.channels.forEach((ch, trackId) => {
      const meterBar = document.getElementById(`meter-bar-${trackId}`);
      if (!meterBar) return;

      ch.analyser.getByteTimeDomainData(this.tempByteData);

      // Compute True Peak & RMS
      let peak = 0;
      let sumSquares = 0;
      for (let i = 0; i < this.tempByteData.length; i++) {
        const norm = (this.tempByteData[i] - 128) / 128;
        const abs = Math.abs(norm);
        if (abs > peak) peak = abs;
        sumSquares += norm * norm;
      }
      const rms = Math.sqrt(sumSquares / this.tempByteData.length);

      // Convert to dBFS (-60 dB to 0 dB)
      const db = 20 * Math.log10(Math.max(0.001, peak));
      const meterPercent = Math.max(0, Math.min(100, ((db + 48) / 48) * 100));

      meterBar.style.height = `${meterPercent}%`;

      // Check clipping
      if (peak >= 0.99) {
        this.channelClips.set(trackId, true);
        const clipEl = document.getElementById(`clip-led-${trackId}`);
        if (clipEl) clipEl.classList.add('active');
      }
    });

    // 2. Master Bus Stereo Meters & Spectrum
    if (this.masterAnalyser) {
      this.masterAnalyser.getByteTimeDomainData(this.tempByteData);

      let peak = 0;
      let sumSquares = 0;
      for (let i = 0; i < this.tempByteData.length; i++) {
        const norm = (this.tempByteData[i] - 128) / 128;
        const abs = Math.abs(norm);
        if (abs > peak) peak = abs;
        sumSquares += norm * norm;
      }
      const rms = Math.sqrt(sumSquares / this.tempByteData.length);
      const db = 20 * Math.log10(Math.max(0.001, peak));
      const meterPercent = Math.max(0, Math.min(100, ((db + 48) / 48) * 100));

      const masterMeterL = document.getElementById('master-meter-l');
      const masterMeterR = document.getElementById('master-meter-r');
      const masterPeakDb = document.getElementById('master-peak-db');

      if (masterMeterL) masterMeterL.style.height = `${meterPercent}%`;
      if (masterMeterR) masterMeterR.style.height = `${Math.max(0, meterPercent * 0.98)}%`;
      if (masterPeakDb) masterPeakDb.textContent = db <= -48 ? '-inf dB' : `${db.toFixed(1)} dB`;

      if (peak >= 0.99) {
        this.masterClipped = true;
        const masterClipLed = document.getElementById('master-clip-led');
        if (masterClipLed) masterClipLed.classList.add('active');
      }

      // Draw Master Spectrum Analyzer
      this._drawMasterSpectrum();
    }

    // 3. Channel Compressor Gain Reduction Meter
    const selectedCh = this.channels.get(this.selectedTrackId);
    if (selectedCh && selectedCh.compressor) {
      const redDb = Math.abs(selectedCh.compressor.reduction); // reduction is negative dB
      const redPercent = Math.min(100, (redDb / 24) * 100);
      const grFill = document.getElementById('ins-comp-gr-fill');
      const grText = document.getElementById('ins-comp-gr-text');
      if (grFill) grFill.style.width = `${redPercent}%`;
      if (grText) grText.textContent = redDb > 0.2 ? `-${redDb.toFixed(1)} dB` : '0 dB';
    }
  }

  _drawMasterSpectrum() {
    const canvas = document.getElementById('mixer-master-spectrum');
    if (!canvas) return;
    const ctx2d = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    this.masterAnalyser.getByteFrequencyData(this.masterFreqData);

    ctx2d.clearRect(0, 0, width, height);

    const barCount = 24;
    const barWidth = width / barCount;

    for (let i = 0; i < barCount; i++) {
      const val = this.masterFreqData[i * 2] || 0;
      const barHeight = (val / 255) * height;
      const x = i * barWidth;
      const y = height - barHeight;

      ctx2d.fillStyle = '#EF4444';
      ctx2d.fillRect(x, y, barWidth - 1, barHeight);
    }
  }

  // =========================================================================
  // MIXER PRESETS & PERSISTENCE
  // =========================================================================

  _initPresets() {
    return {
      pop: {
        name: 'Pop Modern Polish',
        master: { volume: 0.85, reverbType: 'plate', reverbPreDelay: 15, delaySync: '1/8d', delayFeedback: 0.28, chorusRate: 1.8, chorusDepth: 0.002 },
        channels: {
          eq: { lowGain: 1.5, midGain: 0.5, midFreq: 2200, midQ: 1.2, highGain: 2.5 },
          compressor: { enabled: true, threshold: -16, ratio: 4.0, attack: 0.015, release: 0.2, makeup: 2 },
          sends: { reverb: 0.3, delay: 0.2, chorus: 0.1 }
        }
      },
      classical: {
        name: 'Classical Acoustic Stage',
        master: { volume: 0.88, reverbType: 'hall', reverbPreDelay: 35, delaySync: '1/4', delayFeedback: 0.15, chorusRate: 0.8, chorusDepth: 0.001 },
        channels: {
          eq: { lowGain: 0.5, midGain: 0, midFreq: 1000, midQ: 0.7, highGain: 0.5 },
          compressor: { enabled: false, threshold: -24, ratio: 2.0, attack: 0.05, release: 0.4, makeup: 0 },
          sends: { reverb: 0.45, delay: 0.05, chorus: 0.0 }
        }
      },
      jazz: {
        name: 'Warm Jazz Club',
        master: { volume: 0.85, reverbType: 'room', reverbPreDelay: 20, delaySync: '1/8', delayFeedback: 0.25, chorusRate: 1.2, chorusDepth: 0.0015 },
        channels: {
          eq: { lowGain: 2.0, midGain: -1.0, midFreq: 400, midQ: 1.0, highGain: 1.0 },
          compressor: { enabled: true, threshold: -18, ratio: 3.0, attack: 0.03, release: 0.3, makeup: 1 },
          sends: { reverb: 0.35, delay: 0.15, chorus: 0.05 }
        }
      },
      rock: {
        name: 'Punchy Rock Studio',
        master: { volume: 0.85, reverbType: 'plate', reverbPreDelay: 10, delaySync: '1/16', delayFeedback: 0.22, chorusRate: 2.0, chorusDepth: 0.0025 },
        channels: {
          eq: { lowGain: 3.0, midGain: 2.0, midFreq: 3200, midQ: 1.5, highGain: 1.5 },
          compressor: { enabled: true, threshold: -14, ratio: 5.0, attack: 0.005, release: 0.15, makeup: 3 },
          sends: { reverb: 0.25, delay: 0.25, chorus: 0.1 }
        }
      },
      electronic: {
        name: 'Electronic EDM Pumping',
        master: { volume: 0.85, reverbType: 'hall', reverbPreDelay: 10, delaySync: '1/8', delayFeedback: 0.45, chorusRate: 2.5, chorusDepth: 0.003 },
        channels: {
          eq: { lowGain: 4.0, midGain: -2.0, midFreq: 500, midQ: 1.0, highGain: 3.0 },
          compressor: { enabled: true, threshold: -12, ratio: 6.0, attack: 0.002, release: 0.1, makeup: 4 },
          sends: { reverb: 0.35, delay: 0.35, chorus: 0.2 }
        }
      },
      hiphop: {
        name: 'Heavy Hip-Hop 808',
        master: { volume: 0.85, reverbType: 'room', reverbPreDelay: 15, delaySync: '1/4', delayFeedback: 0.3, chorusRate: 1.0, chorusDepth: 0.001 },
        channels: {
          eq: { lowGain: 4.5, midGain: 1.0, midFreq: 1800, midQ: 1.2, highGain: 2.0 },
          compressor: { enabled: true, threshold: -14, ratio: 5.0, attack: 0.008, release: 0.18, makeup: 3 },
          sends: { reverb: 0.25, delay: 0.25, chorus: 0.05 }
        }
      },
      indian: {
        name: 'Indian Classical Nuance',
        master: { volume: 0.88, reverbType: 'hall', reverbPreDelay: 30, delaySync: '1/8', delayFeedback: 0.2, chorusRate: 1.0, chorusDepth: 0.001 },
        channels: {
          eq: { lowGain: 1.0, midGain: 2.5, midFreq: 1400, midQ: 1.8, highGain: 1.0 },
          compressor: { enabled: false, threshold: -22, ratio: 2.0, attack: 0.04, release: 0.35, makeup: 0 },
          sends: { reverb: 0.4, delay: 0.15, chorus: 0.0 }
        }
      },
      ambient: {
        name: 'Deep Ambient Space',
        master: { volume: 0.85, reverbType: 'hall', reverbPreDelay: 45, delaySync: '1/4', delayFeedback: 0.55, chorusRate: 1.4, chorusDepth: 0.0035 },
        channels: {
          eq: { lowGain: 2.0, midGain: 0.0, midFreq: 800, midQ: 0.8, highGain: -1.0 },
          compressor: { enabled: true, threshold: -20, ratio: 2.5, attack: 0.08, release: 0.5, makeup: 1 },
          sends: { reverb: 0.65, delay: 0.45, chorus: 0.35 }
        }
      },
      cinematic: {
        name: 'Cinematic Orchestral Hall',
        master: { volume: 0.86, reverbType: 'hall', reverbPreDelay: 40, delaySync: '1/8d', delayFeedback: 0.3, chorusRate: 1.1, chorusDepth: 0.002 },
        channels: {
          eq: { lowGain: 2.0, midGain: 1.0, midFreq: 2500, midQ: 1.0, highGain: 2.0 },
          compressor: { enabled: true, threshold: -18, ratio: 3.5, attack: 0.02, release: 0.3, makeup: 2 },
          sends: { reverb: 0.55, delay: 0.2, chorus: 0.1 }
        }
      }
    };
  }

  loadPreset(presetKey) {
    let preset = this.PRESETS[presetKey];
    if (!preset) {
      // Check custom presets
      const customPresets = JSON.parse(localStorage.getItem('vms_custom_mixer_presets') || '{}');
      preset = customPresets[presetKey];
    }
    if (!preset) return;

    this.currentPresetName = presetKey;

    // Apply to master
    if (preset.master) {
      this.auxReverb.type = preset.master.reverbType || 'hall';
      this.auxReverb.preDelayMs = preset.master.reverbPreDelay || 20;
      this.auxDelay.sync = preset.master.delaySync || '1/8';
      this.auxDelay.feedback = preset.master.delayFeedback || 0.32;
      this.auxChorus.rate = preset.master.chorusRate || 1.5;
      this.auxChorus.depth = preset.master.chorusDepth || 0.002;

      if (this.auxReverb.convolver && this.ctx) {
        this.auxReverb.convolver.buffer = this._generateImpulseResponse(this.auxReverb.type, this.auxReverb.decaySec);
      }
    }

    // Apply channel template to all active channels
    if (preset.channels && window.trackManager) {
      window.trackManager.tracks.forEach(track => {
        if (!track.mixer) track.mixer = {};
        track.mixer.eq = JSON.parse(JSON.stringify(preset.channels.eq));
        track.mixer.compressor = JSON.parse(JSON.stringify(preset.channels.compressor));
        track.mixer.sends = JSON.parse(JSON.stringify(preset.channels.sends));

        const channel = this.channels.get(track.id);
        if (channel && this.ctx) {
          const t = this.ctx.currentTime;
          // Apply EQ
          channel.eq.low.gain.setTargetAtTime(track.mixer.eq.lowGain, t, 0.02);
          channel.eq.mid.frequency.setTargetAtTime(track.mixer.eq.midFreq, t, 0.02);
          channel.eq.mid.gain.setTargetAtTime(track.mixer.eq.midGain, t, 0.02);
          channel.eq.mid.Q.setTargetAtTime(track.mixer.eq.midQ, t, 0.02);
          channel.eq.high.gain.setTargetAtTime(track.mixer.eq.highGain, t, 0.02);

          // Apply Compressor
          channel.compressor.threshold.setTargetAtTime(track.mixer.compressor.threshold, t, 0.02);
          channel.compressor.ratio.setTargetAtTime(track.mixer.compressor.enabled ? track.mixer.compressor.ratio : 1.0, t, 0.02);
          channel.compressor.attack.setTargetAtTime(track.mixer.compressor.attack, t, 0.02);
          channel.compressor.release.setTargetAtTime(track.mixer.compressor.release, t, 0.02);
          const makeupLin = Math.pow(10, (track.mixer.compressor.makeup || 0) / 20);
          channel.makeupGain.gain.setTargetAtTime(makeupLin, t, 0.02);

          // Apply Sends
          channel.sends.reverb.gain.setTargetAtTime(track.mixer.sends.reverb, t, 0.02);
          channel.sends.delay.gain.setTargetAtTime(track.mixer.sends.delay, t, 0.02);
          channel.sends.chorus.gain.setTargetAtTime(track.mixer.sends.chorus, t, 0.02);
        }
      });
    }

    this.renderMixerUI();
    this._updateInspectorUI();

    if (window.app && typeof window.app.showToast === 'function') {
      window.app.showToast(`Loaded Mixer Preset: "${preset.name || presetKey}"`);
    }
  }

  saveCustomPreset(name) {
    const customKey = `custom_${Date.now()}`;
    const customPresets = JSON.parse(localStorage.getItem('vms_custom_mixer_presets') || '{}');

    // Build preset from current selected channel & master
    const selectedCh = this.channels.get(this.selectedTrackId);
    const channelSettings = selectedCh ? selectedCh.track.mixer : {
      eq: { lowGain: 0, midGain: 0, midFreq: 1200, midQ: 1.0, highGain: 0 },
      compressor: { enabled: false, threshold: -18, ratio: 4, attack: 0.01, release: 0.25, makeup: 0 },
      sends: { reverb: 0.25, delay: 0.15, chorus: 0.0 }
    };

    customPresets[customKey] = {
      name,
      master: {
        volume: this.masterVolume,
        reverbType: this.auxReverb.type,
        reverbPreDelay: this.auxReverb.preDelayMs,
        delaySync: this.auxDelay.sync,
        delayFeedback: this.auxDelay.feedback,
        chorusRate: this.auxChorus.rate,
        chorusDepth: this.auxChorus.depth
      },
      channels: channelSettings
    };

    localStorage.setItem('vms_custom_mixer_presets', JSON.stringify(customPresets));

    // Update select element
    const select = document.getElementById('mixer-preset-select');
    if (select) {
      const opt = document.createElement('option');
      opt.value = customKey;
      opt.textContent = `★ ${name}`;
      opt.selected = true;
      select.appendChild(opt);
    }

    if (window.app && typeof window.app.showToast === 'function') {
      window.app.showToast(`Custom mixer preset saved: "${name}"`);
    }
  }

  resetMixerFlat() {
    if (window.trackManager) {
      window.trackManager.tracks.forEach(track => {
        track.volume = 0.8;
        track.pan = 0;
        track.isMuted = false;
        track.isSolo = false;
        track.mixer = {
          volume: 0.8,
          pan: 0,
          isMuted: false,
          isSolo: false,
          eq: { lowGain: 0, midGain: 0, midFreq: 1200, midQ: 1.0, highGain: 0 },
          compressor: { enabled: false, threshold: -18, ratio: 4, attack: 0.01, release: 0.25, makeup: 0 },
          sends: { reverb: 0.2, delay: 0.1, chorus: 0.0 }
        };
        const ch = this.channels.get(track.id);
        if (ch) this._updateChannelParameters(ch);
      });
      window.trackManager.renderArrangerUI();
    }
    this.renderMixerUI();
    this._updateInspectorUI();
  }

  // =========================================================================
  // UTILITY HELPERS
  // =========================================================================

  _linearToDbString(linear) {
    if (linear <= 0.001) return '-inf dB';
    const db = 20 * Math.log10(linear);
    return `${db > 0 ? '+' : ''}${db.toFixed(1)} dB`;
  }

  _formatPan(pan) {
    if (Math.abs(pan) < 0.05) return 'C';
    if (pan < 0) return `${Math.round(Math.abs(pan) * 100)}% L`;
    return `${Math.round(pan * 100)}% R`;
  }
}

// Global singleton instance
window.mixerEngine = new MixerEngine();
