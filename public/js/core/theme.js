/**
 * Miruform Theme Manager
 * Manages Dark (default atelier) and Light themes with persistent state.
 */
const ThemeManager = {
  THEME_KEY: 'miruform_theme',

  init() {
    let saved = 'dark';
    try {
      saved = localStorage.getItem(this.THEME_KEY) || 'dark';
    } catch (e) { }
    this.apply(saved, false);
  },

  getTheme() {
    return (document.documentElement && document.documentElement.getAttribute('data-theme') === 'light') ? 'light' : 'dark';
  },

  apply(theme, playSound = false) {
    const isLight = theme === 'light';
    if (document.documentElement) {
      if (isLight) {
        document.documentElement.setAttribute('data-theme', 'light');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
    }
    if (document.body) {
      if (isLight) {
        document.body.setAttribute('data-theme', 'light');
      } else {
        document.body.removeAttribute('data-theme');
      }
    }

    try {
      localStorage.setItem(this.THEME_KEY, isLight ? 'light' : 'dark');
    } catch (e) { }

    this.updateUI(isLight);

    if (typeof WallpaperManager !== 'undefined' && WallpaperManager && typeof WallpaperManager.applyStyles === 'function') {
      WallpaperManager.applyStyles();
    }

    if (playSound && typeof SoundFX !== 'undefined' && SoundFX && typeof SoundFX.play === 'function') {
      SoundFX.play('click');
    }
  },

  toggle() {
    const next = this.getTheme() === 'light' ? 'dark' : 'light';
    this.apply(next, true);
    return next;
  },

  updateUI(isLight) {
    const themeText = document.getElementById('theme-text');
    const themeIcon = document.getElementById('theme-icon');
    const detailThemeText = document.getElementById('detail-theme-text');
    const detailThemeIcon = document.getElementById('detail-theme-icon');
    const logoImg = document.querySelector('.brand-logo-img');

    if (logoImg) {
      logoImg.src = 'assets/miruform_icon.svg';
    }

    const sunSvg = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';
    const moonSvg = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';

    if (themeIcon) {
      themeIcon.innerHTML = isLight ? moonSvg : sunSvg;
    }
    if (themeText) {
      themeText.textContent = isLight ? 'Dark' : 'Light';
    }
    if (detailThemeIcon) {
      detailThemeIcon.innerHTML = isLight ? moonSvg : sunSvg;
    }
    if (detailThemeText) {
      detailThemeText.textContent = isLight ? 'Dark' : 'Light';
    }

    const btn1 = document.getElementById('btn-toggle-theme');
    if (btn1) {
      btn1.title = isLight ? 'Switch to Dark Theme' : 'Switch to Light Theme';
    }
    const btn2 = document.getElementById('btn-detail-theme');
    if (btn2) {
      btn2.title = isLight ? 'Switch to Dark Theme' : 'Switch to Light Theme';
    }
  }
};

if (typeof window !== 'undefined') {
  window.ThemeManager = ThemeManager;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ThemeManager;
}
