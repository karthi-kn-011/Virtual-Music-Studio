/**
 * Virtual Music Studio - SoundFont & Realistic Sample Manager
 * Coordinates WebAudioFont SoundFont playback and provides authentic physical audio synthesis.
 */

class SoundFontManager {
  constructor() {
    this.loadedFonts = new Map(); // instrumentId -> soundfontData
    this.loadingPromises = new Map();
    this.player = null;
    this.isWebAudioFontAvailable = false;
    this.sampleCache = new Map(); // key = `${instrumentId}_${midiNote}` -> AudioBuffer
    this.activeNodes = new Map(); // noteKey -> { stop, nodes }
    this.cdnBase = 'https://surikov.github.io/webaudiofontdata/sound/';
  }

  async init(ctx) {
    this.ctx = ctx || (window.audioEngine ? window.audioEngine.ctx : null);
    this._checkWebAudioFont();
  }

  _checkWebAudioFont() {
    if (typeof WebAudioFontPlayer !== 'undefined') {
      if (!this.player) {
        this.player = new WebAudioFontPlayer();
      }
      this.isWebAudioFontAvailable = true;
      console.log('[SoundFontManager] WebAudioFontPlayer initialized with active AudioContext.');
    } else {
      console.log('[SoundFontManager] WebAudioFontPlayer script pending, using hybrid acoustic synthesis.');
    }
  }

  /**
   * Preloads an instrument SoundFont from CDN or initializes acoustic model
   */
  async loadInstrument(instrument) {
    if (!this.ctx && window.audioEngine && window.audioEngine.ctx) {
      this.ctx = window.audioEngine.ctx;
    }
    if (this.loadedFonts.has(instrument.id)) {
      return this.loadedFonts.get(instrument.id);
    }

    if (this.loadingPromises.has(instrument.id)) {
      return this.loadingPromises.get(instrument.id);
    }

    const loadPromise = (async () => {
      // Try loading official WebAudioFont script
      try {
        if (!window[instrument.soundfontVar]) {
          await this._loadScript(`${this.cdnBase}${instrument.soundfontFile}`);
        }
        if (window[instrument.soundfontVar]) {
          const fontData = window[instrument.soundfontVar];
          this.loadedFonts.set(instrument.id, fontData);
          if (this.player && this.ctx) {
            this.player.adjustPreset(this.ctx, fontData);
          }
          console.log(`[SoundFontManager] Successfully loaded SoundFont for ${instrument.name}`);
          return fontData;
        }
      } catch (err) {
        console.warn(`[SoundFontManager] CDN load skipped for ${instrument.name}, using offline acoustic sample synthesizer:`, err.message);
      }

      // Mark as loaded using built-in acoustic profile
      this.loadedFonts.set(instrument.id, { isBuiltinAcoustic: true, instrument });
      return this.loadedFonts.get(instrument.id);
    })();

    this.loadingPromises.set(instrument.id, loadPromise);
    return loadPromise;
  }

