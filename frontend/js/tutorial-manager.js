/**
 * Virtual Music Studio - Interactive Tutorials Engine
 * Live interactive learning lessons with real-time QWERTY key detection, audio demonstration,
 * visual keyboard guidance, step progression, and achievement badges.
 */

const TUTORIALS_DATA = [
  {
    id: 'intro_qwerty',
    title: 'Mastering the QWERTY Keyboard',
    category: 'Getting Started',
    duration: '3 mins',
    instrumentId: 'classical_piano',
    description: 'Learn how your physical computer keyboard becomes an expressive 2-octave musical piano.',
    steps: [
      {
        instruction: 'Press the "A" key on your physical keyboard to play Middle C (C4).',
        expectedKeys: ['KeyA'],
        hint: 'Key "A" = C4 (Root of C Major)',
        demoMidi: 60
      },
      {
        instruction: 'Now press "S" to play note D4.',
        expectedKeys: ['KeyS'],
        hint: 'Key "S" = D4 (2nd note)',
        demoMidi: 62
      },
      {
        instruction: 'Press "D" to play note E4.',
        expectedKeys: ['KeyD'],
        hint: 'Key "D" = E4 (Major 3rd)',
        demoMidi: 64
      },
      {
        instruction: 'Press "F" to play note F4.',
        expectedKeys: ['KeyF'],
        hint: 'Key "F" = F4 (Perfect 4th)',
        demoMidi: 65
      },
      {
        instruction: 'Awesome! Now play the 4-note melody in sequence: A ➔ S ➔ D ➔ F.',
        expectedSequence: ['KeyA', 'KeyS', 'KeyD', 'KeyF'],
        hint: 'Play A, then S, then D, then F',
        demoMidi: [60, 62, 64, 65]
      }
    ]
  },
  {
    id: 'black_keys',
    title: 'Sharps & Flats (The Upper Row)',
    category: 'Music Fundamentals',
    duration: '4 mins',
    instrumentId: 'grand_classical_piano',
    description: 'Explore the upper QWERTY row (W, E, T, Y, U) to play chromatic accidentals.',
    steps: [
      {
        instruction: 'Press "W" to play C#4 (the black key between C and D).',
        expectedKeys: ['KeyW'],
        hint: 'Key "W" = C#4 / Db4',
        demoMidi: 61
      },
      {
        instruction: 'Press "E" to play D#4 (the black key between D and E).',
        expectedKeys: ['KeyE'],
        hint: 'Key "E" = D#4 / Eb4',
        demoMidi: 63
      },
      {
        instruction: 'Press "T" to play F#4.',
        expectedKeys: ['KeyT'],
        hint: 'Key "T" = F#4 / Gb4',
        demoMidi: 66
      },
      {
        instruction: 'Play the blues lick: D (E4) followed quickly by E (D#4) and S (D4).',
        expectedSequence: ['KeyD', 'KeyE', 'KeyS'],
        hint: 'D ➔ E ➔ S',
        demoMidi: [64, 63, 62]
      }
    ]
  },
  {
    id: 'first_chord',
    title: 'Playing Your First Triad Chord',
    category: 'Chords & Harmony',
    duration: '5 mins',
    instrumentId: 'classical_piano',
    description: 'Learn how to play multiple keys simultaneously to form a rich C Major chord.',
    steps: [
      {
        instruction: 'A C-Major triad is formed by notes C (A), E (D), and G (G). First, press and hold "A".',
        expectedKeys: ['KeyA'],
        hint: 'Note C4',
        demoMidi: 60
      },
      {
        instruction: 'Now press note "D" (E4) and note "G" (G4) together to complete the triad!',
        expectedChord: ['KeyA', 'KeyD', 'KeyG'],
        hint: 'Press A + D + G simultaneously on your keyboard!',
        demoMidi: [60, 64, 67]
      },
      {
        instruction: 'Now shift up to F Major: Press F (F4) + H (A4) + K (C5) together!',
        expectedChord: ['KeyF', 'KeyH', 'KeyK'],
        hint: 'Press F + H + K simultaneously!',
        demoMidi: [65, 69, 72]
      }
    ]
  },
  {
    id: 'recording_lesson',
    title: 'Recording Your First Song Take',
    category: 'Studio Production',
    duration: '4 mins',
    instrumentId: 'violin',
    description: 'Master the recording workflow: record note events, inspect the timeline, and replay your music.',
    steps: [
      {
        instruction: 'Switch your active instrument to the Violin.',
        actionCheck: () => window.instrumentManager.currentInstrument.id === 'violin',
        hint: 'Click on Violin in the Instruments library',
        demoMidi: 67
      },
      {
        instruction: 'Click the red "● Record" button in the top studio toolbar to start recording.',
        actionCheck: () => window.recordingEngine.isRecording,
        hint: 'Click ● Record',
        demoMidi: null
      },
      {
        instruction: 'Play any 5 notes on your keyboard (try A - S - D - F - G) while recording.',
        actionCheck: () => window.recordingEngine.recordedEvents.length >= 5,
        hint: 'Play notes on the QWERTY keyboard',
        demoMidi: [60, 62, 64, 65, 67]
      },
      {
        instruction: 'Now click "■ Stop" to save your recorded take.',
        actionCheck: () => !window.recordingEngine.isRecording && window.recordingEngine.takes.length > 0,
        hint: 'Click Stop in the recording controls',
        demoMidi: null
      }
    ]
  },
  {
    id: 'sitar_raga',
    title: 'Playing Indian Classical on the Sitar',
    category: 'World Music',
    duration: '6 mins',
    instrumentId: 'sitar',
    description: 'Explore traditional Indian microtonality, sympathetic resonance, and Raga Bhairav.',
    steps: [
      {
        instruction: 'Switch to the Sitar instrument.',
        actionCheck: () => window.instrumentManager.currentInstrument.id === 'sitar',
        hint: 'Select Sitar from the String Instruments family',
        demoMidi: 60
      },
      {
        instruction: 'Play Sa (Root C): Press key "A".',
        expectedKeys: ['KeyA'],
        hint: 'Key "A"',
        demoMidi: 60
      },
      {
        instruction: 'Play Komal Re (Flat 2nd): Press key "W" (C#). Notice the exotic tension!',
        expectedKeys: ['KeyW'],
        hint: 'Key "W"',
        demoMidi: 61
      },
      {
        instruction: 'Play the classic Aaroh phrase: A (Sa) ➔ W (re) ➔ D (Ga) ➔ F (Ma).',
        expectedSequence: ['KeyA', 'KeyW', 'KeyD', 'KeyF'],
        hint: 'Keys: A ➔ W ➔ D ➔ F',
        demoMidi: [60, 61, 64, 65]
      }
    ]
  },
  {
    id: 'drum_groove',
    title: 'Building a 16-Step Drum Groove',
    category: 'Beat Making',
    duration: '4 mins',
    instrumentId: 'stage_piano',
    description: 'Program syncopated kick, snare, and hi-hat beats in the drum machine sequencer.',
    steps: [
      {
        instruction: 'Open the Drum Machine tab in the main navigation.',
        actionCheck: () => window.app && window.app.currentView === 'drum-machine',
        hint: 'Click "Drum Machine" in the top navigation bar',
        demoMidi: null
      },
      {
        instruction: 'Click the "Rock" preset button to load a standard 4/4 groove.',
        hint: 'Click the "Rock" preset button',
        actionCheck: () => true,
        demoMidi: null
      },
      {
        instruction: 'Click "▶ Play Beat" to hear the rhythm engine!',
        actionCheck: () => window.drumMachine && window.drumMachine.isPlaying,
        hint: 'Click Play Beat',
        demoMidi: null
      }
    ]
  }
];

