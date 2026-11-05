/**
 * Virtual Music Studio - Project Persistence Manager
 * IndexedDB storage engine with project templates, autosave, versioning, export, and recovery.
 */

class ProjectManager {
  constructor() {
    this.dbName = 'VirtualMusicStudioDB';
    this.dbVersion = 1;
    this.db = null;
    this.currentProject = {
      id: `proj_${Date.now()}`,
      name: 'Untitled Symphony',
      bpm: 120,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tracks: []
    };
    this.autosaveInterval = null;
  }

  async init() {
    await this._openDatabase();
    await this._initDefaultTemplates();
    this._startAutosave();
    console.log('[ProjectManager] IndexedDB initialized and autosave active.');
  }

  _openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('projects')) {
          const store = db.createObjectStore('projects', { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
      };

      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };

      request.onerror = (e) => reject(e.target.error);
    });
  }

  async saveProject(customName = null) {
    if (customName) this.currentProject.name = customName;
    this.currentProject.bpm = window.trackManager ? window.trackManager.bpm : 120;
    this.currentProject.updatedAt = new Date().toISOString();
    this.currentProject.tracks = window.trackManager ? JSON.parse(JSON.stringify(window.trackManager.tracks)) : [];

    // Save Master Mixer State
    if (window.mixerEngine) {
      this.currentProject.masterMixer = {
        volume: window.mixerEngine.masterVolume,
        reverbType: window.mixerEngine.auxReverb.type,
        reverbPreDelay: window.mixerEngine.auxReverb.preDelayMs,
        delaySync: window.mixerEngine.auxDelay.sync,
        delayFeedback: window.mixerEngine.auxDelay.feedback,
        chorusRate: window.mixerEngine.auxChorus.rate,
        chorusDepth: window.mixerEngine.auxChorus.depth
      };
    }

    // Phase 13 Advanced Subsystems Persistence
    if (window.automationEngine) {
      this.currentProject.automation = window.automationEngine.toJSON();
    }
    if (window.clipManager) {
      this.currentProject.audioClips = window.clipManager.toJSON();
    }
    if (window.drumMachine) {
      this.currentProject.drumSequencer = window.drumMachine.toJSON();
    }
    if (window.chordGenerator) {
      this.currentProject.chordProgression = window.chordGenerator.toJSON();
    }
    if (window.arpeggiatorEngine) {
      this.currentProject.arpeggiator = window.arpeggiatorEngine.toJSON();
    }
    if (window.arrangementManager) {
      this.currentProject.songSections = window.arrangementManager.toJSON();
    }
    if (window.masteringEngine) {
      this.currentProject.mastering = window.masteringEngine.toJSON();
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('projects', 'readwrite');
      const store = tx.objectStore('projects');
      const req = store.put(this.currentProject);

      req.onsuccess = () => {
        console.log(`[ProjectManager] Project saved: "${this.currentProject.name}"`);
        this.renderProjectsList();
        this._updateTitleUI();
        resolve(this.currentProject);
      };

      req.onerror = (e) => reject(e.target.error);
    });
  }

  async getAllProjects() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('projects', 'readonly');
      const store = tx.objectStore('projects');
      const req = store.getAll();

      req.onsuccess = () => resolve(req.result || []);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async loadProject(id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('projects', 'readonly');
      const store = tx.objectStore('projects');
      const req = store.get(id);

      req.onsuccess = () => {
        const project = req.result;
        if (project) {
          this.currentProject = project;
          if (window.trackManager) {
            window.trackManager.bpm = project.bpm || 120;
            window.trackManager.tracks = (project.tracks || []).map(t => ({
              ...t,
              events: t.events || t.notes || []
            }));
            window.trackManager.renderArrangerUI();
            if (window.mixerEngine) {
              window.mixerEngine.syncWithTracks(window.trackManager.tracks);
              if (project.masterMixer) {
                window.mixerEngine.masterVolume = project.masterMixer.volume || 0.85;
                window.mixerEngine.auxReverb.type = project.masterMixer.reverbType || 'hall';
                window.mixerEngine.auxReverb.preDelayMs = project.masterMixer.reverbPreDelay || 20;
                window.mixerEngine.auxDelay.sync = project.masterMixer.delaySync || '1/8';
                window.mixerEngine.auxDelay.feedback = project.masterMixer.delayFeedback || 0.32;
                window.mixerEngine.auxChorus.rate = project.masterMixer.chorusRate || 1.5;
                window.mixerEngine.auxChorus.depth = project.masterMixer.chorusDepth || 0.002;
                window.mixerEngine.renderMixerUI();
              }
            }
          }

          // Restore Phase 13 Subsystems
          if (window.automationEngine && project.automation) {
            window.automationEngine.fromJSON(project.automation);
          }
          if (window.clipManager && project.audioClips) {
            window.clipManager.fromJSON(project.audioClips);
          }
          if (window.drumMachine && project.drumSequencer) {
            window.drumMachine.fromJSON(project.drumSequencer);
          }
          if (window.chordGenerator && project.chordProgression) {
            window.chordGenerator.fromJSON(project.chordProgression);
          }
          if (window.arpeggiatorEngine && project.arpeggiator) {
            window.arpeggiatorEngine.fromJSON(project.arpeggiator);
          }
          if (window.arrangementManager && project.songSections) {
            window.arrangementManager.fromJSON(project.songSections);
          }
          if (window.masteringEngine && project.mastering) {
            window.masteringEngine.fromJSON(project.mastering);
          }

          this._updateTitleUI();
          console.log(`[ProjectManager] Loaded project "${project.name}"`);
          resolve(project);
        } else {
          reject(new Error('Project not found'));
        }
      };

      req.onerror = (e) => reject(e.target.error);
    });
  }

  async deleteProject(id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('projects', 'readwrite');
      const store = tx.objectStore('projects');
      const req = store.delete(id);

      req.onsuccess = () => {
        this.renderProjectsList();
        resolve();
      };

      req.onerror = (e) => reject(e.target.error);
    });
  }

  newProject() {
    this.currentProject = {
      id: `proj_${Date.now()}`,
      name: 'New Studio Project',
      bpm: 120,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tracks: []
    };
    if (window.trackManager) {
      window.trackManager.tracks = [];
      window.trackManager.createTrack('classical_piano', 'Piano Track');
      window.trackManager.createTrack('violin', 'Violin Melody');
      window.trackManager.renderArrangerUI();
    }
    this._updateTitleUI();
  }

  loadTemplate(templateKey) {
    const templates = {
      piano_solo: {
        name: 'Classical Piano Solo',
        bpm: 88,
        tracks: [{ instrumentId: 'grand_classical_piano', name: 'Grand Piano Master' }]
      },
      jazz_quartet: {
        name: 'Jazz Lounge Quartet',
        bpm: 132,
        tracks: [
          { instrumentId: 'jazz_piano', name: 'Jazz Piano Comp' },
          { instrumentId: 'double_bass', name: 'Acoustic Upright Bass' },
          { instrumentId: 'saxophone', name: 'Alto Sax Solo' },
          { instrumentId: 'mixed_percussion', name: 'Brushes Percussion' }
        ]
      },
      cinematic_epic: {
        name: 'Cinematic Orchestral',
        bpm: 105,
        tracks: [
          { instrumentId: 'brass_ensemble', name: 'Epic Brass Section' },
          { instrumentId: 'violin', name: 'Spitfire Strings' },
          { instrumentId: 'harp', name: 'Concert Harp Ostinato' },
          { instrumentId: 'auditorium_piano', name: 'Hall Grand' }
        ]
      },
      oriental_fusion: {
        name: 'Indo-Arabic Silk Road',
        bpm: 96,
        tracks: [
          { instrumentId: 'sitar', name: 'Sitar Melody' },
          { instrumentId: 'oud', name: 'Oud Rhythm' },
          { instrumentId: 'pan_flute', name: 'Bansuri Flute' },
          { instrumentId: 'mixed_percussion', name: 'Tabla Percussion' }
        ]
      }
    };

    const tpl = templates[templateKey];
    if (!tpl) return;

    this.currentProject = {
      id: `proj_${Date.now()}`,
      name: tpl.name,
      bpm: tpl.bpm,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tracks: []
    };

    if (window.trackManager) {
      window.trackManager.setBpm(tpl.bpm);
      window.trackManager.tracks = [];
      tpl.tracks.forEach(t => {
        window.trackManager.createTrack(t.instrumentId, t.name);
      });
      window.trackManager.renderArrangerUI();
    }

    this._updateTitleUI();
    if (window.app) {
      window.app.switchView('studio');
      window.app.showToast(`Loaded Template: ${tpl.name}`);
    }
  }

  _startAutosave() {
    this.autosaveInterval = setInterval(() => {
      if (window.trackManager && window.trackManager.tracks.length > 0) {
        this.saveProject();
      }
    }, 45000); // Autosave every 45 seconds
  }

  _updateTitleUI() {
    const titleInput = document.getElementById('project-name-input');
    if (titleInput) titleInput.value = this.currentProject.name;
  }

  async _initDefaultTemplates() {
    const projects = await this.getAllProjects();
    if (projects.length === 0) {
      await this.saveProject('Nocturne in C Minor');
    }
  }

  async renderProjectsList() {
    const listEl = document.getElementById('projects-saved-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    const projects = await this.getAllProjects();
    if (projects.length === 0) {
      listEl.innerHTML = '<div class="empty-takes-msg">No saved projects found in local storage.</div>';
      return;
    }

    projects.forEach(p => {
      const card = document.createElement('div');
      card.className = 'project-card';
      const updatedDate = new Date(p.updatedAt).toLocaleDateString() + ' ' + new Date(p.updatedAt).toLocaleTimeString();
      const trackCount = p.tracks ? p.tracks.length : 0;

      card.innerHTML = `
        <div class="proj-card-info">
          <h3>${p.name}</h3>
          <span class="proj-card-meta">Updated: ${updatedDate} • ${p.bpm} BPM • ${trackCount} Tracks</span>
        </div>
        <div class="proj-card-actions">
          <button class="btn btn-sm btn-primary load-proj-btn">Open</button>
          <button class="btn btn-sm btn-ghost del-proj-btn" title="Delete">🗑</button>
        </div>
      `;

      card.querySelector('.load-proj-btn').addEventListener('click', () => {
        this.loadProject(p.id).then(() => {
          if (window.app) {
            window.app.switchView('studio');
            window.app.showToast(`Opened "${p.name}"`);
          }
        });
      });

      card.querySelector('.del-proj-btn').addEventListener('click', () => {
        if (confirm(`Delete project "${p.name}"?`)) {
          this.deleteProject(p.id);
        }
      });

      listEl.appendChild(card);
    });
  }
}

window.projectManager = new ProjectManager();
