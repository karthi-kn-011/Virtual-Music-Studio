/**
 * Virtual Music Studio - Instrument Manager
 * Handles 24-instrument catalog rendering, category filtering, search,
 * instrument selection, hero UI updates, audio engine preset switching, and favorites.
 */

class InstrumentManager {
  constructor() {
    this.currentInstrument = null;
    this.instruments = [];
    this.favorites = new Set(JSON.parse(localStorage.getItem('vms_favorites') || '["classical_piano", "violin", "sitar", "saxophone"]'));
    this.recents = JSON.parse(localStorage.getItem('vms_recents') || '["classical_piano", "violin", "sitar"]');
    this.currentFilter = 'all';
    this.searchQuery = '';
    this.onInstrumentChangeCallbacks = [];
    this.isLoading = false;
    this.containerEl = null;
  }

  async init() {
    this.instruments = window.INSTRUMENTS_CATALOG || [];
    // Set default instrument to Classical Piano without triggering AudioContext creation
    const initial = this.instruments.find(i => i.id === 'classical_piano') || this.instruments[0];
    this.currentInstrument = initial;

    // Update hero card and badges with default instrument
    this._updateHeroUI(initial);
    this._updateLoadingIndicator(false, initial.name);

    // Initial notification for UI binding without audio playback
    this.onInstrumentChangeCallbacks.forEach(cb => {
      try { cb(initial); } catch (e) { console.error(e); }
    });

    console.log(`[InstrumentManager] Loaded 24 instruments. Default: ${initial.name}`);
  }

  getAllInstruments() {
    return this.instruments.length > 0 ? this.instruments : (window.INSTRUMENTS_CATALOG || []);
  }

  getInstrument(id) {
    const list = this.getAllInstruments();
    return list.find(i => i.id === id) || null;
  }

  /**
   * Selects an instrument, updates the audio engine, studio hero UI, keyboard,
   * displays a confirmation toast, and returns to the studio view.
   */
  async selectInstrument(id, userTriggered = true) {
    const inst = this.getInstrument(id);
    if (!inst) {
      console.warn(`[InstrumentManager] Instrument ID not found: ${id}`);
      return;
    }

    this.isLoading = true;
    this._updateLoadingIndicator(true, inst.name);

    // Track recently used
    this.recents = [inst.id, ...this.recents.filter(x => x !== inst.id)].slice(0, 8);
    localStorage.setItem('vms_recents', JSON.stringify(this.recents));

    // If user clicked/selected, resume/unlock AudioContext
    if (userTriggered && window.audioEngine) {
      try {
        await window.audioEngine.unlockAudio();
      } catch (err) {
        console.warn('[InstrumentManager] Audio unlock notice:', err.message);
      }
    }

    // Load SoundFont sample preset if audio engine is active or ready
    if (window.soundFontManager && window.audioEngine && window.audioEngine.ctx) {
      try {
        await window.soundFontManager.loadInstrument(inst);
      } catch (e) {
        console.warn('[InstrumentManager] Preload notice:', e);
      }
    }

    this.currentInstrument = inst;
    this.isLoading = false;
    this._updateLoadingIndicator(false, inst.name);

    // 1. Update studio hero card
    this._updateHeroUI(inst);

    // 2. Update keyboard configuration & active voice stop
    if (window.keyboardController) {
      window.keyboardController.currentInstrument = inst;
      window.keyboardController.stopAllNotes();
      if (inst.defaultOctave) {
        window.keyboardController.setOctave(inst.defaultOctave, true);
      } else {
        window.keyboardController.updateKeyLabels();
      }
    }

    // 3. Notify listeners
    this.onInstrumentChangeCallbacks.forEach(cb => {
      try { cb(inst); } catch (e) { console.error(e); }
    });

    // 4. If user triggered, return to Studio view and display confirmation
    if (userTriggered) {
      if (window.app && typeof window.app.showToast === 'function') {
        window.app.showToast(`Selected: ${inst.name} (${inst.family})`);
      }
      if (typeof window.navigateTo === 'function') {
        window.navigateTo('studio');
      }
    }

    console.log(`[InstrumentManager] Active instrument set to: ${inst.name} (${inst.family})`);
    return inst;
  }

