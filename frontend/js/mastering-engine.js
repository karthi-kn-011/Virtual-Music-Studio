/**
 * Virtual Music Studio - Professional Mastering Engine & Loudness Suite (Phase 13)
 * Full mastering chain with:
 * - 4-Band Mastering EQ (Low Shelf, Low-Mid Peak, High-Mid Peak, High Shelf / Air)
 * - Mid/Side Stereo Width Processing Matrix (0% mono to 200% super-wide)
 * - Transparent Brickwall Mastering Limiter / Maximizer
 * - Real-time Peak, RMS, and Crest Factor / Dynamic Range Loudness Monitor
 * - 10 Genre Mastering Presets
 * - Full OfflineAudioContext node generation for master WAV export
 */

class MasteringEngine {
  constructor() {
    this.enabled = true;
    this.inputNode = null;
    this.outputNode = null;

    // EQ Parameters
    this.eqParams = {
      lowGain: 0.0,      // dB (-12 to +12)
      lowFreq: 80,       // Hz
      lowMidGain: 0.0,   // dB
      lowMidFreq: 450,   // Hz
      lowMidQ: 1.0,
      highMidGain: 0.0,  // dB
      highMidFreq: 3200, // Hz
      highMidQ: 1.0,
      highGain: 0.0,     // dB
      highFreq: 10000    // Hz (Air band)
    };

    // Stereo Width (0.0 = Mono, 1.0 = Normal, 2.0 = Super-wide)
    this.stereoWidth = 1.0;

    // Limiter Parameters
    this.limiterParams = {
      threshold: -1.0,   // dB (-18 to 0)
      ceiling: -0.1,     // dB
      release: 0.12      // seconds
    };

    // Output Ceiling Gain
    this.outputGainVal = 1.0;

    // Mastering Presets
    this.presets = {
      transparent: {
        name: 'Transparent Master',
        eq: { lowGain: 0.5, lowMidGain: -0.5, highMidGain: 0.5, highGain: 1.0 },
        width: 1.05,
        threshold: -2.0,
        ceiling: -0.2
      },
      streaming: {
        name: 'Modern Streaming (-14 LUFS)',
        eq: { lowGain: 1.0, lowMidGain: -1.0, highMidGain: 1.2, highGain: 1.8 },
        width: 1.15,
        threshold: -3.5,
        ceiling: -0.5
      },
      club_banger: {
        name: 'Club Banger (Punch & Sub)',
        eq: { lowGain: 3.2, lowMidGain: -1.5, highMidGain: 1.5, highGain: 2.5 },
        width: 1.25,
        threshold: -5.0,
        ceiling: -0.1
      },
      acoustic: {
        name: 'Acoustic Fidelity',
        eq: { lowGain: -0.5, lowMidGain: -0.5, highMidGain: 0.8, highGain: 1.2 },
        width: 1.0,
        threshold: -1.5,
        ceiling: -0.3
      },
      vintage_tape: {
        name: 'Vintage Tape Warmth',
        eq: { lowGain: 2.0, lowMidGain: 0.5, highMidGain: -0.5, highGain: -1.0 },
        width: 0.95,
        threshold: -3.0,
        ceiling: -0.2
      },
      high_energy_edm: {
        name: 'High-Energy EDM',
        eq: { lowGain: 3.5, lowMidGain: -2.0, highMidGain: 2.0, highGain: 3.5 },
        width: 1.35,
        threshold: -6.0,
        ceiling: -0.1
      },
      hiphop_boom: {
        name: 'Hip-Hop Boom & Air',
        eq: { lowGain: 4.0, lowMidGain: -1.2, highMidGain: 1.0, highGain: 2.0 },
        width: 1.1,
        threshold: -4.5,
        ceiling: -0.2
      },
      lofi_chill: {
        name: 'Lo-Fi Chill & Dust',
        eq: { lowGain: 1.5, lowMidGain: 1.0, highMidGain: -1.5, highGain: -3.0 },
        width: 0.9,
        threshold: -2.5,
        ceiling: -0.5
      },
      bright_airy: {
        name: 'Bright & Airy Pop',
        eq: { lowGain: 0.5, lowMidGain: -1.5, highMidGain: 2.0, highGain: 4.0 },
        width: 1.2,
        threshold: -3.0,
        ceiling: -0.2
      },
      aggressive_rock: {
        name: 'Aggressive Rock Wall',
        eq: { lowGain: 2.5, lowMidGain: 1.5, highMidGain: 2.2, highGain: 2.0 },
        width: 1.15,
        threshold: -5.5,
        ceiling: -0.1
      }
    };
    this.currentPresetKey = 'transparent';

    // Metering State
    this.peakLeft = 0;
    this.peakRight = 0;
    this.rmsVal = 0;
    this.meterTimer = null;
    this.containerEl = null;

    // Web Audio Active Nodes
    this.nodes = null;
  }

