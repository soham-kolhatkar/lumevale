/* Pendulum Wave — soft 3D studio. A row of pendulums, each a little shorter than the last, slides out of step
   into snakes and braids, then lines up again once per cycle. Every ball rings a note at the near end of its swing.
   Mouse: grab a ball, pull it and let go; swipe across the strings to pluck them; click empty space to gather
   every ball and release them together. Knocked-out balls ease back into the wave. */
(function () {
  const W = window.Lumevale;
  const U = W.util;
  const { TAU, clamp, lerp, smoothstep } = U;

  // Ball colours run along the row, longest pendulum first.
  const PALETTES = {
    pastel: { stops: ['#ff9aa2', '#ffc89a', '#fbe38e', '#a8e6b5', '#9ad3f0', '#b9a7f2'], accent: '#ff8f9c' },
    candy: { stops: ['#ff6fa8', '#ff9f80', '#ffd36e'], accent: '#ff6fa8' },
    ocean: { stops: ['#3dd6c6', '#3a8dff', '#7b5cf0'], accent: '#3a8dff' },
    sunset: { stops: ['#ffc23d', '#ff6b35', '#ff2e7e', '#8f4dff'], accent: '#ff6b35' },
    chrome: { stops: ['#e9edf3', '#c6ceda'], accent: '#9aa8bd', metal: true },
    brass: { stops: ['#f6d58a', '#d6a24c'], accent: '#d6a24c', metal: true },
  };

  // Studio blends between day and night with the time of day; midnight is always dark, with glowing balls.
  const ROOMS = {
    day: { wall: ['#f5f0e9', '#e8dfd3'], floor: ['#e0d5c6', '#cdbfac'], wood: '#b4875c', string: [70, 56, 46, 0.5], spot: [255, 252, 245, 0.35], shadow: 0.2 },
    night: { wall: ['#262b3b', '#1b1f2c'], floor: ['#1c1f2b', '#11131b'], wood: '#5a4636', string: [210, 215, 235, 0.32], spot: [140, 150, 200, 0.08], shadow: 0.32 },
    midnight: { wall: ['#0b0c16', '#07080e'], floor: ['#0c0d18', '#040509'], wood: '#23263a', string: [170, 180, 255, 0.22], spot: [120, 130, 255, 0.07], shadow: 0.4 },
  };
  const RGB = {};
  for (const [k, r] of Object.entries(ROOMS)) {
    RGB[k] = { wall: r.wall.map(U.hex), floor: r.floor.map(U.hex), wood: U.hex(r.wood), string: r.string, spot: r.spot, shadow: r.shadow };
  }

  const isDark = (o) => o.room === 'midnight' || W.env.mood(1, 0).day < 0.5;

  // A minor pentatonic from A3: long, slow pendulums ring low, short ones high.
  const PENTA = [0, 3, 5, 7, 10];
  function noteFor(i, n) {
    const j = Math.round((i * Math.min(n - 1, 13)) / (n - 1));
    return 57 + 12 * Math.floor(j / 5) + PENTA[j % 5];
  }

  function rowColour(stops, k) {
    const f = k * (stops.length - 1), j = Math.min(stops.length - 2, Math.floor(f));
    return U.mixRgb(U.hex(stops[j]), U.hex(stops[j + 1]), f - j);
  }

  // Glossy ball, lit from the top left, with a little bounce light from the floor.
  function ballSprite(rgb, metal) {
    const S = 128, R = S / 2 - 1, c = U.canvas(S, S), g = c.getContext('2d');
    const lite = U.rgb(U.mixRgb(rgb, [255, 255, 255], 0.55));
    const dark = U.rgb(U.mixRgb(rgb, [20, 14, 30], 0.45));
    g.beginPath();
    g.arc(S / 2, S / 2, R, 0, TAU);
    if (metal) {
      // a mirror ball: bright sky above, dark horizon band, warm floor below
      const lin = g.createLinearGradient(0, 0, 0, S);
      lin.addColorStop(0, '#ffffff');
      lin.addColorStop(0.3, lite);
      lin.addColorStop(0.5, dark);
      lin.addColorStop(0.57, U.rgb(rgb));
      lin.addColorStop(0.86, lite);
      lin.addColorStop(1, U.rgb(rgb));
      g.fillStyle = lin;
    } else {
      const grd = g.createRadialGradient(S * 0.38, S * 0.34, S * 0.03, S * 0.5, S * 0.5, R);
      grd.addColorStop(0, lite);
      grd.addColorStop(0.45, U.rgb(rgb));
      grd.addColorStop(0.88, dark);
      grd.addColorStop(1, U.rgb(U.mixRgb(rgb, [10, 6, 20], 0.7)));
      g.fillStyle = grd;
    }
    g.fill();
    g.globalCompositeOperation = 'source-atop';
    const rim = g.createRadialGradient(S * 0.45, S * 0.42, R * 0.5, S / 2, S / 2, R);
    rim.addColorStop(0, 'rgba(0,0,0,0)');
    rim.addColorStop(1, 'rgba(10,5,20,0.35)');
    g.fillStyle = rim;
    g.fillRect(0, 0, S, S);
    const bounce = g.createRadialGradient(S * 0.6, S * 0.86, 0, S * 0.6, S * 0.86, R * 0.6);
    bounce.addColorStop(0, 'rgba(255,255,255,0.22)');
    bounce.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = bounce;
    g.fillRect(0, 0, S, S);
    const hi = g.createRadialGradient(S * 0.36, S * 0.3, 0, S * 0.36, S * 0.3, R * 0.42);
    hi.addColorStop(0, 'rgba(255,255,255,0.95)');
    hi.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    hi.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = hi;
    g.fillRect(0, 0, S, S);
    return c;
  }

  let shadowSprite = null;
  function getShadow() {
    if (shadowSprite) return shadowSprite;
    const S = 64, c = U.canvas(S, S), g = c.getContext('2d');
    const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    grd.addColorStop(0, 'rgba(0,0,0,1)');
    grd.addColorStop(0.5, 'rgba(0,0,0,0.5)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, S, S);
    return (shadowSprite = c);
  }

  // Box faces as corner indices (corner = xi + 2*yi + 4*zi) with their outward normals.
  const FACES = [
    [[0, 0, 1], [4, 5, 7, 6]], [[0, 0, -1], [0, 2, 3, 1]],
    [[0, 1, 0], [2, 6, 7, 3]], [[0, -1, 0], [0, 1, 5, 4]],
    [[1, 0, 0], [1, 3, 7, 5]], [[-1, 0, 0], [0, 4, 6, 2]],
  ];
  const LIGHT = [-0.35, 0.85, 0.4].map((v, _, a) => v / Math.hypot(...a));

  const SCENE = {
    id: 'pendulum',
    name: 'Pendulum Wave',
    style: 'Satisfying · soft 3D',
    swatch: ['#f5f0e9', '#ff9aa2', '#9ad3f0', '#b9a7f2'],
    ambience: 'chimes',
    type: '2d',
    options: [
      { key: 'room', label: 'Room', type: 'select', default: 'studio', options: [['studio', 'Studio'], ['midnight', 'Midnight glow']] },
      { key: 'palette', label: 'Balls', type: 'select', default: 'pastel', options: [['pastel', 'Pastel rainbow'], ['candy', 'Candy'], ['ocean', 'Ocean'], ['sunset', 'Sunset'], ['chrome', 'Chrome'], ['brass', 'Brass']] },
      { key: 'count', label: 'Pendulums', type: 'range', min: 8, max: 30, step: 1, default: 18 },
      { key: 'cycle', label: 'Seconds until they line up', type: 'range', min: 30, max: 180, step: 10, default: 60 },
      { key: 'swing', label: 'Swing', type: 'range', min: 0.5, max: 1.5, step: 0.05, default: 1 },
      { key: 'trails', label: 'Motion trails', type: 'toggle', default: true },
      { key: 'wave', label: 'Trace the wave', type: 'toggle', default: false },
      { key: 'chimes', label: 'Chimes', type: 'select', default: 'swing', options: [['swing', 'Every swing'], ['sync', 'Only when they line up'], ['off', 'Off']] },
    ],
    theme: (o) => {
      const accent = (PALETTES[o.palette] || PALETTES.pastel).accent;
      if (isDark(o)) {
        return {
          font: "'Outfit', system-ui, sans-serif",
          clockWeight: 200,
          text: '#eef0ff',
          dim: 'rgba(225,230,255,0.6)',
          accent,
          card: 'rgba(14,16,30,0.55)',
          border: `1px solid ${accent}40`,
          radius: '22px',
          shadow: `0 14px 40px rgba(0,0,0,0.4), 0 0 24px ${accent}1f`,
          blur: '16px',
          textShadow: `0 0 16px ${accent}55`,
          field: 'rgba(255,255,255,0.07)',
          cursor: {
            svg: W.theme.dotSvg('#ffffff', 'rgba(0,0,0,0.3)', 3, 18), hot: [9, 9],
            ring: { size: 42, border: `1.5px solid ${accent}aa`, shadow: `0 0 14px ${accent}55` },
          },
        };
      }
      return {
        font: "'Outfit', system-ui, sans-serif",
        clockWeight: 300,
        text: '#2d2a32',
        dim: 'rgba(45,42,50,0.6)',
        accent,
        card: 'rgba(255,255,255,0.55)',
        border: '1px solid rgba(255,255,255,0.75)',
        radius: '22px',
        shadow: '0 18px 40px rgba(70,50,30,0.12), 0 2px 6px rgba(70,50,30,0.06)',
        blur: '18px',
        textShadow: 'none',
        field: 'rgba(45,42,50,0.06)',
        cursor: {
          svg: W.theme.dotSvg('#2d2a32', 'rgba(255,255,255,0.8)', 3, 18), hot: [9, 9],
          ring: { size: 42, border: '1.5px solid rgba(45,42,50,0.45)', background: 'rgba(255,255,255,0.15)' },
        },
      };
    },

    create({ canvas, ctx, input, env, opts, thumbnail }) {
      let w = 1, h = 1, time = 0;
      let pends = [], order = [];
      let half, spacing, Lmax, r, yc, yF, backZ, D, cx, cyS, pad, beamH, beamD, postW, va;
      let cyw = 1, syw = 0, cp = 1, sp = 0;
      let clock = 0, gather = null, drag = null, hover = null;
      let trailFade = 1, sync = 1, lastPt = null, lastMoveAt = 0;
      let lastDark = isDark(opts);
      const amp = () => 0.42 * opts.swing;

      // Pendulum i swings (K + i) times per cycle, so every cycle they all come back in line.
      function build() {
        const n = opts.count;
        const K = Math.max(6, Math.round(opts.cycle / 1.5));
        const pal = PALETTES[opts.palette] || PALETTES.pastel;
        clock = 0;
        gather = drag = hover = null;
        pends = [];
        for (let i = 0; i < n; i++) {
          const rgb = rowColour(pal.stops, i / (n - 1));
          pends.push({
            i, omega: (TAU * (K + i)) / opts.cycle, frac: Math.max(0.28, (K / (K + i)) ** 2),
            a: amp(), ph: 0, lap: 0, since: 99, th: amp(), vel: 0, from: 0,
            pluck: 0, lastPluck: -1, hl: 0, midi: noteFor(i, n), pan: (i / (n - 1)) * 1.4 - 0.7,
            rgb, css: U.rgb(rgb), sprite: ballSprite(rgb, pal.metal), glow: U.glowSprite(U.rgb(rgb, 0.9), 128),
            sb: [0, 0, 1, 0], spv: [0, 0], wy: 0, wz: 0,
          });
        }
        order = pends.slice();
        layout();
      }

      function repaint() {
        const pal = PALETTES[opts.palette] || PALETTES.pastel;
        for (const p of pends) {
          p.rgb = rowColour(pal.stops, p.i / (pends.length - 1));
          p.css = U.rgb(p.rgb);
          p.sprite = ballSprite(p.rgb, pal.metal);
          p.glow = U.glowSprite(U.rgb(p.rgb, 0.9), 128);
        }
      }

      function layout() {
        const n = pends.length;
        half = Math.min(w * 0.37, h * 0.8);
        spacing = (2 * half) / (n - 1);
        Lmax = Math.min(h * 0.6, half * 1.6); // portrait screens get a shorter rig, not spaghetti strings
        r = Math.min(spacing * 0.36, h * 0.034);
        va = spacing * 0.3;
        yc = -Lmax * 0.6;
        yF = -(Lmax + r * 2.5 + h * 0.06);
        backZ = -Lmax * 0.8;
        D = Math.max(w, h) * 2.2;
        cx = w / 2;
        cyS = h * 0.52;
        pad = spacing * 0.9 + r;
        beamH = h * 0.03;
        beamD = h * 0.035;
        postW = h * 0.022;
        for (const p of pends) {
          p.x = lerp(-half, half, p.i / (n - 1));
          p.len = Lmax * p.frac;
        }
      }

      // ---------- 3D ----------
      function rot(x, y, z) {
        const x1 = x * cyw + z * syw, z1 = z * cyw - x * syw;
        return [x1, y * cp - z1 * sp, z1 * cp + y * sp];
      }
      // -> [screen x, screen y, scale, depth toward the camera]
      function project(x, y, z) {
        const q = rot(x, y - yc, z);
        const s = D / (D - q[2]);
        return [cx + q[0] * s, cyS - q[1] * s, s, q[2]];
      }
      const bob = (p, th) => [p.x, -p.len * Math.cos(th), p.len * Math.sin(th)];

      function camera() {
        const yaw = input.px * 0.16 + Math.sin(time * 0.06) * 0.05;
        const pitch = 0.42 + input.py * 0.06 + Math.sin(time * 0.045 + 1) * 0.015;
        cyw = Math.cos(yaw); syw = Math.sin(yaw);
        cp = Math.cos(pitch); sp = Math.sin(pitch);
      }

      // ---------- sound ----------
      function chime(p, gain, delay = 0) {
        if (!thumbnail && opts.chimes !== 'off') W.audio.cue('chime', p.midi, gain, p.pan, delay);
      }
      function chord(gain) {
        for (const p of pends) chime(p, gain, p.i * 0.022);
      }

      // ---------- motion ----------
      // Restart a ball's swing from its current angle and angular velocity, keeping its lap count.
      function setSwing(p, th, v) {
        p.a = Math.min(1.3, Math.hypot(th, v / p.omega));
        p.ph += U.angleDiff(p.ph, Math.atan2(-v / p.omega, th));
        p.lap = Math.floor(p.ph / TAU);
        p.since = 0;
      }

      function update(dt) {
        const A = amp();
        const prev = clock;
        clock += dt;
        if (opts.chimes === 'sync' && Math.floor(prev / opts.cycle) !== Math.floor(clock / opts.cycle)) chord(0.2 / Math.sqrt(pends.length));

        if (gather) {
          // every ball is drawn back to the same spot, held for a beat, then let go together
          gather.t += dt;
          for (const p of pends) p.th = lerp(p.from, A, smoothstep(0, 1, (gather.t - p.i * 0.012) / 0.9));
          if (gather.t > 1.35) {
            clock = 0;
            for (const p of pends) Object.assign(p, { a: A, ph: 0, lap: 0, since: 99, th: A });
            gather = null;
            chord(0.22 / Math.sqrt(pends.length));
          }
          return;
        }

        const swing = opts.chimes === 'swing' ? 0.05 / Math.sqrt(pends.length) : 0;
        for (const p of pends) {
          if (drag && drag.p === p) continue;
          p.since += dt;
          p.ph += p.omega * dt;
          // after a nudge the ball swings freely for a moment, then eases back into the wave
          const k = 0.5 * smoothstep(1.5, 5, p.since);
          if (k > 0) {
            p.ph += U.angleDiff(p.ph, p.omega * clock) * (1 - Math.exp(-k * dt));
            p.a = U.damp(p.a, A, k * 0.8, dt);
          }
          p.th = p.a * Math.cos(p.ph);
          const lap = Math.floor(p.ph / TAU);
          if (lap > p.lap) {
            p.lap = lap;
            if (swing) chime(p, swing);
          }
        }
      }

      function updateDrag(dt) {
        const p = drag.p;
        if (!input.down || !input.active) {
          const v = clamp(p.vel, -p.omega * 1.2, p.omega * 1.2);
          setSwing(p, p.th, v);
          drag = null;
          chime(p, 0.03 + 0.04 * Math.min(1, p.a));
          return;
        }
        // the swing angle that puts the ball nearest the pointer
        let best = p.th, bd = Infinity;
        for (let th = -1.25; th <= 1.25; th += 0.025) {
          const [x, y, z] = bob(p, th);
          const q = project(x, y, z);
          const d = (q[0] - input.x) ** 2 + (q[1] - input.y) ** 2;
          if (d < bd) { bd = d; best = th; }
        }
        const prev = p.th;
        p.th = U.damp(p.th, best, 16, dt);
        if (dt > 0) p.vel = U.damp(p.vel, (p.th - prev) / dt, 10, dt);
      }

      function pluck(p) {
        if (time - p.lastPluck < 0.12) return;
        p.lastPluck = time;
        const s = clamp(input.speed / 1400, 0.25, 1);
        const v = -p.a * p.omega * Math.sin(p.ph);
        setSwing(p, p.th, v + (Math.sign(v) || 1) * s * 0.9);
        p.pluck = 1;
        chime(p, 0.03 + 0.04 * s);
      }

      function hitTest(x, y) {
        for (let k = order.length - 1; k >= 0; k--) {
          const p = order[k];
          if (Math.hypot(p.sb[0] - x, p.sb[1] - y) < r * p.sb[2] + 10) return p;
        }
        return null;
      }

      // ---------- drawing ----------
      function roomColours() {
        if (opts.room === 'midnight') return RGB.midnight;
        const { day, dusk } = env.mood(1, 0);
        const a = RGB.night, b = RGB.day;
        const m = (x, y) => U.mixRgb(x, y, day);
        const mixA = (x, y) => [...U.mixRgb(x, y, day), lerp(x[3], y[3], day)];
        const wall = a.wall.map((v, i) => m(v, b.wall[i]));
        wall[0] = U.mixRgb(wall[0], [250, 200, 170], dusk * 0.3);
        return {
          wall, floor: a.floor.map((v, i) => m(v, b.floor[i])), wood: m(a.wood, b.wood),
          string: mixA(a.string, b.string), spot: mixA(a.spot, b.spot), shadow: lerp(a.shadow, b.shadow, day),
        };
      }

      function drawRoom(room) {
        const seam = project(0, yF, backZ)[1];
        let g = ctx.createLinearGradient(0, 0, 0, seam);
        g.addColorStop(0, U.rgb(room.wall[0]));
        g.addColorStop(1, U.rgb(room.wall[1]));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, seam + 1);
        g = ctx.createLinearGradient(0, seam, 0, h);
        g.addColorStop(0, U.rgb(room.floor[0]));
        g.addColorStop(1, U.rgb(room.floor[1]));
        ctx.fillStyle = g;
        ctx.fillRect(0, seam, w, h - seam);
        // soft cove where the wall curves into the floor
        g = ctx.createLinearGradient(0, seam - h * 0.07, 0, seam + h * 0.03);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(0.7, 'rgba(0,0,0,0.06)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, seam - h * 0.07, w, h * 0.1);
        // overhead light, a touch brighter whenever the balls line up
        const [sr, sg, sb, sa] = room.spot;
        const spot = ctx.createRadialGradient(cx, h * 0.32, 0, cx, h * 0.4, Math.max(w, h) * 0.55);
        spot.addColorStop(0, `rgba(${sr},${sg},${sb},${sa * (1 + sync * 0.35)})`);
        spot.addColorStop(1, `rgba(${sr},${sg},${sb},0)`);
        ctx.fillStyle = spot;
        ctx.fillRect(0, 0, w, h);
      }

      function drawBox(x0, x1, y0, y1, z0, z1, rgb) {
        const xs = [x0, x1], ys = [y0, y1], zs = [z0, z1];
        const pts = [];
        for (let c = 0; c < 8; c++) pts.push(project(xs[c & 1], ys[(c >> 1) & 1], zs[c >> 2]));
        const ctr = rot((x0 + x1) / 2, (y0 + y1) / 2 - yc, (z0 + z1) / 2);
        const ext = [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2];
        for (const [nrm, idx] of FACES) {
          // face centre in camera space, then cull faces turned away from the camera
          const rn = rot(nrm[0], nrm[1], nrm[2]);
          const e = ext[Math.abs(nrm[1]) + 2 * Math.abs(nrm[2])];
          const fc = [ctr[0] + rn[0] * e, ctr[1] + rn[1] * e, ctr[2] + rn[2] * e];
          if (-fc[0] * rn[0] - fc[1] * rn[1] + (D - fc[2]) * rn[2] <= 0) continue;
          const lit = nrm[0] * LIGHT[0] + nrm[1] * LIGHT[1] + nrm[2] * LIGHT[2];
          const shade = 0.62 + 0.38 * Math.max(0, lit) + (nrm[1] > 0 ? 0.06 : 0);
          const col = U.rgb(rgb.map((v) => Math.min(255, v * shade)));
          ctx.fillStyle = col;
          ctx.strokeStyle = col;
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          idx.forEach((c, k) => (k ? ctx.lineTo(pts[c][0], pts[c][1]) : ctx.moveTo(pts[c][0], pts[c][1])));
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      }

      function drawFrame(room) {
        const x0 = -half - pad, x1 = half + pad;
        const foot = beamD * 3, footH = h * 0.012, zm = -beamD / 2;
        for (const [a, b] of [[x0 - postW, x0], [x1, x1 + postW]]) {
          // feet first, with a soft contact shadow
          const q = project((a + b) / 2, yF, zm);
          ctx.globalAlpha = room.shadow * 0.8;
          ctx.drawImage(getShadow(), q[0] - postW * 3 * q[2], q[1] - foot * sp * q[2] * 1.4, postW * 6 * q[2], foot * sp * q[2] * 2.8);
          ctx.globalAlpha = 1;
          drawBox(a - postW * 0.9, b + postW * 0.9, yF, yF + footH, zm - foot, zm + foot, room.wood);
          drawBox(a, b, yF + footH, 0, -beamD * 0.8, -beamD * 0.2, room.wood);
        }
        drawBox(x0 - postW * 1.4, x1 + postW * 1.4, 0, beamH, -beamD, 0, room.wood);
        // little brass pins where the strings hang
        ctx.fillStyle = 'rgba(220,180,110,0.9)';
        for (const p of pends) {
          for (const side of [-1, 1]) {
            const q = project(p.x + side * va, 0, 0);
            ctx.beginPath();
            ctx.arc(q[0], q[1], Math.max(1, r * 0.09) * q[2], 0, TAU);
            ctx.fill();
          }
        }
      }

      function drawShadows(room) {
        const shadow = getShadow();
        for (const p of pends) {
          const q = project(p.x, yF, p.wz);
          const lift = clamp((p.wy - yF) / Lmax, 0, 1);
          const sw = r * 2.8 * q[2] * (1 + lift * 0.4);
          ctx.globalAlpha = room.shadow * (1 - lift * 0.55);
          ctx.drawImage(shadow, q[0] - sw / 2, q[1] - sw * sp * 0.5, sw, sw * sp);
        }
        ctx.globalAlpha = 1;
      }

      function drawTrails(glow) {
        if (trailFade < 0.02) return;
        const M = 9, span = 0.26;
        ctx.lineCap = 'round';
        if (glow) ctx.globalCompositeOperation = 'lighter';
        for (const p of pends) {
          if (drag && drag.p === p) continue;
          ctx.strokeStyle = p.css;
          let prev = p.sb;
          for (let j = 1; j <= M; j++) {
            const k = j / M;
            const [x, y, z] = bob(p, p.a * Math.cos(p.ph - p.omega * span * k));
            const q = project(x, y, z);
            ctx.globalAlpha = trailFade * (glow ? 0.32 : 0.2) * (1 - k);
            ctx.lineWidth = r * q[2] * 1.5 * (1 - k * 0.7);
            ctx.beginPath();
            ctx.moveTo(prev[0], prev[1]);
            ctx.lineTo(q[0], q[1]);
            ctx.stroke();
            prev = q;
          }
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }

      function drawWave(glow) {
        ctx.beginPath();
        ctx.moveTo(pends[0].sb[0], pends[0].sb[1]);
        for (let i = 1; i < pends.length - 1; i++) {
          const a = pends[i].sb, b = pends[i + 1].sb;
          ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
        }
        const last = pends[pends.length - 1].sb;
        ctx.lineTo(last[0], last[1]);
        const accent = U.hex((PALETTES[opts.palette] || PALETTES.pastel).accent);
        ctx.strokeStyle = glow ? U.rgb(accent, 0.5) : 'rgba(60,50,70,0.22)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      function drawPendulum(p, room, glow) {
        const B = p.sb;
        const [sr, sg, sb, sa] = room.string;
        ctx.strokeStyle = `rgba(${sr | 0},${sg | 0},${sb | 0},${sa})`;
        ctx.lineWidth = Math.max(0.8, r * 0.05);
        for (const side of [-1, 1]) {
          const A = project(p.x + side * va, 0, 0);
          ctx.beginPath();
          ctx.moveTo(A[0], A[1]);
          if (p.pluck > 0.01) {
            // a plucked string shivers for a moment
            const wob = Math.sin(time * 55 + side) * p.pluck * r * 0.6;
            ctx.quadraticCurveTo((A[0] + B[0]) / 2 + wob, (A[1] + B[1]) / 2, B[0], B[1]);
          } else ctx.lineTo(B[0], B[1]);
          ctx.stroke();
        }
        const rad = r * B[2] * (1 + p.hl * 0.08);
        if (glow) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = clamp(0.28 + 0.4 * sync + p.pluck * 0.4 + p.hl * 0.15, 0, 1);
          ctx.drawImage(p.glow, B[0] - rad * 3, B[1] - rad * 3, rad * 6, rad * 6);
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = 'source-over';
        }
        ctx.drawImage(p.sprite, B[0] - rad, B[1] - rad, rad * 2, rad * 2);
      }

      build();

      return {
        resize(nw, nh) {
          w = nw; h = nh;
          layout();
        },
        frame(dt, t) {
          time = t;
          camera();
          if (drag) updateDrag(dt);
          update(dt);
          for (const p of pends) {
            const [x, y, z] = bob(p, p.th);
            p.sb = project(x, y, z);
            p.wy = y;
            p.wz = z;
            p.pluck *= Math.exp(-dt * 3.5);
          }
          order.sort((a, b) => a.sb[3] - b.sb[3]);

          // how lined up the row is: 1 when every ball swings together
          let sc = 0, ss = 0;
          for (const p of pends) { sc += Math.cos(p.ph); ss += Math.sin(p.ph); }
          sync = U.damp(sync, gather ? 1 : (Math.hypot(sc, ss) / pends.length) ** 8, 4, dt);
          trailFade = U.damp(trailFade, gather ? 0 : 1, gather ? 10 : 2, dt);

          if (!thumbnail) {
            hover = input.active && !drag && !gather ? hitTest(input.x, input.y) : null;
            canvas.style.cursor = drag ? 'grabbing' : hover ? 'grab' : '';
            const dark = isDark(opts);
            if (dark !== lastDark && W.engine.current() === SCENE) W.emit('sceneOptions', SCENE, opts); // re-theme widgets
            lastDark = dark;
          }
          for (const p of pends) p.hl = U.damp(p.hl, drag && drag.p === p ? 1.3 : hover === p ? 1 : 0, 12, dt);

          const room = roomColours();
          const glow = opts.room === 'midnight';
          drawRoom(room);
          drawShadows(room);
          drawFrame(room);
          if (opts.trails) drawTrails(glow);
          if (opts.wave) drawWave(glow);
          for (const p of order) drawPendulum(p, room, glow);
        },
        onPointerDown(x, y) {
          const hit = hitTest(x, y);
          if (hit && !gather) {
            drag = { p: hit };
            hit.vel = 0;
            hit.pluck = 0.4;
          } else if (!gather && !drag) {
            gather = { t: 0 };
            for (const p of pends) p.from = p.th;
          }
        },
        onPointerMove(x, y) {
          const now = performance.now();
          // swiping across the row plucks every string the pointer crosses
          if (lastPt && now - lastMoveAt < 150 && !drag && !gather && !input.down) {
            const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
            const m = [x, y];
            for (const p of pends) {
              const P = project(p.x, 0, 0), B = p.sb;
              if (cross(lastPt, m, P) * cross(lastPt, m, B) < 0 && cross(P, B, lastPt) * cross(P, B, m) < 0) pluck(p);
            }
          }
          lastPt = [x, y];
          lastMoveAt = now;
        },
        onOption(key) {
          if (key === 'count' || key === 'cycle') build();
          if (key === 'palette') repaint();
        },
        destroy() {
          canvas.style.cursor = '';
        },
      };
    },
  };

  W.registerScene(SCENE);
})();