  _updateHeroUI(inst) {
    if (!inst) return;
    const heroName = document.getElementById('current-instrument-name');
    const heroFamily = document.getElementById('current-instrument-family');
    const heroDesc = document.getElementById('current-instrument-desc');
    const heroIcon = document.getElementById('current-instrument-icon');

    if (heroName) heroName.textContent = inst.name;
    if (heroFamily) heroFamily.textContent = inst.family;
    if (heroDesc) heroDesc.textContent = inst.description;
    if (heroIcon) {
      heroIcon.innerHTML = `
        <img src="assets/instruments/${inst.id}.svg" alt="${inst.name}" class="hero-artwork-img" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';" />
        <div class="fallback-hero-svg" style="display:none; color: ${inst.badgeColor || '#8B5CF6'}">
          ${this.getInstrumentSvg(inst.id)}
        </div>
      `;
    }
  }

  onInstrumentChange(cb) {
    this.onInstrumentChangeCallbacks.push(cb);
  }

  toggleFavorite(id) {
    if (this.favorites.has(id)) {
      this.favorites.delete(id);
    } else {
      this.favorites.add(id);
    }
    localStorage.setItem('vms_favorites', JSON.stringify(Array.from(this.favorites)));
    this.renderCatalogue();
    return this.favorites.has(id);
  }

  isFavorite(id) {
    return this.favorites.has(id);
  }

  filterInstruments(category = 'all', search = '') {
    this.currentFilter = category;
    this.searchQuery = (search || '').toLowerCase().trim();
    const all = this.getAllInstruments();

    return all.filter(inst => {
      // Category match
      let matchCat = true;
      if (category === 'favorites') {
        matchCat = this.favorites.has(inst.id);
      } else if (category === 'recents') {
        matchCat = this.recents.includes(inst.id);
      } else if (category !== 'all') {
        matchCat = inst.familyId === category;
      }

      // Search match
      let matchSearch = true;
      if (this.searchQuery) {
        matchSearch = inst.name.toLowerCase().includes(this.searchQuery) ||
                      inst.family.toLowerCase().includes(this.searchQuery) ||
                      inst.description.toLowerCase().includes(this.searchQuery);
      }

      return matchCat && matchSearch;
    });
  }

