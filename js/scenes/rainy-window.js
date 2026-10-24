/* Rainy Window — pixel-art lofi room. A cat naps on the sill while rain falls on the city.
   Mouse: wipe the fogged glass, wake the cat (it watches you), click the glass for drops, click the cat to pet. */
(function () {
  const W = window.Lumevale;
  const U = W.util;

  const C = {
    wallTop: '#1b1524', wallBot: '#281c2b', wainscot: '#2f2131',
    wood: '#4a3326', woodLight: '#6e4b35', woodDark: '#2c1d16',
    curtain: '#35505a', curtainDark: '#1f3038',
    cat: '#d98a45', catDark: '#a8612e', catLight: '#f2b574', catShadow: '#7d4523',
    pink: '#f3a0a6', eye: '#a8e46f', ink: '#16121a',
    pot: '#b4613f', potDark: '#7f3f2a', leaf: '#4f8a52', leafLight: '#7dba6a', stem: '#2f5a36',
    mug: '#e9dcc8', mugStripe: '#c9675a',
    lampShade: '#e8b36a', lampLit: '#ffdca0', metal: '#3b3236',
    radiator: '#454858', radiatorDark: '#262833',
    floor: '#2b1e1d', floorLine: '#211616',
  };
  const ROOMS = {
    plum: { wallTop: '#1b1524', wallBot: '#281c2b', wainscot: '#2f2131', curtain: '#35505a', curtainDark: '#1f3038' },
    sage: { wallTop: '#16201c', wallBot: '#1f2b25', wainscot: '#26342d', curtain: '#7a4b52', curtainDark: '#4a2a30' },
    navy: { wallTop: '#121628', wallBot: '#1a1f36', wainscot: '#22283f', curtain: '#8a5a3c', curtainDark: '#553420' },
    terracotta: { wallTop: '#24150f', wallBot: '#331d15', wainscot: '#3d241a', curtain: '#3d5c55', curtainDark: '#243833' },
  };
  const CATS = {
    ginger: { base: '#d98a45', dark: '#a8612e', light: '#f2b574', shadow: '#7d4523', eye: '#a8e46f' },
    black: { base: '#2a2830', dark: '#1a191f', light: '#45424e', shadow: '#111015', eye: '#f2d14b' },
    grey: { base: '#8d909e', dark: '#666978', light: '#b5b8c6', shadow: '#4a4c57', eye: '#a8e46f' },
    white: { base: '#ece7df', dark: '#c4bdb3', light: '#ffffff', shadow: '#9e978d', eye: '#7cc4f2' },
    siamese: { base: '#e8d7bf', dark: '#6b4a3a', light: '#f6ead8', shadow: '#a08770', eye: '#6fb7f0' },
  };
  const PIXEL_ROWS = { chunky: 160, classic: 216, fine: 300 };
  const ARROW = [
    'X..........', 'XX.........', 'XWX........', 'XWWX.......', 'XWWWX......', 'XWWWWX.....', 'XWWWWWX....',
    'XWWWWWWX...', 'XWWWWWWWX..', 'XWWWWWWWWX.', 'XWWWWWXXXXX', 'XWWXWWX....', 'XWX.XWWX...', 'XX..XWWX...',
    'X....XWWX..', '.....XWWX..', '......XX...',
  ];

  // Outside palette, [night, day, dusk-tint]
  const SKY = {
    top: ['#0f1329', '#7c8897', '#4a4472'],
    bot: ['#3b2b52', '#b4bac1', '#c8837a'],
    far: ['#2a2445', '#8b939d', '#6c4f6e'],
    near: ['#161328', '#5b636e', '#3b2d47'],
  };
  const LIGHTS = ['#ffcf6e', '#ff9e7a', '#ffe6a6', '#f7a6c4'];
  const GLYPH = {
    z: ['####', '  # ', ' #  ', '####'],
    heart: [' # # ', '#####', ' ### ', '  #  '],
  };

  W.registerScene({
    id: 'rain',
    name: 'Rainy Window',
    style: 'Pixel art · lofi',
    swatch: ['#1b1524', '#3b2b52', '#d98a45'],
    ambience: 'rain',
    type: '2d',
    pixelHeight: (o) => PIXEL_ROWS[o.pixel] || 216,
    options: [
      { key: 'cat', label: 'Cat', type: 'select', default: 'ginger', options: [['ginger', 'Ginger tabby'], ['black', 'Black'], ['grey', 'Grey'], ['white', 'Snow white'], ['siamese', 'Siamese']] },
      { key: 'room', label: 'Room colour', type: 'select', default: 'plum', options: [['plum', 'Plum & teal'], ['sage', 'Sage & rose'], ['navy', 'Navy & rust'], ['terracotta', 'Terracotta & pine']] },
      { key: 'rain', label: 'Rain', type: 'range', min: 0.15, max: 2.5, step: 0.05, default: 1 },
      { key: 'lights', label: 'Fairy lights', type: 'toggle', default: true },
      { key: 'lamp', label: 'Desk lamp on', type: 'toggle', default: true },
      { key: 'pixel', label: 'Pixel size', type: 'select', default: 'classic', rebuild: true, options: [['chunky', 'Chunky'], ['classic', 'Classic'], ['fine', 'Fine']] },
    ],
    theme: (o) => {
      const room = ROOMS[o.room] || ROOMS.plum;
      const [r, g, b] = W.util.hex(room.wallTop);
      return {
        font: "'Pixelify Sans', 'Courier New', monospace",
        clockWeight: 500,
        text: '#ffe9c7',
        dim: 'rgba(255,233,199,0.62)',
        accent: '#f2a65a',
        card: `rgba(${r},${g},${b},0.9)`,
        border: '2px solid rgba(242,166,90,0.55)',
        radius: '0px',
        shadow: '4px 4px 0 rgba(0,0,0,0.45)',
        blur: '0px',
        textShadow: '2px 2px 0 rgba(0,0,0,0.55)',
        field: 'rgba(0,0,0,0.3)',
        cursor: { svg: W.theme.pixelSvg(ARROW, { X: '#2a1b14', W: '#ffe6b8' }, 2), hot: [0, 0] },
      };
    },

    create({ canvas, ctx, input, env, opts }) {
      let bw = 0, bh = 0, cssW = 1, cssH = 1;
      const L = {};
      let fog, fogCtx;
      let farB = [], nearB = [], rain = [], stuck = [], sliding = [], parts = [];
      let time = 0, nextDrop = 0, nextZ = 0, nextSteam = 0;
      let lastWipe = null;
      const cat = { wakeUntil: -1, blink: 0, flick: 0, ear: 0, lookX: 1 };
      const hexCache = {};
      let mood = { day: 0, dusk: 0 };

      // ---------- pixel helpers ----------
      const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
      function ell(g, cx, cy, rx, ry, c) {
        g.fillStyle = c;
        cx = Math.round(cx); cy = Math.round(cy);
        for (let y = -ry; y <= ry; y++) {
          const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry + 0.25))));
          g.fillRect(cx - hw, cy + y, hw * 2 + 1, 1);
        }
      }
      function line(x0, y0, x1, y1, c, th = 1) {
        ctx.fillStyle = c;
        const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
        for (let i = 0; i <= n; i++) {
          ctx.fillRect(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), th, th);
        }
      }
      function glyph(rows, x, y, c) {
        ctx.fillStyle = c;
        rows.forEach((row, j) => {
          for (let i = 0; i < row.length; i++) if (row[i] === '#') ctx.fillRect(Math.round(x) + i, Math.round(y) + j, 1, 1);
        });
      }
      const hx = (h) => hexCache[h] || (hexCache[h] = U.hex(h));
      function pal([night, day, dusk], alpha = 1) {
        let c = U.mixRgb(hx(night), hx(day), mood.day);
        if (dusk) c = U.mixRgb(c, hx(dusk), mood.dusk * 0.7);
        return U.rgb(c, alpha);
      }
      const room = () => ROOMS[opts.room] || ROOMS.plum;
      const toBuf = (x, y) => [(x / cssW) * bw, (y / cssH) * bh];
      const inGlass = (x, y) => x >= L.gx0 && x < L.gx1 && y >= L.gy0 && y < L.gy1;

      // ---------- layout ----------
      function makeBuildings(minH, maxH, minW, maxW, lit) {
        const list = [];
        let x = L.gx0 - 12;
        while (x < L.gx1 + 12) {
          const w = U.randInt(minW, maxW);
          const h = Math.round(U.rand(minH, maxH) * (L.gy1 - L.gy0));
          const cols = Math.max(1, Math.floor((w - 2) / 3));
          const rows = Math.max(1, Math.floor((h - 4) / 4));
          const wins = new Uint8Array(cols * rows).map(() => (Math.random() < lit ? 1 + U.randInt(0, 2) : 0));
          list.push({ x, w, h, cols, rows, wins, antenna: Math.random() < 0.25, phase: U.rand(0, 6) });
          x += w + U.randInt(0, 3);
        }
        return list;
      }

      function layout() {
        const winH = Math.round(bh * 0.6);
        const winW = Math.min(Math.round(bw * 0.62), Math.round(winH * 1.6));
        L.wx0 = Math.round((bw - winW) / 2);
        L.wx1 = L.wx0 + winW;
        L.wy0 = Math.round(bh * 0.1);
        L.wy1 = L.wy0 + winH;
        L.gx0 = L.wx0 + 4; L.gy0 = L.wy0 + 4; L.gx1 = L.wx1 - 4; L.gy1 = L.wy1 - 2;
        L.mx = Math.round((L.gx0 + L.gx1) / 2);
        L.my = Math.round(L.gy0 + (L.gy1 - L.gy0) * 0.42);
        L.sill = L.wy1;
        L.floor = Math.round(bh * 0.9);
        L.catX = Math.round(L.gx0 + (L.gx1 - L.gx0) * 0.3);
        L.plantX = L.gx0 + 4;
        L.mugX = Math.round(L.gx0 + (L.gx1 - L.gx0) * 0.6);
        L.lampX = L.gx1 - 16;

        farB = makeBuildings(0.35, 0.75, 10, 24, 0.3);
        nearB = makeBuildings(0.18, 0.5, 14, 30, 0.42);

        rain = [];
        const area = (L.gx1 - L.gx0) * (L.gy1 - L.gy0);
        for (let i = 0; i < area / 110; i++) rain.push(newStreak(true));
        stuck = [];
        for (let i = 0; i < area / 70; i++) stuck.push(newStuck());
        sliding = [];

        fog = U.canvas(bw, bh);
        fogCtx = fog.getContext('2d');
        fogCtx.fillStyle = '#cdd6ea';
        fogCtx.fillRect(0, 0, bw, bh);
      }

      function newStreak(anywhere) {
        return {
          x: U.rand(L.gx0 - 10, L.gx1),
          y: anywhere ? U.rand(L.gy0, L.gy1) : L.gy0 - U.rand(0, 20),
          len: U.randInt(3, 6),
          v: U.rand(150, 230),
          far: Math.random() < 0.5,
        };
      }
      function newStuck() {
        return { x: U.randInt(L.gx0, L.gx1 - 1), y: U.randInt(L.gy0, L.gy1 - 1), big: Math.random() < 0.15 };
      }

      // ---------- interaction ----------
      function wipe(x0, y0, x1, y1) {
        fogCtx.globalCompositeOperation = 'destination-out';
        const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 2));
        for (let i = 0; i <= n; i++) {
          const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n;
          ell(fogCtx, x, y, 7, 6, 'rgba(0,0,0,0.5)');
          ell(fogCtx, x, y, 5, 4, '#000');
        }
        fogCtx.globalCompositeOperation = 'source-over';
      }

      function catHead() {
        const awake = time < cat.wakeUntil;
        return [L.catX + 12, L.sill - 8 - (awake ? 2 : 0)];
      }

      // ---------- update ----------
      function update(dt) {
        // fog slowly grows back
        fogCtx.globalAlpha = 1 - Math.exp(-dt * 0.07);
        fogCtx.fillStyle = '#cdd6ea';
        fogCtx.fillRect(0, 0, bw, bh);
        fogCtx.globalAlpha = 1;

        const want = Math.round(((L.gx1 - L.gx0) * (L.gy1 - L.gy0) / 110) * opts.rain);
        while (rain.length < want) rain.push(newStreak(true));
        if (rain.length > want) rain.length = want;
        const wind = 0.12 + U.clamp(input.vx / 4000, -0.25, 0.25);
        for (const r of rain) {
          r.y += r.v * dt * (r.far ? 0.8 : 1);
          r.x += r.v * dt * wind;
          if (r.y - r.len > L.gy1) Object.assign(r, newStreak(false));
        }
        for (const b of farB.concat(nearB)) {
          if (Math.random() < dt * 0.25) {
            const i = U.randInt(0, b.wins.length - 1);
            b.wins[i] = b.wins[i] ? 0 : 1 + U.randInt(0, 2);
          }
        }

        // drops
        if (time > nextDrop) {
          nextDrop = time + U.rand(0.6, 2.2) / opts.rain;
          sliding.push({ x: U.randInt(L.gx0 + 2, L.gx1 - 3), y: U.rand(L.gy0, L.gy0 + (L.gy1 - L.gy0) * 0.5), r: 1, moving: true, v: U.rand(15, 35) });
        }
        if (Math.random() < dt * 4 * opts.rain) {
          stuck.push(newStuck());
          if (stuck.length > 600) stuck.shift();
        }
        fogCtx.globalCompositeOperation = 'destination-out';
        fogCtx.fillStyle = '#000';
        for (let i = sliding.length - 1; i >= 0; i--) {
          const d = sliding[i];
          if (Math.random() < dt * 1.2) d.moving = !d.moving;
          const prevY = d.y;
          d.y += (d.moving ? d.v * (0.6 + d.r * 0.4) : 1.5) * dt;
          if (Math.random() < dt * 2) d.x += U.choice([-1, 1]);
          fogCtx.fillRect(Math.round(d.x), Math.round(prevY), d.r, Math.max(1, Math.round(d.y - prevY) + 1));
          for (let j = stuck.length - 1; j >= 0; j--) {
            const s = stuck[j];
            if (Math.abs(s.x - d.x) < 2 && Math.abs(s.y - d.y) < 2) {
              stuck.splice(j, 1);
              if (d.r < 2) d.r++;
              d.moving = true;
            }
          }
          if (d.y > L.gy1) sliding.splice(i, 1);
        }
        fogCtx.globalCompositeOperation = 'source-over';

        // cat
        if (input.active) {
          const [bx, by] = toBuf(input.x, input.y);
          const [hx0, hy0] = catHead();
          const near = Math.hypot(bx - hx0, by - hy0) < 55;
          if ((near && input.speed > 25) || input.speed > 1400) cat.wakeUntil = Math.max(cat.wakeUntil, time + U.rand(4, 6));
          cat.lookX = bx < hx0 - 4 ? -1 : bx > hx0 + 4 ? 1 : 0;
          cat.lookY = by < hy0 - 10 ? -1 : 0;
        }
        const awake = time < cat.wakeUntil;
        cat.blink = Math.max(0, cat.blink - dt);
        if (awake && Math.random() < dt * 0.5) cat.blink = 0.15;
        cat.flick = Math.max(0, cat.flick - dt);
        if (Math.random() < dt * (awake ? 0.5 : 0.12)) cat.flick = 0.6;
        cat.ear = Math.max(0, cat.ear - dt);
        if (Math.random() < dt * 0.15) cat.ear = 0.25;
        if (!awake && time > nextZ) {
          nextZ = time + 2.8;
          const [hx0, hy0] = catHead();
          parts.push({ kind: 'z', x: hx0 + 5, y: hy0 - 10, vx: 4, vy: -7, age: 0, life: 3 });
        }

        // steam
        if (time > nextSteam) {
          nextSteam = time + 0.22;
          parts.push({ kind: 'steam', x: L.mugX + U.randInt(1, 4), y: L.sill - 9, vx: 0, vy: -6, age: 0, life: U.rand(2, 3), seed: U.rand(0, 6) });
        }
        for (let i = parts.length - 1; i >= 0; i--) {
          const p = parts[i];
          p.age += dt;
          p.y += p.vy * dt;
          p.x += (p.vx + (p.kind === 'steam' ? Math.sin(p.age * 2.4 + p.seed) * 3 + input.vx / 120 : 0)) * dt;
          if (p.age > p.life) parts.splice(i, 1);
        }
      }

      // ---------- draw ----------
      function drawOutside() {
        ctx.save();
        ctx.beginPath();
        ctx.rect(L.gx0, L.gy0, L.gx1 - L.gx0, L.gy1 - L.gy0);
        ctx.clip();
        const g = ctx.createLinearGradient(0, L.gy0, 0, L.gy1);
        g.addColorStop(0, pal(SKY.top));
        g.addColorStop(1, pal(SKY.bot));
        ctx.fillStyle = g;
        ctx.fillRect(L.gx0, L.gy0, L.gx1 - L.gx0, L.gy1 - L.gy0);

        const litAlpha = 1 - mood.day * 0.7;
        drawBuildings(farB, pal(SKY.far), Math.round(-input.px * 3), 0.55 * litAlpha);
        // rain between layers
        ctx.fillStyle = `rgba(170,190,240,${0.22 + mood.day * 0.1})`;
        for (const r of rain) if (r.far) ctx.fillRect(Math.round(r.x), Math.round(r.y - r.len), 1, r.len);
        drawBuildings(nearB, pal(SKY.near), Math.round(-input.px * 6), 0.9 * litAlpha);
        ctx.fillStyle = `rgba(190,205,250,${0.32 + mood.day * 0.1})`;
        for (const r of rain) if (!r.far) ctx.fillRect(Math.round(r.x), Math.round(r.y - r.len), 1, r.len);

        // fog on the glass, then the drops sitting on it
        ctx.globalAlpha = 0.17 + mood.day * 0.08;
        ctx.drawImage(fog, 0, 0);
        ctx.globalAlpha = 1;
        // warm reflection of the lamp in the glass
        if (opts.lamp) {
        const rg = ctx.createRadialGradient(L.lampX - 4, L.sill - 18, 0, L.lampX - 4, L.sill - 18, 26);
        rg.addColorStop(0, 'rgba(255,200,130,0.16)');
        rg.addColorStop(1, 'rgba(255,200,130,0)');
        ctx.fillStyle = rg;
        ctx.fillRect(L.lampX - 32, L.sill - 46, 56, 50);
        }

        for (const s of stuck) {
          ctx.fillStyle = s.big ? 'rgba(225,235,255,0.55)' : 'rgba(210,225,255,0.3)';
          ctx.fillRect(s.x, s.y, 1, s.big ? 2 : 1);
        }
        for (const d of sliding) {
          const x = Math.round(d.x), y = Math.round(d.y);
          R(x, y, d.r, d.r + 1, 'rgba(200,220,255,0.6)');
          R(x, y, 1, 1, 'rgba(255,255,255,0.9)');
        }
        ctx.restore();
      }

      function drawBuildings(list, color, off, litA) {
        const base = L.gy1;
        for (const b of list) {
          const x = b.x + off, top = base - b.h;
          R(x, top, b.w, b.h, color);
          if (b.antenna) {
            R(x + (b.w >> 1), top - 5, 1, 5, color);
            if (Math.sin(time * 2 + b.phase) > 0.3) R(x + (b.w >> 1), top - 6, 1, 1, `rgba(255,90,90,${0.5 + litA * 0.5})`);
          }
          for (let r = 0; r < b.rows; r++) {
            for (let c = 0; c < b.cols; c++) {
              const v = b.wins[r * b.cols + c];
              if (!v) continue;
              ctx.fillStyle = v === 3 ? `rgba(160,210,255,${litA * 0.8})` : `rgba(255,${v === 1 ? 205 : 180},${v === 1 ? 120 : 110},${litA})`;
              ctx.fillRect(x + 2 + c * 3, top + 3 + r * 4, 1, 2);
            }
          }
        }
      }

      function drawRoom() {
        const g = ctx.createLinearGradient(0, 0, 0, bh);
        g.addColorStop(0, room().wallTop);
        g.addColorStop(1, room().wallBot);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, bw, bh);
        R(0, L.floor - 14, bw, 1, room().wainscot);

        // floor
        R(0, L.floor, bw, bh - L.floor, C.floor);
        for (let y = L.floor + 4; y < bh; y += 5) R(0, y, bw, 1, C.floorLine);
        R(0, L.floor, bw, 1, C.woodDark);

        // radiator
        const rw = Math.round((L.wx1 - L.wx0) * 0.46), rx = Math.round((bw - rw) / 2), ry = L.sill + 14, rh = 16;
        R(rx - 1, ry, rw + 2, 2, C.radiator);
        R(rx - 1, ry + rh - 2, rw + 2, 2, C.radiator);
        for (let x = rx; x < rx + rw; x += 3) {
          R(x, ry + 1, 2, rh - 2, C.radiator);
          R(x + 2, ry + 2, 1, rh - 4, C.radiatorDark);
        }
        R(rx + 2, ry + rh, 2, L.floor - ry - rh, C.radiatorDark);
        R(rx + rw - 4, ry + rh, 2, L.floor - ry - rh, C.radiatorDark);
      }

      function drawFrame() {
        const { wx0, wx1, wy0, wy1, gx0, gx1, gy0, gy1, mx, my } = L;
        R(wx0, wy0, wx1 - wx0, 4, C.wood);
        R(wx0, wy0, 4, wy1 - wy0, C.wood);
        R(wx1 - 4, wy0, 4, wy1 - wy0, C.wood);
        R(mx - 1, gy0, 3, gy1 - gy0, C.wood);
        R(gx0, my - 1, gx1 - gx0, 3, C.wood);
        R(wx0, wy0, wx1 - wx0, 1, C.woodLight);
        R(mx - 1, gy0, 1, gy1 - gy0, C.woodLight);
        R(gx0, my - 1, gx1 - gx0, 1, C.woodLight);
        R(gx0, gy0, gx1 - gx0, 1, C.woodDark);
        R(gx0, gy0, 1, gy1 - gy0, C.woodDark);
        // sill
        R(wx0 - 8, L.sill - 2, wx1 - wx0 + 16, 3, C.woodLight);
        R(wx0 - 8, L.sill + 1, wx1 - wx0 + 16, 5, C.wood);
        R(wx0 - 8, L.sill + 6, wx1 - wx0 + 16, 1, C.woodDark);
      }

      function drawCurtains() {
        const top = L.wy0 - 6, bottom = L.sill - 2;
        R(L.wx0 - 22, top - 1, L.wx1 - L.wx0 + 44, 1, C.metal);
        const drape = (x0, x1, dir) => {
          for (let x = x0; x < x1; x++) {
            const fold = 0.5 + 0.5 * Math.sin((x - x0) * 0.95);
            const sway = Math.round(Math.sin(time * 0.6 + x * 0.3) * 0.8 + input.px * dir);
            ctx.fillStyle = U.mix(room().curtainDark, room().curtain, fold);
            ctx.fillRect(x, top, 1, bottom - top + sway + (x % 3 === 0 ? 1 : 0));
          }
        };
        drape(L.wx0 - 20, L.wx0 + 6, 1);
        drape(L.wx1 - 6, L.wx1 + 20, -1);
      }

      function drawFairyLights() {
        const x0 = L.wx0 - 2, x1 = L.wx1 + 2, y0 = L.wy0 - 3, sag = 9, mid = (x0 + x1) / 2, half = (x1 - x0) / 2;
        const yAt = (x) => y0 + sag * (1 - ((x - mid) / half) ** 2);
        ctx.fillStyle = '#3a2c2a';
        for (let x = x0; x <= x1; x++) ctx.fillRect(x, Math.round(yAt(x)), 1, 1);
        let i = 0;
        for (let x = x0 + 5; x < x1 - 3; x += 9, i++) {
          const y = Math.round(yAt(x)) + 1;
          const tw = 0.55 + 0.45 * Math.sin(time * 1.4 + i * 1.7);
          const c = LIGHTS[i % LIGHTS.length];
          ctx.globalAlpha = tw;
          R(x, y, 1, 2, c);
          ctx.globalAlpha = tw * 0.22;
          R(x - 1, y - 1, 3, 4, c);
          ctx.globalAlpha = 1;
        }
      }

      function drawPlant() {
        const x = L.plantX, base = L.sill - 2;
        for (let i = 0; i < 8; i++) R(x - 5 + Math.floor(i / 4), base - 8 + i, 11 - Math.floor(i / 2), 1, i < 2 ? C.potDark : C.pot);
        R(x - 5, base - 8, 11, 1, C.potDark);
        const stems = [-2.4, -2.05, -1.75, -1.45, -1.15, -0.85];
        stems.forEach((a, i) => {
          const sway = Math.sin(time * 0.9 + i * 1.3) * 0.07 + input.px * 0.05;
          const len = 9 + (i % 3) * 3;
          const ex = x + Math.cos(a + sway) * len, ey = base - 8 + Math.sin(a + sway) * len;
          line(x, base - 8, ex, ey, C.stem);
          ell(ctx, ex, ey, 2, 1, C.leaf);
          R(Math.round(ex), Math.round(ey) - 1, 1, 1, C.leafLight);
        });
      }

      function drawMugAndBooks() {
        const x = L.mugX, b = L.sill - 2;
        R(x, b - 7, 6, 7, C.mug);
        R(x, b - 5, 6, 1, C.mugStripe);
        R(x + 1, b - 7, 4, 1, '#3b2418');
        R(x + 6, b - 6, 1, 1, C.mug); R(x + 7, b - 5, 1, 2, C.mug); R(x + 6, b - 3, 1, 1, C.mug);
        const bx = x + 11;
        R(bx, b - 3, 17, 3, '#6b8fa3'); R(bx, b - 3, 17, 1, '#86a9bb');
        R(bx + 1, b - 6, 15, 3, '#c9a15a'); R(bx + 1, b - 6, 15, 1, '#e0bd78');
        R(bx + 2, b - 9, 13, 3, '#8a5a6b'); R(bx + 2, b - 9, 13, 1, '#a6738a');
      }

      function drawLamp() {
        const x = L.lampX, b = L.sill - 2;
        ell(ctx, x, b - 1, 4, 1, C.metal);
        R(x, b - 15, 1, 14, C.metal);
        for (let i = 0; i < 7; i++) R(x - 3 - Math.floor(i / 2), b - 22 + i, 7 + Math.floor(i / 2) * 2, 1, i > 4 && opts.lamp ? C.lampLit : opts.lamp ? C.lampShade : '#8a6a48');
      }

      function drawCat() {
        const K = CATS[opts.cat] || CATS.ginger;
        const awake = time < cat.wakeUntil;
        const cx = L.catX, by = L.sill - 2;
        const breath = Math.sin(time * 1.7) > 0.2 ? 1 : 0;
        const cy = by - 6;
        ell(ctx, cx + 2, by, 15, 1, 'rgba(0,0,0,0.35)');
        // body
        ell(ctx, cx, cy, 13, 5 + breath, K.base);
        ell(ctx, cx + 3, cy - 2 - breath, 8, 2, K.light);
        R(cx - 12, cy + 3, 24, 1, K.dark);
        [-7, -3, 1].forEach((sx) => R(cx + sx, cy - 4 - breath, 1, 3, K.dark));
        // tail curling in front
        const flick = Math.round(Math.sin(cat.flick * 10) * 2 * (cat.flick > 0 ? 1 : 0));
        line(cx - 12, cy + 2, cx - 5, by - 1, K.dark, 2);
        line(cx - 5, by - 1, cx + 3, by - 1 - Math.max(0, flick), K.base, 2);
        // head
        const [hx0, hy0] = catHead();
        ell(ctx, hx0, hy0, 6, 5, K.base);
        ell(ctx, hx0 + 1, hy0 - 2, 3, 1, K.light);
        const earL = cat.ear > 0 ? 1 : 0;
        for (let i = 0; i < 4; i++) {
          R(hx0 - 5, hy0 - 7 + i + earL, i + 1, 1, K.base);
          R(hx0 + 5 - i, hy0 - 7 + i, i + 1, 1, K.base);
        }
        R(hx0 - 4, hy0 - 4 + earL, 1, 1, C.pink);
        R(hx0 + 4, hy0 - 4, 1, 1, C.pink);
        R(hx0 - 1, hy0 - 4, 1, 2, K.dark);
        R(hx0 + 1, hy0 - 4, 1, 2, K.dark);
        // paws
        R(hx0 - 4, by - 2, 3, 2, K.light);
        R(hx0 + 1, by - 2, 3, 2, K.light);
        // face
        const open = awake && cat.blink <= 0;
        [hx0 - 3, hx0 + 2].forEach((ex) => {
          if (open) {
            R(ex, hy0, 2, 2, K.eye);
            const px = cat.lookX < 0 ? ex : cat.lookX > 0 ? ex + 1 : ex + (ex < hx0 ? 1 : 0);
            R(px, hy0, 1, cat.lookY < 0 ? 1 : 2, C.ink);
          } else R(ex, hy0 + 1, 2, 1, K.shadow);
        });
        R(hx0, hy0 + 2, 1, 1, C.pink);
      }

      function drawParts() {
        for (const p of parts) {
          const a = 1 - p.age / p.life;
          if (p.kind === 'steam') {
            ctx.fillStyle = `rgba(235,235,245,${0.35 * a})`;
            ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
          } else if (p.kind === 'z') glyph(GLYPH.z, p.x, p.y, `rgba(205,215,255,${0.8 * a})`);
          else glyph(GLYPH.heart, p.x, p.y, `rgba(255,140,175,${a})`);
        }
      }

      function drawGlow() {
        const strength = (1 - mood.day * 0.55) * (opts.lamp ? 1 : 0.12);
        const flicker = 0.96 + Math.sin(time * 7.3) * 0.015 + Math.sin(time * 2.1) * 0.02;
        const x = L.lampX, y = L.sill - 16;
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(x, y, 0, x, y, 110);
        g.addColorStop(0, `rgba(255,180,100,${0.32 * strength * flicker})`);
        g.addColorStop(0.35, `rgba(255,150,80,${0.12 * strength * flicker})`);
        g.addColorStop(1, 'rgba(255,140,70,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - 110, y - 110, 220, 220);
        ctx.globalCompositeOperation = 'source-over';
        // cool spill from the window across the sill
        ctx.fillStyle = `rgba(120,140,220,${0.05 + mood.day * 0.06})`;
        ctx.fillRect(L.gx0, L.sill - 2, L.gx1 - L.gx0, 3);
      }

      return {
        resize(w, h) {
          cssW = w; cssH = h;
          bw = canvas.width; bh = canvas.height;
          ctx.imageSmoothingEnabled = false;
          layout();
        },
        frame(dt, t) {
          time = t;
          mood = env.mood(0, 0);
          update(dt);
          drawRoom();
          drawOutside();
          drawFrame();
          drawCurtains();
          if (opts.lights) drawFairyLights();
          drawPlant();
          drawCat();
          drawMugAndBooks();
          drawLamp();
          drawParts();
          drawGlow();
        },
        onPointerMove(x, y) {
          const [bx, by] = toBuf(x, y);
          if (inGlass(bx, by)) {
            if (lastWipe && performance.now() - lastWipe.t < 120) wipe(lastWipe.x, lastWipe.y, bx, by);
            else wipe(bx, by, bx, by);
            lastWipe = { x: bx, y: by, t: performance.now() };
          } else lastWipe = null;
        },
        onPointerDown(x, y) {
          const [bx, by] = toBuf(x, y);
          const [hx0, hy0] = catHead();
          if (Math.hypot(bx - (L.catX + 4), by - (L.sill - 8)) < 18) {
            cat.wakeUntil = time + 6;
            cat.ear = 0.4;
            parts.push({ kind: 'heart', x: hx0 - 2, y: hy0 - 14, vx: 0, vy: -10, age: 0, life: 1.8 });
          } else if (inGlass(bx, by)) {
            sliding.push({ x: Math.round(bx), y: by, r: 2, moving: true, v: U.rand(25, 40) });
          }
        },
      };
    },
  });
})();
