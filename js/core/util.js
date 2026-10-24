/* Shared helpers: math, noise, colour. Everything hangs off window.Lumevale. */
(function () {
  const W = (window.Lumevale = window.Lumevale || {});

  const TAU = Math.PI * 2;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const smoothstep = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];
  // Frame-rate independent exponential approach: move `cur` toward `target`.
  const damp = (cur, target, rate, dt) => lerp(cur, target, 1 - Math.exp(-rate * dt));
  const angleDiff = (a, b) => {
    let d = (b - a) % TAU;
    if (d > Math.PI) d -= TAU;
    if (d < -Math.PI) d += TAU;
    return d;
  };

  // ---- Value noise (seeded, smooth) ----
  function makeNoise(seed = Math.random() * 65536) {
    const perm = new Uint8Array(512);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    let s = seed >>> 0 || 1;
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    const grad = new Float32Array(256);
    for (let i = 0; i < 256; i++) grad[i] = rnd() * 2 - 1;
    const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);

    function n1(x) {
      const xi = Math.floor(x), xf = x - xi;
      const a = grad[perm[xi & 255]], b = grad[perm[(xi + 1) & 255]];
      return lerp(a, b, fade(xf));
    }
    function n2(x, y) {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = x - xi, yf = y - yi;
      const X = xi & 255, Y = yi & 255;
      const aa = grad[perm[X + perm[Y]]];
      const ba = grad[perm[X + 1 + perm[Y]]];
      const ab = grad[perm[X + perm[Y + 1]]];
      const bb = grad[perm[X + 1 + perm[Y + 1]]];
      const u = fade(xf), v = fade(yf);
      return lerp(lerp(aa, ba, u), lerp(ab, bb, u), v);
    }
    function fbm2(x, y, oct = 4) {
      let v = 0, a = 0.5, f = 1, norm = 0;
      for (let i = 0; i < oct; i++) {
        v += a * n2(x * f, y * f);
        norm += a;
        a *= 0.5;
        f *= 2.03;
      }
      return v / norm;
    }
    return { n1, n2, fbm2 };
  }

  // ---- Colour ----
  function hex(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mixRgb(a, b, t) {
    return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  }
  function rgb(c, alpha = 1) {
    return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${alpha})`;
  }
  function mix(a, b, t, alpha = 1) {
    return rgb(mixRgb(hex(a), hex(b), t), alpha);
  }
  function hsl(h, s, l, a = 1) {
    return `hsla(${h},${s}%,${l}%,${a})`;
  }

  // Offscreen canvas helper.
  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // Soft radial glow sprite, cached by colour/size.
  const glowCache = new Map();
  function glowSprite(color, size = 128) {
    const key = color + size;
    if (glowCache.has(key)) return glowCache.get(key);
    const c = canvas(size, size);
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grd.addColorStop(0, color);
    grd.addColorStop(0.25, color.replace(/[\d.]+\)$/, '0.45)'));
    grd.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
    g.fillStyle = grd;
    g.fillRect(0, 0, size, size);
    glowCache.set(key, c);
    return c;
  }

  W.util = {
    TAU, lerp, clamp, smoothstep, rand, randInt, choice, damp, angleDiff,
    makeNoise, hex, mixRgb, rgb, mix, hsl, canvas, glowSprite,
  };
})();
