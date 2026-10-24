/* Silk Flow — abstract WebGL shader. Domain-warped noise folds like silk, drifting through palettes.
   Mouse: the cursor stirs the flow; click to send a ripple through it. */
(function () {
  const W = window.Lumevale;
  const U = W.util;

  const PALETTE_HEX = {
    dusk: ['#1d1b3a', '#6b4c9a', '#f2a38a', '#ffd6a5', '#fff1e0'],
    lagoon: ['#071b2e', '#1e5f74', '#5fc9c0', '#b6f0e0', '#e8fffb'],
    rose: ['#2a0f24', '#8a2f5a', '#f28fad', '#ffd1dc', '#fff0f5'],
    forest: ['#10241e', '#3a7262', '#a6d4a4', '#eef4cc', '#f8fff0'],
    midnight: ['#0d1026', '#3b4280', '#d9a866', '#f6dfae', '#fff6e0'],
  };
  const toVec = (hexes) => hexes.map((c) => U.hex(c).map((v) => v / 255));
  const PALETTES = Object.values(PALETTE_HEX).map(toVec);
  const HOLD = 35, BLEND = 12;

  // Patterns are parameter sets for the same shader.
  const PATTERNS = {
    silk: { scale: 0.8, warp: 2.4, stretch: [1, 1], sheen: 1, veins: 0, aurora: 0 },
    marble: { scale: 1.1, warp: 3.2, stretch: [1, 1], sheen: 0.55, veins: 1, aurora: 0 },
    smoke: { scale: 0.55, warp: 4, stretch: [1, 1], sheen: 0.25, veins: 0, aurora: 0 },
    waves: { scale: 0.7, warp: 1.6, stretch: [0.45, 1.8], sheen: 1.2, veins: 0, aurora: 0 },
    aurora: { scale: 0.7, warp: 2, stretch: [2.2, 0.35], sheen: 0.3, veins: 0, aurora: 1 },
  };

  function customPalette(o) {
    const mixHex = (a, b, t) => U.mixRgb(U.hex(a), U.hex(b), t).map((v) => v / 255);
    return [U.hex(o.c1), U.hex(o.c2), U.hex(o.c3)].map((c) => c.map((v) => v / 255)).concat([mixHex(o.c3, '#ffffff', 0.5), mixHex(o.c3, '#ffffff', 0.85)]);
  }

  const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

  const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;
uniform float uStir;
uniform vec4 uClick[4];
uniform vec3 uC[5];
uniform float uScale, uWarp, uSheen, uVeins, uAurora, uGrain;
uniform vec2 uStretch;
out vec4 outColor;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
  return v;
}

float fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 3; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
  return v / 0.875;
}