  _loadScript(src) {
    return new Promise((resolve, reject) => {
      // Check if already in DOM
      if (document.querySelector(`script[src="${src}"]`)) {
        return resolve();
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.timeout = 4000;
      script.onload = () => resolve();
      script.onerror = (e) => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
      setTimeout(() => resolve(), 3500); // graceful fallback timeout
    });
  }

  /**
   * Plays a note on the specified instrument.
   * Returns a note handle with a .stop() method.
   */
  playNote(instrument, midiNote, velocity = 0.8, destinationNode = null, targetTime = 0) {
    if (!this.ctx && window.audioEngine && window.audioEngine.ctx) {
      this.ctx = window.audioEngine.ctx;
    }
    if (!this.ctx) return null;
    const dest = destinationNode || window.audioEngine.destinationNode || this.ctx.destination;
    const now = targetTime > 0 ? targetTime : this.ctx.currentTime;
    const fontData = this.loadedFonts.get(instrument.id);

    // If genuine WebAudioFont soundbank is loaded and player is available
    if (this.player && fontData && !fontData.isBuiltinAcoustic && window[instrument.soundfontVar]) {
      try {
        const envelope = this.player.queueWaveTable(
          this.ctx,
          dest,
          window[instrument.soundfontVar],
          now,
          midiNote,
          999, // indefinite duration until cancel/release
          velocity
        );
        return {
          stop: (releaseTime = 0.1) => {
            try {
              if (envelope && envelope.cancel) {
                envelope.cancel();
              }
            } catch (e) { /* ignore */ }
          }
        };
      } catch (err) {
        console.warn('[SoundFontManager] WebAudioFont queue error, falling back to acoustic model:', err);
      }
    }

    // High-Fidelity Acoustic Physical Sample Synthesizer
    return this._playAcousticSampleVoice(instrument, midiNote, velocity, dest, now);
  }

  /**
   * Synthesizes and plays an instrument note according to its physical timbre model.
   */
  _playAcousticSampleVoice(instrument, midiNote, velocity, destination, startTime) {
    const ctx = this.ctx;
    const timbre = instrument.timbre || {};
    const freq = this.midiToFrequency(midiNote);

    // Master Voice Gain for velocity & ADSR
    const voiceGain = ctx.createGain();
    const gainNode = voiceGain.gain;
    const peakGain = Math.max(0.01, velocity * (timbre.brightness || 1.0));

    // Attack Envelope
    const attack = timbre.attack || 0.01;
    const decay = timbre.decay || 1.5;
    const sustainLevel = (timbre.sustain !== undefined ? timbre.sustain : 0.1) * peakGain;
    const releaseTime = timbre.release || 0.5;

    gainNode.setValueAtTime(0.0001, startTime);
    gainNode.linearRampToValueAtTime(peakGain, startTime + attack);

    if (timbre.continuous) {
      gainNode.setTargetAtTime(sustainLevel, startTime + attack, decay * 0.5);
    } else {
      gainNode.exponentialRampToValueAtTime(Math.max(0.0001, sustainLevel), startTime + attack + decay);
      gainNode.setTargetAtTime(0.0001, startTime + attack + decay, releaseTime);
    }

    // Voice Filter for acoustic resonance
    const filter = ctx.createBiquadFilter();
    filter.type = timbre.filterType || 'lowpass';
    const baseCutoff = timbre.cutoff || 4000;
    filter.frequency.setValueAtTime(baseCutoff * (0.5 + velocity * 0.7), startTime);
    filter.Q.setValueAtTime(timbre.resonance || 2.0, startTime);

    if (timbre.brassFilterSweep) {
      // Dynamic brass filter envelope sweep
      filter.frequency.setValueAtTime(baseCutoff * 0.6, startTime);
      filter.frequency.exponentialRampToValueAtTime(Math.min(16000, baseCutoff * 3.5), startTime + 0.12);
      filter.frequency.exponentialRampToValueAtTime(baseCutoff, startTime + 0.4);
    }

    // Vibrato LFO if applicable
    let vibratoLfo = null;
    let vibratoGain = null;
    if (timbre.vibratoRate) {
      vibratoLfo = ctx.createOscillator();
      vibratoGain = ctx.createGain();
      vibratoLfo.frequency.setValueAtTime(timbre.vibratoRate, startTime);
      vibratoGain.gain.setValueAtTime(timbre.vibratoDepth || 5, startTime);
      vibratoLfo.connect(vibratoGain);
      vibratoLfo.start(startTime);
    }

    // Harmonic Overtones generation
    const harmonics = timbre.harmonics || [1.0, 0.5, 0.25, 0.1];
    const oscNodes = [];

    harmonics.forEach((amp, idx) => {
      const harmNum = idx + 1;
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();

      // Instrument specific waveform & slight inharmonicity
      if (instrument.id.includes('piano')) {
        // Piano string stiffness introduces slight stretching in upper harmonics
        const stretch = 1 + (harmNum * harmNum * 0.0004);
        osc.frequency.setValueAtTime(freq * harmNum * stretch, startTime);
        osc.type = harmNum % 2 === 0 ? 'sine' : 'triangle';
      } else if (instrument.id === 'clarinet') {
        // Cylindrical bore emphasizes odd harmonics
        osc.frequency.setValueAtTime(freq * harmNum, startTime);
        osc.type = harmNum % 2 !== 0 ? 'triangle' : 'sine';
      } else if (instrument.id.includes('guitar') || instrument.id === 'harp' || instrument.id === 'koto' || instrument.id === 'oud') {
        // Plucked strings: rich sawtooth base
        osc.frequency.setValueAtTime(freq * harmNum, startTime);
        osc.type = idx === 0 ? 'sawtooth' : 'triangle';
      } else if (instrument.id === 'sitar') {
        // Sitar buzzing jawari: bright harmonics with slight phase offset
        osc.frequency.setValueAtTime(freq * harmNum * 1.002, startTime);
        osc.type = 'sawtooth';
      } else if (instrument.id === 'organ') {
        // Pipe organ: combination of flutes and reeds
        osc.frequency.setValueAtTime(freq * harmNum, startTime);
        osc.type = 'sine';
      } else if (instrument.id === 'accordion') {
        // Dual reed musette beat
        const detuneCents = (idx % 2 === 0 ? 1 : -1) * (timbre.reedDetune || 3.5);
        osc.frequency.setValueAtTime(freq * harmNum, startTime);
        osc.detune.setValueAtTime(detuneCents, startTime);
        osc.type = 'sawtooth';
      } else if (instrument.id === 'glockenspiel') {
        // Glockenspiel inharmonic bars: fundamental, ~2.76, ~5.4
        const barRatios = [1.0, 2.76, 5.4, 8.93];
        const barRatio = barRatios[idx] || (harmNum * 1.5);
        osc.frequency.setValueAtTime(freq * barRatio, startTime);
        osc.type = 'sine';
      } else if (instrument.id === 'steel_pan') {
        // Steel pan: fundamental + prominent octave and 5th
        const panRatios = [1.0, 2.0, 3.0, 4.0, 6.0];
        const ratio = panRatios[idx] || harmNum;
        osc.frequency.setValueAtTime(freq * ratio, startTime);
        osc.type = 'sine';
      } else if (instrument.id === 'pan_flute') {
        osc.frequency.setValueAtTime(freq * harmNum, startTime);
        osc.type = idx === 0 ? 'sine' : 'triangle';
      } else {
        osc.frequency.setValueAtTime(freq * harmNum, startTime);
        osc.type = timbre.continuous ? 'sawtooth' : 'triangle';
      }

      // Connect vibrato to frequency if present
      if (vibratoGain) {
        vibratoGain.connect(osc.frequency);
      }

      oscGain.gain.setValueAtTime(amp, startTime);
      osc.connect(oscGain);
      oscGain.connect(filter);
      osc.start(startTime);
      oscNodes.push(osc);
    });

    // Breath / transient noise for winds, flutes, and percussion
    let noiseSource = null;
    if (timbre.breathNoise || timbre.isPercussive) {
      const bufferSize = ctx.sampleRate * 0.15;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.04));
      }
      noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime((timbre.breathNoise || 0.25) * velocity, startTime);
      noiseSource.connect(noiseGain);
      noiseGain.connect(filter);
      noiseSource.start(startTime);
    }

    // Connect filter to voice gain, then to destination
    filter.connect(voiceGain);
    voiceGain.connect(destination);

    // Build control handle
    let isStopped = false;
    return {
      stop: (userRelease = null) => {
        if (isStopped) return;
        isStopped = true;
        const rel = userRelease !== null ? userRelease : releaseTime;
        const stopTime = ctx.currentTime;
        gainNode.cancelScheduledValues(stopTime);
        gainNode.setValueAtTime(gainNode.value, stopTime);
        gainNode.exponentialRampToValueAtTime(0.00001, stopTime + rel);

        setTimeout(() => {
          try {
            oscNodes.forEach(o => { try { o.stop(); o.disconnect(); } catch (e) {} });
            if (vibratoLfo) { vibratoLfo.stop(); vibratoLfo.disconnect(); }
            if (noiseSource) { try { noiseSource.stop(); } catch (e) {} }
            voiceGain.disconnect();
            filter.disconnect();
          } catch (e) { /* ignore */ }
        }, Math.floor((rel + 0.1) * 1000));
      }
    };
  }

  midiToFrequency(midiNote) {
    return 440 * Math.pow(2, (midiNote - 69) / 12);
  }
}

window.soundFontManager = new SoundFontManager();
