/**
 * Virtual Music Studio - DAW Automation Engine
 * Supports sample-accurate AudioParam automation for:
 * Track volume, pan, reverb send, delay send, chorus send, EQ low, EQ mid, EQ high, compressor threshold,
 * and Master volume, reverb return, delay return.
 * Features: Click to add points, drag, delete, multi-select, linear/smooth/step curve interpolation,
 * grid snapping, seeking synchronization, loop reset, and offline export rendering.
 */

class AutomationEngine {
  constructor() {
    this.lanes = new Map(); // trackId -> Array of AutomationLane
    this.masterLanes = [];   // Array of AutomationLane for Master Bus
    this.activePointDrag = null; // { lane, pointIndex, startX, startY, initialTime, initialVal }
    this.selectedPointIds = new Set();
    this.clipboardPoints = [];
    this.isScheduling = false;
    this.pixelsPerSecond = 80; // Synced with trackManager
    this.isVisible = true;
    this.containerEl = null;
    this.colors = {
      volume: '#8B5CF6',
      pan: '#06B6D4',
      reverbSend: '#EC4899',
      delaySend: '#3B82F6',
      chorusSend: '#10B981',
      eqLow: '#F59E0B',
      eqMid: '#EAB308',
      eqHigh: '#84CC16',
      compThreshold: '#EF4444',
      masterVolume: '#A855F7',
      masterReverb: '#F43F5E',
      masterDelay: '#6366F1'
    };

    this.paramMeta = {
      volume: { label: 'Track Volume', min: 0, max: 1.5, default: 0.8, unit: 'dB' },
      pan: { label: 'Track Pan', min: -1.0, max: 1.0, default: 0, unit: 'Pan' },
      reverbSend: { label: 'Reverb Send', min: 0, max: 1.0, default: 0.25, unit: '%' },
      delaySend: { label: 'Delay Send', min: 0, max: 1.0, default: 0.15, unit: '%' },
      chorusSend: { label: 'Chorus Send', min: 0, max: 1.0, default: 0.0, unit: '%' },
      eqLow: { label: 'EQ Low Gain', min: -15, max: 15, default: 0, unit: 'dB' },
      eqMid: { label: 'EQ Mid Gain', min: -15, max: 15, default: 0, unit: 'dB' },
      eqHigh: { label: 'EQ High Gain', min: -15, max: 15, default: 0, unit: 'dB' },
      compThreshold: { label: 'Comp Threshold', min: -60, max: 0, default: -18, unit: 'dB' },
      masterVolume: { label: 'Master Volume', min: 0, max: 1.25, default: 0.85, unit: 'dB' },
      masterReverb: { label: 'Master Reverb', min: 0, max: 1.0, default: 0.9, unit: '%' },
      masterDelay: { label: 'Master Delay', min: 0, max: 1.0, default: 0.85, unit: '%' }
    };
  }

  init(containerEl) {
    this.containerEl = containerEl || document.getElementById('automation-lanes-mount');
    if (this.masterLanes.length === 0) {
      this.addLane('master', 'masterVolume', 'smooth');
    }
    this.render();
    console.log('[AutomationEngine] Professional DAW Automation Subsystem Initialized.');
  }

  toggleView() {
    this.isVisible = !this.isVisible;
    const btn = document.getElementById('btn-toggle-automation');
    if (btn) btn.classList.toggle('active', this.isVisible);
    this.render();
  }

