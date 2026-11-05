/**
 * Virtual Music Studio - Export & Import Engine
 * Offline AudioContext rendering for pristine 16-bit PCM WAV export,
 * multi-track Standard MIDI File (SMF .mid Type 0 and Type 1) binary encoder and binary parser.
 */

class ExportManager {
  constructor() {}

  /**
   * Renders the complete multi-track project using an OfflineAudioContext into a downloadable WAV file.
   */
  async exportProjectAsWav(bitDepth = 16) {
    const tracks = window.trackManager ? window.trackManager.tracks : [];
    if (!tracks || tracks.length === 0) {
      alert('Cannot export: No tracks exist in this project.');
      return;
    }

    // Determine max length in seconds
    let maxTimeMs = 4000;
    tracks.forEach(track => {
      (track.events || []).forEach(ev => {
        const end = (ev.startTimeMs || 0) + (ev.durationMs || 500);
        if (end > maxTimeMs) maxTimeMs = end;
      });
    });

    if (window.clipManager && window.clipManager.clips) {
      window.clipManager.clips.forEach(clip => {
        const startMs = clip.startTimeMs !== undefined ? clip.startTimeMs : (clip.startTime * 1000 || 0);
        const durMs = clip.durationMs !== undefined ? clip.durationMs : (clip.duration * 1000 || 0);
        const end = startMs + durMs;
        if (end > maxTimeMs) maxTimeMs = end;
      });
    }

    const totalSeconds = (maxTimeMs / 1000) + 1.5; // tail room
    const sampleRate = 44100;
    const totalFrames = Math.ceil(totalSeconds * sampleRate);

    const toast = document.getElementById('studio-toast');
    if (toast) {
      toast.textContent = `Rendering project audio (${totalSeconds.toFixed(1)}s)...`;
      toast.classList.add('show');
    }

    try {
      const OfflineCtxClass = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      const offlineCtx = new OfflineCtxClass(2, totalFrames, sampleRate);

      // 1. Build Offline Master Bus & Limiter
      const offlineMasterSummingBus = offlineCtx.createGain();
      const offlineMasterGain = offlineCtx.createGain();
      const masterVol = (window.mixerEngine ? window.mixerEngine.masterVolume : 0.85);
      offlineMasterGain.gain.setValueAtTime(masterVol, 0);

      const offlineLimiter = offlineCtx.createDynamicsCompressor();
      offlineLimiter.threshold.setValueAtTime(-0.5, 0);
      offlineLimiter.ratio.setValueAtTime(20.0, 0);
      offlineLimiter.attack.setValueAtTime(0.001, 0);
      offlineLimiter.release.setValueAtTime(0.05, 0);

      // Insert Mastering Engine if enabled
      if (window.masteringEngine && window.masteringEngine.enabled) {
        window.masteringEngine.applyToOfflineContext(offlineCtx, offlineMasterSummingBus, offlineMasterGain);
      } else {
        offlineMasterSummingBus.connect(offlineMasterGain);
      }

      offlineMasterGain.connect(offlineLimiter);
      offlineLimiter.connect(offlineCtx.destination);

      // 2. Build Offline Aux Reverb Bus
      const reverbSettings = (window.mixerEngine && window.mixerEngine.auxReverb) || { type: 'hall', preDelayMs: 20, decaySec: 3.0 };
      const offlineReverbInput = offlineCtx.createGain();
      const offlineReverbPreDelay = offlineCtx.createDelay(0.2);
      offlineReverbPreDelay.delayTime.setValueAtTime((reverbSettings.preDelayMs || 20) / 1000, 0);

      const offlineReverbConvolver = offlineCtx.createConvolver();
      const reverbLength = Math.floor(sampleRate * (reverbSettings.decaySec || 3.0));
      const reverbBuf = offlineCtx.createBuffer(2, reverbLength, sampleRate);
      const rL = reverbBuf.getChannelData(0);
      const rR = reverbBuf.getChannelData(1);
      const decayFactor = reverbSettings.type === 'room' ? 3.5 : reverbSettings.type === 'plate' ? 2.8 : 2.0;
      for (let i = 0; i < reverbLength; i++) {
        const env = Math.pow(1 - (i / reverbLength), decayFactor);
        rL[i] = ((Math.random() * 2) - 1) * env;
        rR[i] = ((Math.random() * 2) - 1) * env;
      }
      offlineReverbConvolver.buffer = reverbBuf;

      const offlineReverbReturn = offlineCtx.createGain();
      offlineReverbReturn.gain.setValueAtTime(0.9, 0);

      offlineReverbInput.connect(offlineReverbPreDelay);
      offlineReverbPreDelay.connect(offlineReverbConvolver);
      offlineReverbConvolver.connect(offlineReverbReturn);
      offlineReverbReturn.connect(offlineMasterSummingBus);

      // 3. Build Offline Aux Delay Bus
      const delaySettings = (window.mixerEngine && window.mixerEngine.auxDelay) || { sync: '1/8', feedback: 0.32 };
      const bpm = (window.trackManager && window.trackManager.bpm) || 120;
      const beatSec = 60 / bpm;
      let delaySec = beatSec / 2;
      if (delaySettings.sync === '1/4') delaySec = beatSec;
      else if (delaySettings.sync === '1/8d') delaySec = (beatSec / 2) * 1.5;
      else if (delaySettings.sync === '1/16') delaySec = beatSec / 4;

      const offlineDelayInput = offlineCtx.createGain();
      const offlineDelayL = offlineCtx.createDelay(2.0);
      const offlineDelayR = offlineCtx.createDelay(2.0);
      offlineDelayL.delayTime.setValueAtTime(delaySec, 0);
      offlineDelayR.delayTime.setValueAtTime(delaySec * 1.05, 0);

      const offlineDelayFilter = offlineCtx.createBiquadFilter();
      offlineDelayFilter.type = 'lowpass';
      offlineDelayFilter.frequency.setValueAtTime(3800, 0);

      const offlineDelayFeedback = offlineCtx.createGain();
      offlineDelayFeedback.gain.setValueAtTime(delaySettings.feedback || 0.32, 0);

      const offlineDelayReturn = offlineCtx.createGain();
      offlineDelayReturn.gain.setValueAtTime(0.85, 0);

      offlineDelayInput.connect(offlineDelayL);
      offlineDelayInput.connect(offlineDelayR);
      offlineDelayL.connect(offlineDelayFilter);
      offlineDelayR.connect(offlineDelayFilter);
      offlineDelayFilter.connect(offlineDelayFeedback);
      offlineDelayFeedback.connect(offlineDelayL);
      offlineDelayFeedback.connect(offlineDelayR);
      offlineDelayL.connect(offlineDelayReturn);
      offlineDelayR.connect(offlineDelayReturn);
      offlineDelayReturn.connect(offlineMasterSummingBus);

      // 4. Render all non-muted tracks through their isolated channel strip
      const hasSolo = tracks.some(t => t.isSolo);
      const trackGainMap = {};
      const trackParamMap = {};

      tracks.forEach(track => {
        if (track.isMuted) return;
        if (hasSolo && !track.isSolo) return;

        const inst = window.instrumentManager.getInstrument(track.instrumentId) || window.instrumentManager.currentInstrument;
        const mixerProps = track.mixer || {
          volume: track.volume !== undefined ? track.volume : 0.8,
          pan: track.pan || 0,
          eq: { lowGain: 0, midGain: 0, midFreq: 1200, midQ: 1.0, highGain: 0 },
          compressor: { enabled: false, threshold: -18, ratio: 4, attack: 0.01, release: 0.25, makeup: 0 },
          sends: { reverb: 0.25, delay: 0.15, chorus: 0.0 }
        };

        // Track Gain
        const trackGain = offlineCtx.createGain();
        trackGain.gain.setValueAtTime(track.volume !== undefined ? track.volume : 0.8, 0);
        trackGainMap[track.id] = trackGain;

        // 3-Band Parametric EQ
        const eqLow = offlineCtx.createBiquadFilter();
        eqLow.type = 'lowshelf';
        eqLow.frequency.setValueAtTime(120, 0);
        eqLow.gain.setValueAtTime(mixerProps.eq ? mixerProps.eq.lowGain : 0, 0);

        const eqMid = offlineCtx.createBiquadFilter();
        eqMid.type = 'peaking';
        eqMid.frequency.setValueAtTime(mixerProps.eq ? mixerProps.eq.midFreq : 1200, 0);
        eqMid.Q.setValueAtTime(mixerProps.eq ? mixerProps.eq.midQ : 1.0, 0);
        eqMid.gain.setValueAtTime(mixerProps.eq ? mixerProps.eq.midGain : 0, 0);

        const eqHigh = offlineCtx.createBiquadFilter();
        eqHigh.type = 'highshelf';
        eqHigh.frequency.setValueAtTime(6000, 0);
        eqHigh.gain.setValueAtTime(mixerProps.eq ? mixerProps.eq.highGain : 0, 0);

        // Dynamics Compressor
        const comp = offlineCtx.createDynamicsCompressor();
        const compSettings = mixerProps.compressor || { enabled: false, threshold: -18, ratio: 4, attack: 0.01, release: 0.25, makeup: 0 };
        comp.threshold.setValueAtTime(compSettings.threshold, 0);
        comp.ratio.setValueAtTime(compSettings.enabled ? compSettings.ratio : 1.0, 0);
        comp.attack.setValueAtTime(compSettings.attack, 0);
        comp.release.setValueAtTime(compSettings.release, 0);

        const makeupGain = offlineCtx.createGain();
        const makeupLin = Math.pow(10, (compSettings.makeup || 0) / 20);
        makeupGain.gain.setValueAtTime(makeupLin, 0);

        // Track Sends to Master Aux Busses
        const revSend = offlineCtx.createGain();
        revSend.gain.setValueAtTime(mixerProps.sends ? mixerProps.sends.reverb : 0.2, 0);

        const dlySend = offlineCtx.createGain();
        dlySend.gain.setValueAtTime(mixerProps.sends ? mixerProps.sends.delay : 0.15, 0);

        // Stereo Panner
        let panner = null;
        if (offlineCtx.createStereoPanner) {
          panner = offlineCtx.createStereoPanner();
          panner.pan.setValueAtTime(track.pan || 0, 0);
        }

        trackParamMap[track.id] = {
          volume: trackGain.gain,
          pan: panner ? panner.pan : null,
          eqLow: eqLow.gain,
          eqMid: eqMid.gain,
          eqHigh: eqHigh.gain,
          reverbSend: revSend.gain,
          delaySend: dlySend.gain
        };

        // Connect Track Graph
        trackGain.connect(eqLow);
        eqLow.connect(eqMid);
        eqMid.connect(eqHigh);
        eqHigh.connect(comp);
        comp.connect(makeupGain);

        makeupGain.connect(revSend);
        revSend.connect(offlineReverbInput);

        makeupGain.connect(dlySend);
        dlySend.connect(offlineDelayInput);

        if (panner) {
          makeupGain.connect(panner);
          panner.connect(offlineMasterSummingBus);
        } else {
          makeupGain.connect(offlineMasterSummingBus);
        }

        // Render each note event on this track
        (track.events || []).forEach(ev => {
          const startTime = (ev.startTimeMs || 0) / 1000;
          const dur = (ev.durationMs || 400) / 1000;
          const vel = (ev.velocity || 0.8);

          this._renderOfflineNote(offlineCtx, inst, ev.midiNote, vel, trackGain, startTime, dur);
        });
      });

      // 5. Render Audio Clips
      if (window.clipManager && window.clipManager.clips) {
        window.clipManager.clips.forEach(clip => {
          if (!clip.audioBuffer) return;
          const trk = tracks.find(t => t.id === clip.trackId);
          if (trk && trk.isMuted) return;
          if (hasSolo && trk && !trk.isSolo) return;

          const src = offlineCtx.createBufferSource();
          src.buffer = clip.audioBuffer;
          const cGain = offlineCtx.createGain();
          const baseGain = clip.gain !== undefined ? clip.gain : 1.0;
          cGain.gain.setValueAtTime(baseGain, 0);

          const startSec = (clip.startTimeMs !== undefined ? clip.startTimeMs : (clip.startTime * 1000 || 0)) / 1000;
          const durSec = (clip.durationMs !== undefined ? clip.durationMs : (clip.duration * 1000 || 0)) / 1000;
          const offsetSec = (clip.offsetMs !== undefined ? clip.offsetMs : (clip.offset * 1000 || 0)) / 1000;
          const fadeInSec = (clip.fadeInMs !== undefined ? clip.fadeInMs : (clip.fadeIn * 1000 || 0)) / 1000;
          const fadeOutSec = (clip.fadeOutMs !== undefined ? clip.fadeOutMs : (clip.fadeOut * 1000 || 0)) / 1000;

          if (fadeInSec > 0) {
            cGain.gain.setValueAtTime(0, startSec);
            cGain.gain.linearRampToValueAtTime(baseGain, startSec + fadeInSec);
          }
          if (fadeOutSec > 0) {
            cGain.gain.setValueAtTime(baseGain, startSec + durSec - fadeOutSec);
            cGain.gain.linearRampToValueAtTime(0, startSec + durSec);
          }

          src.connect(cGain);
          const targetNode = trackGainMap[clip.trackId] || offlineMasterSummingBus;
          cGain.connect(targetNode);
          src.start(startSec, offsetSec, durSec);
        });
      }

      // 6. Apply Offline Automation Ramps
      if (window.automationEngine) {
        window.automationEngine.applyOfflineAutomation(offlineCtx, trackParamMap);
      }

      // Render audio
      const renderedBuffer = await offlineCtx.startRendering();
      const wavBlob = this.audioBufferToWav(renderedBuffer, bitDepth);

      // Trigger download
      const filename = `${window.projectManager.currentProject.name || 'Studio_Track'}.wav`;
      this._downloadBlob(wavBlob, filename);

      if (toast) {
        toast.textContent = `WAV Export Complete: ${filename}`;
        setTimeout(() => toast.classList.remove('show'), 2500);
      }
    } catch (err) {
      console.error('[ExportManager] Offline rendering error:', err);
      alert('Audio export failed: ' + err.message);
    }
  }