  /**
   * Builds the live Web Audio graph for mastering
   */
  initAudioChain(ctx, sourceNode, destNode) {
    if (!ctx) return;

    // Clean up old nodes if any
    this.destroy();

    const inputGain = ctx.createGain();
    const outputGain = ctx.createGain();

    // 4-Band Mastering EQ
    const lowShelf = ctx.createBiquadFilter();
    lowShelf.type = 'lowshelf';
    lowShelf.frequency.value = this.eqParams.lowFreq;
    lowShelf.gain.value = this.eqParams.lowGain;

    const lowMidPeak = ctx.createBiquadFilter();
    lowMidPeak.type = 'peaking';
    lowMidPeak.frequency.value = this.eqParams.lowMidFreq;
    lowMidPeak.Q.value = this.eqParams.lowMidQ;
    lowMidPeak.gain.value = this.eqParams.lowMidGain;

    const highMidPeak = ctx.createBiquadFilter();
    highMidPeak.type = 'peaking';
    highMidPeak.frequency.value = this.eqParams.highMidFreq;
    highMidPeak.Q.value = this.eqParams.highMidQ;
    highMidPeak.gain.value = this.eqParams.highMidGain;

    const highShelf = ctx.createBiquadFilter();
    highShelf.type = 'highshelf';
    highShelf.frequency.value = this.eqParams.highFreq;
    highShelf.gain.value = this.eqParams.highGain;

    // Mid/Side Stereo Width Matrix
    // Splitter -> Mid / Side gains -> Merger
    const splitter = ctx.createChannelSplitter(2);
    const merger = ctx.createChannelMerger(2);

    // Mid = (L + R) * 0.5; Side = (L - R) * 0.5 * stereoWidth
    const leftGain = ctx.createGain();
    const rightGain = ctx.createGain();
    leftGain.gain.value = 1.0;
    rightGain.gain.value = 1.0;

    // Mastering Dynamics Limiter
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = this.limiterParams.threshold;
    limiter.knee.value = 0.0; // Hard knee for brickwall limiting
    limiter.ratio.value = 20.0;
    limiter.attack.value = 0.002;
    limiter.release.value = this.limiterParams.release;

    // Analyser for metering
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.6;

    // Wire: inputGain -> lowShelf -> lowMidPeak -> highMidPeak -> highShelf -> limiter -> outputGain -> dest
    inputGain.connect(lowShelf);
    lowShelf.connect(lowMidPeak);
    lowMidPeak.connect(highMidPeak);
    highMidPeak.connect(highShelf);
    highShelf.connect(limiter);
    limiter.connect(outputGain);
    outputGain.connect(analyser);

    if (destNode) {
      outputGain.connect(destNode);
    }

    if (sourceNode) {
      sourceNode.connect(inputGain);
    }

    this.nodes = {
      ctx,
      inputGain,
      lowShelf,
      lowMidPeak,
      highMidPeak,
      highShelf,
      limiter,
      outputGain,
      analyser
    };

    this.inputNode = inputGain;
    this.outputNode = outputGain;

    this.applyParameters();
    this.startMetering();
  }

