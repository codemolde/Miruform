// Document Picture-in-Picture (PiP) Transparent DOM Resolution
const PiPState = {
  isActive: false,
  window: null,

  getElementById(id) {
    if (this.isActive && this.window && !this.window.closed) {
      try {
        const el = this.window.document.getElementById(id);
        if (el) return el;
      } catch (e) { }
    }
    return null;
  },

  querySelector(selector) {
    if (this.isActive && this.window && !this.window.closed) {
      try {
        const el = this.window.document.querySelector(selector);
        if (el) return el;
      } catch (e) { }
    }
    return null;
  },

  querySelectorAll(selector) {
    if (this.isActive && this.window && !this.window.closed) {
      try {
        const list = this.window.document.querySelectorAll(selector);
        if (list && list.length > 0) return list;
      } catch (e) { }
    }
    return null;
  }
};

const _origGetElementById = document.getElementById.bind(document);
document.getElementById = function (id) {
  return PiPState.getElementById(id) || _origGetElementById(id);
};

const _origQuerySelector = document.querySelector.bind(document);
document.querySelector = function (selector) {
  return PiPState.querySelector(selector) || _origQuerySelector(selector);
};

const _origQuerySelectorAll = document.querySelectorAll.bind(document);
document.querySelectorAll = function (selector) {
  return PiPState.querySelectorAll(selector) || _origQuerySelectorAll(selector);
};

if (typeof window !== 'undefined') {
  window.PiPState = PiPState;
}
if (typeof globalThis !== 'undefined') {
  globalThis.PiPState = PiPState;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PiPState
  };
}
