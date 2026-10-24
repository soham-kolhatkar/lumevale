/* Lonely Astronaut — flat vector illustration. An astronaut sits on an alien hill under a ringed planet.
   Mouse: layered parallax, the astronaut turns to look at the cursor; click to launch a shooting star. */
(function () {
  const W = window.Lumevale;
  const U = W.util;
  const { TAU, rand, clamp, lerp } = U;

  // Each sky: [night, day, dusk] colours for 3 gradient stops and 4 hill layers.
  const SKIES = {
    violet: {
      sky: [['#090b24', '#3f86b5', '#1b1747'], ['#231a52', '#7cbcd1', '#6a3d7a'], ['#5b3a7a', '#f5d0a6', '#f0936b']],
      hills: [['#3b2d6e', '#6f8fb0', '#5a3a78'], ['#271f52', '#4f6f93', '#3b2858'], ['#17133a', '#33506f', '#24183d'], ['#0e0b24', '#1f344b', '#140d24']],
      card: 'rgba(35,26,82,0.92)',
    },
    deep: {
      sky: [['#03061a', '#3f86b5', '#101a40'], ['#0b1640', '#7cbcd1', '#2b3a78'], ['#1c3a6e', '#f5d0a6', '#e0906b']],
      hills: [['#1f2f5c', '#6f8fb0', '#2d3a6a'], ['#16234a', '#4f6f93', '#202c55'], ['#0e1836', '#33506f', '#151d3d'], ['#080e22', '#1f344b', '#0c1024']],
      card: 'rgba(16,28,66,0.92)',
    },
    teal: {
      sky: [['#041a1f', '#4fa3a8', '#123a40'], ['#0d3b42', '#8fd0c8', '#3c6f6a'], ['#2f6f6a', '#f6dcb0', '#f0a070']],
      hills: [['#1d4a4c', '#6fa0a0', '#2f5a55'], ['#14383b', '#4f8080', '#22443f'], ['#0c2729', '#335a5a', '#16302c'], ['#061719', '#1f3c3c', '#0c1c1a']],
      card: 'rgba(10,48,52,0.92)',
    },
    rose: {
      sky: [['#1a0a1e', '#c78fb3', '#3a1532'], ['#4a1d4a', '#f0b8c8', '#8a3a5e'], ['#a8506e', '#ffe0c8', '#ff9a80']],
      hills: [['#5a2a5a', '#a07090', '#6a2f55'], ['#3f1d44', '#805070', '#4a2040'], ['#2a1230', '#5a3550', '#33142c'], ['#180a1c', '#3a2035', '#1c0a18']],
      card: 'rgba(60,22,60,0.92)',
    },
  };
  const PLANETS = {
    peach: {
      base: '#f2b08a', bands: ['#f7c79b', '#e9927a', '#f5d6b0', '#d97a72', '#f2b08a', '#c86f78', '#f7c79b'],
      rings: ['rgba(255,214,170,0.55)', 'rgba(240,170,150,0.45)', 'rgba(255,230,200,0.35)'], glow: '255,170,140', accent: '#f5a37a',
    },
    ice: {
      base: '#a9d6e5', bands: ['#cde9f2', '#8ec5d6', '#e8f6fa', '#6ea9c4', '#b5dbe8', '#5b8fb0', '#cde9f2'],
      rings: ['rgba(210,240,255,0.5)', 'rgba(150,200,230,0.42)', 'rgba(235,250,255,0.32)'], glow: '150,210,255', accent: '#9fd8f0',
    },
    emerald: {
      base: '#8fc79a', bands: ['#b8e0b0', '#6fb38a', '#d8f0c8', '#4f9a7a', '#9fd0a0', '#3f7f6a', '#b8e0b0'],
      rings: ['rgba(200,240,200,0.5)', 'rgba(140,200,160,0.42)', 'rgba(220,250,220,0.3)'], glow: '150,230,170', accent: '#8fdcaa',
    },
    lava: {
      base: '#f07a3a', bands: ['#ffb36b', '#e0502e', '#ffd27a', '#b8341f', '#f58a3c', '#8a2416', '#ffb36b'],
      rings: ['rgba(255,190,120,0.5)', 'rgba(240,120,80,0.42)', 'rgba(255,220,160,0.32)'], glow: '255,120,70', accent: '#ff9a5c',
    },
  };
  const SUITS = {
    white: { white: '#f1f2f8', shade: '#c9cddc', dark: '#8e93ab' },
    orange: { white: '#f4a261', shade: '#d9833f', dark: '#8e5a3a' },
    pink: { white: '#f7c6d9', shade: '#e29ab8', dark: '#9a5f7a' },
    mint: { white: '#bfead8', shade: '#8fd0b5', dark: '#4f8a76' },
  };
  const METEORS = { rare: [12, 25], normal: [5, 12], shower: [0.5, 1.8] };

  W.registerScene({
    id: 'astro',
    name: 'Lonely Astronaut',
    style: 'Flat illustration',
    swatch: ['#090b24', '#3b2d6e', '#f0936b', '#f5c58a'],
    ambience: 'space',
    type: '2d',
    options: [
      { key: 'sky', label: 'Sky', type: 'select', default: 'violet', options: [['violet', 'Violet night'], ['deep', 'Deep blue'], ['teal', 'Teal'], ['rose', 'Rose']] },
      { key: 'planet', label: 'Planet', type: 'select', default: 'peach', options: [['peach', 'Peach ringed giant'], ['ice', 'Ice giant'], ['emerald', 'Emerald'], ['lava', 'Lava world']] },
      { key: 'suit', label: 'Spacesuit', type: 'select', default: 'white', options: [['white', 'Classic white'], ['orange', 'Rescue orange'], ['pink', 'Bubblegum'], ['mint', 'Mint']] },
      { key: 'meteors', label: 'Shooting stars', type: 'select', default: 'normal', options: [['rare', 'Rare'], ['normal', 'Now and then'], ['shower', 'Meteor shower']] },
      { key: 'flag', label: 'Flag', type: 'toggle', default: true },
      { key: 'plants', label: 'Glowing plants', type: 'toggle', default: true },
    ],
    theme: (o) => {
      const sk = SKIES[o.sky] || SKIES.violet, pl = PLANETS[o.planet] || PLANETS.peach;
      return {
        font: "'Fredoka', 'Outfit', sans-serif",
        clockWeight: 400,
        text: '#fff4ea',
        dim: 'rgba(255,244,234,0.62)',
        accent: pl.accent,
        card: sk.card,
        border: 'none',
        radius: '24px',
        shadow: '0 6px 0 rgba(8,5,25,0.35)',
        blur: '0px',
        textShadow: '0 3px 0 rgba(8,5,25,0.35)',
        field: 'rgba(255,255,255,0.1)',
        cursor: { svg: W.theme.starSvg(pl.accent, 26), hot: [13, 13] },
      };
    },

    create({ ctx, input, env, opts }) {
      let w = 1, h = 1, time = 0;
      let stars = [], hills = [], plants = [], spores = [], meteors = [];
      let milky = null;
      let nextMeteor = 4;
      const noise = U.makeNoise();
      const astro = { lookX: 1, lookY: -0.6, gazeUntil: 0, gx: 0, gy: 0 };
      let mood = { day: 0, dusk: 0 };
      const hexCache = {};

      const sky = () => SKIES[opts.sky] || SKIES.violet;
      const planet = () => PLANETS[opts.planet] || PLANETS.peach;
      const hx = (c) => hexCache[c] || (hexCache[c] = U.hex(c));
      function pal([n, d, k], a = 1) {
        let c = U.mixRgb(hx(n), hx(d), mood.day);
        c = U.mixRgb(c, hx(k), mood.dusk * 0.8);
        return U.rgb(c, a);
      }

      // ---------- layout ----------
      const L = {};
      function layout() {
        const m = Math.min(w, h);
        L.planet = { x: w * 0.72, y: h * 0.3, r: m * 0.16 };
        L.peakX = w * 0.3;
        L.peakY = h * 0.74;
        L.s = m * 0.085; // astronaut scale

        stars = [];
        for (let i = 0; i < (w * h) / 2200; i++) {
          stars.push({ x: rand(-30, w + 30), y: rand(-30, h * 0.85), r: Math.pow(Math.random(), 3) * 1.6 + 0.4, ph: rand(TAU), sp: rand(0.5, 2), z: rand(0.3, 1) });
        }

        // rolling hill silhouettes
        hills = [0.58, 0.66, 0.76].map((base, i) => {
          const pts = [];
          const step = 24;
          const amp = h * (0.08 - i * 0.015);
          const seed = rand(100);
          for (let x = -80; x <= w + 80; x += step) pts.push([x, h * base - (noise.fbm2(x / (300 - i * 60) + seed, i * 10, 3) * 0.5 + 0.5) * amp * 2]);
          return { pts, depth: 0.25 + i * 0.25, layer: i };
        });

        plants = [];
        for (let i = 0; i < 16; i++) {
          const t = rand(-1, 1);
          const x = L.peakX + t * w * 0.28;
          plants.push({ t, x, h: rand(14, 36) * (m / 800), hue: U.choice([180, 190, 300, 320, 45]), ph: rand(TAU), bulbs: U.randInt(1, 3) });
        }
        spores = [];
        for (let i = 0; i < 26; i++) spores.push({ x: rand(w), y: rand(h * 0.5, h), seed: rand(100), r: rand(1, 2.5), hue: U.choice([180, 300, 45]) });

        paintMilkyWay();
      }

      function paintMilkyWay() {
        milky = U.canvas(w, h);
        const g = milky.getContext('2d');
        g.save();
        g.translate(w * 0.45, h * 0.35);
        g.rotate(-0.45);
        const bandW = Math.max(w, h) * 1.4, bandH = Math.min(w, h) * 0.28;
        const grd = g.createLinearGradient(0, -bandH, 0, bandH);
        grd.addColorStop(0, 'rgba(160,140,255,0)');
        grd.addColorStop(0.5, 'rgba(190,160,255,0.16)');
        grd.addColorStop(1, 'rgba(160,140,255,0)');
        g.fillStyle = grd;
        g.fillRect(-bandW / 2, -bandH, bandW, bandH * 2);
        for (let i = 0; i < 1400; i++) {
          const x = rand(-bandW / 2, bandW / 2);
          const y = (Math.random() + Math.random() + Math.random() - 1.5) * bandH * 0.6;
          g.fillStyle = `rgba(255,255,255,${rand(0.05, 0.35)})`;
          g.fillRect(x, y, rand(0.5, 1.4), rand(0.5, 1.4));
        }
        for (let i = 0; i < 30; i++) {
          const x = rand(-bandW / 2, bandW / 2), y = rand(-bandH * 0.4, bandH * 0.4), r = rand(30, 110);
          const b = g.createRadialGradient(x, y, 0, x, y, r);
          b.addColorStop(0, `rgba(${U.choice(['255,170,220', '170,190,255', '200,160,255'])},0.06)`);
          b.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = b;
          g.fillRect(x - r, y - r, r * 2, r * 2);
        }
        g.restore();
      }

      // ---------- sky ----------
      function drawSky() {
        const g = ctx.createLinearGradient(0, 0, 0, h * 0.8);
        g.addColorStop(0, pal(sky().sky[0]));
        g.addColorStop(0.55, pal(sky().sky[1]));
        g.addColorStop(1, pal(sky().sky[2]));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);

        const starA = 1 - mood.day * 0.9;
        ctx.globalAlpha = 0.9 * starA;
        ctx.drawImage(milky, input.px * -8, input.py * -5);
        ctx.globalAlpha = 1;
        for (const s of stars) {
          const tw = 0.55 + 0.45 * Math.sin(time * s.sp + s.ph);
          const x = s.x + input.px * -6 * s.z, y = s.y + input.py * -4 * s.z;
          ctx.fillStyle = `rgba(255,250,240,${tw * starA * (0.4 + s.z * 0.6)})`;
          ctx.beginPath();
          ctx.arc(x, y, s.r, 0, TAU);
          ctx.fill();
          if (s.r > 1.6) {
            ctx.strokeStyle = `rgba(255,250,240,${tw * starA * 0.35})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(x - s.r * 4, y); ctx.lineTo(x + s.r * 4, y);
            ctx.moveTo(x, y - s.r * 4); ctx.lineTo(x, y + s.r * 4);
            ctx.stroke();
          }
        }
      }

      function drawPlanet() {
        const { r } = L.planet;
        const x = L.planet.x + input.px * -14, y = L.planet.y + input.py * -9;
        const tilt = -0.32;
        // glow
        ctx.globalCompositeOperation = 'lighter';
        const glow = ctx.createRadialGradient(x, y, r * 0.9, x, y, r * 2.4);
        glow.addColorStop(0, `rgba(${planet().glow},0.18)`);
        glow.addColorStop(1, `rgba(${planet().glow},0)`);
        ctx.fillStyle = glow;
        ctx.fillRect(x - r * 2.5, y - r * 2.5, r * 5, r * 5);
        ctx.globalCompositeOperation = 'source-over';

        const ring = (front) => {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(tilt);
          [[2.05, 0.06, planet().rings[0]], [1.85, 0.12, planet().rings[1]], [1.6, 0.05, planet().rings[2]]].forEach(([rr, lw, col]) => {
            ctx.strokeStyle = col;
            ctx.lineWidth = r * lw;
            ctx.beginPath();
            ctx.ellipse(0, 0, r * rr, r * rr * 0.24, 0, front ? 0 : Math.PI, front ? Math.PI : TAU);
            ctx.stroke();
          });
          ctx.restore();
        };
        ring(false);

        // banded body
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.clip();
        ctx.fillStyle = planet().base;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
        ctx.translate(x, y);
        ctx.rotate(tilt);
        const bands = planet().bands;
        const drift = (time * 0.01) % 1;
        for (let i = -1; i < bands.length + 1; i++) {
          const by = -r + ((i + drift) / bands.length) * r * 2;
          ctx.fillStyle = bands[(i + bands.length) % bands.length];
          ctx.beginPath();
          ctx.ellipse(0, by, r * 1.6, r * 0.13 + (i % 2) * r * 0.05, 0, 0, TAU);
          ctx.fill();
        }
        ctx.rotate(-tilt);
        const shade = ctx.createRadialGradient(r * 0.45, -r * 0.45, r * 0.2, 0, 0, r * 1.15);
        shade.addColorStop(0, 'rgba(255,240,220,0.25)');
        shade.addColorStop(0.55, 'rgba(60,20,60,0)');
        shade.addColorStop(1, 'rgba(30,10,50,0.6)');
        ctx.fillStyle = shade;
        ctx.fillRect(-r, -r, r * 2, r * 2);
        ctx.restore();
        ring(true);

        // little moon orbiting
        const oa = time * 0.08;
        const mx = x + Math.cos(oa) * r * 2.6, my = y + Math.sin(oa) * r * 0.7 - r * 0.2;
        const behind = Math.sin(oa) < 0 && Math.hypot(mx - x, my - y) < r;
        if (!behind) {
          ctx.fillStyle = '#d9d4f0';
          ctx.beginPath();
          ctx.arc(mx, my, r * 0.12, 0, TAU);
          ctx.fill();
          ctx.fillStyle = 'rgba(60,40,100,0.35)';
          ctx.beginPath();
          ctx.arc(mx - r * 0.035, my + r * 0.03, r * 0.1, 0, TAU);
          ctx.fill();
        }
      }

      function drawMeteors(dt) {
        if (time > nextMeteor) {
          nextMeteor = time + rand(...(METEORS[opts.meteors] || METEORS.normal));
          launch(rand(w * 0.2, w * 1.1), rand(-20, h * 0.25));
        }
        ctx.lineCap = 'round';
        for (let i = meteors.length - 1; i >= 0; i--) {
          const m = meteors[i];
          m.age += dt;
          if (m.age > m.life) { meteors.splice(i, 1); continue; }
          m.x += m.vx * dt;
          m.y += m.vy * dt;
          const k = m.age / m.life, a = Math.sin(Math.PI * k);
          const tail = 160 * a;
          const sp = Math.hypot(m.vx, m.vy);
          const tx = m.x - (m.vx / sp) * tail, ty = m.y - (m.vy / sp) * tail;
          const grd = ctx.createLinearGradient(m.x, m.y, tx, ty);
          grd.addColorStop(0, `rgba(255,245,230,${0.9 * a})`);
          grd.addColorStop(1, 'rgba(255,200,170,0)');
          ctx.strokeStyle = grd;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(m.x, m.y);
          ctx.lineTo(tx, ty);
          ctx.stroke();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = a;
          const s = U.glowSprite('rgba(255,230,200,0.9)', 32);
          ctx.drawImage(s, m.x - 8, m.y - 8, 16, 16);
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = 'source-over';
        }
      }

      function launch(x, y) {
        const a = rand(2.3, 2.7); // down-left
        const v = rand(500, 750);
        meteors.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, life: rand(0.9, 1.4) });
      }

      // ---------- ground ----------
      function drawHills() {
        for (const hl of hills) {
          const ox = input.px * -40 * hl.depth, oy = input.py * -10 * hl.depth;
          ctx.fillStyle = pal(sky().hills[hl.layer]);
          ctx.beginPath();
          ctx.moveTo(-100, h + 10);
          const p = hl.pts;
          ctx.lineTo(p[0][0] + ox, p[0][1] + oy);
          for (let i = 1; i < p.length - 1; i++) {
            const mx = (p[i][0] + p[i + 1][0]) / 2, my = (p[i][1] + p[i + 1][1]) / 2;
            ctx.quadraticCurveTo(p[i][0] + ox, p[i][1] + oy, mx + ox, my + oy);
          }
          ctx.lineTo(w + 100, h + 10);
          ctx.closePath();
          ctx.fill();
        }
      }

      const front = () => ({ ox: input.px * -55, oy: input.py * -14 });

      function hillY(x) {
        // front hill: smooth bump peaking under the astronaut
        const d = (x - L.peakX) / (w * 0.45);
        return L.peakY + (h - L.peakY) * 0.95 * Math.min(1, d * d) + (h * 0.02) * Math.sin(x / 90);
      }

      function drawFrontHill() {
        const { ox, oy } = front();
        ctx.fillStyle = pal(sky().hills[3]);
        ctx.beginPath();
        ctx.moveTo(-100, h + 10);
        for (let x = -100; x <= w + 100; x += 12) ctx.lineTo(x + ox, hillY(x) + oy);
        ctx.lineTo(w + 100, h + 10);
        ctx.closePath();
        ctx.fill();
        // rim light from the planet
        ctx.strokeStyle = 'rgba(255,180,160,0.22)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = L.peakX - w * 0.3; x <= L.peakX + w * 0.42; x += 10) {
          x === L.peakX - w * 0.3 ? ctx.moveTo(x + ox, hillY(x) + oy + 1) : ctx.lineTo(x + ox, hillY(x) + oy + 1);
        }
        ctx.stroke();

        // glowing alien plants
        for (const p of opts.plants ? plants : []) {
          const bx = p.x + ox, by = hillY(p.x) + oy + 2;
          const sway = Math.sin(time * 0.8 + p.ph) * 0.15 + input.vx * 0.0002;
          const tx = bx + Math.sin(sway) * p.h, ty = by - Math.cos(sway) * p.h;
          ctx.strokeStyle = 'rgba(30,25,60,1)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.quadraticCurveTo(bx, by - p.h * 0.6, tx, ty);
          ctx.stroke();
          const pulse = 0.6 + 0.4 * Math.sin(time * 1.3 + p.ph);
          ctx.globalCompositeOperation = 'lighter';
          for (let b = 0; b < p.bulbs; b++) {
            const k = 1 - b * 0.3;
            const x = lerp(bx, tx, k), y = lerp(by, ty, k);
            const s = U.glowSprite(`hsla(${p.hue},100%,65%,0.9)`, 64);
            const sz = (14 - b * 3) * pulse;
            ctx.drawImage(s, x - sz, y - sz, sz * 2, sz * 2);
            ctx.fillStyle = `hsla(${p.hue},100%,85%,${0.9 * pulse})`;
            ctx.beginPath();
            ctx.arc(x, y, 2.2 - b * 0.4, 0, TAU);
            ctx.fill();
          }
          ctx.globalCompositeOperation = 'source-over';
        }
      }

      function drawSpores(dt) {
        ctx.globalCompositeOperation = 'lighter';
        for (const s of spores) {
          s.y -= 6 * dt;
          s.x += noise.n1(time * 0.2 + s.seed) * 12 * dt;
          if (s.y < h * 0.45) { s.y = h + 5; s.x = rand(w); }
          const a = 0.5 + 0.5 * Math.sin(time * 1.5 + s.seed);
          ctx.globalAlpha = a * 0.8;
          const sp = U.glowSprite(`hsla(${s.hue},100%,70%,0.9)`, 32);
          ctx.drawImage(sp, s.x + input.px * -50 - 5, s.y - 5, 10, 10);
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }

      // ---------- astronaut ----------
      function drawAstronaut(dt) {
        const { ox, oy } = front();
        const s = L.s;
        const x = L.peakX + ox, y = hillY(L.peakX) + oy + s * 0.05;

        // where to look: a recent meteor, the cursor, or the planet
        let tx = L.planet.x - x, ty = L.planet.y - y;
        const recent = meteors[meteors.length - 1];
        if (time < astro.gazeUntil && recent) { tx = recent.x - x; ty = recent.y - y; }
        else if (input.active) { tx = input.x - x; ty = input.y - (y - s * 1.75); }
        else { tx += noise.n1(time * 0.1) * 200; ty += noise.n1(time * 0.1 + 9) * 80; }
        const d = Math.hypot(tx, ty) || 1;
        astro.gx = U.damp(astro.gx, tx / d, 3, dt);
        astro.gy = U.damp(astro.gy, ty / d, 3, dt);
        const lx = astro.gx, ly = astro.gy;

        const breathe = Math.sin(time * 1.2) * 0.012;
        const { white, shade, dark } = SUITS[opts.suit] || SUITS.white;
        ctx.save();
        ctx.translate(x, y);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // shadow
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(s * 0.2, 0, s * 1.1, s * 0.12, 0, 0, TAU);
        ctx.fill();

        // flag
        const fx = -s * 1.25;
        if (opts.flag) {
        ctx.strokeStyle = '#b8bccb';
        ctx.lineWidth = s * 0.05;
        ctx.beginPath();
        ctx.moveTo(fx, s * 0.05);
        ctx.lineTo(fx, -s * 1.9);
        ctx.stroke();
        ctx.fillStyle = '#ef8a7a';
        ctx.beginPath();
        ctx.moveTo(fx, -s * 1.88);
        const fw = s * 0.75, fh = s * 0.45;
        for (let i = 0; i <= 10; i++) {
          const k = i / 10;
          ctx.lineTo(fx + fw * k, -s * 1.88 + Math.sin(time * 3 - k * 4) * s * 0.06 * k);
        }
        for (let i = 10; i >= 0; i--) {
          const k = i / 10;
          ctx.lineTo(fx + fw * k, -s * 1.88 + fh + Math.sin(time * 3 - k * 4) * s * 0.06 * k);
        }
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#f7d36d';
        ctx.beginPath();
        ctx.arc(fx + fw * 0.4, -s * 1.88 + fh / 2 + Math.sin(time * 3 - 1.6) * s * 0.025, s * 0.08, 0, TAU);
        ctx.fill();
        }

        // far leg
        const limb = (pts, width, color) => {
          ctx.strokeStyle = color;
          ctx.lineWidth = width;
          ctx.beginPath();
          ctx.moveTo(pts[0][0] * s, pts[0][1] * s);
          for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] * s, pts[i][1] * s);
          ctx.stroke();
        };
        limb([[0.05, -0.45], [0.62, -0.88], [0.82, -0.12]], s * 0.3, shade);
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.ellipse(s * 0.92, -s * 0.08, s * 0.2, s * 0.11, 0, 0, TAU);
        ctx.fill();

        // backpack
        ctx.fillStyle = shade;
        roundRect(-s * 0.72, -s * 1.42, s * 0.42, s * 0.85, s * 0.1);
        ctx.fill();
        ctx.fillStyle = dark;
        roundRect(-s * 0.7, -s * 0.85, s * 0.38, s * 0.12, s * 0.05);
        ctx.fill();

        // torso
        ctx.save();
        ctx.translate(0, -s * 0.5);
        ctx.scale(1, 1 + breathe);
        ctx.fillStyle = white;
        roundRect(-s * 0.4, -s * 0.95, s * 0.78, s * 0.98, s * 0.28);
        ctx.fill();
        ctx.fillStyle = shade;
        roundRect(-s * 0.4, -s * 0.2, s * 0.78, s * 0.22, s * 0.1);
        ctx.fill();
        // chest panel
        ctx.fillStyle = '#d6dae6';
        roundRect(s * 0.02, -s * 0.72, s * 0.28, s * 0.22, s * 0.05);
        ctx.fill();
        ['#ef8a7a', '#7fd6e8', '#f7d36d'].forEach((c, i) => {
          ctx.fillStyle = c;
          ctx.beginPath();
          ctx.arc(s * (0.08 + i * 0.08), -s * 0.61, s * 0.026, 0, TAU);
          ctx.fill();
        });
        ctx.restore();

        // near leg
        limb([[0.1, -0.42], [0.72, -0.82], [0.95, -0.1]], s * 0.32, white);
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.ellipse(s * 1.05, -s * 0.06, s * 0.22, s * 0.12, 0, 0, TAU);
        ctx.fill();

        // arm resting on knee
        limb([[0.0, -1.25], [0.38, -0.92], [0.76, -0.98]], s * 0.22, white);
        ctx.fillStyle = shade;
        ctx.beginPath();
        ctx.arc(s * 0.8, -s * 0.99, s * 0.12, 0, TAU);
        ctx.fill();

        // helmet (tilts toward the look direction)
        ctx.save();
        ctx.translate(s * 0.02, -s * 1.42);
        ctx.rotate(clamp(ly, -0.9, 0.6) * 0.35 * Math.sign(lx || 1) + (lx < 0 ? -0.1 : 0));
        const hy = -s * 0.36, hr = s * 0.42;
        ctx.strokeStyle = '#b8bccb';
        ctx.lineWidth = s * 0.03;
        ctx.beginPath();
        ctx.moveTo(-s * 0.15, hy - hr * 0.8);
        ctx.lineTo(-s * 0.25, hy - hr * 1.35);
        ctx.stroke();
        ctx.fillStyle = Math.sin(time * 2.5) > 0 ? '#ef8a7a' : '#7d4a5a';
        ctx.beginPath();
        ctx.arc(-s * 0.25, hy - hr * 1.38, s * 0.045, 0, TAU);
        ctx.fill();
        ctx.fillStyle = white;
        ctx.beginPath();
        ctx.arc(0, hy, hr, 0, TAU);
        ctx.fill();
        ctx.fillStyle = shade;
        ctx.beginPath();
        ctx.arc(0, hy, hr, 0.2 * Math.PI, 0.9 * Math.PI);
        ctx.fill();
        ctx.fillStyle = white;
        ctx.beginPath();
        ctx.arc(0, hy - hr * 0.06, hr * 0.96, 0, TAU);
        ctx.fill();
        // visor shifts around the helmet as the head turns
        const vx = lx * hr * 0.38, vy = ly * hr * 0.25;
        const vw = hr * (0.72 - Math.max(0, -lx) * 0.25), vh = hr * 0.58;
        const vg = ctx.createLinearGradient(vx - vw, hy + vy - vh, vx + vw, hy + vy + vh);
        vg.addColorStop(0, '#2a2f6a');
        vg.addColorStop(0.6, '#3d2d6e');
        vg.addColorStop(1, '#c0717f');
        ctx.fillStyle = vg;
        ctx.beginPath();
        ctx.ellipse(vx, hy + vy, vw, vh, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = s * 0.04;
        ctx.beginPath();
        ctx.ellipse(vx, hy + vy, vw * 0.72, vh * 0.68, 0, Math.PI * 1.1, Math.PI * 1.45);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath();
        ctx.arc(vx + vw * 0.35, hy + vy - vh * 0.35, s * 0.03, 0, TAU);
        ctx.fill();
        ctx.restore();

        ctx.restore();
      }

      // little stars that trail the cursor
      const sparkles = [];
      function drawSparkles(dt) {
        if (input.active && !input.overUi && input.speed > 40 && sparkles.length < 120 && Math.random() < Math.min(1, input.speed / 600)) {
          sparkles.push({ x: input.x + rand(-6, 6), y: input.y + rand(-6, 6), vx: rand(-15, 15), vy: rand(5, 30), age: 0, life: rand(0.6, 1.2), r: rand(2, 4.5), rot: rand(TAU) });
        }
        const col = planet().accent;
        for (let i = sparkles.length - 1; i >= 0; i--) {
          const p = sparkles[i];
          p.age += dt;
          if (p.age > p.life) { sparkles.splice(i, 1); continue; }
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          const a = 1 - p.age / p.life, r = p.r * a;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot + p.age * 2);
          ctx.globalAlpha = a;
          ctx.fillStyle = p.age < 0.15 ? '#fff' : col;
          ctx.beginPath();
          ctx.moveTo(0, -r);
          ctx.quadraticCurveTo(r * 0.2, -r * 0.2, r, 0);
          ctx.quadraticCurveTo(r * 0.2, r * 0.2, 0, r);
          ctx.quadraticCurveTo(-r * 0.2, r * 0.2, -r, 0);
          ctx.quadraticCurveTo(-r * 0.2, -r * 0.2, 0, -r);
          ctx.fill();
          ctx.restore();
        }
        ctx.globalAlpha = 1;
      }

      function roundRect(x, y, rw, rh, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + rw, y, x + rw, y + rh, r);
        ctx.arcTo(x + rw, y + rh, x, y + rh, r);
        ctx.arcTo(x, y + rh, x, y, r);
        ctx.arcTo(x, y, x + rw, y, r);
        ctx.closePath();
      }

      return {
        resize(nw, nh) {
          w = nw; h = nh;
          layout();
        },
        frame(dt, t) {
          time = t;
          mood = env.mood(0, 0);
          drawSky();
          drawMeteors(dt);
          drawPlanet();
          drawHills();
          drawSpores(dt);
          drawFrontHill();
          drawAstronaut(dt);
          drawSparkles(dt);
        },
        onPointerDown(x, y) {
          launch(x, y);
          astro.gazeUntil = time + 2.5;
        },
      };
    },
  });
})();