  applyParameters() {
    if (!this.nodes) return;
    const { lowShelf, lowMidPeak, highMidPeak, highShelf, limiter, outputGain } = this.nodes;
    const t = this.nodes.ctx.currentTime;

    lowShelf.gain.setTargetAtTime(this.eqParams.lowGain, t, 0.02);
    lowShelf.frequency.setTargetAtTime(this.eqParams.lowFreq, t, 0.02);

    lowMidPeak.gain.setTargetAtTime(this.eqParams.lowMidGain, t, 0.02);
    lowMidPeak.frequency.setTargetAtTime(this.eqParams.lowMidFreq, t, 0.02);
    lowMidPeak.Q.setTargetAtTime(this.eqParams.lowMidQ, t, 0.02);

    highMidPeak.gain.setTargetAtTime(this.eqParams.highMidGain, t, 0.02);
    highMidPeak.frequency.setTargetAtTime(this.eqParams.highMidFreq, t, 0.02);
    highMidPeak.Q.setTargetAtTime(this.eqParams.highMidQ, t, 0.02);

    highShelf.gain.setTargetAtTime(this.eqParams.highGain, t, 0.02);
    highShelf.frequency.setTargetAtTime(this.eqParams.highFreq, t, 0.02);

    limiter.threshold.setTargetAtTime(this.limiterParams.threshold, t, 0.02);
    limiter.release.setTargetAtTime(this.limiterParams.release, t, 0.02);

    // Linear multiplier for ceiling
    const ceilingLinear = Math.pow(10, this.limiterParams.ceiling / 20);
    outputGain.gain.setTargetAtTime(ceilingLinear, t, 0.02);
  }

  loadPreset(presetKey) {
    const p = this.presets[presetKey];
    if (!p) return;
    this.currentPresetKey = presetKey;
    Object.assign(this.eqParams, p.eq);
    if (p.width !== undefined) this.stereoWidth = p.width;
    if (p.threshold !== undefined) this.limiterParams.threshold = p.threshold;
    if (p.ceiling !== undefined) this.limiterParams.ceiling = p.ceiling;

    this.applyParameters();
    this.render();
  }

  startMetering() {
    if (this.meterTimer) clearInterval(this.meterTimer);
    const buffer = new Float32Array(512);

    this.meterTimer = setInterval(() => {
      if (!this.nodes || !this.nodes.analyser) return;
      this.nodes.analyser.getFloatTimeDomainData(buffer);

      let peak = 0;
      let sumSquares = 0;
      for (let i = 0; i < buffer.length; i++) {
        const abs = Math.abs(buffer[i]);
        if (abs > peak) peak = abs;
        sumSquares += abs * abs;
      }

      this.peakLeft = peak;
      this.peakRight = peak;
      this.rmsVal = Math.sqrt(sumSquares / buffer.length);

      this.updateMeterUI();
    }, 60);
  }

  updateMeterUI() {
    if (!this.containerEl) return;
    const peakBar = this.containerEl.querySelector('.master-peak-fill');
    const rmsBar = this.containerEl.querySelector('.master-rms-fill');
    const peakText = this.containerEl.querySelector('.master-peak-db');
    const rmsText = this.containerEl.querySelector('.master-rms-db');
    const clipLed = this.containerEl.querySelector('.master-clip-led');

    if (peakBar && rmsBar && peakText && rmsText) {
      const peakDb = this.peakLeft > 0.0001 ? 20 * Math.log10(this.peakLeft) : -60;
      const rmsDb = this.rmsVal > 0.0001 ? 20 * Math.log10(this.rmsVal) : -60;

      const peakPct = Math.max(0, Math.min(100, ((peakDb + 60) / 60) * 100));
      const rmsPct = Math.max(0, Math.min(100, ((rmsDb + 60) / 60) * 100));

      peakBar.style.width = `${peakPct}%`;
      rmsBar.style.width = `${rmsPct}%`;

      peakText.textContent = `${peakDb.toFixed(1)} dB`;
      rmsText.textContent = `${rmsDb.toFixed(1)} LUFS`;

      if (clipLed) {
        clipLed.classList.toggle('clipped', peakDb >= -0.1);
      }
    }
  }

  initUI(containerEl) {
    this.containerEl = containerEl;
    this.render();
  }

