/* Settings: defaults, persistence (localStorage) and change notifications.
   Top-level keys hold global settings; `widgets[id]` holds each widget's config, position and data;
   `sceneOpts[id]` holds each scene's customisations. */
(function () {
  const W = window.Lumevale;
  const KEY = 'lumevale.settings.v2';

  const defaults = {
    scene: null,
    // atmosphere
    sound: false,
    volume: 0.6,
    grain: true,
    vignette: true,
    timeOfDay: false,
    interaction: true,
    // playback
    slideshow: false,
    slideshowMin: 5,
    speed: 1,
    quality: 'high', // low | medium | high
    fps: 60, // 30 | 60 | 0 (unlimited)
    widgets: {},
    sceneOpts: {},
  };

  const load = (k) => {
    try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; }
  };

  let state = { ...defaults, ...load(KEY) };

  const listeners = [];
  const emit = (...args) => listeners.forEach((fn) => fn(...args));

  // Writes are debounced so typing in a note doesn't hammer storage; flushed when the page hides.
  let saveTimer = null;
  function flush() {
    clearTimeout(saveTimer);
    saveTimer = null;
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
  }
  function save() {
    if (!saveTimer) saveTimer = setTimeout(flush, 250);
  }
  addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());

  W.settings = {
    get: (k) => state[k],
    all: () => ({ ...state }),
    set(k, v) {
      if (state[k] === v) return;
      state[k] = v;
      save();
      emit(k, v);
    },
    onChange(fn) { listeners.push(fn); },

    widget: (id) => state.widgets[id] || {},
    setWidget(id, patch, { silent } = {}) {
      state.widgets = { ...state.widgets, [id]: { ...state.widgets[id], ...patch } };
      save();
      if (!silent) emit('widgets', id, patch);
    },
    resetLayout() {
      const next = {};
      for (const [id, cfg] of Object.entries(state.widgets)) {
        const { pos, scale, ...rest } = cfg;
        next[id] = rest;
      }
      state.widgets = next;
      save();
      emit('layout');
    },

    sceneOpts: (id) => state.sceneOpts[id] || {},
    setSceneOpt(id, key, val) {
      state.sceneOpts = { ...state.sceneOpts, [id]: { ...state.sceneOpts[id], [key]: val } };
      save();
      emit('sceneOpts', id, key, val);
    },
    resetSceneOpts(id) {
      const next = { ...state.sceneOpts };
      delete next[id];
      state.sceneOpts = next;
      save();
      emit('sceneOpts', id, null);
    },
  };
})();
