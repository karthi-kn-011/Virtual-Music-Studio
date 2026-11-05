/**
 * Virtual Music Studio - Song Arrangement & Section Manager (Phase 13)
 * Full song structure planning with section markers: Intro, Verse, Chorus, Bridge, Breakdown, Outro.
 * Supports section looping, moving, range selection, and deep section duplication (cloning MIDI notes, audio clips, and automation).
 */

class ArrangementManager {
  constructor() {
    this.sections = [
      { id: 'sec_1', name: 'Intro', type: 'intro', startBar: 1, lengthBars: 4, color: '#3B82F6' },
      { id: 'sec_2', name: 'Verse 1', type: 'verse', startBar: 5, lengthBars: 8, color: '#06B6D4' },
      { id: 'sec_3', name: 'Chorus 1', type: 'chorus', startBar: 13, lengthBars: 8, color: '#EC4899' },
      { id: 'sec_4', name: 'Outro', type: 'outro', startBar: 21, lengthBars: 4, color: '#8B5CF6' }
    ];

    this.selectedSectionId = null;
    this.loopSectionActive = false;
    this.containerEl = null;

    this.SECTION_TYPES = {
      intro: { name: 'Intro', color: '#3B82F6' },
      verse: { name: 'Verse', color: '#06B6D4' },
      pre_chorus: { name: 'Pre-Chorus', color: '#10B981' },
      chorus: { name: 'Chorus', color: '#EC4899' },
      bridge: { name: 'Bridge', color: '#F59E0B' },
      breakdown: { name: 'Breakdown', color: '#EF4444' },
      instrumental: { name: 'Instrumental', color: '#8B5CF6' },
      outro: { name: 'Outro', color: '#6B7280' },
      custom: { name: 'Custom Section', color: '#A855F7' }
    };
  }

  init(containerEl) {
    this.containerEl = containerEl;
    this.render();
  }

