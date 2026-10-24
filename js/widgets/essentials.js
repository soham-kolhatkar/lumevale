/* Glanceable widgets: clock, greeting + daily focus, quote, breathing, calendar, world clock, countdown, moon. */
(function () {
  const W = window.Lumevale;
  const { esc, pad, today } = W.wh;

  // ---------- Clock ----------
  W.registerWidget({
    id: 'clock',
    name: 'Clock',
    desc: 'Time and date',
    pos: { x: 0, y: 1 },
    defaults: { on: true, h24: false, date: true, seconds: false },
    config: [
      { key: 'h24', label: '24-hour time', type: 'toggle' },
      { key: 'seconds', label: 'Show seconds', type: 'toggle' },
      { key: 'date', label: 'Show date', type: 'toggle' },
    ],
    create(el, cfg) {
      el.innerHTML = '<div class="clock-time"></div><div class="clock-date"></div>';
      const timeEl = el.querySelector('.clock-time'), dateEl = el.querySelector('.clock-date');
      function render(now = new Date()) {
        let h = now.getHours();
        const m = pad(now.getMinutes());
        const sec = cfg.seconds ? `<span class="sec">${pad(now.getSeconds())}</span>` : '';
        if (cfg.h24) timeEl.innerHTML = `${pad(h)}:${m}${sec}`;
        else {
          const ampm = h >= 12 ? 'PM' : 'AM';
          h = h % 12 || 12;
          timeEl.innerHTML = `${h}:${m}${sec}<span class="ampm">${ampm}</span>`;
        }
        dateEl.style.display = cfg.date ? '' : 'none';
        dateEl.textContent = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
      }
      render();
      return { tick: render, update(c) { cfg = c; render(); } };
    },
  });

  // ---------- Greeting + daily focus ----------
  W.registerWidget({
    id: 'greeting',
    name: 'Greeting & focus',
    desc: '“Good evening” plus your one focus for today',
    pos: { x: 0.5, y: 0.38 },
    defaults: { on: false, name: '', askFocus: true, focus: null },
    config: [
      { key: 'name', label: 'Your name', type: 'text', placeholder: 'optional' },
      { key: 'askFocus', label: 'Ask for a daily focus', type: 'toggle' },
    ],
    create(el, cfg, api) {
      function hello() {
        const h = new Date().getHours();
        const part = h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 22 ? 'Good evening' : 'Good night';
        return cfg.name ? `${part}, ${esc(cfg.name)}.` : `${part}.`;
      }
      let lastHello = '';
      function render() {
        const f = api.cfg().focus;
        const focus = f && f.date === today() ? f : null;
        let body = '';
        if (cfg.askFocus) {
          body = focus
            ? `<div class="greet-label">Today</div>
               <div class="greet-focus w-live ${focus.done ? 'done' : ''}">
                 <button class="check" title="Mark done"></button><span>${esc(focus.text)}</span>
                 <button class="clear" title="Clear">×</button>
               </div>`
            : `<input class="greet-input w-live" placeholder="What is your main focus today?" maxlength="80">`;
        }
        el.innerHTML = `<div class="greet-hello">${hello()}</div>${body}`;
        lastHello = hello();
        const input = el.querySelector('.greet-input');
        if (input) {
          input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && input.value.trim()) {
              api.save({ focus: { date: today(), text: input.value.trim(), done: false } });
              render();
            }
          });
        }
        const box = el.querySelector('.greet-focus');
        if (box) {
          box.querySelector('.check').addEventListener('click', () => {
            api.save({ focus: { ...focus, done: !focus.done } });
            render();
          });
          box.querySelector('.clear').addEventListener('click', () => {
            api.save({ focus: null });
            render();
          });
        }
      }
      render();
      return {
        tick() { if (hello() !== lastHello && !el.contains(document.activeElement)) render(); },
        update(c) { cfg = c; render(); },
      };
    },
  });

  // ---------- Quote ----------
  const QUOTES = [
    ['Nature does not hurry, yet everything is accomplished.', 'Lao Tzu'],
    ['Adopt the pace of nature: her secret is patience.', 'Ralph Waldo Emerson'],
    ['Almost everything will work again if you unplug it for a few minutes, including you.', 'Anne Lamott'],
    ['Look deep into nature, and then you will understand everything better.', 'Albert Einstein'],
    ['The best way out is always through.', 'Robert Frost'],
    ['Keep your face always toward the sunshine, and shadows will fall behind you.', 'Walt Whitman'],
    ['Not all those who wander are lost.', 'J. R. R. Tolkien'],
    ['We are all in the gutter, but some of us are looking at the stars.', 'Oscar Wilde'],
    ['What we think, we become.', 'Buddha'],
    ['Simplicity is the ultimate sophistication.', 'Leonardo da Vinci'],
    ['It does not matter how slowly you go as long as you do not stop.', 'Confucius'],
    ['The present moment is filled with joy and happiness. If you are attentive, you will see it.', 'Thich Nhat Hanh'],
    ['Breathe in. Breathe out. You are exactly where you need to be.', ''],
    ['Slow down. Everything you need will come to you at the right time.', ''],
    ['Rest is not idleness.', 'John Lubbock'],
    ['Small steps every day.', ''],
    ['Be like water.', 'Bruce Lee'],
  ];
  W.registerWidget({
    id: 'quote',
    name: 'Quote',
    desc: 'A calm line that changes every so often',
    pos: { x: 0.5, y: 0 },
    defaults: { on: false, every: 60 },
    config: [{ key: 'every', label: 'Change every', type: 'select', options: [[30, '30 seconds'], [60, '1 minute'], [300, '5 minutes'], [900, '15 minutes']] }],
    create(el, cfg) {
      el.innerHTML = '<div class="quote-text"></div><div class="quote-author"></div>';
      let idx = Math.floor(Math.random() * QUOTES.length), since = 0;
      const show = () => {
        const [t, a] = QUOTES[idx];
        el.querySelector('.quote-text').textContent = `“${t}”`;
        el.querySelector('.quote-author').textContent = a;
      };
      show();
      return {
        tick() {
          if (++since < cfg.every) return;
          since = 0;
          idx = (idx + 1) % QUOTES.length;
          el.classList.add('swap');
          setTimeout(() => { show(); el.classList.remove('swap'); }, 1200);
        },
        update(c) { cfg = c; },
      };
    },
  });

  // ---------- Breathing guide ----------
  const PATTERNS = {
    relax: [['breathe in', 4, 1], ['hold', 2, 1], ['breathe out', 6, 0.35]],
    box: [['breathe in', 4, 1], ['hold', 4, 1], ['breathe out', 4, 0.35], ['hold', 4, 0.35]],
    sleep: [['breathe in', 4, 1], ['hold', 7, 1], ['breathe out', 8, 0.35]],
  };
  W.registerWidget({
    id: 'breath',
    name: 'Breathing guide',
    desc: 'A slow circle to breathe along with',
    pos: { x: 1, y: 0.78 },
    defaults: { on: false, pattern: 'relax' },
    config: [{ key: 'pattern', label: 'Pattern', type: 'select', options: [['relax', 'Relax · 4-2-6'], ['box', 'Box · 4-4-4-4'], ['sleep', 'Sleep · 4-7-8']] }],
    create(el, cfg) {
      el.innerHTML = '<div class="breath-ring"><div class="breath-dot"></div></div><div class="breath-label"></div>';
      const dot = el.querySelector('.breath-dot'), label = el.querySelector('.breath-label');
      let i = 0, timer = null;
      const next = () => {
        const phases = PATTERNS[cfg.pattern] || PATTERNS.relax;
        const [text, secs, scale] = phases[i % phases.length];
        label.textContent = text;
        dot.style.transition = `transform ${secs}s cubic-bezier(.45,0,.55,1)`;
        dot.style.transform = `scale(${scale})`;
        i++;
        timer = setTimeout(next, secs * 1000);
      };
      next();
      return { update(c) { cfg = c; i = 0; }, destroy() { clearTimeout(timer); } };
    },
  });

  // ---------- Calendar ----------
  W.registerWidget({
    id: 'calendar',
    name: 'Calendar',
    desc: 'This month at a glance',
    pos: { x: 1, y: 0.42 },
    card: true,
    defaults: { on: false, monday: true },
    config: [{ key: 'monday', label: 'Week starts on Monday', type: 'toggle' }],
    create(el, cfg) {
      let shown = '';
      function render() {
        const now = new Date();
        const y = now.getFullYear(), mo = now.getMonth(), d = now.getDate();
        const first = new Date(y, mo, 1).getDay();
        const offset = cfg.monday ? (first + 6) % 7 : first;
        const days = new Date(y, mo + 1, 0).getDate();
        const names = cfg.monday ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
        let cells = names.map((n) => `<span class="dow">${n}</span>`).join('');
        for (let i = 0; i < offset; i++) cells += '<span></span>';
        for (let i = 1; i <= days; i++) cells += `<span class="${i === d ? 'today' : i < d ? 'past' : ''}">${i}</span>`;
        el.innerHTML = `<div class="cal-head">${now.toLocaleDateString(undefined, { month: 'long' })} <span>${y}</span></div><div class="cal-grid">${cells}</div>`;
        shown = `${today()}${cfg.monday}`;
      }
      render();
      return { tick() { if (shown !== `${today()}${cfg.monday}`) render(); }, update(c) { cfg = c; render(); } };
    },
  });

  // ---------- World clock ----------
  const CITY_ALIASES = {
    'san francisco': 'America/Los_Angeles', 'la': 'America/Los_Angeles', 'seattle': 'America/Los_Angeles',
    'nyc': 'America/New_York', 'boston': 'America/New_York', 'washington': 'America/New_York',
    'mumbai': 'Asia/Kolkata', 'delhi': 'Asia/Kolkata', 'new delhi': 'Asia/Kolkata', 'bangalore': 'Asia/Kolkata',
    'bengaluru': 'Asia/Kolkata', 'pune': 'Asia/Kolkata', 'chennai': 'Asia/Kolkata', 'hyderabad': 'Asia/Kolkata', 'india': 'Asia/Kolkata',
    'beijing': 'Asia/Shanghai', 'hong kong': 'Asia/Hong_Kong', 'dubai': 'Asia/Dubai', 'sydney': 'Australia/Sydney',
    'paris': 'Europe/Paris', 'berlin': 'Europe/Berlin', 'geneva': 'Europe/Zurich', 'utc': 'UTC',
  };
  let zoneList = null;
  function resolveZone(name) {
    const key = name.trim().toLowerCase();
    if (!key) return null;
    if (CITY_ALIASES[key]) return CITY_ALIASES[key];
    zoneList = zoneList || (Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : []);
    const hit = zoneList.find((z) => z.toLowerCase() === key || z.split('/').pop().replace(/_/g, ' ').toLowerCase() === key);
    if (hit) return hit;
    try { new Intl.DateTimeFormat(undefined, { timeZone: name.trim() }); return name.trim(); } catch (e) { return null; }
  }
  W.registerWidget({
    id: 'worldclock',
    name: 'World clock',
    desc: 'Time in other cities',
    pos: { x: 0, y: 0.55 },
    card: true,
    defaults: { on: false, cities: 'London, New York, Tokyo', h24: false },
    config: [
      { key: 'cities', label: 'Cities', type: 'text', placeholder: 'London, New York, Tokyo', hint: 'Comma-separated city or time-zone names' },
      { key: 'h24', label: '24-hour time', type: 'toggle' },
    ],
    create(el, cfg) {
      function render() {
        const now = new Date();
        const localDay = now.toLocaleDateString('en-CA');
        const rows = cfg.cities.split(',').map((c) => [c.trim(), resolveZone(c)]).filter(([, z]) => z).slice(0, 6).map(([name, zone]) => {
          const time = now.toLocaleTimeString(undefined, { timeZone: zone, hour: 'numeric', minute: '2-digit', hour12: !cfg.h24 });
          const day = now.toLocaleDateString('en-CA', { timeZone: zone });
          const rel = day > localDay ? 'Tomorrow' : day < localDay ? 'Yesterday' : 'Today';
          return `<div class="wc-row"><div><div class="wc-city">${esc(name)}</div><div class="wc-rel">${rel}</div></div><div class="wc-time">${time}</div></div>`;
        });
        el.innerHTML = rows.join('') || '<div class="w-empty">Add cities in Widgets settings</div>';
      }
      render();
      return { tick: render, update(c) { cfg = c; render(); } };
    },
  });

  // ---------- Countdown ----------
  W.registerWidget({
    id: 'countdown',
    name: 'Countdown',
    desc: 'Days left until something you’re looking forward to',
    pos: { x: 0, y: 0 },
    card: true,
    defaults: { on: false, label: 'Holiday', date: '' },
    config: [
      { key: 'label', label: 'Event', type: 'text', placeholder: 'Holiday' },
      { key: 'date', label: 'Date', type: 'date' },
    ],
    create(el, cfg) {
      function render() {
        if (!cfg.date) {
          el.innerHTML = '<div class="w-empty">Pick a date in Widgets settings</div>';
          return;
        }
        const target = new Date(`${cfg.date}T00:00:00`);
        const diff = target - Date.now();
        const label = esc(cfg.label || 'the day');
        if (diff <= 0) {
          const ago = Math.floor(-diff / 86400000);
          el.innerHTML = ago === 0
            ? `<div class="cd-num">Today</div><div class="cd-label">is ${label} ✦</div>`
            : `<div class="cd-num">${ago}</div><div class="cd-label">days since ${label}</div>`;
          return;
        }
        const days = Math.floor(diff / 86400000), hours = Math.floor((diff % 86400000) / 3600000), mins = Math.floor((diff % 3600000) / 60000);
        el.innerHTML = `<div class="cd-num">${days}</div><div class="cd-label">${days === 1 ? 'day' : 'days'} until ${label}</div><div class="cd-sub">and ${hours}h ${pad(mins)}m</div>`;
      }
      render();
      return { tick: render, update(c) { cfg = c; render(); } };
    },
  });

  // ---------- Moon phase ----------
  const SYNODIC = 29.530588853;
  const NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);
  function moonPhase(now = Date.now()) {
    const p = (((now - NEW_MOON) / 86400000 / SYNODIC) % 1 + 1) % 1;
    const names = [[0.03, 'New moon'], [0.22, 'Waxing crescent'], [0.28, 'First quarter'], [0.47, 'Waxing gibbous'], [0.53, 'Full moon'], [0.72, 'Waning gibbous'], [0.78, 'Last quarter'], [0.97, 'Waning crescent'], [1.01, 'New moon']];
    const name = names.find(([lim]) => p < lim)[1];
    const toFull = ((0.5 - p + 1) % 1) * SYNODIC;
    return { p, name, lit: (1 - Math.cos(2 * Math.PI * p)) / 2, toFull };
  }
  W.registerWidget({
    id: 'moon',
    name: 'Moon phase',
    desc: 'Tonight’s moon',
    pos: { x: 1, y: 0.18 },
    defaults: { on: false },
    create(el) {
      let shown = '';
      function render() {
        const { p, name, lit, toFull } = moonPhase();
        const c = 30, r = 26, k = Math.cos(2 * Math.PI * p), rx = Math.abs(k) * r;
        const d = p < 0.5
          ? `M${c},${c - r} A${r},${r} 0 0 1 ${c},${c + r} A${rx},${r} 0 0 ${k > 0 ? 0 : 1} ${c},${c - r}Z`
          : `M${c},${c - r} A${r},${r} 0 0 0 ${c},${c + r} A${rx},${r} 0 0 ${k > 0 ? 1 : 0} ${c},${c - r}Z`;
        const sub = toFull < 0.6 || toFull > SYNODIC - 0.6 ? `${Math.round(lit * 100)}% lit` : `Full moon in ${Math.round(toFull)} day${Math.round(toFull) === 1 ? '' : 's'}`;
        el.innerHTML = `<svg viewBox="0 0 60 60" class="moon-svg"><circle cx="${c}" cy="${c}" r="${r}" class="moon-dark"/><path d="${d}" class="moon-lit"/></svg>
          <div><div class="moon-name">${name}</div><div class="moon-sub">${sub}</div></div>`;
        shown = today();
      }
      render();
      return { tick() { if (shown !== today()) render(); } };
    },
  });
})();
