/* Deep Ocean — bioluminescent jellyfish drifting through marine snow.
   Mouse: the cursor leaves a glowing plankton trail and jellies drift away from it; click sends a light pulse. */
(function () {
  const W = window.Lumevale;
  const U = W.util;
  const { TAU, rand, clamp, lerp } = U;

  const PALETTES = {
    neon: { hues: [188, 200, 280, 300, 320, 170, 260, 30], sat: 92, accent: '#58e1ff' },
    aqua: { hues: [172, 182, 190, 198, 205], sat: 92, accent: '#5ff0e0' },
    violet: { hues: [255, 270, 285, 300, 315], sat: 90, accent: '#c58bff' },
    ember: { hues: [12, 22, 32, 42, 335], sat: 95, accent: '#ffb36b' },
    moon: { hues: [200, 210, 220], sat: 28, accent: '#dfe8ff' },
  };

  W.registerScene({
    id: 'jelly',
    name: 'Deep Ocean',
    style: 'Bioluminescent glow',
    swatch: ['#01030a', '#0b2a4a', '#58e1ff', '#d070ff'],
    ambience: 'deep',
    type: '2d',
    options: [
      { key: 'palette', label: 'Glow colours', type: 'select', default: 'neon', rebuild: true, options: [['neon', 'Neon mix'], ['aqua', 'Aqua'], ['violet', 'Violet'], ['ember', 'Ember'], ['moon', 'Moonlight']] },
      { key: 'count', label: 'Jellyfish', type: 'range', min: 3, max: 24, step: 1, default: 10 },
      { key: 'snow', label: 'Marine snow', type: 'range', min: 0, max: 2, step: 0.1, default: 1 },
      { key: 'rays', label: 'Light rays', type: 'toggle', default: true },
      { key: 'trail', label: 'Plankton trail on cursor', type: 'toggle', default: true },
    ],
    theme: (o) => {
      const a = (PALETTES[o.palette] || PALETTES.neon).accent;
      return {
        font: "'Outfit', system-ui, sans-serif",
        clockWeight: 200,
        text: '#e8fbff',
        dim: 'rgba(205,240,255,0.62)',
        accent: a,
        card: 'rgba(3,12,28,0.5)',
        border: `1px solid ${a}55`,
        radius: '16px',
        shadow: `0 0 28px ${a}2e, inset 0 0 18px ${a}14`,
        blur: '10px',
        textShadow: `0 0 18px ${a}99`,
        field: 'rgba(120,220,255,0.07)',
        cursor: { svg: W.theme.glowSvg(a, 30), hot: [15, 15] },
      };
    },

    create({ ctx, input, opts }) {
      let w = 1, h = 1, time = 0, scale = 1;
      let jellies = [], snow = [], plankton = [], pulses = [], rays = [];
      const noise = U.makeNoise();
      let bg = null, nextSpawn = 0;

      function makeJelly(anywhere) {
        const z = rand(0.45, 1);
        const r = rand(45, 95) * z * scale;
        const pal = PALETTES[opts.palette] || PALETTES.neon;
        const hue = U.choice(pal.hues);
        const tentacles = [];
        const nt = U.randInt(9, 15);
        for (let k = 0; k < nt; k++) {
          tentacles.push({ u: lerp(-0.85, 0.85, k / (nt - 1)) + rand(-0.05, 0.05), len: rand(1.6, 3.4), ph: rand(TAU), amp: rand(0.6, 1.2) });
        }
        const arms = [];
        for (let k = 0; k < U.randInt(3, 4); k++) arms.push({ u: rand(-0.3, 0.3), len: rand(1.1, 1.8), ph: rand(TAU) });
        return {
          x: rand(w), y: anywhere ? rand(h) : h + r * 4,
          vx: 0, vy: 0, a: 0, z, r, hue, sat: pal.sat, tentacles, arms,
          period: rand(2.6, 4.2), phase: rand(1), c: 0, prevC: 0,
          seed: rand(100), flash: 0,
        };
      }

      function init() {
        scale = clamp(Math.min(w, h) / 800, 0.6, 1.6);
        jellies = [];
        const n = opts.count;
        // stratify across the width so they don't clump on one side
        for (let i = 0; i < n; i++) jellies.push(Object.assign(makeJelly(true), { x: ((i + rand(0.15, 0.85)) / n) * w }));
        snow = [];
        for (let i = 0; i < (w * h) / 3000; i++) {
          snow.push({ x: rand(w), y: rand(h), z: rand(0.2, 1), r: rand(0.5, 1.8), seed: rand(100), glow: Math.random() < 0.08 });
        }
        rays = [];
        for (let i = 0; i < 6; i++) rays.push({ x: rand(0.1, 0.9), width: rand(0.05, 0.14), seed: rand(100) });
        paintBg();
      }

      function paintBg() {
        bg = U.canvas(w, h);
        const g = bg.getContext('2d');
        const grd = g.createLinearGradient(0, 0, 0, h);
        grd.addColorStop(0, '#0a2846');
        grd.addColorStop(0.35, '#061a33');
        grd.addColorStop(0.75, '#030b1c');
        grd.addColorStop(1, '#01030a');
        g.fillStyle = grd;
        g.fillRect(0, 0, w, h);
      }

      // ---------- drawing ----------
      function drawRays() {
        ctx.globalCompositeOperation = 'lighter';
        for (const r of rays) {
          const sway = noise.n1(time * 0.05 + r.seed) * 0.12;
          const x = (r.x + sway) * w + input.px * -20;
          const top = r.width * w, bottom = r.width * w * 2.6;
          const grd = ctx.createLinearGradient(0, 0, 0, h * 0.85);
          const a = 0.035 + 0.02 * noise.n1(time * 0.2 + r.seed);
          grd.addColorStop(0, `rgba(120,200,255,${a})`);
          grd.addColorStop(1, 'rgba(120,200,255,0)');
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.moveTo(x - top / 2, -10);
          ctx.lineTo(x + top / 2, -10);
          ctx.lineTo(x + bottom / 2 + sway * w * 0.6, h * 0.85);
          ctx.lineTo(x - bottom / 2 + sway * w * 0.6, h * 0.85);
          ctx.closePath();
          ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      }

      function drawSnow(dt) {
        const shown = Math.floor((snow.length * opts.snow) / 2);
        for (let i = 0; i < shown; i++) {
          const s = snow[i];
          s.y -= (4 + s.z * 6) * dt;
          s.x += noise.n1(time * 0.1 + s.seed) * 8 * dt;
          if (s.y < -5) { s.y = h + 5; s.x = rand(w); }
          if (s.x < -5) s.x = w + 5;
          if (s.x > w + 5) s.x = -5;
          const x = s.x + input.px * -25 * s.z, y = s.y + input.py * -12 * s.z;
          if (s.glow) {
            const tw = 0.4 + 0.6 * Math.abs(Math.sin(time * 0.8 + s.seed));
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = tw * s.z;
            const sp = U.glowSprite('rgba(120,240,255,0.9)', 32);
            ctx.drawImage(sp, x - 6, y - 6, 12, 12);
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
          } else {
            ctx.fillStyle = `rgba(180,210,230,${0.12 + s.z * 0.25})`;
            ctx.fillRect(x, y, s.r * s.z + 0.4, s.r * s.z + 0.4);
          }
        }
      }

      function updateJelly(j, dt) {
        j.prevC = j.c;
        const p = ((time / j.period) + j.phase) % 1;
        j.c = p < 0.3 ? Math.sin((p / 0.3) * Math.PI / 2) : Math.cos(((p - 0.3) / 0.7) * Math.PI / 2);
        const dc = Math.max(0, j.c - j.prevC);
        // orientation drifts; cursor nudges it away
        let target = noise.n1(time * 0.06 + j.seed) * 0.6;
        const jx = j.x + input.px * -40 * j.z;
        if (input.active) {
          const dx = jx - input.x, dy = j.y - input.y, d = Math.hypot(dx, dy);
          const reach = 200 * scale;
          if (d < reach && d > 1) {
            const f = (1 - d / reach) * 40;
            j.vx += (dx / d) * f * dt;
            j.vy += (dy / d) * f * dt;
            target += clamp(dx / reach, -1, 1) * 0.6;
          }
        }
        j.a = U.damp(j.a, target, 0.8, dt);
        const thrust = dc * 70 * (0.6 + j.z * 0.6) * scale;
        j.vx += Math.sin(j.a) * thrust;
        j.vy -= Math.cos(j.a) * thrust;
        j.vy += 4 * dt; // gentle sinking
        const drag = Math.exp(-dt * 1.1);
        j.vx *= drag;
        j.vy *= drag;
        j.x += j.vx * dt;
        j.y += j.vy * dt;
        j.flash = Math.max(0, j.flash - dt * 0.8);
        if (j.y < -j.r * 5) {
          if (jellies.length > opts.count) j.gone = true;
          else Object.assign(j, makeJelly(false));
        }
        if (j.y > h + j.r * 6) j.y = -j.r * 4;
        if (j.x < -j.r * 3) j.x = w + j.r * 2;
        if (j.x > w + j.r * 3) j.x = -j.r * 2;
      }

      function drawJelly(j) {
        const { r, c, hue } = j;
        const x = j.x + input.px * -40 * j.z, y = j.y + input.py * -18 * j.z;
        const bright = (0.45 + j.z * 0.55) * (1 + j.flash * 0.8);
        const bw = r * (1 - 0.18 * c), bh = r * (0.78 + 0.14 * c);
        const ca = Math.cos(j.a), sa = Math.sin(j.a);
        const toWorld = (lx, ly) => [x + lx * ca - ly * sa, y + lx * sa + ly * ca];
        const down = [-sa, ca];

        ctx.globalCompositeOperation = 'lighter';
        // halo
        ctx.globalAlpha = clamp(0.35 * bright, 0, 1);
        const halo = U.glowSprite(`hsla(${hue},${Math.round(j.sat * 90 / 100)}%,60%,0.6)`, 128);
        const hs = r * 4.2;
        const [gx, gy] = toWorld(0, -bh * 0.4);
        ctx.drawImage(halo, gx - hs / 2, gy - hs / 2, hs, hs);
        ctx.globalAlpha = 1;

        // tentacles
        ctx.lineCap = 'round';
        for (const t of j.tentacles) {
          const [ax, ay] = toWorld(t.u * bw, -bh * 0.02);
          const len = t.len * r;
          const N = 10;
          ctx.strokeStyle = `hsla(${hue},${Math.round(j.sat * 90 / 100)}%,72%,${0.3 * bright})`;
          ctx.lineWidth = Math.max(0.6, r * 0.025);
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          let px = ax, py = ay;
          for (let i = 1; i <= N; i++) {
            const k = i / N;
            const wave = Math.sin(time * 1.6 - k * 4 + t.ph) * r * 0.22 * t.amp * k;
            const lagX = -j.vx * k * 0.5, lagY = -j.vy * k * 0.5;
            const nx = ax + down[0] * len * k + -down[1] * wave + lagX + t.u * r * 0.25 * k;
            const ny = ay + down[1] * len * k + down[0] * wave + lagY;
            ctx.quadraticCurveTo(px, py, (px + nx) / 2, (py + ny) / 2);
            px = nx; py = ny;
          }
          ctx.stroke();
        }
        // oral arms: frilly ribbons
        for (const a of j.arms) {
          const [ax, ay] = toWorld(a.u * bw, -bh * 0.1);
          const len = a.len * r;
          for (const [lw, alpha] of [[r * 0.11, 0.1], [r * 0.035, 0.28]]) {
            ctx.strokeStyle = `hsla(${hue + 15},${Math.round(j.sat * 95 / 100)}%,78%,${alpha * bright})`;
            ctx.lineWidth = lw;
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            for (let i = 1; i <= 12; i++) {
              const k = i / 12;
              const wave = Math.sin(time * 2.2 - k * 7 + a.ph) * r * 0.12 * k;
              ctx.lineTo(ax + down[0] * len * k - down[1] * wave - j.vx * k * 0.35, ay + down[1] * len * k + down[0] * wave - j.vy * k * 0.35);
            }
            ctx.stroke();
          }
        }

        // bell
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(j.a);
        ctx.beginPath();
        ctx.moveTo(-bw, 0);
        ctx.bezierCurveTo(-bw * 1.02, -bh * 1.25, bw * 1.02, -bh * 1.25, bw, 0);
        const scallops = 10;
        for (let i = scallops - 1; i >= 0; i--) {
          const xa = lerp(-bw, bw, i / scallops);
          const xm = lerp(-bw, bw, (i + 0.5) / scallops);
          ctx.quadraticCurveTo(xm, bh * 0.08 + Math.sin(time * 3 + i) * r * 0.02, xa, -bh * 0.04 * Math.sin((i / scallops) * Math.PI));
        }
        ctx.closePath();
        const grd = ctx.createRadialGradient(0, -bh * 0.55, r * 0.05, 0, -bh * 0.3, r * 1.1);
        grd.addColorStop(0, `hsla(${hue},${Math.round(j.sat * 100 / 100)}%,88%,${0.55 * bright})`);
        grd.addColorStop(0.5, `hsla(${hue},${Math.round(j.sat * 90 / 100)}%,62%,${0.28 * bright})`);
        grd.addColorStop(1, `hsla(${hue},${Math.round(j.sat * 90 / 100)}%,50%,${0.08 * bright})`);
        ctx.fillStyle = grd;
        ctx.fill();
        ctx.strokeStyle = `hsla(${hue},${Math.round(j.sat * 100 / 100)}%,85%,${0.45 * bright})`;
        ctx.lineWidth = Math.max(1, r * 0.03);
        ctx.stroke();
        // inner gonads
        ctx.strokeStyle = `hsla(${hue + 25},${Math.round(j.sat * 100 / 100)}%,85%,${0.3 * bright})`;
        ctx.lineWidth = Math.max(0.8, r * 0.025);
        for (let k = 0; k < 4; k++) {
          ctx.beginPath();
          ctx.ellipse(Math.cos(k * Math.PI / 2 + 0.4) * bw * 0.25, -bh * 0.45 + Math.sin(k * Math.PI / 2 + 0.4) * bh * 0.12, bw * 0.16, bh * 0.1, k * Math.PI / 2 + 0.4, 0, TAU);
          ctx.stroke();
        }
        // top highlight
        ctx.fillStyle = `hsla(${hue},${Math.round(j.sat * 100 / 100)}%,95%,${0.18 * bright})`;
        ctx.beginPath();
        ctx.ellipse(-bw * 0.25, -bh * 0.75, bw * 0.3, bh * 0.12, -0.3, 0, TAU);
        ctx.fill();
        ctx.restore();
        ctx.globalCompositeOperation = 'source-over';
      }

      function drawPlankton(dt) {
        ctx.globalCompositeOperation = 'lighter';
        for (let i = plankton.length - 1; i >= 0; i--) {
          const p = plankton[i];
          p.age += dt;
          if (p.age > p.life) { plankton.splice(i, 1); continue; }
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vx *= Math.exp(-dt * 1.5);
          p.vy = p.vy * Math.exp(-dt * 1.5) - 3 * dt;
          const k = p.age / p.life;
          const a = Math.sin(Math.PI * Math.min(1, k * 4)) * (1 - k);
          ctx.globalAlpha = clamp(a, 0, 1);
          const sp = U.glowSprite(`hsla(${p.hue},100%,70%,0.9)`, 32);
          const s = p.size * (1 + k);
          ctx.drawImage(sp, p.x - s, p.y - s, s * 2, s * 2);
        }
        ctx.globalAlpha = 1;
        for (let i = pulses.length - 1; i >= 0; i--) {
          const p = pulses[i];
          p.age += dt;
          const k = p.age / 2.5;
          if (k >= 1) { pulses.splice(i, 1); continue; }
          const rad = k * Math.max(w, h) * 0.45;
          ctx.strokeStyle = `rgba(140,230,255,${0.35 * (1 - k)})`;
          ctx.lineWidth = 2 + 14 * (1 - k);
          ctx.beginPath();
          ctx.arc(p.x, p.y, rad, 0, TAU);
          ctx.stroke();
        }
        if (input.active) {
          const sp = U.glowSprite('rgba(120,220,255,0.5)', 128);
          ctx.globalAlpha = 0.25;
          ctx.drawImage(sp, input.sx - 70, input.sy - 70, 140, 140);
          ctx.globalAlpha = 1;
        }
        ctx.globalCompositeOperation = 'source-over';
      }

      function emit(x, y, n, spread, speed) {
        for (let i = 0; i < n; i++) {
          const a = rand(TAU), v = rand(0.2, 1) * speed;
          plankton.push({
            x: x + rand(-spread, spread), y: y + rand(-spread, spread),
            vx: Math.cos(a) * v + input.vx * 0.05, vy: Math.sin(a) * v + input.vy * 0.05,
            age: 0, life: rand(1.5, 3.2), size: rand(2, 5), hue: U.choice([185, 195, 175, 290]),
          });
        }
      }

      return {
        resize(nw, nh) {
          const first = !bg;
          w = nw; h = nh;
          if (first) init();
          else paintBg();
        },
        frame(dt, t) {
          time = t;
          ctx.drawImage(bg, 0, 0, w, h);
          if (opts.rays) drawRays();
          drawSnow(dt);
          // count follows the slider: extras swim off the top, new ones rise from below
          if (jellies.length < opts.count && time > nextSpawn) {
            jellies.push(makeJelly(false));
            nextSpawn = time + 0.8;
          }
          if (jellies.length > opts.count) {
            const top = jellies.reduce((a, b) => (a.y < b.y ? a : b));
            top.vy = Math.min(top.vy, -30);
          }
          jellies = jellies.filter((j) => !j.gone);
          jellies.sort((a, b) => a.z - b.z);
          for (const j of jellies) {
            updateJelly(j, dt);
            drawJelly(j);
          }
          if (opts.trail && input.active && input.speed > 30 && plankton.length < 400) {
            emit(input.x, input.y, Math.min(4, Math.ceil(input.speed * dt * 0.08)), 6, 15);
          }
          drawPlankton(dt);
        },
        onPointerDown(x, y) {
          pulses.push({ x, y, age: 0 });
          emit(x, y, 40, 10, 90);
          for (const j of jellies) {
            const jx = j.x + input.px * -40 * j.z;
            const dx = jx - x, dy = j.y - y, d = Math.hypot(dx, dy) || 1;
            const reach = Math.max(w, h) * 0.45;
            if (d < reach) {
              const f = (1 - d / reach);
              j.vx += (dx / d) * f * 60;
              j.vy += (dy / d) * f * 60;
              j.flash = Math.max(j.flash, f);
            }
          }
        },
      };
    },
  });
})();