  addSection(type = 'verse', startBar = null, lengthBars = 4) {
    const typeDef = this.SECTION_TYPES[type] || this.SECTION_TYPES.verse;
    let nextStart = 1;
    if (this.sections.length > 0) {
      const last = this.sections[this.sections.length - 1];
      nextStart = last.startBar + last.lengthBars;
    }
    const finalStart = startBar !== null ? startBar : nextStart;

    const newSec = {
      id: `sec_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: `${typeDef.name} ${this.sections.filter(s => s.type === type).length + 1}`,
      type: type,
      startBar: finalStart,
      lengthBars: lengthBars,
      color: typeDef.color
    };

    this.sections.push(newSec);
    this.sortSections();
    this.render();
    return newSec;
  }

  removeSection(id) {
    this.sections = this.sections.filter(s => s.id !== id);
    if (this.selectedSectionId === id) this.selectedSectionId = null;
    this.render();
  }

  sortSections() {
    this.sections.sort((a, b) => a.startBar - b.startBar);
  }

  getBarDurationSec() {
    const bpm = window.trackManager ? window.trackManager.bpm : 120;
    return (60 / bpm) * 4; // 4/4 time signature bar duration in seconds
  }

  getSectionTimeRange(section) {
    const barSec = this.getBarDurationSec();
    const startSec = (section.startBar - 1) * barSec;
    const endSec = startSec + section.lengthBars * barSec;
    return { startSec, endSec, durationSec: endSec - startSec };
  }

  selectSection(id) {
    this.selectedSectionId = id;
    const sec = this.sections.find(s => s.id === id);
    if (!sec) return;

    if (window.trackManager) {
      const range = this.getSectionTimeRange(sec);
      // Seek playhead to start of section
      window.trackManager.seekTo(range.startSec * 1000);
    }
    this.render();
  }

  loopSection(id) {
    const sec = this.sections.find(s => s.id === id);
    if (!sec || !window.trackManager) return;

    const range = this.getSectionTimeRange(sec);
    window.trackManager.loopStartMs = range.startSec * 1000;
    window.trackManager.loopEndMs = range.endSec * 1000;
    window.trackManager.isLooping = true;
    window.trackManager.seekTo(range.startSec * 1000);
    this.selectedSectionId = id;
    this.render();
  }

  /**
   * Deep Section Duplication:
   * Clones all MIDI notes, Audio Clips, and Automation Points that fall within this section
   * and pastes them shifted to the end of this section (or target location).
   */
  duplicateSection(id) {
    const sec = this.sections.find(s => s.id === id);
    if (!sec) return;

    const barSec = this.getBarDurationSec();
    const range = this.getSectionTimeRange(sec);
    const shiftSec = range.durationSec;
    const shiftBars = sec.lengthBars;

    // 1. Duplicate section marker itself
    const newSection = {
      id: `sec_${Date.now()}_copy`,
      name: `${sec.name} (Copy)`,
      type: sec.type,
      startBar: sec.startBar + sec.lengthBars,
      lengthBars: sec.lengthBars,
      color: sec.color
    };
    this.sections.push(newSection);
    this.sortSections();

    // 2. Clone MIDI events in all tracks
    if (window.trackManager && window.trackManager.tracks) {
      window.trackManager.tracks.forEach(track => {
        if (!track.events) return;
        const eventsToClone = track.events.filter(e => {
          const secStart = (e.startTimeMs || 0) / 1000;
          return secStart >= range.startSec && secStart < range.endSec;
        });

        eventsToClone.forEach(e => {
          track.events.push({
            ...e,
            id: `ev_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            startTimeMs: Math.round(e.startTimeMs + shiftSec * 1000)
          });
        });
      });
      window.trackManager.renderArrangerUI();
    }

    // 3. Clone Audio Clips
    if (window.clipManager && window.clipManager.clips) {
      const clipsToClone = window.clipManager.clips.filter(c => c.startTime >= range.startSec && c.startTime < range.endSec);
      clipsToClone.forEach(c => {
        window.clipManager.duplicateClip(c.id);
        const cloned = window.clipManager.clips[window.clipManager.clips.length - 1];
        if (cloned) {
          cloned.startTime = c.startTime + shiftSec;
        }
      });
      window.clipManager.render();
    }

    // 4. Clone Automation points
    if (window.automationEngine && window.automationEngine.lanes) {
      window.automationEngine.lanes.forEach(lane => {
        const pointsToClone = lane.points.filter(p => p.time >= range.startSec && p.time < range.endSec);
        pointsToClone.forEach(p => {
          lane.points.push({
            id: `pt_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            time: p.time + shiftSec,
            value: p.value,
            curve: p.curve
          });
        });
        window.automationEngine.sortPoints(lane);
      });
    }

    this.render();
    alert(`Successfully duplicated section "${sec.name}" and all underlying tracks, clips, and automation!`);
  }

  render() {
    if (!this.containerEl) return;
    this.containerEl.innerHTML = '';

    const rootEl = document.createElement('div');
    rootEl.className = 'arrangement-manager-bar';

    // Section Bar Header / Quick Add
    const headerEl = document.createElement('div');
    headerEl.className = 'arr-bar-header';
    headerEl.innerHTML = `
      <span class="arr-bar-title">SONG SECTIONS:</span>
      <select class="arr-new-type-select">
        ${Object.entries(this.SECTION_TYPES).map(([k, v]) => `
          <option value="${k}">${v.name}</option>
        `).join('')}
      </select>
      <button class="arr-add-sec-btn">+ Add Section</button>
    `;

    headerEl.querySelector('.arr-add-sec-btn').addEventListener('click', () => {
      const type = headerEl.querySelector('.arr-new-type-select').value;
      this.addSection(type);
    });

    rootEl.appendChild(headerEl);

    // Timeline marker strip (proportional visual display)
    const stripEl = document.createElement('div');
    stripEl.className = 'arr-sections-strip';

    this.sections.forEach(sec => {
      const chip = document.createElement('div');
      chip.className = `arr-section-chip ${this.selectedSectionId === sec.id ? 'active' : ''}`;
      chip.style.borderColor = sec.color;
      chip.style.backgroundColor = `${sec.color}22`;

      chip.innerHTML = `
        <div class="sec-chip-bar" style="background:${sec.color}"></div>
        <div class="sec-chip-info">
          <span class="sec-chip-name" style="color:${sec.color}">${sec.name}</span>
          <span class="sec-chip-bars">Bar ${sec.startBar} - ${sec.startBar + sec.lengthBars} (${sec.lengthBars} bars)</span>
        </div>
        <div class="sec-chip-actions">
          <button class="sec-btn-loop" title="Loop Section" data-id="${sec.id}">🔁</button>
          <button class="sec-btn-dup" title="Duplicate Section & Content" data-id="${sec.id}">⧉</button>
          <button class="sec-btn-del" title="Delete Section" data-id="${sec.id}">×</button>
        </div>
      `;

      chip.addEventListener('click', (e) => {
        if (!e.target.closest('button')) {
          this.selectSection(sec.id);
        }
      });

      chip.querySelector('.sec-btn-loop').addEventListener('click', (e) => {
        e.stopPropagation();
        this.loopSection(sec.id);
      });

      chip.querySelector('.sec-btn-dup').addEventListener('click', (e) => {
        e.stopPropagation();
        this.duplicateSection(sec.id);
      });

      chip.querySelector('.sec-btn-del').addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Delete section "${sec.name}" marker?`)) {
          this.removeSection(sec.id);
        }
      });

      stripEl.appendChild(chip);
    });

    rootEl.appendChild(stripEl);
    this.containerEl.appendChild(rootEl);
  }

  toJSON() {
    return {
      sections: this.sections
    };
  }

  fromJSON(data) {
    if (!data) return;
    if (data.sections && Array.isArray(data.sections)) {
      this.sections = data.sections;
    }
    this.render();
  }
}

window.arrangementManager = new ArrangementManager();
