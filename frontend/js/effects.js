/**
 * Virtual Music Studio - Audio Effects Processor
 * Complete DSP chain: EQ3, Dynamic Compressor, Stereo Delay, Lush Reverb, Chorus, Resonant Filters.
 */

class StudioEffects {
  constructor() {
    this.ctx = null;
    this.inputNode = null;
    this.outputNode = null;

    // Effect nodes
    this.lowFilter = null;
    this.highFilter = null;
    this.eqLow = null;
    this.eqMid = null;
    this.eqHigh = null;
    this.compressor = null;
    
    // Delay
    this.delayNode = null;
    this.delayFeedback = null;
    this.delayDry = null;
    this.delayWet = null;

    // Reverb
    this.reverbConvolver = null;
    this.reverbDry = null;
    this.reverbWet = null;

    // Chorus
    this.chorusDelay = null;
    this.chorusLfo = null;
    this.chorusDepth = null;
    this.chorusDry = null;
    this.chorusWet = null;

    // State / parameters
    this.params = {
      reverbWet: 0.28,
      reverbTime: 2.2,
      delayTime: 0.35,
      delayFeedback: 0.32,
      delayWet: 0.18,
      chorusRate: 1.5,
      chorusDepth: 0.002,
      chorusWet: 0.0,
      eqLow: 0,     // dB
      eqMid: 0,     // dB
      eqHigh: 0,    // dB
      filterLowPass: 20000, // Hz
      filterHighPass: 20,   // Hz
      compThreshold: -18,   // dB
      compRatio: 4,
      compAttack: 0.01,
      compRelease: 0.25
    };
  }

  init(ctx, masterGainNode) {
    this.ctx = ctx;
    this.outputNode = masterGainNode;

    // 1. Input Node
    this.inputNode = ctx.createGain();

    // 2. High-Pass Filter (removes mud)
    this.highFilter = ctx.createBiquadFilter();
    this.highFilter.type = 'highpass';
    this.highFilter.frequency.setValueAtTime(this.params.filterHighPass, ctx.currentTime);

    // 3. Low-Pass Filter (brilliance cut)
    this.lowFilter = ctx.createBiquadFilter();
    this.lowFilter.type = 'lowpass';
    this.lowFilter.frequency.setValueAtTime(this.params.filterLowPass, ctx.currentTime);

    // 4. 3-Band Equalizer
    this.eqLow = ctx.createBiquadFilter();
    this.eqLow.type = 'lowshelf';
    this.eqLow.frequency.setValueAtTime(250, ctx.currentTime);
    this.eqLow.gain.setValueAtTime(this.params.eqLow, ctx.currentTime);

    this.eqMid = ctx.createBiquadFilter();
    this.eqMid.type = 'peaking';
    this.eqMid.frequency.setValueAtTime(1200, ctx.currentTime);
    this.eqMid.Q.setValueAtTime(1.0, ctx.currentTime);
    this.eqMid.gain.setValueAtTime(this.params.eqMid, ctx.currentTime);

    this.eqHigh = ctx.createBiquadFilter();
    this.eqHigh.type = 'highshelf';
    this.eqHigh.frequency.setValueAtTime(4500, ctx.currentTime);
    this.eqHigh.gain.setValueAtTime(this.params.eqHigh, ctx.currentTime);

    // 5. Compressor
    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(this.params.compThreshold, ctx.currentTime);
    this.compressor.ratio.setValueAtTime(this.params.compRatio, ctx.currentTime);
    this.compressor.attack.setValueAtTime(this.params.compAttack, ctx.currentTime);
    this.compressor.release.setValueAtTime(this.params.compRelease, ctx.currentTime);

    // Connect core serial path
    this.inputNode.connect(this.highFilter);
    this.highFilter.connect(this.lowFilter);
    this.lowFilter.connect(this.eqLow);
    this.eqLow.connect(this.eqMid);
    this.eqMid.connect(this.eqHigh);

    // Pre-FX bus
    const preFxBus = this.eqHigh;

    // 6. Delay Module
    this.delayNode = ctx.createDelay(2.0);
    this.delayNode.delayTime.setValueAtTime(this.params.delayTime, ctx.currentTime);
    this.delayFeedback = ctx.createGain();
    this.delayFeedback.gain.setValueAtTime(this.params.delayFeedback, ctx.currentTime);
    this.delayDry = ctx.createGain();
    this.delayDry.gain.setValueAtTime(1.0, ctx.currentTime);
    this.delayWet = ctx.createGain();
    this.delayWet.gain.setValueAtTime(this.params.delayWet, ctx.currentTime);

    preFxBus.connect(this.delayDry);
    preFxBus.connect(this.delayNode);
    this.delayNode.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delayNode);
    this.delayNode.connect(this.delayWet);

