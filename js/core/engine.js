/* Engine: scene registry, render loop, crossfades, pointer input, environment, thumbnails. */
(function () {
  const W = window.Lumevale;
  const U = W.util;
  const S = W.settings;

  // ---------- Scene registry ----------
  // A scene definition looks like:
  // {
  //   id, name, style, ambience: 'rain' | ...,
  //   type: '2d' | 'webgl',
  //   pixelHeight: 200 | (opts) => 200, // optional: render at this many rows, upscaled crisp (pixel art)
  //   resolution: 0.6,                  // optional: multiplier on device pixel ratio (smooth shaders)
  //   options: [{ key, label, type, default, options?, rebuild?, showIf? }],  // Customize panel
  //   theme: {...} | (opts) => ({...}),  // widget + cursor styling, see theme.js
  //   create(ctx) -> { resize(w, h, dpr), frame(dt, t), onPointerDown?, onPointerMove?, onOption?, destroy? }
  // }
  const defs = [];
  W.scenes = defs;
  W.registerScene = (def) => defs.push(def);

  W.sceneOptions = (def) => {
    const o = {};
    (def.options || []).forEach((r) => (o[r.key] = r.default));
    return Object.assign(o, S.sceneOpts(def.id));
  };

  // ---------- Events ----------
  const handlers = {};
  W.on = (name, fn) => (handlers[name] = handlers[name] || []).push(fn);
  W.emit = (name, ...args) => (handlers[name] || []).forEach((fn) => fn(...args));

  // ---------- Input ----------
  const input = (W.input = {
    x: innerWidth / 2, y: innerHeight / 2, // raw pointer (CSS px)
    sx: innerWidth / 2, sy: innerHeight / 2, // smoothed pointer
    px: 0, py: 0, // smoothed parallax offset, -1..1, eases to 0 when inactive
    vx: 0, vy: 0, speed: 0, // smoothed velocity (px/s)
    inside: false,
    overUi: false,
    down: false,
    lastMove: -1e9,
    enabled: true,
    get active() { return this.enabled && this.inside && !W.editing; },
  });
  let prevX = input.x, prevY = input.y;

  // ---------- Environment (time of day) ----------
  const urlHour = parseFloat(new URLSearchParams(location.search).get('hour'));
  const env = (W.env = {
    hour: 12, day: 1, dusk: 0, blend: 0,
    // Scenes call mood(defaultDay, defaultDusk). With time-of-day off they get their own
    // defaults; with it on they get the real local light, eased in smoothly.
    mood(defDay = 0, defDusk = 0) {
      return {
        day: U.lerp(defDay, this.day, this.blend),
        dusk: U.lerp(defDusk, this.dusk, this.blend),
      };
    },
  });
  env.blend = S.get('timeOfDay') ? 1 : 0;
  function updateEnv(dt) {
    const d = new Date();
    const hr = isNaN(urlHour) ? d.getHours() + d.getMinutes() / 60 : urlHour;
    const bump = (c, w) => Math.exp(-(((hr - c) / w) ** 2));
    env.hour = hr;
    env.day = U.smoothstep(5, 8.5, hr) * (1 - U.smoothstep(16.5, 20, hr));
    env.dusk = Math.max(bump(6.5, 1.4), bump(18.4, 1.5));
    env.blend = U.damp(env.blend, S.get('timeOfDay') ? 1 : 0, 1.5, dt);
  }

  // ---------- Layers ----------
  let stage;
  let layers = [];
  let current = null;
  let W_ = innerWidth, H_ = innerHeight;
  let paused = false;
  let needsRender = false;

  const pixelRows = (def, opts) => (typeof def.pixelHeight === 'function' ? def.pixelHeight(opts) : def.pixelHeight);

  function dprFor(def, opts) {
    if (def.pixelHeight) return pixelRows(def, opts) / H_;
    const cap = { low: 1, medium: 1.5, high: 2 }[S.get('quality')] || 2;
    return Math.min(window.devicePixelRatio || 1, cap) * (def.resolution || 1);
  }

  function sizeLayer(layer) {
    layer.dpr = dprFor(layer.def, layer.opts);
    layer.canvas.width = Math.max(1, Math.round(W_ * layer.dpr));
    layer.canvas.height = Math.max(1, Math.round(H_ * layer.dpr));
    if (layer.inst && layer.inst.resize) layer.inst.resize(W_, H_, layer.dpr);
  }

  function getContext(def, canvas, forSnapshot) {
    return def.type === 'webgl'
      ? canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'low-power', preserveDrawingBuffer: !!forSnapshot })
      : canvas.getContext('2d', { alpha: false });
  }

  function makeLayer(def) {
    const canvas = document.createElement('canvas');
    if (def.pixelHeight) canvas.classList.add('pixelated');
    stage.appendChild(canvas);
    const ctx = getContext(def, canvas);
    const opts = W.sceneOptions(def);
    const layer = { def, canvas, ctx, opts, inst: null, dpr: 1, t: 0 };
    sizeLayer(layer);
    layer.inst = def.create({ canvas, ctx, input, env, util: U, settings: S, opts });
    layer.inst.resize && layer.inst.resize(W_, H_, layer.dpr);
    return layer;
  }

  function loseContext(def, ctx) {
    if (def.type === 'webgl' && ctx) {
      const ext = ctx.getExtension('WEBGL_lose_context');
      ext && ext.loseContext();
    }
  }

  function destroyLayer(layer) {
    try { layer.inst.destroy && layer.inst.destroy(); } catch (e) { console.error(e); }
    loseContext(layer.def, layer.ctx);
    layer.canvas.remove();
    layers = layers.filter((l) => l !== layer);
  }

  function renderLayer(layer, dt) {
    layer.t += dt;
    if (layer.def.type !== 'webgl' && !layer.def.pixelHeight) {
      layer.ctx.setTransform(layer.dpr, 0, 0, layer.dpr, 0, 0);
    }
    try {
      layer.inst.frame(dt, layer.t);
    } catch (e) {
      console.error(`[${layer.def.id}]`, e);
      layer.broken = true;
    }
  }

  function switchTo(id, { force } = {}) {
    const def = defs.find((d) => d.id === id) || defs[0];
    if (!def || (!force && current && current.def.id === def.id)) return;
    const old = current;
    const layer = makeLayer(def);
    current = layer;
    layers.push(layer);
    renderLayer(layer, 0);
    // New layer fades in on top of the old one; the old one is removed once covered.
    requestAnimationFrame(() => requestAnimationFrame(() => layer.canvas.classList.add('visible')));
    if (old) setTimeout(() => destroyLayer(old), 1800);
    S.set('scene', def.id);
    try {
      const url = new URL(location.href);
      url.searchParams.set('scene', def.id);
      history.replaceState(null, '', url);
    } catch (e) { /* file:// in some browsers */ }
    W.emit('scene', def, layer.opts);
  }

  function step(dir) {
    if (!defs.length) return;
    const i = current ? defs.indexOf(current.def) : 0;
    switchTo(defs[(i + dir + defs.length) % defs.length].id);
  }

  // Scene customisation changed: update live, or rebuild with a crossfade if the option needs it.
  function onSceneOption(sceneId, key, val) {
    if (!current || current.def.id !== sceneId) return;
    const def = current.def;
    if (key === null) return switchTo(def.id, { force: true }); // reset
    current.opts[key] = val;
    const row = (def.options || []).find((r) => r.key === key);
    if (row && row.rebuild) switchTo(def.id, { force: true });
    else if (current.inst.onOption) current.inst.onOption(key, val);
    W.emit('sceneOptions', def, current.opts);
  }

  // ---------- Thumbnails: render a scene offscreen for a moment and grab a frame ----------
  function snapshot(def, width = 400) {
    const vw = W_, vh = H_;
    const opts = W.sceneOptions(def);
    const dpr = def.pixelHeight ? pixelRows(def, opts) / vh : width / vw;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    const ctx = getContext(def, canvas, true);
    const fake = {
      x: vw / 2, y: vh / 2, sx: vw / 2, sy: vh / 2, px: 0, py: 0, vx: 0, vy: 0, speed: 0,
      inside: false, down: false, lastMove: -1e9, enabled: false, active: false,
    };
    const inst = def.create({ canvas, ctx, input: fake, env, util: U, settings: S, opts, thumbnail: true });
    inst.resize && inst.resize(vw, vh, dpr);
    for (let i = 0; i < 45; i++) {
      if (def.type !== 'webgl' && !def.pixelHeight) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      inst.frame(1 / 20, i / 20 + 6);
    }
    let out = canvas;
    if (def.pixelHeight) {
      // upscale pixel art crisply so the thumbnail isn't blurred by the browser
      out = U.canvas(width, Math.round((width * vh) / vw));
      const g = out.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.drawImage(canvas, 0, 0, out.width, out.height);
    }
    const url = out.toDataURL('image/jpeg', 0.86);
    try { inst.destroy && inst.destroy(); } catch (e) { /* ignore */ }
    loseContext(def, ctx);
    return url;
  }

  // ---------- Loop ----------
  let then = performance.now();
  let last = then;
  function loop(now) {
    requestAnimationFrame(loop);
    const cap = S.get('fps');
    const interval = cap ? 1000 / cap : 0;
    const elapsed = now - then;
    if (interval && elapsed < interval - 1.5) return;
    then = interval ? now - (elapsed % interval) : now;

    const dtReal = Math.min((now - last) / 1000, 0.05);
    last = now;
    updateInput(dtReal);
    updateEnv(dtReal);
    W.emit('tick', dtReal);

    if (paused && !needsRender) return;
    const dt = paused ? 0 : dtReal * S.get('speed');
    needsRender = false;
    for (const layer of layers) if (!layer.broken) renderLayer(layer, dt);
  }

  function updateInput(dt) {
    if (dt <= 0) return;
    const rvx = (input.x - prevX) / dt, rvy = (input.y - prevY) / dt;
    prevX = input.x;
    prevY = input.y;
    input.vx = U.damp(input.vx, rvx, 10, dt);
    input.vy = U.damp(input.vy, rvy, 10, dt);
    input.speed = Math.hypot(input.vx, input.vy);
    input.sx = U.damp(input.sx, input.x, 6, dt);
    input.sy = U.damp(input.sy, input.y, 6, dt);
    const on = input.active;
    input.px = U.damp(input.px, on ? (input.x / W_) * 2 - 1 : 0, 2.2, dt);
    input.py = U.damp(input.py, on ? (input.y / H_) * 2 - 1 : 0, 2.2, dt);
  }

  // ---------- Wake lock (keep the screen on while visible) ----------
  async function requestWakeLock() {
    if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
    try { await navigator.wakeLock.request('screen'); } catch (e) { /* denied, low battery, etc. */ }
  }

  // ---------- Fullscreen ----------
  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
  }

  // ---------- Wiring ----------
  // Anything that is UI (panels, HUD, interactive widgets) keeps clicks away from the scene.
  W.isUi = (target) => !!(target && target.closest && target.closest('.ui, .w-live, #editbar'));

  function init() {
    stage = document.getElementById('stage');
    input.enabled = S.get('interaction');

    addEventListener('resize', () => {
      W_ = innerWidth;
      H_ = innerHeight;
      layers.forEach(sizeLayer);
      needsRender = true;
    });

    addEventListener('pointermove', (e) => {
      input.x = e.clientX;
      input.y = e.clientY;
      input.inside = true;
      input.overUi = W.isUi(e.target);
      input.lastMove = performance.now();
      if (input.active && current && current.inst.onPointerMove && !input.overUi) {
        current.inst.onPointerMove(e.clientX, e.clientY);
      }
    });
    addEventListener('pointerdown', (e) => {
      input.down = true;
      input.inside = true;
      if (W.isUi(e.target) || W.editing) return;
      if (input.enabled && current && current.inst.onPointerDown) {
        current.inst.onPointerDown(e.clientX, e.clientY);
      }
    });
    addEventListener('pointerup', () => (input.down = false));
    document.documentElement.addEventListener('mouseleave', () => (input.inside = false));
    addEventListener('blur', () => (input.inside = false));

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
        last = performance.now();
      }
    });
    document.addEventListener('fullscreenchange', () => {
      document.body.classList.toggle('is-fullscreen', !!document.fullscreenElement);
    });

    S.onChange((k, a, b, c) => {
      if (k === 'interaction') input.enabled = a;
      if (k === 'quality') layers.forEach(sizeLayer);
      if (k === 'sceneOpts') onSceneOption(a, b, c);
    });

    requestWakeLock();
    requestAnimationFrame(loop);
  }

  W.engine = {
    init,
    switchTo,
    next: () => step(1),
    prev: () => step(-1),
    current: () => current && current.def,
    currentOpts: () => current && current.opts,
    snapshot,
    togglePause() {
      paused = !paused;
      W.emit('pause', paused);
      return paused;
    },
    isPaused: () => paused,
    toggleFullscreen,
  };
})();