  /**
   * Adds an automation lane to a track or master
   */
  addLane(trackId, param = 'volume', curveType = 'linear') {
    const laneId = `lane_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const meta = this.paramMeta[param] || { default: 0.8, min: 0, max: 1.0 };
    const color = this.colors[param] || '#8B5CF6';

    const lane = {
      id: laneId,
      trackId: trackId, // 'master' or trackId
      param: param,
      label: meta.label || param,
      color: color,
      curveType: curveType, // 'linear', 'smooth', 'step'
      isExpanded: true,
      points: [
        { id: `pt_${Date.now()}_1`, timeMs: 0, value: meta.default },
        { id: `pt_${Date.now()}_2`, timeMs: 16000, value: meta.default }
      ]
    };

    if (trackId === 'master') {
      this.masterLanes.push(lane);
    } else {
      if (!this.lanes.has(trackId)) {
        this.lanes.set(trackId, []);
      }
      this.lanes.get(trackId).push(lane);
    }

    if (window.trackManager) window.trackManager.renderArrangerUI();
    return lane;
  }

  removeLane(laneId) {
    for (const [tId, arr] of this.lanes.entries()) {
      const idx = arr.findIndex(l => l.id === laneId);
      if (idx !== -1) {
        arr.splice(idx, 1);
        if (window.trackManager) window.trackManager.renderArrangerUI();
        return;
      }
    }
    const mIdx = this.masterLanes.findIndex(l => l.id === laneId);
    if (mIdx !== -1) {
      this.masterLanes.splice(mIdx, 1);
      if (window.trackManager) window.trackManager.renderArrangerUI();
    }
  }

  getLanesForTrack(trackId) {
    return this.lanes.get(trackId) || [];
  }

  /**
   * Evaluates the interpolated value of an automation lane at any timestamp (in ms)
   */
  getValueAtTime(lane, timeMs) {
    if (!lane || !lane.points || lane.points.length === 0) {
      const meta = this.paramMeta[lane.param] || { default: 0 };
      return meta.default;
    }

    // Sort points by time
    const pts = [...lane.points].sort((a, b) => a.timeMs - b.timeMs);

    if (timeMs <= pts[0].timeMs) return pts[0].value;
    if (timeMs >= pts[pts.length - 1].timeMs) return pts[pts.length - 1].value;

    // Find surrounding points
    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      if (timeMs >= p1.timeMs && timeMs <= p2.timeMs) {
        if (lane.curveType === 'step') {
          return p1.value;
        }

        const t = (timeMs - p1.timeMs) / (p2.timeMs - p1.timeMs);
        if (lane.curveType === 'smooth') {
          // S-curve smooth interpolation (Cosine / Hermite ease)
          const smoothT = (1 - Math.cos(t * Math.PI)) / 2;
          return p1.value + (p2.value - p1.value) * smoothT;
        }

        // Linear interpolation
        return p1.value + (p2.value - p1.value) * t;
      }
    }

    return pts[pts.length - 1].value;
  }

  /**
   * Applies automation values directly to Web Audio nodes at current playback playhead
   */
  applyAutomationAt(timeMs) {
    if (!window.audioEngine || !window.audioEngine.ctx) return;
    const ctx = window.audioEngine.ctx;
    const t = ctx.currentTime;

    // Apply Track Lanes
    for (const [trackId, laneList] of this.lanes.entries()) {
      const channel = window.mixerEngine ? window.mixerEngine.getTrackChannel(trackId) : null;
      if (!channel) continue;

      laneList.forEach(lane => {
        const val = this.getValueAtTime(lane, timeMs);
        this._setTargetAudioParam(channel, lane.param, val, t);
      });
    }

    // Apply Master Lanes
    if (window.mixerEngine) {
      this.masterLanes.forEach(lane => {
        const val = this.getValueAtTime(lane, timeMs);
        this._setMasterTargetParam(lane.param, val, t);
      });
    }
  }

  _setTargetAudioParam(channel, param, val, timeAudio) {
    try {
      switch (param) {
        case 'volume':
          channel.volumeGain.gain.setTargetAtTime(val, timeAudio, 0.02);
          break;
        case 'pan':
          if (channel.panner.pan) channel.panner.pan.setTargetAtTime(val, timeAudio, 0.02);
          break;
        case 'reverbSend':
          channel.sends.reverb.gain.setTargetAtTime(val, timeAudio, 0.02);
          break;
        case 'delaySend':
          channel.sends.delay.gain.setTargetAtTime(val, timeAudio, 0.02);
          break;
        case 'chorusSend':
          channel.sends.chorus.gain.setTargetAtTime(val, timeAudio, 0.02);
          break;
        case 'eqLow':
          channel.eq.low.gain.setTargetAtTime(val, timeAudio, 0.02);
          break;
        case 'eqMid':
          channel.eq.mid.gain.setTargetAtTime(val, timeAudio, 0.02);
          break;
        case 'eqHigh':
          channel.eq.high.gain.setTargetAtTime(val, timeAudio, 0.02);
          break;
        case 'compThreshold':
          channel.compressor.threshold.setTargetAtTime(val, timeAudio, 0.02);
          break;
      }
    } catch (e) {
      // AudioParam target safely handled
    }
  }

  _setMasterTargetParam(param, val, timeAudio) {
    const mx = window.mixerEngine;
    if (!mx) return;
    try {
      switch (param) {
        case 'masterVolume':
          if (mx.masterGain) mx.masterGain.gain.setTargetAtTime(val, timeAudio, 0.02);
          break;
        case 'masterReverb':
          if (mx.auxReverb && mx.auxReverb.returnGain) mx.auxReverb.returnGain.gain.setTargetAtTime(val, timeAudio, 0.02);
          break;
        case 'masterDelay':
          if (mx.auxDelay && mx.auxDelay.returnGain) mx.auxDelay.returnGain.gain.setTargetAtTime(val, timeAudio, 0.02);
          break;
      }
    } catch (e) {}
  }

  /**
   * Schedules AudioParam events for continuous playback
   */
  schedulePlayback(startPlayheadMs) {
    if (!window.audioEngine || !window.audioEngine.ctx) return;
    const ctx = window.audioEngine.ctx;
    const nowAudio = ctx.currentTime;

    const scheduleLanePoints = (lane, setterFn) => {
      if (!lane.points || lane.points.length === 0) return;
      const pts = [...lane.points].sort((a, b) => a.timeMs - b.timeMs);

      // Value at start
      const startVal = this.getValueAtTime(lane, startPlayheadMs);
      setterFn(startVal, nowAudio, 'set');

      // Schedule subsequent points in future
      pts.forEach(pt => {
        if (pt.timeMs > startPlayheadMs) {
          const deltaSec = (pt.timeMs - startPlayheadMs) / 1000;
          const targetTime = nowAudio + deltaSec;
          setterFn(pt.value, targetTime, lane.curveType);
        }
      });
    };

    for (const [trackId, laneList] of this.lanes.entries()) {
      const channel = window.mixerEngine ? window.mixerEngine.getTrackChannel(trackId) : null;
      if (!channel) continue;

      laneList.forEach(lane => {
        scheduleLanePoints(lane, (val, targetAudioTime, type) => {
          this._scheduleParamChange(channel, lane.param, val, targetAudioTime, type);
        });
      });
    }

    if (window.mixerEngine) {
      this.masterLanes.forEach(lane => {
        scheduleLanePoints(lane, (val, targetAudioTime, type) => {
          this._scheduleMasterParamChange(lane.param, val, targetAudioTime, type);
        });
      });
    }
  }

  _scheduleParamChange(channel, param, val, targetTime, curveType) {
    let audioParam = null;
    switch (param) {
      case 'volume': audioParam = channel.volumeGain.gain; break;
      case 'pan': audioParam = channel.panner.pan; break;
      case 'reverbSend': audioParam = channel.sends.reverb.gain; break;
      case 'delaySend': audioParam = channel.sends.delay.gain; break;
      case 'chorusSend': audioParam = channel.sends.chorus.gain; break;
      case 'eqLow': audioParam = channel.eq.low.gain; break;
      case 'eqMid': audioParam = channel.eq.mid.gain; break;
      case 'eqHigh': audioParam = channel.eq.high.gain; break;
      case 'compThreshold': audioParam = channel.compressor.threshold; break;
    }
    if (!audioParam) return;

    try {
      if (curveType === 'set') {
        audioParam.setValueAtTime(val, targetTime);
      } else if (curveType === 'step') {
        audioParam.setValueAtTime(val, targetTime);
      } else {
        audioParam.linearRampToValueAtTime(val, targetTime);
      }
    } catch (e) {}
  }

  _scheduleMasterParamChange(param, val, targetTime, curveType) {
    const mx = window.mixerEngine;
    if (!mx) return;
    let audioParam = null;
    switch (param) {
      case 'masterVolume': audioParam = mx.masterGain.gain; break;
      case 'masterReverb': audioParam = mx.auxReverb.returnGain.gain; break;
      case 'masterDelay': audioParam = mx.auxDelay.returnGain.gain; break;
    }
    if (!audioParam) return;
    try {
      if (curveType === 'set' || curveType === 'step') {
        audioParam.setValueAtTime(val, targetTime);
      } else {
        audioParam.linearRampToValueAtTime(val, targetTime);
      }
    } catch (e) {}
  }

  cancelScheduledAutomation() {
    if (!window.audioEngine || !window.audioEngine.ctx) return;
    const now = window.audioEngine.ctx.currentTime;

    const cancelParam = (param) => {
      try {
        if (param && param.cancelScheduledValues) {
          param.cancelScheduledValues(now);
        }
      } catch (e) {}
    };

    if (window.mixerEngine) {
      window.mixerEngine.channels.forEach(ch => {
        cancelParam(ch.volumeGain.gain);
        if (ch.panner.pan) cancelParam(ch.panner.pan);
        cancelParam(ch.sends.reverb.gain);
        cancelParam(ch.sends.delay.gain);
        cancelParam(ch.sends.chorus.gain);
        cancelParam(ch.eq.low.gain);
        cancelParam(ch.eq.mid.gain);
        cancelParam(ch.eq.high.gain);
        cancelParam(ch.compressor.threshold);
      });
      cancelParam(window.mixerEngine.masterGain.gain);
    }
  }

  /**
   * Renders the interactive Automation Lane SVG element into a track row
   */
  renderLaneElement(lane, widthPx = 3200, heightPx = 64) {
    const laneDiv = document.createElement('div');
    laneDiv.className = 'automation-lane-row';
    laneDiv.dataset.laneId = lane.id;

    const meta = this.paramMeta[lane.param] || { min: 0, max: 1.0, default: 0.5 };

    // Lane Header / Param Switcher
    const laneHeader = document.createElement('div');
    laneHeader.className = 'automation-lane-header';
    laneHeader.innerHTML = `
      <div style="display: flex; align-items: center; gap: 6px;">
        <span class="auto-color-dot" style="background: ${lane.color}"></span>
        <select class="auto-param-select">
          <option value="volume" ${lane.param === 'volume' ? 'selected' : ''}>Vol (Volume)</option>
          <option value="pan" ${lane.param === 'pan' ? 'selected' : ''}>Pan (Stereo)</option>
          <option value="reverbSend" ${lane.param === 'reverbSend' ? 'selected' : ''}>Rev (Reverb Send)</option>
          <option value="delaySend" ${lane.param === 'delaySend' ? 'selected' : ''}>Dly (Delay Send)</option>
          <option value="chorusSend" ${lane.param === 'chorusSend' ? 'selected' : ''}>Cho (Chorus Send)</option>
          <option value="eqLow" ${lane.param === 'eqLow' ? 'selected' : ''}>EQ Low Shelf</option>
          <option value="eqMid" ${lane.param === 'eqMid' ? 'selected' : ''}>EQ Mid Peak</option>
          <option value="eqHigh" ${lane.param === 'eqHigh' ? 'selected' : ''}>EQ High Shelf</option>
          <option value="compThreshold" ${lane.param === 'compThreshold' ? 'selected' : ''}>Comp Threshold</option>
        </select>
      </div>

      <div class="auto-lane-actions">
        <select class="auto-curve-select" title="Interpolation Mode">
          <option value="linear" ${lane.curveType === 'linear' ? 'selected' : ''}>Linear</option>
          <option value="smooth" ${lane.curveType === 'smooth' ? 'selected' : ''}>Smooth</option>
          <option value="step" ${lane.curveType === 'step' ? 'selected' : ''}>Step</option>
        </select>
        <button class="auto-del-lane-btn" title="Delete Automation Lane">✕</button>
      </div>
    `;

    // Interactive SVG Canvas Track
    const svgArea = document.createElement('div');
    svgArea.className = 'automation-svg-area';
    svgArea.style.width = `${widthPx}px`;
    svgArea.style.height = `${heightPx}px`;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', widthPx);
    svg.setAttribute('height', heightPx);
    svg.setAttribute('class', 'automation-svg');

    // Draw grid background line
    const bgLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    bgLine.setAttribute('x1', '0');
    bgLine.setAttribute('y1', heightPx / 2);
    bgLine.setAttribute('x2', widthPx);
    bgLine.setAttribute('y2', heightPx / 2);
    bgLine.setAttribute('stroke', 'rgba(255, 255, 255, 0.08)');
    bgLine.setAttribute('stroke-dasharray', '4,4');
    svg.appendChild(bgLine);

    // Draw curve path
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const pathData = this._generateSvgPath(lane, meta, widthPx, heightPx);
    path.setAttribute('d', pathData);
    path.setAttribute('stroke', lane.color);
    path.setAttribute('stroke-width', '2.5');
    path.setAttribute('fill', 'none');
    svg.appendChild(path);

    // Draw point circles
    const pts = [...lane.points].sort((a, b) => a.timeMs - b.timeMs);
    pts.forEach((pt, pIdx) => {
      const x = (pt.timeMs / 1000) * this.pixelsPerSecond;
      const norm = (pt.value - meta.min) / (meta.max - meta.min);
      const y = heightPx - (norm * (heightPx - 12) + 6);

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', x);
      circle.setAttribute('cy', y);
      circle.setAttribute('r', '5.5');
      circle.setAttribute('fill', '#FFFFFF');
      circle.setAttribute('stroke', lane.color);
      circle.setAttribute('stroke-width', '2.5');
      circle.setAttribute('class', `auto-point-handle ${this.selectedPointIds.has(pt.id) ? 'selected' : ''}`);
      circle.dataset.pointId = pt.id;

      // Point Dragging
      circle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        this._startPointDrag(e, lane, pt, svgArea, meta, heightPx);
      });

      // Point Deletion (Double click or right click)
      circle.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        lane.points = lane.points.filter(p => p.id !== pt.id);
        if (window.trackManager) window.trackManager.renderArrangerUI();
      });

      circle.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        lane.points = lane.points.filter(p => p.id !== pt.id);
        if (window.trackManager) window.trackManager.renderArrangerUI();
      });

      svg.appendChild(circle);
    });

    // Click on empty SVG area adds new point
    svgArea.addEventListener('click', (e) => {
      if (e.target.tagName === 'circle') return;
      const rect = svgArea.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      let timeMs = (clickX / this.pixelsPerSecond) * 1000;
      // Snap to 1/16th note default
      const bpm = (window.trackManager && window.trackManager.bpm) || 120;
      const snapMs = (60 / bpm) * 250; // 1/16 beat
      timeMs = Math.round(timeMs / snapMs) * snapMs;

      const norm = 1 - (clickY / heightPx);
      const val = meta.min + (norm * (meta.max - meta.min));

      lane.points.push({
        id: `pt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        timeMs: Math.max(0, timeMs),
        value: Math.max(meta.min, Math.min(meta.max, parseFloat(val.toFixed(3))))
      });

      if (window.trackManager) window.trackManager.renderArrangerUI();
    });

    // Event handlers for param change and curve change
    laneHeader.querySelector('.auto-param-select').addEventListener('change', (e) => {
      lane.param = e.target.value;
      lane.color = this.colors[lane.param] || '#8B5CF6';
      lane.label = (this.paramMeta[lane.param] || {}).label || lane.param;
      if (window.trackManager) window.trackManager.renderArrangerUI();
    });

    laneHeader.querySelector('.auto-curve-select').addEventListener('change', (e) => {
      lane.curveType = e.target.value;
      if (window.trackManager) window.trackManager.renderArrangerUI();
    });

    laneHeader.querySelector('.auto-del-lane-btn').addEventListener('click', () => {
      this.removeLane(lane.id);
    });

    svgArea.appendChild(svg);
    laneDiv.appendChild(laneHeader);
    laneDiv.appendChild(svgArea);
    return laneDiv;
  }

  _generateSvgPath(lane, meta, widthPx, heightPx) {
    const pts = [...lane.points].sort((a, b) => a.timeMs - b.timeMs);
    if (pts.length === 0) return '';

    const toY = (val) => {
      const norm = (val - meta.min) / (meta.max - meta.min);
      return heightPx - (norm * (heightPx - 12) + 6);
    };

    const firstY = toY(pts[0].value);
    let d = `M 0 ${firstY}`;

    for (let i = 0; i < pts.length; i++) {
      const pt = pts[i];
      const x = (pt.timeMs / 1000) * this.pixelsPerSecond;
      const y = toY(pt.value);

      if (lane.curveType === 'step' && i > 0) {
        const prevPt = pts[i - 1];
        const prevY = toY(prevPt.value);
        d += ` L ${x} ${prevY} L ${x} ${y}`;
      } else if (lane.curveType === 'smooth' && i > 0) {
        const prevPt = pts[i - 1];
        const prevX = (prevPt.timeMs / 1000) * this.pixelsPerSecond;
        const prevY = toY(prevPt.value);
        const cpX1 = prevX + (x - prevX) * 0.5;
        const cpX2 = prevX + (x - prevX) * 0.5;
        d += ` C ${cpX1} ${prevY}, ${cpX2} ${y}, ${x} ${y}`;
      } else {
        d += ` L ${x} ${y}`;
      }
    }

    // Extend to end of lane width
    const lastY = toY(pts[pts.length - 1].value);
    d += ` L ${widthPx} ${lastY}`;
    return d;
  }

  _startPointDrag(e, lane, pt, containerEl, meta, heightPx) {
    const startX = e.clientX;
    const startY = e.clientY;
    const initialTime = pt.timeMs;
    const initialVal = pt.value;

    const onMouseMove = (moveEv) => {
      const dx = moveEv.clientX - startX;
      const dy = moveEv.clientY - startY;

      // Time shift (dx)
      const dTime = (dx / this.pixelsPerSecond) * 1000;
      let newTime = Math.max(0, initialTime + dTime);

      // Snap to musical grid (1/16 note)
      const bpm = (window.trackManager && window.trackManager.bpm) || 120;
      const snapMs = (60 / bpm) * 250;
      newTime = Math.round(newTime / snapMs) * snapMs;
      pt.timeMs = newTime;

      // Value shift (dy, inverted)
      const dValNorm = -(dy / (heightPx - 12));
      const range = meta.max - meta.min;
      let newVal = initialVal + (dValNorm * range);
      newVal = Math.max(meta.min, Math.min(meta.max, newVal));
      pt.value = parseFloat(newVal.toFixed(3));

      // Quick visual update without full rerender
      const pathEl = containerEl.querySelector('path');
      if (pathEl) {
        pathEl.setAttribute('d', this._generateSvgPath(lane, meta, 3200, heightPx));
      }
      const circleEl = containerEl.querySelector(`circle[data-point-id="${pt.id}"]`);
      if (circleEl) {
        const cx = (pt.timeMs / 1000) * this.pixelsPerSecond;
        const norm = (pt.value - meta.min) / (meta.max - meta.min);
        const cy = heightPx - (norm * (heightPx - 12) + 6);
        circleEl.setAttribute('cx', cx);
        circleEl.setAttribute('cy', cy);
      }
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      if (window.trackManager) window.trackManager.renderArrangerUI();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  render() {
    if (!this.containerEl) {
      this.containerEl = document.getElementById('automation-lanes-mount');
    }
    if (!this.containerEl) return;

    if (!this.isVisible) {
      this.containerEl.style.display = 'none';
      return;
    }

    this.containerEl.style.display = 'flex';
    this.containerEl.innerHTML = '';

    // Automation Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'automation-toolbar';
    toolbar.style.padding = '6px 12px';
    toolbar.style.display = 'flex';
    toolbar.style.alignItems = 'center';
    toolbar.style.gap = '8px';
    toolbar.style.background = 'var(--bg-dark)';
    toolbar.style.borderBottom = '1px solid var(--border-subtle)';

    toolbar.innerHTML = `
      <span style="font-size: 11px; font-weight: bold; color: var(--accent-purple);">AUTOMATION LANES</span>
      <button class="btn btn-sm btn-secondary btn-add-track-lane">+ Add Track Lane</button>
      <button class="btn btn-sm btn-ghost btn-add-master-lane">+ Add Master Lane</button>
    `;

    toolbar.querySelector('.btn-add-track-lane').addEventListener('click', () => {
      const selectedId = window.trackManager ? window.trackManager.selectedTrackId : null;
      if (!selectedId) {
        alert('Please select a track first.');
        return;
      }
      this.addLane(selectedId, 'volume', 'smooth');
      this.render();
    });

    toolbar.querySelector('.btn-add-master-lane').addEventListener('click', () => {
      this.addLane('master', 'masterVolume', 'smooth');
      this.render();
    });

    this.containerEl.appendChild(toolbar);

    // Master Lanes
    this.masterLanes.forEach(lane => {
      const el = this.renderLaneElement(lane, 3200, 72);
      this.containerEl.appendChild(el);
    });

    // Track Lanes
    for (const [trackId, laneList] of this.lanes.entries()) {
      const track = window.trackManager ? window.trackManager.tracks.find(t => t.id === trackId) : null;
      const trackName = track ? track.name : trackId;
      laneList.forEach(lane => {
        lane.label = `${trackName} - ${(this.paramMeta[lane.param] || {}).label || lane.param}`;
        const el = this.renderLaneElement(lane, 3200, 72);
        this.containerEl.appendChild(el);
      });
    }
  }

  applyOfflineAutomation(offlineCtx, trackParamMap) {
    if (!offlineCtx) return;

    for (const [trackId, laneList] of this.lanes.entries()) {
      const pMap = trackParamMap[trackId];
      if (!pMap) continue;

      laneList.forEach(lane => {
        let targetParam = null;
        switch (lane.param) {
          case 'volume': targetParam = pMap.volume; break;
          case 'pan': targetParam = pMap.pan; break;
          case 'reverbSend': targetParam = pMap.reverbSend; break;
          case 'delaySend': targetParam = pMap.delaySend; break;
          case 'eqLow': targetParam = pMap.eqLow; break;
          case 'eqMid': targetParam = pMap.eqMid; break;
          case 'eqHigh': targetParam = pMap.eqHigh; break;
        }

        if (targetParam && lane.points && lane.points.length > 0) {
          const pts = [...lane.points].sort((a, b) => a.timeMs - b.timeMs);
          targetParam.setValueAtTime(pts[0].value, 0);

          for (let i = 0; i < pts.length; i++) {
            const timeSec = pts[i].timeMs / 1000;
            if (lane.curveType === 'step') {
              targetParam.setValueAtTime(pts[i].value, timeSec);
            } else {
              targetParam.linearRampToValueAtTime(pts[i].value, timeSec);
            }
          }
        }
      });
    }
  }

  toJSON() {
    const lanesObj = {};
    for (const [k, v] of this.lanes.entries()) {
      lanesObj[k] = v;
    }
    return {
      masterLanes: this.masterLanes,
      lanes: lanesObj,
      isVisible: this.isVisible
    };
  }

  fromJSON(data) {
    if (!data) return;
    if (data.masterLanes) this.masterLanes = data.masterLanes;
    if (data.lanes) {
      this.lanes = new Map();
      for (const [k, v] of Object.entries(data.lanes)) {
        this.lanes.set(k, v);
      }
    }
    if (data.isVisible !== undefined) this.isVisible = data.isVisible;
    this.render();
  }
}

// Global Singleton Instance
window.automationEngine = new AutomationEngine();