void main() {
  vec2 fc = gl_FragCoord.xy;
  float mn = min(uRes.x, uRes.y);
  vec2 p = (fc - 0.5 * uRes) / mn;

  // cursor stirs a soft swirl
  vec2 m = (uMouse - 0.5 * uRes) / mn;
  vec2 d = p - m;
  float r = length(d);
  float sw = uStir * exp(-r * r * 2.5);
  float cs = cos(sw), sn = sin(sw);
  p = m + mat2(cs, -sn, sn, cs) * d;

  // click ripples
  for (int i = 0; i < 4; i++) {
    vec4 k = uClick[i];
    if (k.w < 0.5) continue;
    vec2 dd = p - (k.xy - 0.5 * uRes) / mn;
    float rr = length(dd);
    float age = k.z;
    float ring = exp(-pow((rr - age * 0.32) * 6.0, 2.0));
    p += normalize(dd + 1e-5) * sin(rr * 30.0 - age * 8.0) * ring * exp(-age * 0.9) * 0.03;
  }

  p *= uScale;
  p *= uStretch;
  float t = uTime * 0.035;
  vec2 q = vec2(fbm(p * 1.2 + vec2(0.0, t)), fbm(p * 1.2 + vec2(5.2, 1.3) - t));
  vec2 w = vec2(fbm(p * 1.2 + 3.0 * q + vec2(1.7, 9.2) + 0.7 * t), fbm(p * 1.2 + 3.0 * q + vec2(8.3, 2.8) - 0.6 * t));
  float f = fbm(p + uWarp * w);

  float k1 = smoothstep(0.1, 0.55, f);
  float k2 = smoothstep(0.32, 0.72, f * 0.85 + 0.45 * length(q) - 0.22);
  float k3 = smoothstep(0.55, 0.92, f + 0.4 * w.y - 0.1);
  vec3 col = mix(uC[0], uC[1], k1);
  col = mix(col, uC[2], k2 * 0.9);
  col = mix(col, uC[3], k3 * 0.75);

  // silk sheen: light a smooth, low-frequency height field (finite differences, w held fixed)
  vec2 hp = p * 0.9 + 2.0 * w;
  float e = 0.01;
  float h0 = fbm3(hp);
  vec2 grad = vec2(fbm3(hp + vec2(e, 0.0)) - h0, fbm3(hp + vec2(0.0, e)) - h0) / e;
  vec3 n = normalize(vec3(-grad * 0.55, 1.0));
  vec3 l = normalize(vec3(-0.5, 0.55, 0.65));
  float diff = dot(n, l);
  float spec = pow(max(dot(reflect(-l, n), vec3(0, 0, 1)), 0.0), 14.0);
  col *= mix(1.0, 0.78 + 0.4 * diff, min(uSheen, 1.0));
  col += uC[4] * spec * 0.28 * uSheen;

  // marble veins
  float vein = pow(1.0 - abs(sin(f * 16.0 + w.x * 5.0)), 10.0);
  col = mix(col, uC[4] * 0.95, vein * 0.55 * uVeins);

  // aurora: glowing curtains in a band, dark sky around them
  vec2 uv = fc / uRes;
  float band = exp(-pow((uv.y - 0.6 - (f - 0.5) * 0.35) * 3.0, 2.0));
  vec3 aur = uC[0] * 0.55 + (col * 1.5 + uC[3] * 0.25) * band * smoothstep(0.25, 0.75, f + q.x * 0.4);
  col = mix(col, aur, uAurora);

  col = pow(max(col, 0.0), vec3(0.88));

  // grain
  col += (hash(fc + fract(uTime) * 91.7) - 0.5) * 0.025 * uGrain;
  outColor = vec4(col, 1.0);
}`;

  W.registerScene({
    id: 'flow',
    name: 'Silk Flow',
    style: 'Abstract shader',
    swatch: ['#1d1b3a', '#6b4c9a', '#f2a38a', '#ffd6a5'],
    ambience: 'pad',
    type: 'webgl',
    resolution: 0.6,
    options: [
      { key: 'palette', label: 'Colours', type: 'select', default: 'auto', options: [['auto', 'Drift through all'], ['dusk', 'Dusk peach'], ['lagoon', 'Lagoon'], ['rose', 'Rose'], ['forest', 'Forest mist'], ['midnight', 'Midnight gold'], ['custom', 'Custom…']] },
      { key: 'c1', label: 'Shadow', type: 'color', default: '#141b3d', showIf: (o) => o.palette === 'custom' },
      { key: 'c2', label: 'Body', type: 'color', default: '#2f6f8f', showIf: (o) => o.palette === 'custom' },
      { key: 'c3', label: 'Highlight', type: 'color', default: '#f2b38a', showIf: (o) => o.palette === 'custom' },
      { key: 'pattern', label: 'Pattern', type: 'select', default: 'silk', options: [['silk', 'Silk'], ['marble', 'Marble'], ['smoke', 'Smoke'], ['waves', 'Waves'], ['aurora', 'Aurora']] },
      { key: 'speed', label: 'Flow speed', type: 'range', min: 0.1, max: 3, step: 0.05, default: 1 },
      { key: 'zoom', label: 'Zoom', type: 'range', min: 0.4, max: 2.5, step: 0.05, default: 1 },
      { key: 'sheen', label: 'Sheen', type: 'range', min: 0, max: 2, step: 0.05, default: 1 },
      { key: 'grain', label: 'Grain', type: 'range', min: 0, max: 3, step: 0.1, default: 1 },
    ],
    theme: (o) => {
      const hexes = o.palette === 'custom' ? [o.c1, o.c2, o.c3] : PALETTE_HEX[o.palette];
      const accent = hexes ? hexes[2] : '#ffd6a5';
      return {
        font: "'Outfit', system-ui, sans-serif",
        clockWeight: 200,
        text: '#ffffff',
        dim: 'rgba(255,255,255,0.66)',
        accent,
        card: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.2)',
        radius: '22px',
        shadow: '0 20px 50px rgba(0,0,0,0.25)',
        blur: '24px',
        textShadow: '0 2px 24px rgba(0,0,0,0.35)',
        field: 'rgba(255,255,255,0.1)',
        cursor: {
          svg: W.theme.dotSvg('#ffffff', 'rgba(0,0,0,0.25)', 3, 18), hot: [9, 9],
          ring: { size: 46, border: '1px solid rgba(255,255,255,0.55)', background: 'rgba(255,255,255,0.05)' },
        },
      };
    },

    create({ canvas, ctx: gl, input, opts }) {
      if (!gl) {
        canvas.style.background = 'linear-gradient(135deg, #1d1b3a, #6b4c9a 50%, #f2a38a)';
        return { frame() {} };
      }

      function shader(type, src) {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      }
      const prog = gl.createProgram();
      gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);

      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'aPos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      const u = {};
      ['uRes', 'uTime', 'uMouse', 'uStir', 'uClick', 'uC', 'uScale', 'uWarp', 'uSheen', 'uVeins', 'uAurora', 'uGrain', 'uStretch'].forEach((n) => (u[n] = gl.getUniformLocation(prog, n)));

      let dpr = 1, cssH = 1, stir = 0;
      const clicks = [];
      const startPalette = Math.floor(Math.random() * PALETTES.length);
      const colors = new Float32Array(15);
      const clickData = new Float32Array(16);
      let colorsInit = false, flowT = 0;
      const pat = { ...(PATTERNS[opts.pattern] || PATTERNS.silk) };

      function palette(t) {
        if (opts.palette !== 'auto') {
          const fixed = opts.palette === 'custom' ? customPalette(opts) : toVec(PALETTE_HEX[opts.palette] || PALETTE_HEX.dusk);
          // ease toward the chosen colours so switching palettes is a smooth blend
          for (let i = 0; i < 5; i++) for (let c = 0; c < 3; c++) colors[i * 3 + c] = U.lerp(colors[i * 3 + c], fixed[i][c], colorsInit ? 0.06 : 1);
          colorsInit = true;
          return;
        }
        const cycle = HOLD + BLEND;
        const idx = Math.floor(t / cycle);
        const k = U.smoothstep(HOLD, cycle, t - idx * cycle);
        const a = PALETTES[(startPalette + idx) % PALETTES.length];
        const b = PALETTES[(startPalette + idx + 1) % PALETTES.length];
        for (let i = 0; i < 5; i++) for (let c = 0; c < 3; c++) colors[i * 3 + c] = U.lerp(colors[i * 3 + c], U.lerp(a[i][c], b[i][c], k), colorsInit ? 0.06 : 1);
        colorsInit = true;
      }

      let time = 0;
      const timeOffset = Math.random() * 500; // a different composition every session
      return {
        resize(w, h, d) {
          dpr = d;
          cssH = h;
          gl.viewport(0, 0, canvas.width, canvas.height);
        },
        frame(dt, t) {
          time = t;
          const target = input.active ? 0.12 + Math.min(0.9, input.speed / 1200) : 0;
          stir = U.damp(stir, target, target > stir ? 3 : 0.6, dt);
          palette(t);
          flowT += dt * opts.speed;
          // ease pattern parameters so switching patterns morphs instead of jumping
          const goal = PATTERNS[opts.pattern] || PATTERNS.silk;
          const k = 1 - Math.exp(-dt * 2.5);
          for (const key of ['scale', 'warp', 'sheen', 'veins', 'aurora']) pat[key] = U.lerp(pat[key], goal[key], k);
          pat.stretch = [U.lerp(pat.stretch[0], goal.stretch[0], k), U.lerp(pat.stretch[1], goal.stretch[1], k)];
          for (let i = 0; i < 4; i++) {
            const c = clicks[i];
            clickData.set(c ? [c.x * dpr, (cssH - c.y) * dpr, t - c.t, t - c.t < 5 ? 1 : 0] : [0, 0, 0, 0], i * 4);
          }
          gl.uniform2f(u.uRes, canvas.width, canvas.height);
          gl.uniform1f(u.uTime, flowT + timeOffset);
          gl.uniform1f(u.uScale, pat.scale / opts.zoom);
          gl.uniform1f(u.uWarp, pat.warp);
          gl.uniform1f(u.uSheen, pat.sheen * opts.sheen);
          gl.uniform1f(u.uVeins, pat.veins);
          gl.uniform1f(u.uAurora, pat.aurora);
          gl.uniform1f(u.uGrain, opts.grain);
          gl.uniform2f(u.uStretch, pat.stretch[0], pat.stretch[1]);
          gl.uniform2f(u.uMouse, input.sx * dpr, (cssH - input.sy) * dpr);
          gl.uniform1f(u.uStir, stir);
          gl.uniform4fv(u.uClick, clickData);
          gl.uniform3fv(u.uC, colors);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
        },
        onPointerDown(x, y) {
          clicks.unshift({ x, y, t: time });
          clicks.length = Math.min(clicks.length, 4);
        },
        destroy() {
          gl.deleteBuffer(buf);
          gl.deleteProgram(prog);
        },
      };
    },
  });
})();
