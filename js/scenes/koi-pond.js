/* Koi Pond — soft watercolour, top-down. Koi glide under lily pads while sakura petals fall.
   Mouse: koi drift toward a resting cursor, scatter from fast movement; click to drop food. */
(function () {
  const W = window.Lumevale;
  const U = W.util;
  const { TAU, rand, lerp, clamp } = U;

  const VARIETIES = {
    kohaku: { base: '#f4efe6', spots: ['#e2572f', '#e86a3c'] },
    sanke: { base: '#f6f1e8', spots: ['#e0532c', '#2a2626'] },
    ogon: { base: '#f2b544', spots: ['#f6cf6a'] },
    showa: { base: '#2b2728', spots: ['#e2582e', '#f3eee6'] },
    tancho: { base: '#f5f0e7', spots: [], head: '#de3d2b' },
    orange: { base: '#ee7a35', spots: ['#f7a45a'] },
    asagi: { base: '#8aa0b4', spots: ['#e8823e'] },
    karasu: { base: '#262326', spots: ['#3b3538'] },
    platinum: { base: '#ebe6dc', spots: ['#f4ead0'] },
  };
  const SCHOOLS = {
    mixed: ['kohaku', 'sanke', 'ogon', 'showa', 'tancho', 'orange', 'asagi'],
    kohaku: ['kohaku', 'tancho', 'kohaku', 'sanke'],
    gold: ['ogon', 'orange', 'ogon', 'platinum'],
    ink: ['showa', 'karasu', 'sanke', 'karasu'],
    ghost: ['platinum', 'tancho', 'asagi', 'platinum'],
  };
  const WATER = {
    jade: { c: ['#2c7a76', '#1c5a5d', '#0d2f36'], blooms: ['60,140,130', '20,70,80', '90,160,140', '30,90,100'], card: 'rgba(14,52,56,0.55)', accent: '#f08a5d' },
    deep: { c: ['#2a5f8a', '#1a3f66', '#0a1c33'], blooms: ['60,110,170', '20,50,90', '90,140,190', '30,70,120'], card: 'rgba(14,34,60,0.55)', accent: '#f2a65a' },
    twilight: { c: ['#4a4a8a', '#2e2d63', '#15142e'], blooms: ['110,100,170', '50,40,100', '140,120,190', '70,60,130'], card: 'rgba(30,28,64,0.55)', accent: '#f3a6b8' },
    moss: { c: ['#5a7a4a', '#3d5a33', '#1c2c18'], blooms: ['110,140,90', '50,80,40', '140,160,100', '70,100,60'], card: 'rgba(30,48,28,0.55)', accent: '#f0b25d' },
    clear: { c: ['#6fa8a0', '#4c8a84', '#25534f'], blooms: ['150,200,190', '80,130,120', '180,210,190', '100,150,140'], card: 'rgba(30,80,76,0.5)', accent: '#ef7f5a' },
  };

  W.registerScene({
    id: 'koi',
    name: 'Koi Pond',
    style: 'Watercolour',
    swatch: ['#123c44', '#2f7a78', '#f08a4b'],
    ambience: 'water',
    type: '2d',
    options: [
      { key: 'water', label: 'Water', type: 'select', default: 'jade', rebuild: true, options: [['jade', 'Jade'], ['deep', 'Deep blue'], ['twilight', 'Twilight'], ['moss', 'Mossy'], ['clear', 'Clear shallows']] },
      { key: 'school', label: 'Koi', type: 'select', default: 'mixed', rebuild: true, options: [['mixed', 'Mixed varieties'], ['kohaku', 'Red & white'], ['gold', 'Gold & orange'], ['ink', 'Ink (black)'], ['ghost', 'Ghost (pale)']] },
      { key: 'count', label: 'Number of koi', type: 'range', min: 2, max: 18, step: 1, default: 8 },
      { key: 'falling', label: 'Falling', type: 'select', default: 'sakura', options: [['sakura', 'Sakura petals'], ['maple', 'Maple leaves'], ['none', 'Nothing']] },
      { key: 'pads', label: 'Lily pads', type: 'range', min: 0, max: 2, step: 0.1, default: 1, rebuild: true },
      { key: 'lotus', label: 'Lotus flowers', type: 'toggle', default: true },
    ],
    theme: (o) => {
      const wt = WATER[o.water] || WATER.jade;
      return {
        font: "'Shippori Mincho', 'Cormorant Garamond', serif",
        clockWeight: 400,
        text: '#f6f1e7',
        dim: 'rgba(246,241,231,0.68)',
        accent: wt.accent,
        card: wt.card,
        border: '1px solid rgba(246,241,231,0.18)',
        radius: '20px',
        shadow: '0 10px 30px rgba(0,20,25,0.35)',
        blur: '14px',
        textShadow: '0 2px 14px rgba(0,25,30,0.55)',
        cursor: {
          svg: W.theme.dotSvg('#f6f1e7', 'rgba(10,40,40,0.55)', 3.5, 20), hot: [10, 10],
          ring: { size: 40, border: '1.5px solid rgba(246,241,231,0.6)', shadow: '0 0 12px rgba(246,241,231,0.25)' },
        },
      };
    },

    create({ ctx, input, env, opts }) {
      let w = 1, h = 1, time = 0;
      let bg = null, paper = null, paperPattern = null;
      let koi = [], pads = [], petals = [], ripples = [], food = [], lights = [];
      const noise = U.makeNoise();
      let nextPetal = 0;
      let mood = { day: 1, dusk: 0 };

      // ---------- painted background ----------
      function paintBackground() {
        const water = WATER[opts.water] || WATER.jade;
        const s = 0.25; // paint small, upscale smooth for soft watercolour blooms
        const c = U.canvas(w * s, h * s);
        const g = c.getContext('2d');
        const grd = g.createRadialGradient(c.width * 0.5, c.height * 0.45, 0, c.width * 0.5, c.height * 0.5, Math.max(c.width, c.height) * 0.75);
        grd.addColorStop(0, water.c[0]);
        grd.addColorStop(0.55, water.c[1]);
        grd.addColorStop(1, water.c[2]);
        g.fillStyle = grd;
        g.fillRect(0, 0, c.width, c.height);
        // pebbles on the floor
        for (let i = 0; i < (c.width * c.height) / 90; i++) {
          const x = rand(c.width), y = rand(c.height), r = rand(1.5, 5);
          g.fillStyle = U.choice(['rgba(150,190,170,0.10)', 'rgba(20,50,55,0.18)', 'rgba(200,210,180,0.07)']);
          g.beginPath();
          g.ellipse(x, y, r * rand(1, 1.6), r, rand(TAU), 0, TAU);
          g.fill();
        }
        // watercolour blooms
        for (let i = 0; i < 40; i++) {
          const x = rand(c.width), y = rand(c.height), r = rand(20, 90);
          const b = g.createRadialGradient(x, y, 0, x, y, r);
          const col = U.choice(water.blooms);
          b.addColorStop(0, `rgba(${col},0.16)`);
          b.addColorStop(0.7, `rgba(${col},0.08)`);
          b.addColorStop(1, `rgba(${col},0)`);
          g.fillStyle = b;
          g.fillRect(x - r, y - r, r * 2, r * 2);
        }
        bg = U.canvas(w, h);
        const bgc = bg.getContext('2d');
        bgc.filter = 'blur(2px)';
        bgc.drawImage(c, 0, 0, w, h);
        bgc.filter = 'none';
        // dark banks around the edges
        const v = bgc.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.72);
        v.addColorStop(0, 'rgba(5,20,25,0)');
        v.addColorStop(1, 'rgba(5,20,25,0.6)');
        bgc.fillStyle = v;
        bgc.fillRect(0, 0, w, h);

        // paper texture for the watercolour feel
        paper = U.canvas(256, 256);
        const pg = paper.getContext('2d');
        const img = pg.createImageData(256, 256);
        for (let y = 0; y < 256; y++) {
          for (let x = 0; x < 256; x++) {
            const n = noise.fbm2(x / 18, y / 18, 3) * 0.5 + Math.random() * 0.5;
            const i = (y * 256 + x) * 4;
            img.data[i] = img.data[i + 1] = img.data[i + 2] = 128 + n * 90;
            img.data[i + 3] = 255;
          }
        }
        pg.putImageData(img, 0, 0);
      }

      // ---------- koi ----------
      function makeKoi(i) {
        const size = rand(0.85, 1.25) * clamp(Math.min(w, h) / 900, 0.6, 1.4) * 110;
        const school = SCHOOLS[opts.school] || SCHOOLS.mixed;
        const v = VARIETIES[school[i % school.length]];
        const n = 14;
        const x = rand(w * 0.15, w * 0.85), y = rand(h * 0.15, h * 0.85), a = rand(TAU);
        const seg = size / n;
        const pts = [];
        for (let k = 0; k < n; k++) pts.push({ x: x - Math.cos(a) * seg * k, y: y - Math.sin(a) * seg * k });
        const spots = [];
        v.spots.forEach((col) => {
          const count = U.randInt(2, 4);
          for (let s = 0; s < count; s++) spots.push({ u: rand(0.08, 0.75), side: rand(-0.7, 0.7), r: rand(0.18, 0.42), col });
        });
        return {
          pts, seg, size, v, spots, fade: 0, leaving: false,
          a, speed: rand(0.45, 0.7), turn: 0,
          seed: rand(100), phase: rand(TAU), flee: 0,
        };
      }

      function width(u, size) {
        // body profile along the spine (u: 0 head → 1 tail)
        return size * 0.2 * Math.pow(Math.sin(Math.PI * clamp(u * 0.92 + 0.07, 0, 1)), 0.9) * (1 - u * 0.55);
      }

      function steer(f, dt) {
        const head = f.pts[0];
        let dx = Math.cos(f.a), dy = Math.sin(f.a);
        // wander
        const wa = noise.n1(time * 0.15 + f.seed) * 2.2;
        let tx = Math.cos(f.a + wa) * 1, ty = Math.sin(f.a + wa) * 1;
        // stay inside pond
        const m = Math.min(w, h) * 0.12;
        if (head.x < m) tx += (m - head.x) / m * 2.5;
        if (head.x > w - m) tx -= (head.x - (w - m)) / m * 2.5;
        if (head.y < m) ty += (m - head.y) / m * 2.5;
        if (head.y > h - m) ty -= (head.y - (h - m)) / m * 2.5;
        // separation
        for (const o of koi) {
          if (o === f) continue;
          const ox = head.x - o.pts[3].x, oy = head.y - o.pts[3].y, d = Math.hypot(ox, oy);
          if (d < f.size * 0.9 && d > 0) { tx += (ox / d) * 0.8; ty += (oy / d) * 0.8; }
        }
        // food
        let hungry = 0;
        let best = null, bestD = Infinity;
        for (const p of food) {
          const d = Math.hypot(p.x - head.x, p.y - head.y);
          if (d < bestD) { bestD = d; best = p; }
        }
        if (best && bestD < Math.max(w, h) * 0.6) {
          tx += ((best.x - head.x) / bestD) * 3;
          ty += ((best.y - head.y) / bestD) * 3;
          hungry = 1;
          if (bestD < f.size * 0.18) {
            food.splice(food.indexOf(best), 1);
            ripple(best.x, best.y, 0.6);
          }
        }
        // cursor: curious when still, scatter when fast
        if (input.active) {
          const cx = input.x - head.x, cy = input.y - head.y, d = Math.hypot(cx, cy) || 1;
          if (input.speed > 900 && d < 260) f.flee = 1.2;
          if (f.flee > 0) { tx -= (cx / d) * 3.5; ty -= (cy / d) * 3.5; }
          else if (d < 380 && d > f.size * 0.4) { tx += (cx / d) * 0.6; ty += (cy / d) * 0.6; }
        }
        f.flee = Math.max(0, f.flee - dt);
        const desired = Math.atan2(ty, tx);
        const maxTurn = (hungry || f.flee ? 2.4 : 1.1) * dt;
        const diff = clamp(U.angleDiff(f.a, desired), -maxTurn, maxTurn);
        f.turn = lerp(f.turn, diff / Math.max(dt, 1e-4), 0.1);
        f.a += diff;
        const targetSpeed = f.speed * (hungry ? 1.8 : 1) * (f.flee > 0 ? 2.6 : 1);
        f.curSpeed = U.damp(f.curSpeed || f.speed, targetSpeed, 2, dt);
        // undulation: steer the head side to side so the chain ripples
        const wig = Math.sin(time * (3 + f.curSpeed * 3) + f.phase) * 0.35 * dt * (1 + f.curSpeed);
        f.a += wig;
        const v = f.curSpeed * f.size * 0.9;
        head.x += Math.cos(f.a) * v * dt;
        head.y += Math.sin(f.a) * v * dt;
        for (let k = 1; k < f.pts.length; k++) {
          const p = f.pts[k], q = f.pts[k - 1];
          const ddx = p.x - q.x, ddy = p.y - q.y, d = Math.hypot(ddx, ddy) || 1;
          p.x = q.x + (ddx / d) * f.seg;
          p.y = q.y + (ddy / d) * f.seg;
        }
        return [dx, dy];
      }

      function bodyPath(f, g, scale = 1) {
        const n = f.pts.length, left = [], right = [];
        for (let k = 0; k < n; k++) {
          const p = f.pts[k];
          const q = f.pts[Math.min(k + 1, n - 1)], r = f.pts[Math.max(k - 1, 0)];
          const ang = Math.atan2(r.y - q.y, r.x - q.x);
          const wd = width(k / (n - 1), f.size) * scale;
          const nx = -Math.sin(ang) * wd, ny = Math.cos(ang) * wd;
          left.push([p.x + nx, p.y + ny]);
          right.push([p.x - nx, p.y - ny]);
        }
        // rounded nose
        const h0 = f.pts[0], h1 = f.pts[1];
        const ha = Math.atan2(h0.y - h1.y, h0.x - h1.x);
        const nose = [h0.x + Math.cos(ha) * f.size * 0.07, h0.y + Math.sin(ha) * f.size * 0.07];
        const pts = [nose, ...left, ...right.reverse()];
        g.beginPath();
        g.moveTo((pts[0][0] + pts[pts.length - 1][0]) / 2, (pts[0][1] + pts[pts.length - 1][1]) / 2);
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i], b = pts[(i + 1) % pts.length];
          g.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
        }
        g.closePath();
      }

      function along(f, u, side) {
        const n = f.pts.length - 1, fi = u * n, k = Math.min(Math.floor(fi), n - 1), t = fi - k;
        const p = f.pts[k], q = f.pts[k + 1];
        const x = lerp(p.x, q.x, t), y = lerp(p.y, q.y, t);
        const ang = Math.atan2(p.y - q.y, p.x - q.x);
        const wd = width(u, f.size) * side;
        return [x - Math.sin(ang) * wd, y + Math.cos(ang) * wd, ang];
      }

      function drawFins(f, g, color) {
        const n = f.pts.length;
        const tail = f.pts[n - 1], pre = f.pts[n - 3];
        const ta = Math.atan2(tail.y - pre.y, tail.x - pre.x);
        const flutter = Math.sin(time * 5 + f.phase) * 0.35 - f.turn * 0.15;
        const len = f.size * 0.32;
        g.fillStyle = color;
        g.beginPath();
        g.moveTo(tail.x, tail.y);
        const a1 = ta + 0.55 + flutter, a2 = ta - 0.55 + flutter;
        g.quadraticCurveTo(tail.x + Math.cos(ta + 0.25 + flutter) * len * 0.6, tail.y + Math.sin(ta + 0.25 + flutter) * len * 0.6,
          tail.x + Math.cos(a1) * len, tail.y + Math.sin(a1) * len);
        g.quadraticCurveTo(tail.x + Math.cos(ta + flutter) * len * 0.55, tail.y + Math.sin(ta + flutter) * len * 0.55,
          tail.x + Math.cos(a2) * len, tail.y + Math.sin(a2) * len);
        g.quadraticCurveTo(tail.x + Math.cos(ta - 0.25 + flutter) * len * 0.6, tail.y + Math.sin(ta - 0.25 + flutter) * len * 0.6, tail.x, tail.y);
        g.fill();
        // pectoral fins
        const flap = Math.sin(time * 4 + f.phase) * 0.3;
        [-1, 1].forEach((side) => {
          const [x, y, ang] = along(f, 0.22, side * 0.9);
          const fa = ang + Math.PI + side * (0.9 + flap);
          g.beginPath();
          g.ellipse(x + Math.cos(fa) * f.size * 0.06, y + Math.sin(fa) * f.size * 0.06, f.size * 0.09, f.size * 0.04, fa, 0, TAU);
          g.fill();
        });
      }

      function drawKoi(f) {
        const g = ctx;
        // shadow on the pond floor
        g.save();
        g.translate(f.size * 0.18, f.size * 0.24);
        g.fillStyle = `rgba(4,22,26,${0.28 * f.fade})`;
        bodyPath(f, g, 1.05);
        g.fill();
        g.restore();

        g.globalAlpha = 0.92 * f.fade;
        drawFins(f, g, f.v.base === '#2b2728' ? 'rgba(60,55,58,0.55)' : 'rgba(255,245,235,0.42)');
        bodyPath(f, g);
        g.fillStyle = f.v.base;
        g.fill();
        g.save();
        bodyPath(f, g);
        g.clip();
        for (const s of f.spots) {
          const [x, y] = along(f, s.u, s.side);
          g.fillStyle = s.col;
          g.beginPath();
          g.ellipse(x, y, f.size * s.r * 0.3, f.size * s.r * 0.2, along(f, s.u, 0)[2], 0, TAU);
          g.fill();
        }
        if (f.v.head) {
          const [x, y] = along(f, 0.1, 0);
          g.fillStyle = f.v.head;
          g.beginPath();
          g.arc(x, y, f.size * 0.07, 0, TAU);
          g.fill();
        }
        // soft back highlight
        g.strokeStyle = 'rgba(255,255,255,0.22)';
        g.lineWidth = f.size * 0.035;
        g.lineCap = 'round';
        g.beginPath();
        for (let k = 1; k < f.pts.length - 4; k++) {
          const p = f.pts[k];
          k === 1 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y);
        }
        g.stroke();
        g.restore();
        // eyes
        g.fillStyle = `rgba(20,20,25,${0.8 * f.fade})`;
        [-0.55, 0.55].forEach((side) => {
          const [x, y] = along(f, 0.06, side);
          g.beginPath();
          g.arc(x, y, f.size * 0.012 + 0.6, 0, TAU);
          g.fill();
        });
        g.globalAlpha = 1;
      }

      // ---------- lily pads, petals, ripples ----------
      function makePads() {
        pads = [];
        const count = Math.round(clamp((w * h) / 140000, 5, 14) * opts.pads);
        for (let i = 0; i < count; i++) {
          const cluster = i % 3 === 0 || pads.length === 0 ? null : pads[pads.length - 1];
          const r = rand(28, 62) * clamp(Math.min(w, h) / 900, 0.6, 1.3);
          pads.push({
            x: cluster ? cluster.x + rand(-1, 1) * r * 2.2 : rand(w * 0.05, w * 0.95),
            y: cluster ? cluster.y + rand(-1, 1) * r * 2.2 : rand(h * 0.05, h * 0.95),
            r, rot: rand(TAU), notch: rand(0.25, 0.45), seed: rand(100),
            flower: Math.random() < 0.3,
            hue: rand(-8, 8),
          });
        }
      }

      function drawPad(p) {
        const g = ctx;
        const bob = noise.n1(time * 0.2 + p.seed);
        const x = p.x + bob * 4, y = p.y + noise.n1(time * 0.17 + p.seed + 50) * 4;
        const rot = p.rot + bob * 0.15;
        g.save();
        g.translate(x, y);
        g.rotate(rot);
        g.fillStyle = 'rgba(4,22,26,0.3)';
        g.beginPath();
        g.moveTo(p.r * 0.12, p.r * 0.16);
        g.arc(p.r * 0.12, p.r * 0.16, p.r, p.notch / 2, TAU - p.notch / 2);
        g.closePath();
        g.fill();
        const grd = g.createRadialGradient(-p.r * 0.2, -p.r * 0.2, p.r * 0.1, 0, 0, p.r);
        grd.addColorStop(0, `hsl(${100 + p.hue}, 38%, 46%)`);
        grd.addColorStop(1, `hsl(${120 + p.hue}, 42%, 30%)`);
        g.fillStyle = grd;
        g.beginPath();
        g.moveTo(0, 0);
        g.arc(0, 0, p.r, p.notch / 2, TAU - p.notch / 2);
        g.closePath();
        g.fill();
        g.strokeStyle = 'rgba(200,230,170,0.25)';
        g.lineWidth = 1;
        for (let k = 0; k < 9; k++) {
          const a = p.notch / 2 + ((TAU - p.notch) * (k + 0.5)) / 9;
          g.beginPath();
          g.moveTo(0, 0);
          g.lineTo(Math.cos(a) * p.r * 0.88, Math.sin(a) * p.r * 0.88);
          g.stroke();
        }
        g.strokeStyle = 'rgba(230,250,200,0.18)';
        g.lineWidth = 1.5;
        g.beginPath();
        g.arc(0, 0, p.r - 1, p.notch / 2 + 0.05, TAU - p.notch / 2 - 0.05);
        g.stroke();
        if (p.flower && opts.lotus) drawLotus(g, p.r * 0.1, p.r * -0.05, p.r * 0.42);
        g.restore();
      }

      function drawLotus(g, x, y, r) {
        g.save();
        g.translate(x, y);
        for (let layer = 0; layer < 3; layer++) {
          const n = 8 - layer * 2, lr = r * (1 - layer * 0.28);
          for (let k = 0; k < n; k++) {
            const a = (k / n) * TAU + layer * 0.4 + time * 0.02;
            g.save();
            g.rotate(a);
            const grd = g.createLinearGradient(0, 0, lr, 0);
            grd.addColorStop(0, '#fff3f4');
            grd.addColorStop(1, layer === 0 ? '#f19ab1' : '#f7c1cf');
            g.fillStyle = grd;
            g.beginPath();
            g.ellipse(lr * 0.5, 0, lr * 0.5, lr * 0.2, 0, 0, TAU);
            g.fill();
            g.restore();
          }
        }
        g.fillStyle = '#f5d060';
        g.beginPath();
        g.arc(0, 0, r * 0.14, 0, TAU);
        g.fill();
        g.restore();
      }

      function ripple(x, y, strength = 1) {
        ripples.push({ x, y, age: 0, life: 3.2 * strength + 1, max: 70 * strength + 20 });
      }

      function spawnPetal() {
        const fromLeft = Math.random() < 0.6;
        petals.push({
          x: fromLeft ? rand(-40, w * 0.6) : rand(w * 0.4, w + 40),
          y: rand(-60, -10),
          vx: rand(10, 35), vy: rand(22, 40),
          rot: rand(TAU), spin: rand(-1.5, 1.5), tumble: rand(TAU),
          size: rand(6, 11), landAt: rand(h * 0.15, h * 0.95),
          landed: false, age: 0, life: rand(18, 30), hue: rand(340, 355),
          maple: opts.falling === 'maple',
        });
        const p = petals[petals.length - 1];
        if (p.maple) { p.hue = rand(8, 38); p.size *= 1.5; }
      }

      function drawPetal(p) {
        const g = ctx;
        const alpha = p.landed ? clamp((p.life - p.age) / 4, 0, 1) : 1;
        const sx = p.landed ? 1 : 0.35 + 0.65 * Math.abs(Math.sin(p.tumble));
        const lift = p.landed ? 0 : 6;
        g.save();
        g.translate(p.x + lift, p.y + lift);
        g.rotate(p.rot);
        g.scale(sx, 1);
        g.globalAlpha = alpha * 0.25;
        g.fillStyle = '#04161a';
        g.beginPath();
        g.ellipse(lift * 0.6, lift * 0.6, p.size * 0.55, p.size, 0, 0, TAU);
        g.fill();
        g.globalAlpha = alpha * 0.95;
        g.translate(-lift, -lift);
        if (p.maple) {
          drawMaple(g, p);
          g.restore();
          g.globalAlpha = 1;
          return;
        }
        g.fillStyle = `hsl(${p.hue}, 75%, 88%)`;
        g.beginPath();
        g.moveTo(0, -p.size);
        g.bezierCurveTo(p.size * 0.75, -p.size * 0.6, p.size * 0.6, p.size * 0.7, 0, p.size);
        g.bezierCurveTo(-p.size * 0.6, p.size * 0.7, -p.size * 0.75, -p.size * 0.6, 0, -p.size);
        g.fill();
        g.fillStyle = `hsl(${p.hue}, 70%, 78%)`;
        g.beginPath();
        g.ellipse(0, p.size * 0.5, p.size * 0.18, p.size * 0.35, 0, 0, TAU);
        g.fill();
        g.restore();
        g.globalAlpha = 1;
      }

      function drawMaple(g, p) {
        // five-lobed leaf with a little stem
        const r = p.size;
        g.fillStyle = `hsl(${p.hue}, 78%, ${48 + (p.hue % 10)}%)`;
        g.beginPath();
        for (let k = 0; k <= 10; k++) {
          const a = -Math.PI / 2 + (k / 10) * TAU;
          const rr = k % 2 === 0 ? r : r * 0.42;
          const lobe = k % 2 === 0 && (k === 4 || k === 6) ? 0.75 : 1;
          k === 0 ? g.moveTo(Math.cos(a) * rr * lobe, Math.sin(a) * rr * lobe) : g.lineTo(Math.cos(a) * rr * lobe, Math.sin(a) * rr * lobe);
        }
        g.closePath();
        g.fill();
        g.strokeStyle = `hsla(${p.hue}, 60%, 30%, 0.6)`;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(0, r * 0.2);
        g.lineTo(0, r * 1.1);
        g.stroke();
      }

      function init() {
        paintBackground();
        koi = [];
        for (let i = 0; i < opts.count; i++) koi.push(Object.assign(makeKoi(i), { fade: 1 }));
        makePads();
        petals = [];
        for (let i = 0; i < 10; i++) {
          spawnPetal();
          const p = petals[petals.length - 1];
          p.x = rand(w); p.y = rand(h); p.landed = true; p.age = rand(0, 10);
        }
        lights = [];
        for (let i = 0; i < 6; i++) lights.push({ seed: rand(100), r: rand(0.25, 0.5) * Math.max(w, h) });
      }

      return {
        resize(nw, nh) {
          const first = !bg;
          w = nw; h = nh;
          if (first) init();
          else {
            // keep the fish swimming; just repaint for the new size
            paintBackground();
            makePads();
            paperPattern = null;
          }
        },
        frame(dt, t) {
          time = t;
          mood = env.mood(1, 0);
          const g = ctx;
          g.drawImage(bg, 0, 0, w, h);

          // drifting caustic light
          g.globalCompositeOperation = 'screen';
          for (const l of lights) {
            const x = (0.5 + noise.n1(time * 0.03 + l.seed) * 0.9) * w;
            const y = (0.5 + noise.n1(time * 0.025 + l.seed + 20) * 0.9) * h;
            const grd = g.createRadialGradient(x, y, 0, x, y, l.r);
            grd.addColorStop(0, 'rgba(120,200,180,0.10)');
            grd.addColorStop(1, 'rgba(120,200,180,0)');
            g.fillStyle = grd;
            g.fillRect(x - l.r, y - l.r, l.r * 2, l.r * 2);
          }
          g.globalCompositeOperation = 'source-over';

          // food pellets sink slowly
          for (let i = food.length - 1; i >= 0; i--) {
            const p = food[i];
            p.age += dt;
            if (p.age > 25) { food.splice(i, 1); continue; }
            g.fillStyle = `rgba(150,95,50,${0.9 - p.age / 30})`;
            g.beginPath();
            g.arc(p.x + Math.sin(p.age + p.seed) * 2, p.y, 3, 0, TAU);
            g.fill();
          }

          // koi count follows the slider; extras fade in and out instead of popping
          const alive = koi.filter((f) => !f.leaving);
          if (alive.length < opts.count) koi.push(makeKoi(koi.length));
          else if (alive.length > opts.count) alive[alive.length - 1].leaving = true;
          for (let i = koi.length - 1; i >= 0; i--) {
            const f = koi[i];
            f.fade = U.damp(f.fade, f.leaving ? 0 : 1, 1.5, dt || 0.016);
            if (f.leaving && f.fade < 0.02) { koi.splice(i, 1); continue; }
            steer(f, dt);
            drawKoi(f);
          }

          // ripples on the surface
          for (let i = ripples.length - 1; i >= 0; i--) {
            const r = ripples[i];
            r.age += dt;
            const k = r.age / r.life;
            if (k >= 1) { ripples.splice(i, 1); continue; }
            for (let j = 0; j < 3; j++) {
              const kk = k - j * 0.12;
              if (kk <= 0) continue;
              g.strokeStyle = `rgba(220,245,240,${0.35 * (1 - kk) * (1 - j * 0.3)})`;
              g.lineWidth = 1.5;
              g.beginPath();
              g.ellipse(r.x, r.y, r.max * kk, r.max * kk * 0.92, 0, 0, TAU);
              g.stroke();
            }
          }

          for (const p of pads) drawPad(p);

          // petals
          if (time > nextPetal) {
            nextPetal = time + rand(0.8, 2.4);
            if (petals.length < 70 && opts.falling !== 'none') spawnPetal();
          }
          for (let i = petals.length - 1; i >= 0; i--) {
            const p = petals[i];
            p.age += dt;
            if (!p.landed) {
              const gust = noise.n1(time * 0.3 + p.size) * 15;
              p.x += (p.vx + gust + (input.active ? input.vx * 0.02 : 0)) * dt;
              p.y += (p.vy + (input.active ? input.vy * 0.02 : 0)) * dt;
              p.rot += p.spin * dt;
              p.tumble += dt * 2.5;
              if (p.y > p.landAt) {
                p.landed = true;
                p.age = 0;
                ripple(p.x, p.y, 0.35);
              }
            } else {
              p.x += noise.n1(time * 0.1 + p.size * 3) * 6 * dt;
              p.y += noise.n1(time * 0.1 + p.size * 7) * 6 * dt;
              p.rot += p.spin * 0.05 * dt;
            }
            if ((p.landed && p.age > p.life) || p.x > w + 60 || p.x < -80) petals.splice(i, 1);
            else drawPetal(p);
          }

          // cursor wake on the surface
          if (input.active && input.speed > 250 && Math.random() < dt * 8) ripple(input.x, input.y, 0.3);

          // overhanging branch shadow drifting in one corner
          g.save();
          g.globalCompositeOperation = 'multiply';
          for (let k = 0; k < 7; k++) {
            const bx = w * 0.95 + noise.n1(time * 0.15 + k) * 30 - k * 40;
            const by = h * 0.04 + noise.n1(time * 0.12 + k * 3) * 20 + k * 22;
            const br = 60 + (k % 3) * 25;
            const grd = g.createRadialGradient(bx, by, 0, bx, by, br);
            grd.addColorStop(0, 'rgba(10,40,40,0.35)');
            grd.addColorStop(1, 'rgba(10,40,40,0)');
            g.fillStyle = grd;
            g.fillRect(bx - br, by - br, br * 2, br * 2);
          }
          g.restore();

          // time of day tint
          const night = 1 - mood.day;
          if (night > 0.02) {
            g.fillStyle = `rgba(8,14,40,${night * 0.5})`;
            g.fillRect(0, 0, w, h);
          }
          if (mood.dusk > 0.02) {
            g.fillStyle = `rgba(255,140,80,${mood.dusk * 0.12})`;
            g.fillRect(0, 0, w, h);
          }

          // paper grain
          g.globalCompositeOperation = 'overlay';
          g.globalAlpha = 0.14;
          paperPattern = paperPattern || g.createPattern(paper, 'repeat');
          g.fillStyle = paperPattern;
          g.fillRect(0, 0, w, h);
          g.globalAlpha = 1;
          g.globalCompositeOperation = 'source-over';
        },
        onPointerDown(x, y) {
          ripple(x, y, 1);
          for (let i = 0; i < 6; i++) food.push({ x: x + rand(-18, 18), y: y + rand(-18, 18), age: 0, seed: rand(6) });
        },
      };
    },
  });
})();