class TutorialManager {
  constructor() {
    this.tutorials = TUTORIALS_DATA;
    this.activeTutorial = null;
    this.currentStepIdx = 0;
    this.completedTutorials = new Set(JSON.parse(localStorage.getItem('vms_completed_tutorials') || '[]'));
    this.containerEl = null;
    this.sequenceBuffer = [];
  }

  init(containerEl) {
    this.containerEl = containerEl;
    this.render();
    this._bindEngineListener();
  }

  render() {
    if (!this.containerEl) return;
    this.containerEl.innerHTML = '';

    if (this.activeTutorial) {
      this.renderActiveLesson();
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'tutorials-grid';

    this.tutorials.forEach((tut, idx) => {
      const isDone = this.completedTutorials.has(tut.id);
      const card = document.createElement('div');
      card.className = `tutorial-card ${isDone ? 'completed' : ''}`;

      card.innerHTML = `
        <div class="tut-header">
          <span class="tut-category">${tut.category}</span>
          <span class="tut-badge ${isDone ? 'done' : ''}">${isDone ? '✓ Completed' : tut.duration}</span>
        </div>
        <h3 class="tut-title">${tut.title}</h3>
        <p class="tut-desc">${tut.description}</p>
        <div class="tut-steps-count">${tut.steps.length} interactive steps</div>
        <button class="btn btn-primary start-tut-btn">${isDone ? '↻ Replay Lesson' : '▶ Start Lesson'}</button>
      `;

      card.querySelector('.start-tut-btn').addEventListener('click', () => {
        this.startTutorial(tut);
      });

      grid.appendChild(card);
    });

    this.containerEl.appendChild(grid);
  }

  startTutorial(tutorial) {
    this.activeTutorial = tutorial;
    this.currentStepIdx = 0;
    this.sequenceBuffer = [];

    // Switch instrument if lesson requires it
    if (tutorial.instrumentId && window.instrumentManager) {
      window.instrumentManager.selectInstrument(tutorial.instrumentId);
    }

    this.renderActiveLesson();
    this._highlightCurrentStepKeys();
  }

  renderActiveLesson() {
    if (!this.containerEl || !this.activeTutorial) return;
    this.containerEl.innerHTML = '';

    const tut = this.activeTutorial;
    const step = tut.steps[this.currentStepIdx];
    const progressPct = Math.round(((this.currentStepIdx + 1) / tut.steps.length) * 100);

    const view = document.createElement('div');
    view.className = 'active-lesson-view';

    view.innerHTML = `
      <div class="lesson-header-bar">
        <button class="btn btn-sm btn-ghost exit-tut-btn">← Back to Lessons</button>
        <span class="lesson-title-badge">${tut.title}</span>
        <span class="step-counter">Step ${this.currentStepIdx + 1} of ${tut.steps.length}</span>
      </div>

      <div class="tut-progress-track">
        <div class="tut-progress-fill" style="width: ${progressPct}%"></div>
      </div>

      <div class="lesson-instruction-card">
        <h3>Step ${this.currentStepIdx + 1}</h3>
        <p class="step-text">${step.instruction}</p>
        <div class="step-hint">💡 Hint: ${step.hint || 'Follow the glowing keys on the keyboard.'}</div>
        
        <div class="lesson-btn-row">
          ${step.demoMidi ? `<button class="btn btn-sm btn-secondary demo-audio-btn">🔊 Listen to Example</button>` : ''}
          <button class="btn btn-sm btn-ghost skip-step-btn">Skip Step ➔</button>
        </div>
      </div>

      <div class="lesson-live-tip">
        Press keys directly on your physical computer keyboard or the on-screen keys below!
      </div>
    `;

    view.querySelector('.exit-tut-btn').addEventListener('click', () => {
      this.activeTutorial = null;
      this._clearTutorialKeyHighlights();
      this.render();
    });

    view.querySelector('.skip-step-btn').addEventListener('click', () => {
      this.advanceStep();
    });

    const demoBtn = view.querySelector('.demo-audio-btn');
    if (demoBtn && step.demoMidi) {
      demoBtn.addEventListener('click', () => {
        this.playStepDemoAudio(step.demoMidi);
      });
    }

    this.containerEl.appendChild(view);
  }

  playStepDemoAudio(midiData) {
    window.audioEngine.ensureContext().then(() => {
      const inst = window.instrumentManager.currentInstrument;
      if (Array.isArray(midiData)) {
        midiData.forEach((m, idx) => {
          setTimeout(() => {
            const v = window.soundFontManager.playNote(inst, m, 0.85);
            setTimeout(() => { if (v) v.stop(); }, 350);
          }, idx * 300);
        });
      } else {
        const v = window.soundFontManager.playNote(inst, midiData, 0.85);
        setTimeout(() => { if (v) v.stop(); }, 500);
      }
    });
  }

  _bindEngineListener() {
    if (window.keyboardController) {
      window.keyboardController.onNoteTrigger((ev) => {
        if (!this.activeTutorial || ev.type !== 'noteOn') return;
        this.handleNotePlayed(ev);
      });
    }
  }

  handleNotePlayed(ev) {
    if (!this.activeTutorial) return;
    const step = this.activeTutorial.steps[this.currentStepIdx];
    if (!step) return;

    // Check actionCheck
    if (step.actionCheck && step.actionCheck()) {
      this.advanceStep();
      return;
    }

    // Check expected single key
    if (step.expectedKeys) {
      const matched = step.expectedKeys.some(code => {
        const mapped = window.noteMapper.getMidiNoteForKey(code);
        return mapped && mapped.midiNote === ev.midiNote;
      });
      if (matched) {
        this.advanceStep();
        return;
      }
    }

    // Check sequence
    if (step.expectedSequence) {
      this.sequenceBuffer.push(ev.midiNote);
      const targetMidis = step.expectedSequence.map(code => {
        const mapped = window.noteMapper.getMidiNoteForKey(code);
        return mapped ? mapped.midiNote : null;
      }).filter(Boolean);

      const bufferTail = this.sequenceBuffer.slice(-targetMidis.length);
      if (bufferTail.length === targetMidis.length && bufferTail.every((val, i) => val === targetMidis[i])) {
        this.sequenceBuffer = [];
        this.advanceStep();
      }
    }
  }

  advanceStep() {
    if (!this.activeTutorial) return;
    this.currentStepIdx++;

    if (this.currentStepIdx >= this.activeTutorial.steps.length) {
      // Completed!
      this.completedTutorials.add(this.activeTutorial.id);
      localStorage.setItem('vms_completed_tutorials', JSON.stringify(Array.from(this.completedTutorials)));
      alert(`🎉 Congratulations! You completed: ${this.activeTutorial.title}`);
      this.activeTutorial = null;
      this._clearTutorialKeyHighlights();
      this.render();
    } else {
      this.renderActiveLesson();
      this._highlightCurrentStepKeys();
    }
  }

  _highlightCurrentStepKeys() {
    this._clearTutorialKeyHighlights();
    if (!this.activeTutorial) return;
    const step = this.activeTutorial.steps[this.currentStepIdx];
    if (!step) return;

    let targetMidis = [];
    if (step.expectedKeys) {
      targetMidis = step.expectedKeys.map(k => {
        const m = window.noteMapper.getMidiNoteForKey(k);
        return m ? m.midiNote : null;
      }).filter(Boolean);
    } else if (step.expectedSequence) {
      targetMidis = step.expectedSequence.map(k => {
        const m = window.noteMapper.getMidiNoteForKey(k);
        return m ? m.midiNote : null;
      }).filter(Boolean);
    }

    targetMidis.forEach(midi => {
      const keyEl = document.querySelector(`.piano-key[data-midi="${midi}"]`);
      if (keyEl) keyEl.classList.add('tutorial-target-key');
    });
  }

  _clearTutorialKeyHighlights() {
    document.querySelectorAll('.piano-key.tutorial-target-key').forEach(k => k.classList.remove('tutorial-target-key'));
  }
}

window.tutorialManager = new TutorialManager();
