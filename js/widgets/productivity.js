/* Productivity widgets: sticky note, to-do list, focus (pomodoro) timer. Their data lives in localStorage. */
(function () {
  const W = window.Lumevale;
  const { esc, pad } = W.wh;

  // ---------- Note ----------
  W.registerWidget({
    id: 'notes',
    name: 'Note',
    desc: 'A sticky note that remembers what you write',
    pos: { x: 1, y: 0.3 },
    card: true,
    live: true,
    defaults: { on: false, title: 'Note', text: '' },
    config: [{ key: 'title', label: 'Title', type: 'text', placeholder: 'Note' }],
    create(el, cfg, api) {
      el.innerHTML = `<div class="w-head"><span class="w-title"></span><span class="w-meta"></span></div>
        <textarea class="note-text" spellcheck="false" placeholder="Write something…"></textarea>`;
      const ta = el.querySelector('textarea');
      const meta = el.querySelector('.w-meta');
      ta.value = api.cfg().text || '';
      const fit = () => {
        ta.style.height = 'auto';
        ta.style.height = `${Math.min(320, Math.max(90, ta.scrollHeight))}px`;
      };
      const count = () => (meta.textContent = ta.value.trim() ? `${ta.value.trim().split(/\s+/).length} words` : '');
      ta.addEventListener('input', () => {
        api.save({ text: ta.value });
        fit();
        count();
      });
      const title = () => (el.querySelector('.w-title').textContent = cfg.title || 'Note');
      title();
      count();
      requestAnimationFrame(fit);
      return { update(c) { cfg = c; title(); } };
    },
  });

  // ---------- To-do ----------
  W.registerWidget({
    id: 'todo',
    name: 'To-do',
    desc: 'A short list of things to get done',
    pos: { x: 0, y: 0.3 },
    card: true,
    live: true,
    defaults: { on: false, items: [] },
    create(el, cfg, api) {
      let items = (api.cfg().items || []).slice();
      const save = () => api.save({ items });
      function render() {
        const done = items.filter((i) => i.done).length;
        el.innerHTML = `<div class="w-head"><span class="w-title">To-do</span><span class="w-meta">${items.length ? `${done}/${items.length}` : ''}</span></div>
          <ul class="todo-list">${items.map((it) => `
            <li class="${it.done ? 'done' : ''}" data-id="${it.id}">
              <button class="check" title="Done"></button><span class="todo-text">${esc(it.text)}</span><button class="del" title="Remove">×</button>
            </li>`).join('')}</ul>
          <input class="todo-add" placeholder="Add a task…" maxlength="120">
          ${done ? '<button class="todo-clear">Clear completed</button>' : ''}`;
      }
      el.addEventListener('click', (e) => {
        const li = e.target.closest('li');
        if (e.target.closest('.todo-clear')) items = items.filter((i) => !i.done);
        else if (li && e.target.closest('.check, .todo-text')) items = items.map((i) => (i.id === li.dataset.id ? { ...i, done: !i.done } : i));
        else if (li && e.target.closest('.del')) items = items.filter((i) => i.id !== li.dataset.id);
        else return;
        save();
        render();
      });
      el.addEventListener('keydown', (e) => {
        const input = e.target.closest('.todo-add');
        if (!input || e.key !== 'Enter' || !input.value.trim()) return;
        items.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), text: input.value.trim(), done: false });
        save();
        render();
        el.querySelector('.todo-add').focus();
      });
      render();
      return {};
    },
  });

  // ---------- Focus timer ----------
  W.registerWidget({
    id: 'timer',
    name: 'Focus timer',
    desc: 'Pomodoro: focus, then take a short break',
    pos: { x: 1, y: 1 },
    card: true,
    live: true,
    defaults: { on: false, focusMin: 25, breakMin: 5, chime: true, auto: false, state: null },
    config: [
      { key: 'focusMin', label: 'Focus length', type: 'select', options: [[15, '15 min'], [25, '25 min'], [30, '30 min'], [45, '45 min'], [50, '50 min'], [60, '60 min']] },
      { key: 'breakMin', label: 'Break length', type: 'select', options: [[3, '3 min'], [5, '5 min'], [10, '10 min'], [15, '15 min']] },
      { key: 'chime', label: 'Chime when done', type: 'toggle' },
      { key: 'auto', label: 'Start next session automatically', type: 'toggle' },
    ],
    create(el, cfg, api) {
      const R = 34, CIRC = 2 * Math.PI * R;
      // state: { mode: 'focus'|'break', running, endsAt, left (ms when paused), sessions }
      let st = api.cfg().state || null;
      const len = (mode) => (mode === 'focus' ? cfg.focusMin : cfg.breakMin) * 60000;
      if (!st) st = { mode: 'focus', running: false, endsAt: 0, left: len('focus'), sessions: 0 };
      const save = () => api.save({ state: st });
      const remaining = () => (st.running ? Math.max(0, st.endsAt - Date.now()) : st.left);

      el.innerHTML = `<div class="tm-body">
          <svg class="tm-ring" viewBox="0 0 80 80"><circle cx="40" cy="40" r="${R}" class="tm-track"/><circle cx="40" cy="40" r="${R}" class="tm-prog" stroke-dasharray="${CIRC}"/></svg>
          <div class="tm-center"><div class="tm-time"></div><div class="tm-mode"></div></div>
        </div>
        <div class="tm-controls">
          <button data-t="toggle" class="tm-main"></button>
          <button data-t="reset" title="Reset">↺</button>
          <button data-t="skip" title="Skip">⏭</button>
        </div>
        <div class="tm-sessions"></div>`;
      const prog = el.querySelector('.tm-prog');

      function render() {
        const left = remaining();
        const total = len(st.mode);
        el.querySelector('.tm-time').textContent = `${pad(Math.floor(left / 60000))}:${pad(Math.floor((left % 60000) / 1000))}`;
        el.querySelector('.tm-mode').textContent = st.mode === 'focus' ? 'focus' : 'break';
        el.querySelector('.tm-main').textContent = st.running ? 'Pause' : left < total ? 'Resume' : 'Start';
        el.querySelector('.tm-sessions').textContent = st.sessions ? `${st.sessions} session${st.sessions > 1 ? 's' : ''} completed` : '';
        prog.style.strokeDashoffset = String(CIRC * (1 - left / total));
        el.classList.toggle('running', st.running);
        el.classList.toggle('on-break', st.mode === 'break');
      }
      function finish() {
        if (cfg.chime && W.audio.chime) W.audio.chime();
        if (st.mode === 'focus') st.sessions++;
        st.mode = st.mode === 'focus' ? 'break' : 'focus';
        st.left = len(st.mode);
        st.running = cfg.auto;
        st.endsAt = Date.now() + st.left;
        save();
      }
      el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-t]');
        if (!b) return;
        const t = b.dataset.t;
        if (t === 'toggle') {
          if (st.running) { st.left = remaining(); st.running = false; }
          else { st.endsAt = Date.now() + st.left; st.running = true; }
        } else if (t === 'reset') {
          st.running = false;
          st.left = len(st.mode);
        } else if (t === 'skip') {
          st.mode = st.mode === 'focus' ? 'break' : 'focus';
          st.running = false;
          st.left = len(st.mode);
        }
        save();
        render();
      });
      const iv = setInterval(() => {
        if (st.running && remaining() <= 0) finish();
        if (st.running) render();
      }, 250);
      render();
      return {
        update(c) {
          const changed = c.focusMin !== cfg.focusMin || c.breakMin !== cfg.breakMin;
          cfg = c;
          if (changed && !st.running) st.left = len(st.mode);
          render();
        },
        destroy() { clearInterval(iv); },
      };
    },
  });
})();