  /**
   * Dynamically renders all 24 instrument cards with illustration, category,
   * description, audition preview button, and selection button.
   */
  renderCatalogue(containerEl = null) {
    const container = containerEl || document.getElementById('instruments-grid');
    if (!container) return;
    this.containerEl = container;
    container.innerHTML = '';

    const filter = this.currentFilter || 'all';
    const search = this.searchQuery || '';
    const filtered = this.filterInstruments(filter, search);

    if (filtered.length === 0) {
      container.innerHTML = '<div class="empty-takes-msg" style="grid-column: 1/-1; padding: 40px; text-align: center; color: var(--text-muted);">No instruments found matching your search.</div>';
      return;
    }

    filtered.forEach(inst => {
      const card = document.createElement('div');
      const isSelected = this.currentInstrument && this.currentInstrument.id === inst.id;
      const isFav = this.isFavorite(inst.id);

      card.className = `instrument-card ${isSelected ? 'selected' : ''}`;
      card.dataset.instrumentId = inst.id;

      card.innerHTML = `
        <div class="inst-card-top">
          <span class="inst-family-tag">${inst.family}</span>
          <button class="inst-fav-btn ${isFav ? 'active' : ''}" title="${isFav ? 'Remove from Favorites' : 'Add to Favorites'}">★</button>
        </div>
        <div class="inst-illustration-box">
          <img src="assets/instruments/${inst.id}.svg" alt="${inst.name}" class="inst-artwork-img" loading="lazy" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';" />
          <div class="inst-svg-icon fallback-svg" style="display:none; color: ${inst.badgeColor || '#8B5CF6'}">
            ${this.getInstrumentSvg(inst.id)}
          </div>
        </div>
        <div class="inst-card-body">
          <h3 class="inst-name">${inst.name}</h3>
          <p class="inst-desc" title="${inst.description}">${inst.description}</p>
        </div>
        <div class="inst-card-footer">
          <button class="btn btn-sm btn-ghost preview-sound-btn" title="Audition Sample">▶ Preview</button>
          <button class="btn btn-sm btn-primary select-inst-btn">${isSelected ? '✓ Active' : 'Play This'}</button>
        </div>
      `;

      // Favorite toggle
      card.querySelector('.inst-fav-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleFavorite(inst.id);
      });

      // Preview Sound (Audition chord arpeggio)
      card.querySelector('.preview-sound-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.audioEngine) {
          window.audioEngine.unlockAudio().then(() => {
            const midNotes = [60, 64, 67, 72];
            midNotes.forEach((m, idx) => {
              setTimeout(() => {
                const v = window.soundFontManager.playNote(inst, m, 0.85);
                setTimeout(() => { if (v) v.stop(); }, 350);
              }, idx * 220);
            });
          });
        }
      });

