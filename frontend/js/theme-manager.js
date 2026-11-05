/**
 * Virtual Music Studio - Two-Hue RGB Accent Cycling Engine
 * Exactly two CSS hue variables (--ha, --hb) driving Studio Precision dark design tokens.
 * Hue formula: h = (158 + t / 1000 * 9) % 360, h2 = (h + 54) % 360; updated ~every 40ms.
 * Smooth .theming ease on disable for ~800ms.
 */

class ThemeManager {
  constructor() {
    this.rgb = false;
    this.rgbIntervalId = null;
    this.themeTriggerBtn = null;
    this.isInitialized = false;
    this.startTime = 0;
    this.themingTimeout = null;
  }

  init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Enforce permanent Studio Precision Dark Mode
    document.body.classList.remove('appearance-light');
    document.body.classList.add('appearance-dark');
    document.documentElement.setAttribute('data-appearance', 'dark');

    // Clean up any legacy localStorage keys
    try {
      localStorage.removeItem('vms_appearance');
      localStorage.removeItem('vms_theme');
    } catch (e) {}

    // Bind RGB Button (#btn-theme-switcher)
    this.themeTriggerBtn = document.getElementById('btn-theme-switcher');
    if (this.themeTriggerBtn) {
      this.themeTriggerBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleRgb();
      });
    }

    // Check if RGB was previously active in session
    const savedRgb = localStorage.getItem('vms_rgb_active') === 'true';
    if (savedRgb) {
      this.startRgb();
    } else {
      this.stopRgb(false);
    }

    console.log('[ThemeManager] Two-Hue RGB Accent Engine initialized. Base: --ha: 259 (Purple #8057D9), --hb: 216 (Blue #477DD0).');
  }

  toggleRgb() {
    if (this.rgb) {
      this.stopRgb(true);
    } else {
      this.startRgb();
    }
  }

  startRgb() {
    this.rgb = true;
    try { localStorage.setItem('vms_rgb_active', 'true'); } catch (e) {}

    const root = document.documentElement;
    root.setAttribute('data-rgb', 'true');
    root.classList.remove('theming');
    if (this.themingTimeout) {
      clearTimeout(this.themingTimeout);
      this.themingTimeout = null;
    }

    // Update Button State
    if (this.themeTriggerBtn) {
      this.themeTriggerBtn.setAttribute('aria-pressed', 'true');
      this.themeTriggerBtn.classList.add('active');
    }

    // Stop any existing loop
    if (this.rgbIntervalId) {
      clearInterval(this.rgbIntervalId);
      this.rgbIntervalId = null;
    }

    this.startTime = performance.now();

    // Respect prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      root.style.setProperty('--ha', '259.0');
      root.style.setProperty('--hb', '216.0');
      return;
    }

    // Update approximately every 40ms (~25 times per second, full 360-degree rotation takes 40s)
    this.rgbIntervalId = setInterval(() => {
      if (!this.rgb) return;
      const t = performance.now() - this.startTime;
      const h = (259 + (t / 1000) * 9) % 360;
      const h2 = (216 + (t / 1000) * 9) % 360;

      root.style.setProperty('--ha', h.toFixed(1));
      root.style.setProperty('--hb', h2.toFixed(1));
    }, 40);

    if (window.app && typeof window.app.showToast === 'function') {
      window.app.showToast('RGB Accent Cycling: Active');
    }
  }

  stopRgb(smoothTransition = true) {
    this.rgb = false;
    try { localStorage.setItem('vms_rgb_active', 'false'); } catch (e) {}

    // 1. Stop applying hue updates
    if (this.rgbIntervalId) {
      clearInterval(this.rgbIntervalId);
      this.rgbIntervalId = null;
    }

    // Update Button State
    if (this.themeTriggerBtn) {
      this.themeTriggerBtn.setAttribute('aria-pressed', 'false');
      this.themeTriggerBtn.classList.remove('active');
    }

    const root = document.documentElement;
    root.removeAttribute('data-rgb');

    if (smoothTransition) {
      // 2. Add the .theming class for smooth ease back to defaults
      root.classList.add('theming');

      // 3. Remove inline --ha and --hb so original CSS defaults (259, 216) return
      root.style.removeProperty('--ha');
      root.style.removeProperty('--hb');

      // 5. Remove .theming after approximately 800ms
      if (this.themingTimeout) clearTimeout(this.themingTimeout);
      this.themingTimeout = setTimeout(() => {
        root.classList.remove('theming');
        this.themingTimeout = null;
      }, 800);

      if (window.app && typeof window.app.showToast === 'function') {
        window.app.showToast('Midnight Violet & Blue Palette: Restored');
      }
    } else {
      root.classList.remove('theming');
      root.style.removeProperty('--ha');
      root.style.removeProperty('--hb');
    }
  }
}

// Global singleton instance
window.themeManager = new ThemeManager();

// Auto-run on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.themeManager.init());
} else {
  window.themeManager.init();
}