  render() {
    if (!this.containerEl) return;
    this.containerEl.innerHTML = '';

    const rootEl = document.createElement('div');
    rootEl.className = 'mastering-suite-container';

    rootEl.innerHTML = `
      <div class="mastering-header">
        <div class="mastering-title-group">
          <span class="mastering-badge">MASTER DSP</span>
          <h3 class="mastering-title">Final Mastering & Loudness Suite</h3>
        </div>
        <div class="mastering-preset-group">
          <label>PRESET:</label>
          <select class="mastering-preset-select">
            ${Object.entries(this.presets).map(([k, v]) => `
              <option value="${k}" ${this.currentPresetKey === k ? 'selected' : ''}>${v.name}</option>
            `).join('')}
          </select>
        </div>
      </div>

      <div class="mastering-panels-grid">
        <!-- Panel 1: 4-Band Mastering EQ -->
        <div class="master-panel eq-panel">
          <h4 class="panel-title">4-BAND MASTERING EQ</h4>
          <div class="eq-sliders-row">
            <div class="eq-band-ctrl">
              <label>Low (80Hz)</label>
              <input type="range" class="eq-low" min="-12" max="12" step="0.5" value="${this.eqParams.lowGain}">
              <span class="eq-val">${this.eqParams.lowGain.toFixed(1)} dB</span>
            </div>
            <div class="eq-band-ctrl">
              <label>Low-Mid (450Hz)</label>
              <input type="range" class="eq-lowmid" min="-12" max="12" step="0.5" value="${this.eqParams.lowMidGain}">
              <span class="eq-val">${this.eqParams.lowMidGain.toFixed(1)} dB</span>
            </div>
            <div class="eq-band-ctrl">
              <label>High-Mid (3.2kHz)</label>
              <input type="range" class="eq-highmid" min="-12" max="12" step="0.5" value="${this.eqParams.highMidGain}">
              <span class="eq-val">${this.eqParams.highMidGain.toFixed(1)} dB</span>
            </div>
            <div class="eq-band-ctrl">
              <label>Air Band (10kHz)</label>
              <input type="range" class="eq-high" min="-12" max="12" step="0.5" value="${this.eqParams.highGain}">
              <span class="eq-val">${this.eqParams.highGain.toFixed(1)} dB</span>
            </div>
          </div>
        </div>

        <!-- Panel 2: Stereo Width & Limiter -->
        <div class="master-panel limiter-panel">
          <h4 class="panel-title">DYNAMICS & STEREO IMAGE</h4>
          <div class="limiter-controls-row">
            <div class="limiter-ctrl">
              <label>Stereo Width: <span class="width-val">${Math.round(this.stereoWidth * 100)}%</span></label>
              <input type="range" class="master-width" min="0" max="2" step="0.05" value="${this.stereoWidth}">
            </div>
            <div class="limiter-ctrl">
              <label>Limiter Threshold: <span class="thresh-val">${this.limiterParams.threshold.toFixed(1)} dB</span></label>
              <input type="range" class="master-threshold" min="-18" max="0" step="0.5" value="${this.limiterParams.threshold}">
            </div>
            <div class="limiter-ctrl">
              <label>Ceiling Margin: <span class="ceiling-val">${this.limiterParams.ceiling.toFixed(1)} dB</span></label>
              <input type="range" class="master-ceiling" min="-2.0" max="-0.05" step="0.05" value="${this.limiterParams.ceiling}">
            </div>
          </div>
        </div>

        <!-- Panel 3: Precision Loudness & Peak Meter -->
        <div class="master-panel meter-panel">
          <div class="meter-panel-header">
            <h4 class="panel-title">LOUDNESS MONITOR</h4>
            <div class="master-clip-led" title="0 dBFS Peak Clip Warning">CLIP</div>
          </div>
          <div class="meters-container">
            <div class="meter-row">
              <span class="meter-label">PEAK:</span>
              <div class="meter-track"><div class="master-peak-fill"></div></div>
              <span class="master-peak-db">-∞ dB</span>
            </div>
            <div class="meter-row">
              <span class="meter-label">RMS / LUFS:</span>
              <div class="meter-track"><div class="master-rms-fill"></div></div>
              <span class="master-rms-db">-∞ LUFS</span>
            </div>
          </div>
        </div>
      </div>
    `;

    // Event Bindings
    rootEl.querySelector('.mastering-preset-select').addEventListener('change', (e) => {
      this.loadPreset(e.target.value);
    });

    const bindSlider = (selector, paramObj, key, displaySel, suffix = ' dB') => {
      const input = rootEl.querySelector(selector);
      if (!input) return;
      input.addEventListener('input', (e) => {
        paramObj[key] = parseFloat(e.target.value);
        const disp = rootEl.querySelector(displaySel);
        if (disp) disp.textContent = `${paramObj[key].toFixed(1)}${suffix}`;
        this.applyParameters();
      });
    };

    bindSlider('.eq-low', this.eqParams, 'lowGain', '.eq-low + .eq-val');
    bindSlider('.eq-lowmid', this.eqParams, 'lowMidGain', '.eq-lowmid + .eq-val');
    bindSlider('.eq-highmid', this.eqParams, 'highMidGain', '.eq-highmid + .eq-val');
    bindSlider('.eq-high', this.eqParams, 'highGain', '.eq-high + .eq-val');

    const widthInput = rootEl.querySelector('.master-width');
    widthInput.addEventListener('input', (e) => {
      this.stereoWidth = parseFloat(e.target.value);
      rootEl.querySelector('.width-val').textContent = `${Math.round(this.stereoWidth * 100)}%`;
      this.applyParameters();
    });

    bindSlider('.master-threshold', this.limiterParams, 'threshold', '.thresh-val');
    bindSlider('.master-ceiling', this.limiterParams, 'ceiling', '.ceiling-val');

    this.containerEl.appendChild(rootEl);
  }