    const afterDelayBus = ctx.createGain();
    this.delayDry.connect(afterDelayBus);
    this.delayWet.connect(afterDelayBus);

    // 7. Chorus Module
    this.chorusDelay = ctx.createDelay(0.1);
    this.chorusDelay.delayTime.setValueAtTime(0.025, ctx.currentTime);
    this.chorusLfo = ctx.createOscillator();
    this.chorusLfo.frequency.setValueAtTime(this.params.chorusRate, ctx.currentTime);
    this.chorusDepth = ctx.createGain();
    this.chorusDepth.gain.setValueAtTime(this.params.chorusDepth, ctx.currentTime);
    this.chorusLfo.connect(this.chorusDepth);
    this.chorusDepth.connect(this.chorusDelay.delayTime);
    this.chorusLfo.start();

    this.chorusDry = ctx.createGain();
    this.chorusDry.gain.setValueAtTime(1.0, ctx.currentTime);
    this.chorusWet = ctx.createGain();
    this.chorusWet.gain.setValueAtTime(this.params.chorusWet, ctx.currentTime);

    afterDelayBus.connect(this.chorusDry);
    afterDelayBus.connect(this.chorusDelay);
    this.chorusDelay.connect(this.chorusWet);

    const afterChorusBus = ctx.createGain();
    this.chorusDry.connect(afterChorusBus);
    this.chorusWet.connect(afterChorusBus);

    // 8. Reverb Module (Convolver with synthesized impulse response)
    this.reverbConvolver = ctx.createConvolver();
    this.reverbConvolver.buffer = this._createReverbImpulse(this.params.reverbTime, 2.0);
    this.reverbDry = ctx.createGain();
    this.reverbDry.gain.setValueAtTime(1.0 - this.params.reverbWet * 0.4, ctx.currentTime);
    this.reverbWet = ctx.createGain();
    this.reverbWet.gain.setValueAtTime(this.params.reverbWet, ctx.currentTime);

    afterChorusBus.connect(this.reverbDry);
    afterChorusBus.connect(this.reverbConvolver);
    this.reverbConvolver.connect(this.reverbWet);

    const afterReverbBus = ctx.createGain();
    this.reverbDry.connect(afterReverbBus);
    this.reverbWet.connect(afterReverbBus);

    // Connect into compressor then to Master Output
    afterReverbBus.connect(this.compressor);
    this.compressor.connect(this.outputNode);

    console.log('[StudioEffects] Chain configured with EQ, Dynamics, Chorus, Delay & Convolution Reverb.');
  }

  _createReverbImpulse(duration, decay) {
    const rate = this.ctx.sampleRate;
    const length = Math.floor(rate * duration);
    const impulse = this.ctx.createBuffer(2, length, rate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const n = i / length;
      const envelope = Math.pow(1 - n, decay);
      left[i] = ((Math.random() * 2) - 1) * envelope;
      right[i] = ((Math.random() * 2) - 1) * envelope;
    }
    return impulse;
  }

  setParam(name, value) {
    if (!this.ctx) return;
    this.params[name] = value;
    const t = this.ctx.currentTime;

    switch (name) {
      case 'reverbWet':
        this.reverbWet.gain.setTargetAtTime(value, t, 0.05);
        this.reverbDry.gain.setTargetAtTime(Math.max(0.1, 1.0 - value * 0.5), t, 0.05);
        break;
      case 'reverbTime':
        this.reverbConvolver.buffer = this._createReverbImpulse(value, 2.0);
        break;
      case 'delayTime':
        this.delayNode.delayTime.setTargetAtTime(value, t, 0.05);
        break;
      case 'delayFeedback':
        this.delayFeedback.gain.setTargetAtTime(Math.min(0.92, value), t, 0.05);
        break;
      case 'delayWet':
        this.delayWet.gain.setTargetAtTime(value, t, 0.05);
        break;
      case 'chorusWet':
        this.chorusWet.gain.setTargetAtTime(value, t, 0.05);
        break;
      case 'chorusRate':
        this.chorusLfo.frequency.setTargetAtTime(value, t, 0.05);
        break;
      case 'eqLow':
        this.eqLow.gain.setTargetAtTime(value, t, 0.05);
        break;
      case 'eqMid':
        this.eqMid.gain.setTargetAtTime(value, t, 0.05);
        break;
      case 'eqHigh':
        this.eqHigh.gain.setTargetAtTime(value, t, 0.05);
        break;
      case 'filterLowPass':
        this.lowFilter.frequency.setTargetAtTime(value, t, 0.05);
        break;
      case 'filterHighPass':
        this.highFilter.frequency.setTargetAtTime(value, t, 0.05);
        break;
    }
  }
}

window.studioEffects = new StudioEffects();