      // Select Instrument
      card.querySelector('.select-inst-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectInstrument(inst.id, true);
      });

      // Clicking card body also selects
      card.addEventListener('click', (e) => {
        if (!e.target.closest('button')) {
          this.selectInstrument(inst.id, true);
        }
      });

      container.appendChild(card);
    });

    this._bindCatalogueFilters();
  }

  _bindCatalogueFilters() {
    // Bind category filter pills if not yet bound
    document.querySelectorAll('.category-filter-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.category-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFilter = btn.dataset.category;
        this.renderCatalogue();
      };
    });

    // Search input
    const searchInput = document.getElementById('instrument-search-input');
    if (searchInput && !searchInput._bound) {
      searchInput._bound = true;
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.renderCatalogue();
      });
    }
  }

  _updateLoadingIndicator(loading, instrumentName) {
    const el = document.getElementById('instrument-loading-badge');
    if (el) {
      if (loading) {
        el.classList.add('active');
        el.innerHTML = `<span class="spinner-ring"></span> Loading ${instrumentName}...`;
      } else {
        el.classList.remove('active');
        el.innerHTML = `<span class="ready-dot"></span> Ready: ${instrumentName}`;
      }
    }
  }

  getInstrumentSvg(instrumentId) {
    if (instrumentId.includes('piano')) {
      return `<svg viewBox="0 0 64 64" width="56" height="56" fill="currentColor"><path d="M8 12h48v40H8z" rx="3" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M14 14h6v24h-6zm10 0h6v24h-6zm10 0h6v24h-6zm10 0h6v24h-6z" fill="currentColor"/><circle cx="50" cy="46" r="3" fill="#F59E0B"/></svg>`;
    } else if (instrumentId === 'organ') {
      return `<svg viewBox="0 0 64 64" width="56" height="56" fill="currentColor"><path d="M12 52V20h8v32zm12 0V12h8v40zm12 0V16h8v36zm12 0V24h8v28z" stroke="currentColor" stroke-width="2" fill="none"/><path d="M10 52h44v4H10z" fill="currentColor"/></svg>`;
    } else if (instrumentId === 'accordion') {
      return `<svg viewBox="0 0 64 64" width="56" height="56" fill="currentColor"><rect x="8" y="14" width="12" height="36" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><rect x="44" y="14" width="12" height="36" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><path d="M20 18l6-4 6 4 6-4 6 4v28l-6 4-6-4-6 4-6-4z" fill="none" stroke="#F59E0B" stroke-width="2"/></svg>`;
    } else if (instrumentId.includes('guitar')) {
      return `<svg viewBox="0 0 64 64" width="56" height="56" fill="currentColor"><path d="M48 10L38 20M32 26c-8-8-18-4-20 4s6 18 16 18 18-6 18-16c0-6-6-8-6-8z" stroke="currentColor" stroke-width="2.5" fill="none"/><circle cx="28" cy="36" r="4" fill="#F59E0B"/><path d="M38 20l14-14 4 4-14 14" stroke="currentColor" stroke-width="2"/></svg>`;
    } else if (instrumentId === 'harp') {
      return `<svg viewBox="0 0 64 64" width="56" height="56" fill="currentColor"><path d="M16 12c12 0 28 8 32 28v12H16z" stroke="currentColor" stroke-width="2" fill="none"/><path d="M22 52V20M28 52V24M34 52V30M40 52V36" stroke="#06B6D4" stroke-width="1.8"/></svg>`;
    } else if (instrumentId === 'violin' || instrumentId === 'double_bass') {
      return `<svg viewBox="0 0 64 64" width="56" height="56" fill="currentColor"><path d="M32 8v48M24 20c-4 0-8 6-8 12s4 6 4 8-4 8 0 12 16 4 24 0c4-4 0-12 0-12s4-2 4-8-4-12-8-12" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="32" cy="38" r="3" fill="#F59E0B"/></svg>`;
    } else if (instrumentId === 'sitar' || instrumentId === 'oud' || instrumentId === 'koto') {
      return `<svg viewBox="0 0 64 64" width="56" height="56" fill="currentColor"><ellipse cx="24" cy="40" rx="14" ry="12" stroke="currentColor" stroke-width="2" fill="none"/><path d="M32 32L54 10l4 4-22 22" stroke="currentColor" stroke-width="2"/><circle cx="24" cy="40" r="3" fill="#F59E0B"/><line x1="18" y1="46" x2="52" y2="12" stroke="#06B6D4" stroke-width="1.5"/></svg>`;
    } else if (instrumentId === 'glockenspiel' || instrumentId === 'steel_pan' || instrumentId === 'mixed_percussion') {
      return `<svg viewBox="0 0 64 64" width="56" height="56" fill="currentColor"><rect x="12" y="16" width="40" height="8" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><rect x="14" y="28" width="36" height="8" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><rect x="16" y="40" width="32" height="8" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="48" cy="24" r="5" fill="#F59E0B"/></svg>`;
    } else if (instrumentId === 'pan_flute') {
      return `<svg viewBox="0 0 64 64" width="56" height="56" fill="currentColor"><path d="M12 12v40M18 12v36M24 12v32M30 12v28M36 12v24M42 12v20M48 12v16" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M10 20h42" stroke="#F59E0B" stroke-width="2"/></svg>`;
    } else if (instrumentId === 'saxophone' || instrumentId === 'brass_ensemble') {
      return `<svg viewBox="0 0 64 64" width="56" height="56" fill="currentColor"><path d="M20 12h12v24c0 8 6 14 14 14s10-4 10-10H46" stroke="currentColor" stroke-width="2.5" fill="none"/><path d="M54 36c4 0 6-6 6-10s-4-6-6-6v22z" fill="#F59E0B"/></svg>`;
    } else {
      return `<svg viewBox="0 0 64 64" width="56" height="56" fill="currentColor"><path d="M28 8h8l4 44-8 4-8-4z" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="32" cy="20" r="2" fill="#F59E0B"/><circle cx="32" cy="28" r="2" fill="#F59E0B"/><circle cx="32" cy="36" r="2" fill="#F59E0B"/><circle cx="32" cy="44" r="2" fill="#F59E0B"/></svg>`;
    }
  }
}

window.instrumentManager = new InstrumentManager();
