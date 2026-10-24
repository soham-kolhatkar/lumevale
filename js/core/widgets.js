/* Widget manager: registry, mounting, positioning and drag-to-arrange.
   A widget definition looks like:
   {
     id, name, desc,
     pos: { x, y },          // default position, 0..1 across the free space (0 = left/top edge, 1 = right/bottom)
     defaults: { on, ... },  // default config
     config: [rows],         // settings rows shown under the widget's switch
     card: true,             // render on a themed card
     live: true,             // interactive (receives clicks/typing instead of the scene)
     create(el, cfg, api) -> { tick?(now), update?(cfg), destroy? }
   }
   Positions and scale are stored per widget, so they survive reloads and screen-size changes. */
(function () {
  const W = window.Lumevale;
  const S = W.settings;
  const MARGIN = 24;

  const defs = [];
  W.registerWidget = (def) => defs.push(def);

  const mounted = new Map();
  let layer, editbar, ro;

  const cfgOf = (def) => ({ ...def.defaults, ...S.widget(def.id) });

  // ---------- helpers for widget authors ----------
  W.wh = {
    esc: (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    pad: (n) => String(n).padStart(2, '0'),
    today: () => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },
  };

  function mount(def) {
    const el = document.createElement('div');
    el.className = `widget w-${def.id}${def.card ? ' card' : ''}${def.live ? ' w-live' : ''}`;
    el.dataset.id = def.id;
    el.dataset.name = def.name;
    layer.appendChild(el);
    const api = {
      cfg: () => cfgOf(def),
      save: (patch) => S.setWidget(def.id, patch, { silent: true }),
      relayout: () => place(def.id),
    };
    let inst = {};
    try { inst = def.create(el, cfgOf(def), api) || {}; } catch (e) { console.error(`[widget ${def.id}]`, e); }
    const m = { def, el, inst };
    mounted.set(def.id, m);
    ro.observe(el);
    place(def.id);
    if (!S.widget(def.id).pos) autoPlace(m);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('shown')));
  }

  function unmount(id) {
    const m = mounted.get(id);
    if (!m) return;
    mounted.delete(id);
    try { m.inst.destroy && m.inst.destroy(); } catch (e) { /* ignore */ }
    ro.unobserve(m.el);
    m.el.classList.remove('shown');
    setTimeout(() => m.el.remove(), 700);
  }

  function metrics(m) {
    const cfg = cfgOf(m.def);
    const s = cfg.scale || 1;
    const w = m.el.offsetWidth * s, h = m.el.offsetHeight * s;
    return { cfg, s, w, h, freeW: Math.max(1, innerWidth - 2 * MARGIN - w), freeH: Math.max(1, innerHeight - 2 * MARGIN - h) };
  }

  function place(id) {
    const m = mounted.get(id);
    if (!m) return;
    const { cfg, s, freeW, freeH } = metrics(m);
    const pos = cfg.pos || m.def.pos;
    m.el.style.setProperty('--s', s);
    m.el.style.left = `${MARGIN + pos.x * freeW}px`;
    m.el.style.top = `${MARGIN + pos.y * freeH}px`;
  }
  // First time a widget appears, put it at its preferred spot, or the nearest spot that
  // doesn't cover another widget or the control bar, and remember it.
  function autoPlace(m) {
    const box = (r) => ({ x: r.left, y: r.top, w: r.width, h: r.height });
    const taken = [...mounted.values()].filter((o) => o !== m).map((o) => box(o.el.getBoundingClientRect()));
    const hud = document.getElementById('hud');
    if (hud) taken.push(box(hud.getBoundingClientRect()));
    const { w, h, freeW, freeH } = metrics(m);
    const rectAt = (p) => ({ x: MARGIN + p.x * freeW, y: MARGIN + p.y * freeH, w, h });
    const hit = (a, b, pad = 14) => a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;
    const pref = m.def.pos;
    const cands = [];
    for (const x of [0, 0.25, 0.5, 0.75, 1]) for (let y = 0; y <= 1.0001; y += 0.05) cands.push({ x, y: Math.round(y * 100) / 100 });
    cands.sort((a, b) => Math.hypot(a.x - pref.x, a.y - pref.y) - Math.hypot(b.x - pref.x, b.y - pref.y));
    const spot = [pref, ...cands].find((p) => !taken.some((t) => hit(rectAt(p), t)));
    if (spot) {
      S.setWidget(m.def.id, { pos: spot }, { silent: true });
      place(m.def.id);
    }
  }

  const placeAll = () => mounted.forEach((_, id) => place(id));

  function sync(id, patch) {
    const def = defs.find((d) => d.id === id);
    if (!def) return;
    const cfg = cfgOf(def);
    const m = mounted.get(id);
    if (cfg.on && !m) mount(def);
    else if (!cfg.on && m) unmount(id);
    else if (m) {
      if (patch && Object.keys(patch).some((k) => k !== 'pos' && k !== 'scale') && m.inst.update) m.inst.update(cfg);
      place(id);
    }
  }

  // ---------- arrange mode ----------
  let drag = null;
  function setEditing(on) {
    W.editing = on;
    document.body.classList.toggle('editing', on);
    W.emit('editing', on);
  }

  function onDown(e) {
    if (!W.editing) return;
    const el = e.target.closest('.widget');
    if (!el || !mounted.has(el.dataset.id)) return;
    e.preventDefault();
    const r = el.getBoundingClientRect();
    drag = { id: el.dataset.id, el, dx: e.clientX - r.left, dy: e.clientY - r.top, pos: null };
    el.setPointerCapture(e.pointerId);
    el.classList.add('dragging');
  }
  function onMove(e) {
    if (!drag) return;
    const m = mounted.get(drag.id);
    const { freeW, freeH } = metrics(m);
    const x = Math.min(1, Math.max(0, (e.clientX - drag.dx - MARGIN) / freeW));
    const y = Math.min(1, Math.max(0, (e.clientY - drag.dy - MARGIN) / freeH));
    drag.pos = { x, y };
    drag.el.style.left = `${MARGIN + x * freeW}px`;
    drag.el.style.top = `${MARGIN + y * freeH}px`;
  }
  function onUp() {
    if (!drag) return;
    drag.el.classList.remove('dragging');
    if (drag.pos) S.setWidget(drag.id, { pos: drag.pos }, { silent: true });
    drag = null;
  }
  function onWheel(e) {
    if (!W.editing) return;
    const el = e.target.closest('.widget');
    if (!el) return;
    e.preventDefault();
    const id = el.dataset.id;
    const cur = S.widget(id).scale || 1;
    const next = Math.min(2.2, Math.max(0.5, cur * (e.deltaY < 0 ? 1.08 : 1 / 1.08)));
    S.setWidget(id, { scale: Math.round(next * 100) / 100 }, { silent: true });
    place(id);
  }

  W.widgets = {
    defs,
    init() {
      layer = document.getElementById('widgets');
      editbar = document.getElementById('editbar');
      ro = new ResizeObserver((entries) => entries.forEach((en) => !drag && place(en.target.dataset.id)));
      defs.forEach((def) => cfgOf(def).on && mount(def));

      // tick on whole seconds
      const tick = () => {
        const now = new Date();
        mounted.forEach((m) => m.inst.tick && m.inst.tick(now));
        setTimeout(tick, 1000 - (Date.now() % 1000) + 5);
      };
      tick();

      addEventListener('resize', placeAll);
      layer.addEventListener('pointerdown', onDown);
      addEventListener('pointermove', onMove);
      addEventListener('pointerup', onUp);
      layer.addEventListener('wheel', onWheel, { passive: false });
      editbar.querySelector('[data-act="done"]').addEventListener('click', () => setEditing(false));
      editbar.querySelector('[data-act="reset"]').addEventListener('click', () => S.resetLayout());

      S.onChange((k, id, patch) => {
        if (k === 'widgets') sync(id, patch);
        if (k === 'layout') placeAll();
      });
    },
    setEditing,
    toggleEditing: () => setEditing(!W.editing),
    cfg: (id) => cfgOf(defs.find((d) => d.id === id)),
    set: (id, patch) => S.setWidget(id, patch),
    // Mounted widget elements, for scenes that react to where widgets sit on screen.
    elements: () => [...mounted.values()].map((m) => m.el),
  };
})();
