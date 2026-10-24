/* UI: control bar, scene picker (live thumbnails), customize / widgets / settings panels,
   keyboard shortcuts, idle auto-hide. */
(function () {
  const W = window.Lumevale;
  const S = W.settings;
  const E = () => W.engine;

  const SETTINGS = [
    {
      title: 'Atmosphere',
      rows: [
        { key: 'sound', label: 'Ambient sound', hint: 'Generated live, matched to each scene', type: 'toggle' },
        { key: 'volume', label: 'Volume', type: 'range', min: 0, max: 1, step: 0.01, parent: 'sound' },
        { key: 'interaction', label: 'Mouse interaction', hint: 'Scenes react to your cursor and clicks', type: 'toggle' },
        { key: 'timeOfDay', label: 'Time-of-day lighting', hint: 'Light follows your local time (rain, koi, astronaut, pendulum)', type: 'toggle' },
        { key: 'grain', label: 'Film grain', type: 'toggle' },
        { key: 'vignette', label: 'Vignette', type: 'toggle' },
      ],
    },
    {
      title: 'Playback',
      rows: [
        { key: 'slideshow', label: 'Slideshow', hint: 'Cycle through scenes automatically', type: 'toggle' },
        {
          key: 'slideshowMin', label: 'Change every', type: 'select', parent: 'slideshow',
          options: [[1, '1 minute'], [3, '3 minutes'], [5, '5 minutes'], [10, '10 minutes'], [30, '30 minutes']],
        },
        { key: 'speed', label: 'Motion speed', type: 'range', min: 0.25, max: 2, step: 0.05 },
        { key: 'quality', label: 'Quality', type: 'select', options: [['low', 'Low (battery)'], ['medium', 'Medium'], ['high', 'High']] },
        { key: 'fps', label: 'Frame rate', type: 'select', options: [[30, '30 fps'], [60, '60 fps'], [0, 'Unlimited']] },
      ],
    },
  ];

  const $ = (sel) => document.querySelector(sel);
  let hud, picker, settings, customize, widgetsPanel, toast;
  const panels = () => [picker, settings, customize, widgetsPanel];

  // ---------- Panels ----------
  function openPanel(panel) {
    const isOpen = panel.classList.contains('open');
    closePanels();
    if (W.editing) W.widgets.setEditing(false);
    if (!isOpen) {
      panel.classList.add('open');
      if (panel === picker) refreshThumbs();
    }
  }
  function closePanels() {
    panels().forEach((p) => p.classList.remove('open'));
  }
  const anyOpen = () => panels().some((p) => p.classList.contains('open'));

  // ---------- Generic setting row ----------
  // row: { key, label, hint, type: toggle|range|select|text|date|color, options, min, max, step, placeholder }
  function buildRow(row, get, set, extraClass = '') {
    const el = document.createElement('div');
    el.className = `set-row ${extraClass}`;
    el.innerHTML = `<div class="set-label"><span class="label">${row.label}</span>${row.hint ? `<span class="hint">${row.hint}</span>` : ''}</div>`;
    const val = get();
    let control;
    if (row.type === 'toggle') {
      control = document.createElement('label');
      control.className = 'switch';
      control.innerHTML = `<input type="checkbox" ${val ? 'checked' : ''}><span></span>`;
      control.querySelector('input').addEventListener('change', (e) => set(e.target.checked));
    } else if (row.type === 'range') {
      control = document.createElement('input');
      control.type = 'range';
      Object.assign(control, { min: row.min, max: row.max, step: row.step, value: val });
      control.addEventListener('input', (e) => set(parseFloat(e.target.value)));
    } else if (row.type === 'select') {
      control = document.createElement('select');
      row.options.forEach(([v, text]) => {
        const o = document.createElement('option');
        o.value = v;
        o.textContent = text;
        if (String(v) === String(val)) o.selected = true;
        control.appendChild(o);
      });
      control.addEventListener('change', (e) => set(typeof row.options[0][0] === 'number' ? Number(e.target.value) : e.target.value));
    } else if (row.type === 'text' || row.type === 'date') {
      control = document.createElement('input');
      control.type = row.type;
      control.className = 'text-input';
      control.value = val || '';
      if (row.placeholder) control.placeholder = row.placeholder;
      control.addEventListener('change', (e) => set(e.target.value));
      control.addEventListener('keydown', (e) => e.key === 'Enter' && control.blur());
    } else if (row.type === 'color') {
      control = document.createElement('input');
      control.type = 'color';
      control.value = val;
      control.addEventListener('input', (e) => set(e.target.value));
    }
    control.dataset.key = row.key;
    el.appendChild(control);
    return el;
  }

  // ---------- Scene picker with live thumbnails ----------
  const thumbs = {};
  let thumbQueue = [];
  function buildPicker() {
    const grid = picker.querySelector('.picker-grid');
    grid.innerHTML = '';
    W.scenes.forEach((def, i) => {
      const card = document.createElement('button');
      card.className = 'scene-card';
      card.dataset.id = def.id;
      card.innerHTML = `
        <div class="thumb" style="background:linear-gradient(135deg, ${def.swatch.join(',')})"><img alt=""></div>
        <span class="num">${i + 1}</span>
        <div class="meta"><div class="name">${def.name}</div><div class="style">${def.style}</div></div>`;
      card.addEventListener('click', () => {
        E().switchTo(def.id);
        closePanels();
      });
      grid.appendChild(card);
    });
  }
  function showThumb(id) {
    const img = picker.querySelector(`.scene-card[data-id="${id}"] img`);
    if (img && thumbs[id]) {
      img.src = thumbs[id];
      img.classList.add('ready');
    }
  }
  function pumpThumbs() {
    const id = thumbQueue.shift();
    if (!id) return;
    if (!thumbs[id]) {
      const def = W.scenes.find((d) => d.id === id);
      try { thumbs[id] = E().snapshot(def); } catch (e) { console.error('thumbnail', id, e); }
      showThumb(id);
    }
    setTimeout(pumpThumbs, 60);
  }
  function refreshThumbs() {
    const missing = W.scenes.map((d) => d.id).filter((id) => !thumbs[id] && !thumbQueue.includes(id));
    if (!missing.length) return;
    const idle = !thumbQueue.length;
    thumbQueue.push(...missing);
    if (idle) setTimeout(pumpThumbs, 30);
  }

  // ---------- Customize (per-scene options) ----------
  let customizeSig = '';
  const visibleOptions = (def) => {
    const opts = W.sceneOptions(def);
    return (def.options || []).filter((r) => !r.showIf || r.showIf(opts));
  };
  function buildCustomize() {
    const def = E().current();
    const body = customize.querySelector('.panel-body');
    body.innerHTML = '';
    if (!def) return;
    customize.querySelector('h2').innerHTML = `Customize <span class="h2-sub">${def.name}</span>`;
    const rows = visibleOptions(def);
    customizeSig = rows.map((r) => r.key).join();
    if (!rows.length) {
      body.innerHTML = '<p class="empty">This scene has no options yet.</p>';
      return;
    }
    const g = document.createElement('div');
    g.className = 'set-group';
    rows.forEach((r) => g.appendChild(buildRow(r, () => W.sceneOptions(def)[r.key], (v) => S.setSceneOpt(def.id, r.key, v))));
    body.appendChild(g);
    const reset = document.createElement('button');
    reset.className = 'btn-ghost';
    reset.textContent = 'Reset to defaults';
    reset.addEventListener('click', () => S.resetSceneOpts(def.id));
    body.appendChild(reset);
  }

  // ---------- Widgets panel ----------
  function buildWidgetsPanel() {
    const body = widgetsPanel.querySelector('.panel-body');
    body.innerHTML = '';
    const arrange = document.createElement('button');
    arrange.className = 'btn-accent';
    arrange.innerHTML = 'Arrange widgets <span>drag to move · scroll to resize</span>';
    arrange.addEventListener('click', () => {
      closePanels();
      W.widgets.setEditing(true);
    });
    body.appendChild(arrange);
    W.widgets.defs.forEach((def) => {
      const cfg = W.widgets.cfg(def.id);
      const block = document.createElement('div');
      block.className = 'w-block' + (cfg.on ? ' on' : '');
      block.appendChild(buildRow({ key: 'on', label: def.name, hint: def.desc, type: 'toggle' }, () => cfg.on, (v) => {
        W.widgets.set(def.id, { on: v });
        buildWidgetsPanel();
      }));
      if (cfg.on) {
        (def.config || []).forEach((r) => block.appendChild(buildRow(r, () => W.widgets.cfg(def.id)[r.key], (v) => W.widgets.set(def.id, { [r.key]: v }), 'sub')));
      }
      body.appendChild(block);
    });
  }

  // ---------- Settings ----------
  function buildSettings() {
    const body = settings.querySelector('.panel-body');
    body.innerHTML = '';
    SETTINGS.forEach((group) => {
      const g = document.createElement('div');
      g.className = 'set-group';
      g.innerHTML = `<h3>${group.title}</h3>`;
      group.rows.forEach((row) => {
        const el = buildRow(row, () => S.get(row.key), (v) => S.set(row.key, v), row.parent ? 'sub' : '');
        if (row.parent) el.dataset.parent = row.parent;
        g.appendChild(el);
      });
      body.appendChild(g);
    });
    syncSubRows();
  }
  function syncSubRows() {
    settings.querySelectorAll('.set-row.sub').forEach((r) => r.classList.toggle('hidden', !S.get(r.dataset.parent)));
  }
  function syncControl(k, v) {
    const c = settings.querySelector(`[data-key="${k}"]`);
    if (!c) return;
    const input = c.querySelector ? c.querySelector('input') : null;
    if (input && input.type === 'checkbox') input.checked = !!v;
    else if ('value' in c) c.value = v;
  }

  // ---------- Toast ----------
  let toastTimer;
  function showToast(name, sub, ms = 2600) {
    toast.querySelector('.toast-name').textContent = name;
    toast.querySelector('.toast-style').textContent = sub;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), ms);
  }

  // ---------- Idle ----------
  let idleTimer;
  function wake() {
    document.body.classList.remove('idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (!anyOpen() && !W.editing && !hud.matches(':hover')) document.body.classList.add('idle');
      else wake();
    }, 3000);
  }

  // ---------- FX overlays ----------
  function makeGrain() {
    const size = 220;
    const c = W.util.canvas(size, size);
    const g = c.getContext('2d');
    const img = g.createImageData(size, size);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    $('#fx-grain').style.backgroundImage = `url(${c.toDataURL()})`;
  }
  function applyFx() {
    $('#fx-grain').classList.toggle('off', !S.get('grain'));
    $('#fx-vignette').classList.toggle('off', !S.get('vignette'));
    document.body.classList.toggle('sound-on', !!S.get('sound'));
  }

  // ---------- Slideshow ----------
  let lastSwitch = Date.now();
  function tickSlideshow() {
    if (!S.get('slideshow') || anyOpen() || W.editing) return;
    if (Date.now() - lastSwitch >= S.get('slideshowMin') * 60000) E().next();
  }

  // ---------- Keyboard ----------
  function onKey(e) {
    const t = e.target;
    if (t.matches && (t.matches('input, select, textarea') || t.isContentEditable)) return;
    const k = e.key.toLowerCase();
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (k === 'arrowright') E().next();
    else if (k === 'arrowleft') E().prev();
    else if (k === 'f') E().toggleFullscreen();
    else if (k === 's') openPanel(settings);
    else if (k === 'g') openPanel(picker);
    else if (k === 't') openPanel(customize);
    else if (k === 'w') openPanel(widgetsPanel);
    else if (k === 'e') { closePanels(); W.widgets.toggleEditing(); }
    else if (k === 'm') S.set('sound', !S.get('sound'));
    else if (k === 'h') document.body.classList.toggle('zen');
    else if (k === ' ') { e.preventDefault(); E().togglePause(); }
    else if (k === 'escape') { closePanels(); W.widgets.setEditing(false); }
    else if (/^[1-9]$/.test(k) && W.scenes[+k - 1]) E().switchTo(W.scenes[+k - 1].id);
    else return;
    wake();
  }

  W.ui = {
    init() {
      hud = $('#hud');
      picker = $('#picker');
      settings = $('#settings');
      customize = $('#customize');
      widgetsPanel = $('#widgets-panel');
      toast = $('#toast');

      buildPicker();
      buildSettings();
      buildWidgetsPanel();
      makeGrain();
      applyFx();

      hud.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-act]');
        if (!btn) return;
        const act = btn.dataset.act;
        if (act === 'prev') E().prev();
        if (act === 'next') E().next();
        if (act === 'scenes') openPanel(picker);
        if (act === 'customize') openPanel(customize);
        if (act === 'widgets') openPanel(widgetsPanel);
        if (act === 'settings') openPanel(settings);
        if (act === 'sound') S.set('sound', !S.get('sound'));
        if (act === 'fullscreen') E().toggleFullscreen();
      });
      document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closePanels));
      // Clicking the scene itself closes any open panel.
      addEventListener('pointerdown', (e) => {
        if (!W.isUi(e.target)) closePanels();
      });
      addEventListener('dblclick', (e) => {
        if (!W.isUi(e.target) && !W.editing && !e.target.closest('.widget')) E().toggleFullscreen();
      });

      addEventListener('pointermove', wake);
      addEventListener('pointerdown', wake);
      addEventListener('keydown', onKey);
      wake();

      W.on('scene', (def) => {
        lastSwitch = Date.now();
        $('.hud-scene-name').textContent = def.name;
        picker.querySelectorAll('.scene-card').forEach((c) => c.classList.toggle('active', c.dataset.id === def.id));
        showToast(def.name, def.style);
        W.audio.setAmbience(def.ambience);
        buildCustomize();
      });
      W.on('pause', (p) => showToast(p ? 'Paused' : 'Playing', 'space to toggle', 1200));
      W.on('editing', (on) => {
        wake();
        if (on) showToast('Arrange widgets', 'drag to move · scroll to resize · esc when done', 2200);
      });

      S.onChange(function (k, a) {
        applyFx();
        syncSubRows();
        syncControl(k, a);
        if (k === 'sceneOpts') {
          delete thumbs[a];
          if (picker.classList.contains('open')) refreshThumbs();
          // rebuild only on reset or when rows appear/disappear, so sliders keep working mid-drag
          const def = E().current();
          if (def && def.id === a && (k === null || arguments[2] === null || visibleOptions(def).map((r) => r.key).join() !== customizeSig)) buildCustomize();
        }
      });
      setInterval(tickSlideshow, 5000);
      // render thumbnails quietly in the background once the first scene has settled
      setTimeout(refreshThumbs, 3000);
    },
  };
})();