  _renderOfflineNote(ctx, inst, midiNote, velocity, dest, startTime, duration) {
    const freq = 440 * Math.pow(2, (midiNote - 69) / 12);
    const timbre = inst.timbre || {};
    const voiceGain = ctx.createGain();
    const peak = velocity * (timbre.brightness || 1.0);
    const attack = timbre.attack || 0.01;
    const release = timbre.release || 0.4;

    voiceGain.gain.setValueAtTime(0.0001, startTime);
    voiceGain.gain.linearRampToValueAtTime(peak, startTime + attack);

    if (timbre.continuous) {
      voiceGain.gain.setValueAtTime(peak * (timbre.sustain || 0.8), startTime + attack);
      voiceGain.gain.setValueAtTime(peak * (timbre.sustain || 0.8), startTime + duration);
      voiceGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration + release);
    } else {
      voiceGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * 0.05), startTime + attack + (timbre.decay || 1.5));
      voiceGain.gain.setTargetAtTime(0.0001, startTime + duration, release);
    }

    const filter = ctx.createBiquadFilter();
    filter.type = timbre.filterType || 'lowpass';
    filter.frequency.setValueAtTime(timbre.cutoff || 4000, startTime);

    const harmonics = timbre.harmonics || [1.0, 0.5, 0.25];
    harmonics.forEach((amp, idx) => {
      const harmNum = idx + 1;
      const osc = ctx.createOscillator();
      osc.frequency.setValueAtTime(freq * harmNum, startTime);
      osc.type = harmNum % 2 === 0 ? 'sine' : 'triangle';
      const hGain = ctx.createGain();
      hGain.gain.setValueAtTime(amp, startTime);
      osc.connect(hGain);
      hGain.connect(filter);
      osc.start(startTime);
      osc.stop(startTime + duration + release + 0.1);
    });

    filter.connect(voiceGain);
    voiceGain.connect(dest);
  }

  /**
   * Encodes an AudioBuffer into 16-bit or 24-bit PCM RIFF WAV format
   */
  audioBufferToWav(buffer, bitDepth = 16) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const actualBitDepth = bitDepth === 24 ? 24 : 16;
    const bytesPerSample = actualBitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    const numSamples = buffer.length;
    const dataSize = numSamples * blockAlign;
    const headerSize = 44;
    const totalSize = headerSize + dataSize;

    const arrayBuffer = new ArrayBuffer(totalSize);
    const view = new DataView(arrayBuffer);

    // RIFF chunk descriptor
    this._writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    this._writeString(view, 8, 'WAVE');

    // "fmt " sub-chunk
    this._writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, actualBitDepth, true);

    // "data" sub-chunk
    this._writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Interleave channels & write PCM samples
    const channels = [];
    for (let i = 0; i < numChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }

    let offset = 44;
    if (actualBitDepth === 24) {
      for (let i = 0; i < numSamples; i++) {
        for (let ch = 0; ch < numChannels; ch++) {
          let sample = channels[ch][i];
          sample = Math.max(-1, Math.min(1, sample));
          const intSample = sample < 0 ? sample * 0x800000 : sample * 0x7FFFFF;
          const intVal = Math.floor(intSample);
          view.setUint8(offset, intVal & 0xFF);
          view.setUint8(offset + 1, (intVal >> 8) & 0xFF);
          view.setUint8(offset + 2, (intVal >> 16) & 0xFF);
          offset += 3;
        }
      }
    } else {
      for (let i = 0; i < numSamples; i++) {
        for (let ch = 0; ch < numChannels; ch++) {
          let sample = channels[ch][i];
          sample = Math.max(-1, Math.min(1, sample));
          const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
          view.setInt16(offset, intSample, true);
          offset += 2;
        }
      }
    }

    return new Blob([view], { type: 'audio/wav' });
  }

  _writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  /**
   * Generates a Standard MIDI File (Format 1 or Format 0) containing all tracks
   */
  exportProjectAsMidi(format = 1) {
    const tracks = window.trackManager ? window.trackManager.tracks : [];
    if (!tracks || tracks.length === 0) {
      alert('No tracks to export.');
      return;
    }

    const bpm = window.trackManager ? window.trackManager.bpm : 120;
    const ticksPerQuarterNote = 480;
    const msPerQuarterNote = (60 / bpm) * 1000;
    const ticksPerMs = ticksPerQuarterNote / msPerQuarterNote;
    const microsecsPerBeat = Math.round(60000000 / bpm);

    const midiFileBytes = [];

    if (format === 0) {
      // Format 0: Single merged track with multi-channel events
      this._appendBytes(midiFileBytes, [0x4D, 0x54, 0x68, 0x64]); // "MThd"
      this._appendUint32(midiFileBytes, 6);
      this._appendUint16(midiFileBytes, 0); // Format 0
      this._appendUint16(midiFileBytes, 1); // 1 Track
      this._appendUint16(midiFileBytes, ticksPerQuarterNote);

      const singleTrackEvents = [];
      // Time signature: 4/4
      this._writeVarLen(singleTrackEvents, 0);
      singleTrackEvents.push(0xFF, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08);

      // Tempo meta event
      this._writeVarLen(singleTrackEvents, 0);
      singleTrackEvents.push(0xFF, 0x51, 0x03);
      singleTrackEvents.push((microsecsPerBeat >> 16) & 0xFF, (microsecsPerBeat >> 8) & 0xFF, microsecsPerBeat & 0xFF);

      const rawEvents = [];
      tracks.forEach((track, channelIdx) => {
        const channel = Math.min(15, channelIdx);
        (track.events || []).forEach(ev => {
          const onTick = Math.max(0, Math.round((ev.startTimeMs || 0) * ticksPerMs));
          const offTick = Math.max(onTick + 1, Math.round(((ev.startTimeMs || 0) + (ev.durationMs || 300)) * ticksPerMs));
          const velByte = Math.max(1, Math.min(127, Math.round((ev.velocity !== undefined ? ev.velocity : 0.8) * 127)));
          rawEvents.push({ tick: onTick, type: 0x90 | channel, note: ev.midiNote, vel: velByte });
          rawEvents.push({ tick: offTick, type: 0x80 | channel, note: ev.midiNote, vel: 0 });
        });
      });

      rawEvents.sort((a, b) => {
        if (a.tick !== b.tick) return a.tick - b.tick;
        return (a.type & 0xF0) === 0x80 ? -1 : 1;
      });

      let lastTick = 0;
      rawEvents.forEach(e => {
        const delta = Math.max(0, e.tick - lastTick);
        lastTick = e.tick;
        this._writeVarLen(singleTrackEvents, delta);
        singleTrackEvents.push(e.type, e.note, e.vel);
      });

      // End of Track
      this._writeVarLen(singleTrackEvents, 0);
      singleTrackEvents.push(0xFF, 0x2F, 0x00);

      this._appendTrackChunk(midiFileBytes, singleTrackEvents);
    } else {
      // Format 1: Multi-track
      this._appendBytes(midiFileBytes, [0x4D, 0x54, 0x68, 0x64]); // "MThd"
      this._appendUint32(midiFileBytes, 6);
      this._appendUint16(midiFileBytes, 1); // Format 1: Multi-track
      this._appendUint16(midiFileBytes, tracks.length + 1); // Tracks count (+1 tempo track)
      this._appendUint16(midiFileBytes, ticksPerQuarterNote);

      // Track 0: Tempo and Time Signature track
      const tempoTrack = [];
      
      // Time signature: 4/4
      this._writeVarLen(tempoTrack, 0);
      tempoTrack.push(0xFF, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08);

      // Set tempo meta event
      this._writeVarLen(tempoTrack, 0);
      tempoTrack.push(0xFF, 0x51, 0x03);
      tempoTrack.push((microsecsPerBeat >> 16) & 0xFF, (microsecsPerBeat >> 8) & 0xFF, microsecsPerBeat & 0xFF);
      
      // End of Track
      this._writeVarLen(tempoTrack, 0);
      tempoTrack.push(0xFF, 0x2F, 0x00);

      this._appendTrackChunk(midiFileBytes, tempoTrack);

      // Track 1..N: Instrument Tracks
      tracks.forEach((track, channelIdx) => {
        const channel = Math.min(15, channelIdx);
        const trackEvents = [];

        // Sort notes into noteOn and noteOff discrete MIDI messages
        const rawEvents = [];
        (track.events || []).forEach(ev => {
          const onTick = Math.max(0, Math.round((ev.startTimeMs || 0) * ticksPerMs));
          const offTick = Math.max(onTick + 1, Math.round(((ev.startTimeMs || 0) + (ev.durationMs || 300)) * ticksPerMs));
          const velByte = Math.max(1, Math.min(127, Math.round((ev.velocity !== undefined ? ev.velocity : 0.8) * 127)));
          rawEvents.push({ tick: onTick, type: 'on', note: ev.midiNote, vel: velByte });
          rawEvents.push({ tick: offTick, type: 'off', note: ev.midiNote, vel: 0 });
        });

        rawEvents.sort((a, b) => a.tick === b.tick ? (a.type === 'off' ? -1 : 1) : a.tick - b.tick);

        // Track Name meta event
        const trackName = track.name || `Track ${channelIdx + 1}`;
        this._writeVarLen(trackEvents, 0);
        trackEvents.push(0xFF, 0x03, trackName.length);
        for (let i = 0; i < trackName.length; i++) trackEvents.push(trackName.charCodeAt(i));

        // Instrument Program Change
        const inst = window.instrumentManager ? window.instrumentManager.getInstrument(track.instrumentId) : null;
        const program = inst ? (inst.gmProgram || 0) : 0;
        this._writeVarLen(trackEvents, 0);
        trackEvents.push(0xC0 | channel, program);

        let lastTick = 0;
        rawEvents.forEach(e => {
          const delta = Math.max(0, e.tick - lastTick);
          lastTick = e.tick;
          this._writeVarLen(trackEvents, delta);
          if (e.type === 'on') {
            trackEvents.push(0x90 | channel, e.note, e.vel);
          } else {
            trackEvents.push(0x80 | channel, e.note, 0);
          }
        });

        // End of Track
        this._writeVarLen(trackEvents, 0);
        trackEvents.push(0xFF, 0x2F, 0x00);

        this._appendTrackChunk(midiFileBytes, trackEvents);
      });
    }

    const uint8 = new Uint8Array(midiFileBytes);
    const blob = new Blob([uint8], { type: 'audio/midi' });
    const filename = `${(window.projectManager && window.projectManager.currentProject.name) || 'Studio_Track'}.mid`;
    this._downloadBlob(blob, filename);

    if (window.app && typeof window.app.showToast === 'function') {
      window.app.showToast(`Standard MIDI File exported: ${filename}`);
    }
  }

  /**
   * Generates a Standard MIDI File for an individual track (Format 0)
   */
  exportTrackAsMidi(track) {
    if (!track) return;
    const bpm = window.trackManager ? window.trackManager.bpm : 120;
    const ticksPerQuarterNote = 480;
    const msPerQuarterNote = (60 / bpm) * 1000;
    const ticksPerMs = ticksPerQuarterNote / msPerQuarterNote;

    const midiFileBytes = [];

    // Header Chunk - Format 0: Single multi-channel track
    this._appendBytes(midiFileBytes, [0x4D, 0x54, 0x68, 0x64]); // "MThd"
    this._appendUint32(midiFileBytes, 6);
    this._appendUint16(midiFileBytes, 0); // Format 0
    this._appendUint16(midiFileBytes, 1); // 1 track
    this._appendUint16(midiFileBytes, ticksPerQuarterNote);

    const trackEvents = [];

    // Track Name
    const trackName = track.name || 'Instrument_Track';
    this._writeVarLen(trackEvents, 0);
    trackEvents.push(0xFF, 0x03, trackName.length);
    for (let c = 0; c < trackName.length; c++) {
      trackEvents.push(trackName.charCodeAt(c));
    }

    // Set Tempo
    const microsecsPerBeat = Math.round(60000000 / bpm);
    this._writeVarLen(trackEvents, 0);
    trackEvents.push(0xFF, 0x51, 0x03);
    trackEvents.push((microsecsPerBeat >> 16) & 0xFF, (microsecsPerBeat >> 8) & 0xFF, microsecsPerBeat & 0xFF);

    // Instrument program change
    const inst = window.instrumentManager ? window.instrumentManager.getInstrument(track.instrumentId) : null;
    const programNum = (inst && inst.soundfontConfig && typeof inst.soundfontConfig.program === 'number') 
      ? inst.soundfontConfig.program 
      : 0;

    this._writeVarLen(trackEvents, 0);
    trackEvents.push(0xC0, programNum & 0x7F);

    // Gather and sort events
    const rawEvents = [];
    (track.events || []).forEach(ev => {
      const startTick = Math.max(0, Math.round(ev.startTimeMs * ticksPerMs));
      const endTick = Math.max(startTick + 1, Math.round((ev.startTimeMs + (ev.durationMs || 300)) * ticksPerMs));
      const vel = Math.max(1, Math.min(127, Math.round((ev.velocity || 0.8) * 127)));

      rawEvents.push({ tick: startTick, type: 0x90, note: ev.midiNote, vel: vel });
      rawEvents.push({ tick: endTick, type: 0x80, note: ev.midiNote, vel: 0 });
    });

    rawEvents.sort((a, b) => {
      if (a.tick !== b.tick) return a.tick - b.tick;
      return a.type === 0x80 ? -1 : 1;
    });

    let lastTick = 0;
    rawEvents.forEach(e => {
      const delta = Math.max(0, e.tick - lastTick);
      lastTick = e.tick;
      this._writeVarLen(trackEvents, delta);
      trackEvents.push(e.type, e.note & 0x7F, e.vel & 0x7F);
    });

    // End of Track
    this._writeVarLen(trackEvents, 0);
    trackEvents.push(0xFF, 0x2F, 0x00);

    this._appendTrackChunk(midiFileBytes, trackEvents);

    const uint8 = new Uint8Array(midiFileBytes);
    const blob = new Blob([uint8], { type: 'audio/midi' });
    const safeName = trackName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safeName}.mid`;
    this._downloadBlob(blob, filename);

    if (window.app && typeof window.app.showToast === 'function') {
      window.app.showToast(`Track exported as Standard MIDI: ${filename}`);
    }
  }

  /**
   * Imports and parses a Standard MIDI File (SMF Type 0 and Type 1)
   * Converts it into project tracks and note events.
   */
  async importMidiFile(file) {
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const reader = new DataView(buffer);
      let offset = 0;

      // 1. Read Header "MThd"
      const headerTag = this._readString(reader, offset, 4);
      offset += 4;
      if (headerTag !== 'MThd') {
        throw new Error('Invalid MIDI file: Missing MThd chunk header.');
      }

      const headerLen = reader.getUint32(offset);
      offset += 4;
      const format = reader.getUint16(offset);
      offset += 2;
      const trackCount = reader.getUint16(offset);
      offset += 2;
      const timeDivision = reader.getUint16(offset);
      offset += 2;

      // Skip extra header bytes if any
      if (headerLen > 6) {
        offset += (headerLen - 6);
      }

      let ticksPerBeat = 480;
      if ((timeDivision & 0x8000) === 0) {
        ticksPerBeat = timeDivision;
      }

      console.log(`[ExportManager] Parsing MIDI: Format ${format}, ${trackCount} tracks, ${ticksPerBeat} ticks/beat.`);

      let projectBpm = 120;
      let microsecsPerBeat = 500000;
      const parsedTracks = [];

      // 2. Read each MTrk chunk
      for (let t = 0; t < trackCount && offset < buffer.byteLength; t++) {
        if (offset + 8 > buffer.byteLength) break;
        const chunkTag = this._readString(reader, offset, 4);
        offset += 4;
        const chunkLen = reader.getUint32(offset);
        offset += 4;

        if (chunkTag !== 'MTrk') {
          // Skip non-track chunks
          offset += chunkLen;
          continue;
        }

        const trackEnd = offset + chunkLen;
        let currentTick = 0;
        let runningStatus = 0;
        let trackName = `Track ${t + 1}`;
        let trackProgram = 0;
        const activeNotes = new Map(); // key = noteNumber -> { onTick, velocity }
        const noteEvents = [];

        while (offset < trackEnd) {
          // Read delta time
          const deltaResult = this._readVarLen(reader, offset);
          currentTick += deltaResult.value;
          offset += deltaResult.bytesRead;

          if (offset >= trackEnd) break;

          let status = reader.getUint8(offset);

          if (status >= 0x80) {
            runningStatus = status;
            offset++;
          } else {
            status = runningStatus;
          }

          const messageType = status & 0xF0;
          const channel = status & 0x0F;

          // Meta events
          if (status === 0xFF) {
            const metaType = reader.getUint8(offset);
            offset++;
            const metaLenResult = this._readVarLen(reader, offset);
            const metaLen = metaLenResult.value;
            offset += metaLenResult.bytesRead;

            if (metaType === 0x03) {
              // Track Name
              trackName = this._readString(reader, offset, metaLen) || trackName;
            } else if (metaType === 0x51 && metaLen === 3) {
              // Tempo
              const b1 = reader.getUint8(offset);
              const b2 = reader.getUint8(offset + 1);
              const b3 = reader.getUint8(offset + 2);
              microsecsPerBeat = (b1 << 16) | (b2 << 8) | b3;
              projectBpm = Math.round(60000000 / microsecsPerBeat);
            }
            offset += metaLen;
          } else if (status === 0xF0 || status === 0xF7) {
            // Sysex event
            const sysexLenResult = this._readVarLen(reader, offset);
            offset += sysexLenResult.bytesRead + sysexLenResult.value;
          } else if (messageType === 0x90) {
            // Note On
            const note = reader.getUint8(offset);
            const vel = reader.getUint8(offset + 1);
            offset += 2;
            if (vel > 0) {
              activeNotes.set(note, { onTick: currentTick, vel: vel / 127 });
            } else {
              // Note On with vel 0 is Note Off
              const active = activeNotes.get(note);
              if (active) {
                noteEvents.push({
                  midiNote: note,
                  startTick: active.onTick,
                  endTick: currentTick,
                  velocity: active.vel
                });
                activeNotes.delete(note);
              }
            }
          } else if (messageType === 0x80) {
            // Note Off
            const note = reader.getUint8(offset);
            offset += 2; // skip note and off-velocity
            const active = activeNotes.get(note);
            if (active) {
              noteEvents.push({
                midiNote: note,
                startTick: active.onTick,
                endTick: currentTick,
                velocity: active.vel
              });
              activeNotes.delete(note);
            }
          } else if (messageType === 0xC0) {
            // Program Change
            trackProgram = reader.getUint8(offset);
            offset += 1;
          } else if (messageType === 0xA0 || messageType === 0xB0 || messageType === 0xE0) {
            // 2-byte messages (Aftertouch, CC, Pitch Bend)
            offset += 2;
          } else if (messageType === 0xD0) {
            // 1-byte message (Channel Pressure)
            offset += 1;
          } else {
            // Unknown byte, advance by 1
            offset += 1;
          }
        }

        // Close any remaining active notes
        for (const [note, active] of activeNotes.entries()) {
          noteEvents.push({
            midiNote: note,
            startTick: active.onTick,
            endTick: currentTick + ticksPerBeat,
            velocity: active.vel
          });
        }

        if (noteEvents.length > 0) {
          parsedTracks.push({
            name: trackName,
            program: trackProgram,
            notes: noteEvents
          });
        }
      }

      if (parsedTracks.length === 0) {
        alert('No note data found in the imported MIDI file.');
        return;
      }

      // Convert ticks to milliseconds based on project BPM
      if (window.trackManager) {
        window.trackManager.setBpm(projectBpm);
        const msPerQuarterNote = (60 / projectBpm) * 1000;
        const msPerTick = msPerQuarterNote / ticksPerBeat;

        // Find matching instrument by GM program number
        const allInstruments = window.INSTRUMENTS_CATALOG || [];

        parsedTracks.forEach(pt => {
          // Find closest instrument matching GM program
          let matchedInst = allInstruments.find(i => i.gmProgram === pt.program);
          if (!matchedInst) {
            // Fallback match by family
            matchedInst = allInstruments[0];
          }

          const newTrack = window.trackManager.createTrack(matchedInst.id, pt.name);
          newTrack.events = pt.notes.map(n => ({
            id: `ev_${Date.now()}_${Math.random()}`,
            midiNote: n.midiNote,
            startTimeMs: Math.round(n.startTick * msPerTick),
            durationMs: Math.max(50, Math.round((n.endTick - n.startTick) * msPerTick)),
            velocity: parseFloat(n.velocity.toFixed(2))
          }));
        });

        window.trackManager.renderArrangerUI();

        // If piano roll is open or target track exists, open the first imported track
        const firstTrack = window.trackManager.tracks[window.trackManager.tracks.length - parsedTracks.length];
        if (firstTrack && window.pianoRoll) {
          window.pianoRoll.openTrack(firstTrack);
        }

        if (window.app && typeof window.app.showToast === 'function') {
          window.app.showToast(`Imported ${parsedTracks.length} tracks from MIDI (${projectBpm} BPM)!`);
        }
      }
    } catch (err) {
      console.error('[ExportManager] MIDI import failed:', err);
      alert('Failed to parse MIDI file: ' + err.message);
    }
  }

  _readString(reader, offset, length) {
    let str = '';
    for (let i = 0; i < length && (offset + i) < reader.byteLength; i++) {
      str += String.fromCharCode(reader.getUint8(offset + i));
    }
    return str;
  }

  _readVarLen(reader, offset) {
    let value = 0;
    let bytesRead = 0;
    while (offset + bytesRead < reader.byteLength) {
      const byte = reader.getUint8(offset + bytesRead);
      bytesRead++;
      value = (value << 7) | (byte & 0x7F);
      if ((byte & 0x80) === 0) break;
    }
    return { value, bytesRead };
  }

  _appendTrackChunk(target, trackBytes) {
    this._appendBytes(target, [0x4D, 0x54, 0x68, 0x64]); // Temporary tag replaced below
    // Set "MTrk"
    target[target.length - 4] = 0x4D;
    target[target.length - 3] = 0x54;
    target[target.length - 2] = 0x72;
    target[target.length - 1] = 0x6B;
    this._appendUint32(target, trackBytes.length);
    target.push(...trackBytes);
  }

  _writeVarLen(target, val) {
    let buffer = val & 0x7F;
    while ((val >>= 7)) {
      buffer <<= 8;
      buffer |= ((val & 0x7F) | 0x80);
    }
    while (true) {
      target.push(buffer & 0xFF);
      if (buffer & 0x80) buffer >>= 8;
      else break;
    }
  }

  _appendBytes(target, bytes) {
    bytes.forEach(b => target.push(b));
  }

  _appendUint16(target, val) {
    target.push((val >> 8) & 0xFF, val & 0xFF);
  }

  _appendUint32(target, val) {
    target.push((val >> 24) & 0xFF, (val >> 16) & 0xFF, (val >> 8) & 0xFF, val & 0xFF);
  }

  _downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);
  }
}

window.exportManager = new ExportManager();