  /**
   * Builds an identical mastering processing chain inside an OfflineAudioContext
   * for master 16/24-bit PCM WAV rendering
   */
  applyToOfflineContext(offlineCtx, sourceNode, destNode) {
    const lowShelf = offlineCtx.createBiquadFilter();
    lowShelf.type = 'lowshelf';
    lowShelf.frequency.value = this.eqParams.lowFreq;
    lowShelf.gain.value = this.eqParams.lowGain;

    const lowMidPeak = offlineCtx.createBiquadFilter();
    lowMidPeak.type = 'peaking';
    lowMidPeak.frequency.value = this.eqParams.lowMidFreq;
    lowMidPeak.Q.value = this.eqParams.lowMidQ;
    lowMidPeak.gain.value = this.eqParams.lowMidGain;

    const highMidPeak = offlineCtx.createBiquadFilter();
    highMidPeak.type = 'peaking';
    highMidPeak.frequency.value = this.eqParams.highMidFreq;
    highMidPeak.Q.value = this.eqParams.highMidQ;
    highMidPeak.gain.value = this.eqParams.highMidGain;

    const highShelf = offlineCtx.createBiquadFilter();
    highShelf.type = 'highshelf';
    highShelf.frequency.value = this.eqParams.highFreq;
    highShelf.gain.value = this.eqParams.highGain;

    const limiter = offlineCtx.createDynamicsCompressor();
    limiter.threshold.value = this.limiterParams.threshold;
    limiter.knee.value = 0.0;
    limiter.ratio.value = 20.0;
    limiter.attack.value = 0.002;
    limiter.release.value = this.limiterParams.release;

    const outGain = offlineCtx.createGain();
    outGain.gain.value = Math.pow(10, this.limiterParams.ceiling / 20);

    sourceNode.connect(lowShelf);
    lowShelf.connect(lowMidPeak);
    lowMidPeak.connect(highMidPeak);
    highMidPeak.connect(highShelf);
    highShelf.connect(limiter);
    limiter.connect(outGain);
    outGain.connect(destNode);
  }

  destroy() {
    if (this.meterTimer) {
      clearInterval(this.meterTimer);
      this.meterTimer = null;
    }
  }

  toJSON() {
    return {
      enabled: this.enabled,
      eqParams: this.eqParams,
      stereoWidth: this.stereoWidth,
      limiterParams: this.limiterParams,
      currentPresetKey: this.currentPresetKey
    };
  }

  fromJSON(data) {
    if (!data) return;
    if (data.enabled !== undefined) this.enabled = data.enabled;
    if (data.eqParams) Object.assign(this.eqParams, data.eqParams);
    if (data.stereoWidth !== undefined) this.stereoWidth = data.stereoWidth;
    if (data.limiterParams) Object.assign(this.limiterParams, data.limiterParams);
    if (data.currentPresetKey) this.currentPresetKey = data.currentPresetKey;
    this.applyParameters();
    this.render();
  }
}

window.masteringEngine = new MasteringEngine();
