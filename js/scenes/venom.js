/* Venom — symbiote takeover. Glossy black goo crawls across a rain-streaked window in front of a neon city,
   swallows the screen, holds it for a moment, then recedes and starts again.
   Mouse: the cursor is a light the goo shrinks from (hold still and it creeps back); click for a sonic pulse
   that blasts it away. Widgets it crawls over get goo dripping down them. */
(function () {
  const W = window.Lumevale;
  const U = W.util;
  const { rand, clamp, lerp } = U;

  const SYMBIOTES = {
    venom: { base: '#040409', tint: '#d8dcff', alt: '#000000', pattern: 0, css: '#07070c', rim: 'rgba(120,135,255,0.55)', accent: '#dfe5ff' },
    carnage: { base: '#6e0910', tint: '#ffb4a4', alt: '#100103', pattern: 1, css: '#7e0c14', rim: 'rgba(255,150,120,0.55)', accent: '#ff5a48' },
    anti: { base: '#cdd2dc', tint: '#ffffff', alt: '#0a0a10', pattern: 2, css: '#d8dce5', rim: 'rgba(0,0,0,0.5)', accent: '#f2f4ff' },
  };
  const BACKDROPS = { neon: 0, moon: 1, dark: 2 };
  const vec3 = (hex) => U.hex(hex).map((c) => c / 255);

  const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

  const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uPx;          // device px per css px
uniform sampler2D uField;   // per simulation cell (row 0 at the top): r = goo density, g = blurred density for height
uniform float uCell;        // css px per cell
uniform float uTime;
uniform vec4 uLight;        // cursor light: css x, y, radius, strength
uniform vec4 uPulse[4];     // css x, y, radius, strength
uniform float uFlash;
uniform int uBg;
uniform float uRain;
uniform vec2 uParallax;
uniform vec3 uBase, uTint, uAlt;
uniform int uPattern;
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
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
  return v / 0.9375;
}

// B-spline sampling (four bilinear taps) so the surface and its normals are smooth across cells
vec4 cubic(float v) {
  vec4 n = vec4(1.0, 2.0, 3.0, 4.0) - v;
  vec4 s = n * n * n;
  float x = s.x, y = s.y - 4.0 * s.x, z = s.z - 4.0 * s.y + 6.0 * s.x;
  return vec4(x, y, z, 6.0 - x - y - z) * (1.0 / 6.0);
}
vec2 field(vec2 css) {
  vec2 size = vec2(textureSize(uField, 0));
  vec2 tc = css / uCell - 0.5;
  vec2 f = fract(tc);
  tc -= f;
  vec4 xc = cubic(f.x), yc = cubic(f.y);
  vec4 c = tc.xxyy + vec2(-0.5, 1.5).xyxy;
  vec4 s = vec4(xc.xz + xc.yw, yc.xz + yc.yw);
  vec4 o = (c + vec4(xc.yw, yc.yw) / s) / size.xxyy;
  vec2 s0 = texture(uField, o.xz).rg, s1 = texture(uField, o.yz).rg;
  vec2 s2 = texture(uField, o.xw).rg, s3 = texture(uField, o.yw).rg;
  float sx = s.x / (s.x + s.y), sy = s.z / (s.z + s.w);
  return mix(mix(s3, s2, sx), mix(s1, s0, sx), sy);
}

// ---------- behind the glass ----------
vec3 neonCol(float h) {
  if (h < 0.28) return vec3(1.0, 0.22, 0.55);
  if (h < 0.52) return vec3(0.22, 0.86, 1.0);
  if (h < 0.72) return vec3(1.0, 0.66, 0.24);
  if (h < 0.9) return vec3(0.62, 0.38, 1.0);
  return vec3(1.0, 0.95, 0.86);
}
// out-of-focus city lights: one disc per grid cell, kept inside its cell
vec3 bokeh(vec2 p, float S, float seed, float density) {
  vec2 id = floor(p / S), f = p - id * S;
  float h = hash(id + seed);
  if (h > density) return vec3(0.0);
  float r = S * (0.14 + 0.26 * hash(id + seed + 3.1));
  vec2 c = vec2(r) + vec2(hash(id + seed + 1.7), hash(id + seed + 7.3)) * (S - 2.0 * r);
  float d = length(f - c);
  float disc = smoothstep(r, r * 0.8, d);
  float disc2 = smoothstep(r, r * 0.55, d);
  float rim = smoothstep(r * 0.6, r * 0.95, d) * disc;
  float fl = 0.72 + 0.28 * sin(uTime * (0.4 + 2.0 * h) + h * 50.0);
  return neonCol(hash(id + seed + 9.9)) * (disc2 * 0.35 + rim * 0.15) * fl * (0.4 + 0.8 * hash(id + seed + 4.4));
}
vec3 glowAt(vec2 p, vec2 c, float r, vec3 col) {
  vec2 d = (p - c) / r;
  return col * exp(-dot(d, d));
}
// a blurred rectangle, for neon signs and lit windows seen through wet glass
float softBox(vec2 p, vec2 c, vec2 hs, float blur) {
  vec2 d = abs(p - c) - hs;
  float sd = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
  return 1.0 - smoothstep(-blur, blur, sd);
}
vec3 background(vec2 p) {
  vec2 res = uRes / uPx;
  float y = p.y / res.y;
  vec3 col;
  if (uBg == 1) {
    col = mix(vec3(0.02, 0.03, 0.09), vec3(0.07, 0.1, 0.2), y);
    vec2 mc = vec2(res.x * 0.72, res.y * 0.3) - uParallax * 10.0;
    float md = length(p - mc) / (res.y * 0.13);
    col += vec3(0.75, 0.8, 0.95) * smoothstep(1.05, 0.9, md) * 0.8 + vec3(0.4, 0.5, 0.8) * exp(-md * md * 0.4) * 0.25;
    vec3 b = bokeh(p + uParallax * 8.0, res.y * 0.08, 5.0, 0.35);
    col += vec3(dot(b, vec3(0.33))) * vec3(0.7, 0.8, 1.0) * smoothstep(0.55, 0.85, y);
    col *= 1.0 - 0.6 * smoothstep(0.62, 0.66, y + 0.05 * hash(vec2(floor(p.x / (res.y * 0.09)), 2.0)));
  } else {
    col = mix(vec3(0.012, 0.012, 0.035), vec3(0.06, 0.025, 0.09), y);
    if (uBg == 0) {
      vec2 pp = p + uParallax * 10.0;
      // dark towers against the glow, their edges softened by the rain
      float bw = res.y * 0.11;
      float bx = floor(pp.x / bw);
      float top = 0.18 + 0.4 * hash(vec2(bx, 3.0));
      float tower = smoothstep(top - 0.04, top + 0.04, y) * (0.5 + 0.5 * smoothstep(0.0, 0.25, abs(fract(pp.x / bw) - 0.5) * -1.0 + 0.5));
      col += glowAt(p, vec2(res.x * 0.2, res.y * 0.7), res.y * 0.42, vec3(1.0, 0.18, 0.48)) * 0.22;
      col += glowAt(p, vec2(res.x * 0.82, res.y * 0.6), res.y * 0.38, vec3(0.16, 0.7, 1.0)) * 0.18;
      col += glowAt(p, vec2(res.x * 0.5, res.y * 1.05), res.y * 0.5, vec3(1.0, 0.5, 0.18)) * 0.16;
      col *= 1.0 - 0.55 * tower;
      // lit windows in the towers, and a few big neon signs
      vec2 wc = floor(pp / vec2(bw * 0.25, res.y * 0.045));
      float lit = step(0.82, hash(wc + 2.0)) * tower * step(top + 0.05, y);
      col += mix(vec3(1.0, 0.75, 0.45), vec3(0.6, 0.8, 1.0), hash(wc + 5.0)) * lit * softBox(fract(pp / vec2(bw * 0.25, res.y * 0.045)), vec2(0.5), vec2(0.22, 0.2), 0.18) * 0.2;
      col += vec3(1.0, 0.25, 0.6) * softBox(pp, vec2(res.x * 0.14, res.y * 0.5), vec2(res.y * 0.012, res.y * 0.13), res.y * 0.02) * (0.55 + 0.1 * sin(uTime * 7.0));
      col += vec3(0.25, 0.9, 1.0) * softBox(pp, vec2(res.x * 0.78, res.y * 0.42), vec2(res.y * 0.11, res.y * 0.014), res.y * 0.02) * 0.5;
      col += vec3(1.0, 0.6, 0.2) * softBox(pp, vec2(res.x * 0.52, res.y * 0.62), vec2(res.y * 0.06, res.y * 0.02), res.y * 0.025) * 0.35;
      // traffic and street lights, out of focus, mostly low down
      float city = smoothstep(0.35, 0.85, y);
      vec3 b = bokeh(p + vec2(uTime * 5.0, 0.0) + uParallax * 6.0, res.y * 0.2, 1.0, 0.32) * (0.3 + 0.7 * city);
      b += bokeh(p + vec2(-uTime * 2.5, 40.0) + uParallax * 12.0, res.y * 0.1, 7.0, 0.3) * 0.8 * city;
      b += bokeh(p + vec2(uTime * 9.0, 13.0) + uParallax * 20.0, res.y * 0.055, 13.0, 0.4) * 0.7 * smoothstep(0.7, 0.95, y);
      col += b;
    } else {
      col += bokeh(p + uParallax * 8.0, res.y * 0.12, 3.0, 0.3) * 0.18;
    }
  }
  return col;
}

// rain on the glass: beads, plus a few drops sliding down. Returns (refraction offset, highlight)
vec3 glassDrops(vec2 p) {
  vec3 o = vec3(0.0);
  float S = 34.0;
  vec2 id = floor(p / S), f = p - id * S;
  if (hash(id + 21.0) < 0.32) {
    float r = 1.5 + 5.5 * hash(id + 4.0) * hash(id + 9.0);
    vec2 c = vec2(r + 1.0) + vec2(hash(id + 2.0), hash(id + 6.0)) * (S - 2.0 * r - 2.0);
    vec2 d = f - c;
    float l = length(d);
    if (l < r) o = vec3(-d * 2.2, smoothstep(r * 0.55, 0.0, length(d + vec2(r * 0.3, r * 0.35))) * 1.4 - 0.15 * smoothstep(r * 0.6, r, l));
  }
  float CW = 70.0;
  float col = floor(p.x / CW);
  float hc = hash(vec2(col, 5.0));
  if (hc < 0.4) {
    float H = uRes.y / uPx;
    float sp = 16.0 + 40.0 * hash(vec2(col, 8.0));
    float yy = mod(uTime * sp + hc * 900.0, H + 120.0) - 60.0;
    float xx = col * CW + CW * (0.3 + 0.4 * hash(vec2(col, 2.0))) + sin(yy * 0.03 + hc * 9.0) * 4.0;
    float r = 4.0 + 3.0 * hash(vec2(col, 3.0));
    vec2 d = (p - vec2(xx, yy)) * vec2(1.0, 0.8);
    float l = length(d);
    if (l < r) o = vec3(-d * 2.4, smoothstep(r * 0.55, 0.0, length(d + vec2(r * 0.3, r * 0.35))) * 1.4 - 0.15 * smoothstep(r * 0.6, r, l));
    // the wet trail it leaves above itself
    float tr = smoothstep(1.6, 0.0, abs(p.x - xx)) * smoothstep(yy - 260.0, yy, p.y) * step(p.y, yy);
    o.z += tr * 0.12;
  }
  return o;
}

// ---------- the goo surface ----------
// thick, rounded at the edges, slowly swelling
float heightAt(vec2 p) {
  float g = field(p).g;
  float h = pow(smoothstep(0.12, 0.95, g), 0.6);
  return h + (0.5 * fbm(p * 0.007 + vec2(uTime * 0.03, -uTime * 0.02)) + 0.12 * noise(p * 0.02 - uTime * 0.1)) * smoothstep(0.3, 0.7, g);
}

void main() {
  vec2 fc = gl_FragCoord.xy;
  vec2 css = vec2(fc.x, uRes.y - fc.y) / uPx;
  float Hc = uRes.y / uPx;

  // sonic pulses bend everything they pass through
  vec2 warp = vec2(0.0);
  float ring = 0.0;
  for (int i = 0; i < 4; i++) {
    vec4 P = uPulse[i];
    if (P.w <= 0.0) continue;
    vec2 dd = css - P.xy;
    float r = length(dd) + 1e-3;
    float band = exp(-pow((r - P.z) / 30.0, 2.0));
    warp += dd / r * band * 22.0 * P.w;
    ring += band * P.w;
  }
  vec2 p = css + warp;

  // the goo: smoothed density, edges roughened
  float v = field(p).r + (noise(p * 0.03 + uTime * 0.15) - 0.5) * 0.08;

  // where the light has pushed it back, the goo bristles into thorns reaching for the light
  vec2 tl = p - uLight.xy;
  float dl = length(tl);
  if (uLight.w > 0.0 && dl < uLight.z * 1.5) {
    // only where there is goo just outside the light's reach for the thorns to grow from
    float root = field(uLight.xy + tl / max(dl, 1.0) * uLight.z * 1.3).r;
    float ang = atan(tl.y, tl.x);
    float k = ang * 9.0 / 3.14159 + sin(dl * 0.03 - uTime * 2.0) * 0.12;
    float id = floor(k);
    float lenJ = 0.5 + 0.5 * hash(vec2(id, 3.0));
    float reach = uLight.z * (1.25 - 0.8 * lenJ * (0.85 + 0.15 * sin(uTime * 3.0 + id * 1.7)));
    // each thorn narrows to a point as it reaches inward
    float along = smoothstep(reach, uLight.z * 1.25, dl);
    float wave = max(0.0, 1.0 - abs(fract(k) * 2.0 - 1.0) / max(along, 0.05));
    v += uLight.w * smoothstep(0.35, 0.6, root) * step(reach, dl) * smoothstep(0.0, 0.3, wave) * 0.7;
  }
  float m = smoothstep(0.42, 0.52, v);

  // surface slope by finite differences (smooth at any render scale)
  float e = 1.5;
  float h0 = heightAt(p);
  vec2 grad = vec2(heightAt(p + vec2(e, 0.0)) - h0, heightAt(p + vec2(0.0, e)) - h0) / e;


  vec3 dr = uRain > 0.5 ? glassDrops(p) : vec3(0.0);
  vec3 bgc = background(p + dr.xy);
  bgc += vec3(0.85, 0.9, 1.0) * dr.z * 0.55;
  float glow = uLight.w * exp(-pow(dl / (uLight.z * 1.3), 2.0));
  bgc += vec3(1.0, 0.88, 0.7) * glow * 0.2;
  bgc += vec3(0.6, 0.65, 0.9) * uFlash * 0.3 * (1.0 - css.y / Hc * 0.6);
  bgc *= 1.0 - 0.45 * smoothstep(0.15, 0.45, v) * (1.0 - m);

  // light the goo: soft key light, the cursor's hot spot, and the city reflected in its slopes
  vec3 n = normalize(vec3(-grad * 30.0, 1.0));
  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 L1 = normalize(vec3(-0.5, -0.7, 0.6));
  float diff = max(dot(n, L1), 0.0);
  float hv = max(dot(n, normalize(L1 + V)), 0.0);
  float spec1 = pow(hv, 70.0) + pow(hv, 14.0) * 0.12;
  vec3 L2 = normalize(vec3(uLight.xy - p, 160.0));
  float att = uLight.w / (1.0 + pow(dl / (uLight.z * 1.6), 2.0));
  float spec2 = pow(max(dot(n, normalize(L2 + V)), 0.0), 110.0) * att;
  float fres = 0.12 + 0.88 * pow(clamp(1.0 - n.z, 0.0, 1.0), 1.2);
  // a glossy mirror of the city, flipped so it reads as reflection rather than see-through
  vec3 refl = background(vec2(p.x, Hc - p.y) + reflect(-V, n).xy * 420.0);

  vec3 base = uBase;
  if (uPattern == 1) {
    float vein = smoothstep(0.045, 0.0, abs(fbm(p * 0.01 + vec2(uTime * 0.01, 0.0)) - 0.5));
    base = mix(base, uAlt, vein * 0.85);
  } else if (uPattern == 2) {
    base = mix(base, uAlt, smoothstep(0.63, 0.67, fbm(p * 0.006 + 3.0)));
  }
  vec3 goo = base * (0.55 + 0.45 * diff) + refl * uTint * fres * 2.2 + uTint * spec1 * 0.5;
  goo += vec3(1.0, 0.9, 0.75) * spec2 * 1.8 + uTint * uFlash * pow(clamp(1.0 - n.z, 0.0, 1.0), 0.8) * 1.2;
  float rim = smoothstep(0.42, 0.47, v) * (1.0 - smoothstep(0.47, 0.58, v));
  goo += uTint * rim * (0.1 + 0.5 * glow);

  vec3 col = mix(bgc, goo, m);
  col += vec3(0.7, 0.85, 1.0) * ring * 0.3;
  outColor = vec4(col, 1.0);
}`;

  W.registerScene({
    id: 'venom',
    name: 'Venom',
    style: 'Symbiote takeover',
    swatch: ['#05050c', '#ff3a8c', '#3adcff', '#05050c'],
    ambience: 'symbiote',
    type: 'webgl',
    resolution: 0.6,
    options: [
      { key: 'symbiote', label: 'Symbiote', type: 'select', default: 'venom', options: [['venom', 'Venom'], ['carnage', 'Carnage'], ['anti', 'Anti-Venom']] },
      { key: 'backdrop', label: 'Behind the glass', type: 'select', default: 'neon', options: [['neon', 'Neon rainy city'], ['moon', 'Moonlit rooftops'], ['dark', 'Plain dark']] },
      { key: 'creep', label: 'Creep speed', type: 'range', min: 0.3, max: 3, step: 0.1, default: 1 },
      { key: 'splatter', label: 'Splatter', type: 'range', min: 0, max: 2, step: 0.1, default: 1 },
      { key: 'rain', label: 'Rain on the glass', type: 'toggle', default: true },
      { key: 'lightning', label: 'Lightning', type: 'toggle', default: true },
    ],
    theme: (o) => {
      const v = SYMBIOTES[o.symbiote] || SYMBIOTES.venom;
      return {
        font: "'Outfit', system-ui, sans-serif",
        clockFont: "'Rubik Wet Paint', 'Outfit', sans-serif",
        clockWeight: 400,
        text: '#f3f4fa',
        dim: 'rgba(225,228,245,0.62)',
        accent: v.accent,
        card: 'rgba(5,5,10,0.72)',
        border: '1px solid rgba(255,255,255,0.08)',
        radius: '22px',
        shadow: 'inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -12px 24px rgba(0,0,0,0.5), 0 16px 40px rgba(0,0,0,0.6)',
        blur: '12px',
        textShadow: '0 2px 14px rgba(0,0,0,0.9)',
        field: 'rgba(255,255,255,0.06)',
        // the cursor is a little torch
        cursor: {
          svg: W.theme.glowSvg('#ffe7bf', 24), hot: [12, 12],
          ring: { size: 54, border: '1px solid rgba(255,231,191,0.35)', background: 'radial-gradient(circle, rgba(255,231,191,0.16), rgba(255,231,191,0) 70%)' },
        },
      };
    },

    create({ canvas, ctx: gl, input, opts, thumbnail }) {
      if (!gl) {
        canvas.style.background = 'radial-gradient(circle at 30% 60%, #3a0f2a, #05050c 60%)';
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
      ['uRes', 'uPx', 'uField', 'uCell', 'uTime', 'uLight', 'uPulse', 'uFlash', 'uBg', 'uRain', 'uParallax', 'uBase', 'uTint', 'uAlt', 'uPattern']
        .forEach((n) => (u[n] = gl.getUniformLocation(prog, n)));

      const tex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.uniform1i(u.uField, 0);

      const noise = U.makeNoise();
      let w = 1, h = 1, dpr = 1, time = 0, acc = 0;
      // simulation grid (css px): goo density per cell
      let cell = 8, GW = 1, GH = 1, goo, next, bytes, soft, tmp, growMask, central;
      let tips = [], drops = [], pulses = [];
      let phase = 'creep', phaseT = 0, coverage = 0, stepN = 0;
      let flash = 0, nextBolt = 8, widgetT = 0;
      const pulseData = new Float32Array(16);
      const sym = () => SYMBIOTES[opts.symbiote] || SYMBIOTES.venom;
      const creep = () => opts.creep;
      const scale = () => Math.min(w, h) / 900;

      // ---------- grid ----------
      function layout() {
        cell = clamp(Math.round(Math.min(w, h) / 125), 5, 14);
        GW = Math.ceil(w / cell) + 1;
        GH = Math.ceil(h / cell) + 1;
        const n = GW * GH;
        goo = new Float32Array(n);
        next = new Float32Array(n);
        bytes = new Uint8Array(n * 2);
        soft = new Float32Array(n);
        tmp = new Float32Array(n);
        growMask = new Float32Array(n);
        central = new Float32Array(n);
        for (let j = 0; j < GH; j++) {
          for (let i = 0; i < GW; i++) {
            const k = j * GW + i;
            // some regions are quicker to take, so the mass advances in fingers
            growMask[k] = 0.25 + 1.1 * Math.pow(clamp(noise.fbm2(i * 0.05, j * 0.05, 3) * 0.7 + 0.5, 0, 1), 1.6);
            central[k] = Math.min(Math.min(i, GW - 1 - i) / (GW / 2), Math.min(j, GH - 1 - j) / (GH / 2));
          }
        }
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG8, GW, GH, 0, gl.RG, gl.UNSIGNED_BYTE, bytes);
        tips = [];
        drops = [];
        pulses = [];
        phase = 'creep';
        phaseT = 0;
        // start part-way into a creep so the glass is already being taken
        const L = { x: -1e4, y: -1e4, r: 0, s: 0 };
        for (let i = 0; i < 130; i++) step(0.2, L);
        blurInto(soft);
      }

      // write a soft disc into a grid; the 0.5 contour lands on radius r
      function stamp(arr, x, y, r, max) {
        const i0 = Math.max(0, Math.floor((x - r) / cell) - 1), i1 = Math.min(GW - 1, Math.ceil((x + r) / cell) + 1);
        const j0 = Math.max(0, Math.floor((y - r) / cell) - 1), j1 = Math.min(GH - 1, Math.ceil((y + r) / cell) + 1);
        for (let j = j0; j <= j1; j++) {
          for (let i = i0; i <= i1; i++) {
            const d = Math.hypot((i + 0.5) * cell - x, (j + 0.5) * cell - y);
            const v = clamp(0.5 + (r - d) / (cell * 1.5), 0, 1) * max;
            const k = j * GW + i;
            if (v > arr[k]) arr[k] = v;
          }
        }
      }

      // ---------- tendrils ----------
      function spawnTip(parent) {
        const s = scale();
        let x, y, a, r0;
        if (parent) {
          x = parent.x;
          y = parent.y;
          a = parent.a + (Math.random() < 0.5 ? -1 : 1) * rand(0.5, 1.1);
          r0 = parent.r * 0.8;
        } else {
          // sprout from the edge of the goo, or from the window frame if there is none yet
          let found = null;
          for (let k = 0; k < 40 && !found; k++) {
            const i = 1 + Math.floor(rand(GW - 2)), j = 1 + Math.floor(rand(GH - 2)), c = j * GW + i;
            if (goo[c] > 0.5 && (goo[c - 1] < 0.5 || goo[c + 1] < 0.5 || goo[c - GW] < 0.5 || goo[c + GW] < 0.5)) found = [i, j];
          }
          if (found) {
            const [i, j] = found, c = j * GW + i;
            x = (i + 0.5) * cell;
            y = (j + 0.5) * cell;
            a = Math.atan2(goo[c - GW] - goo[c + GW], goo[c - 1] - goo[c + 1]);
          } else {
            const side = Math.floor(rand(4));
            x = side === 0 ? 0 : side === 1 ? w : rand(w);
            y = side === 2 ? 0 : side === 3 ? h : rand(h);
            a = Math.atan2(h / 2 - y, w / 2 - x) + rand(-0.6, 0.6);
          }
          r0 = rand(5, 14) * s;
        }
        tips.push({ x, y, a, r: r0, r0, v: rand(30, 65) * s, age: 0, life: rand(3, 8), seed: rand(100) });
      }

      function updateTips(dt, L) {
        const want = phase === 'creep' ? Math.round(6 + 8 * (1 - coverage)) : phase === 'takeover' ? 3 : 0;
        if (tips.length < want && Math.random() < dt * 3) spawnTip(null);
        for (let i = tips.length - 1; i >= 0; i--) {
          const t = tips[i];
          t.age += dt;
          const k = t.age / t.life;
          t.a += noise.n1(t.seed + time * 0.6) * 2.2 * dt;
          // shy of the light: turn away, and wither inside it
          if (L.s > 0) {
            const dx = t.x - L.x, dy = t.y - L.y, d = Math.hypot(dx, dy);
            if (d < L.r * 1.7) t.a += U.angleDiff(t.a, Math.atan2(dy, dx)) * dt * 4;
            if (d < L.r) t.age += dt * 4;
          }
          if (t.x < 20 || t.x > w - 20 || t.y < 20 || t.y > h - 20) t.a += U.angleDiff(t.a, Math.atan2(h / 2 - t.y, w / 2 - t.x)) * dt * 2;
          const sp = t.v * creep() * (phase === 'creep' ? 1 : 0.5) * dt;
          t.r = t.r0 * Math.max(0.3, Math.sqrt(Math.max(0, 1 - k)));
          // stamp along the whole move so long steps still leave an unbroken tendril
          const n = Math.max(1, Math.ceil(sp / (cell * 0.7)));
          for (let s = 0; s < n; s++) {
            t.x += (Math.cos(t.a) * sp) / n;
            t.y += (Math.sin(t.a) * sp) / n;
            stamp(goo, t.x, t.y, t.r, 1);
          }
          if (Math.random() < dt * 0.25 && tips.length < 30 && k < 0.6) spawnTip(t);
          if (k >= 1) tips.splice(i, 1);
        }
      }

      // ---------- the mass: thickens and spreads, or pulls back to the edges ----------
      // While receding, a ragged front sweeps from the middle of the screen out toward the frame.
      const recedeFront = () => Math.max(0.08, 1 - phaseT * 0.07 * creep());

      function spread(dt) {
        const grow = phase === 'recede' ? 0 : (phase === 'takeover' ? 1.6 : 0.75) * creep();
        const front = phase === 'recede' ? recedeFront() : 0;
        let covered = 0;
        for (let j = 0; j < GH; j++) {
          const row = j * GW, up = (j > 0 ? j - 1 : j) * GW, dn = (j < GH - 1 ? j + 1 : j) * GW;
          for (let i = 0; i < GW; i++) {
            const k = row + i;
            let c = goo[k];
            const l = goo[row + (i > 0 ? i - 1 : i)], r = goo[row + (i < GW - 1 ? i + 1 : i)], a = goo[up + i], b = goo[dn + i];
            if (grow) {
              const mx = Math.max(l, r, a, b) * 0.97;
              if (mx > c) c += (mx - c) * grow * growMask[k] * growMask[k] * dt;
              if (c > 0.45) c += (1 - c) * 0.8 * dt;
            } else if (front && central[k] + (growMask[k] - 0.8) * 0.15 > front) {
              c -= dt * 1.6 * creep();
            }
            c = c < 0.015 ? 0 : c > 1 ? 1 : c;
            next[k] = c;
            if (c > 0.5) covered++;
          }
        }
        const t = goo;
        goo = next;
        next = t;
        coverage = covered / (GW * GH);
      }

      // apply fn(k, distance) to every cell within radius R of (x, y)
      function around(x, y, R, fn) {
        const i0 = Math.max(0, Math.floor((x - R) / cell)), i1 = Math.min(GW - 1, Math.ceil((x + R) / cell));
        const j0 = Math.max(0, Math.floor((y - R) / cell)), j1 = Math.min(GH - 1, Math.ceil((y + R) / cell));
        for (let j = j0; j <= j1; j++) {
          for (let i = i0; i <= i1; i++) {
            const d = Math.hypot((i + 0.5) * cell - x, (j + 0.5) * cell - y);
            if (d < R) fn(j * GW + i, d);
          }
        }
      }

      function repel(dt, L) {
        if (L.s <= 0) return;
        around(L.x, L.y, L.r, (k, d) => {
          goo[k] = Math.max(0, goo[k] - dt * (3.2 * (1 - d / L.r) + 0.6) * L.s);
        });
      }

      function updatePulses(dt) {
        for (let i = pulses.length - 1; i >= 0; i--) {
          const p = pulses[i];
          p.R += p.speed * dt;
          p.s = 1 - p.R / p.max;
          if (p.s <= 0) { pulses.splice(i, 1); continue; }
          const band = 40 * scale() + cell * 2;
          around(p.x, p.y, p.R, (k, d) => {
            if (d > p.R - band) goo[k] *= Math.exp(-dt * 16 * p.s);
            else goo[k] = Math.max(0, goo[k] - dt * 2.5 * p.s);
          });
        }
      }

      function updateDrops(dt) {
        for (let i = drops.length - 1; i >= 0; i--) {
          const d = drops[i];
          d.age += dt;
          d.x += d.vx * dt;
          d.y += d.vy * dt;
          const drag = Math.exp(-dt * 4);
          d.vx *= drag;
          d.vy = d.vy * drag + 60 * dt;
          // lands on the glass and starts growing again from there
          if (d.age >= d.life) {
            stamp(goo, d.x, d.y, d.r * 0.9, 1);
            drops.splice(i, 1);
          }
        }
      }

      // ---------- the cycle ----------
      function light() {
        if (!input.active) return { x: -1e4, y: -1e4, r: 0, s: 0 };
        // hold still and the light dims, letting the goo creep back toward you
        const still = (performance.now() - input.lastMove) / 1000;
        const s = lerp(1, 0.5, U.smoothstep(2, 9, still));
        return { x: input.sx, y: input.sy, r: Math.min(w, h) * 0.15 * s, s };
      }

      // creep until it has nearly all of the glass, hold it for a few seconds, then pull back
      function updatePhase(dt) {
        phaseT += dt;
        if (phase === 'creep') {
          if (coverage > 0.76 || (phaseT > 150 && coverage > 0.55)) {
            phase = 'takeover';
            phaseT = 0;
          }
        } else if (phase === 'takeover') {
          if (phaseT > 7) {
            phase = 'recede';
            phaseT = 0;
          }
        } else if (recedeFront() <= 0.08) {
          phase = 'creep';
          phaseT = 0;
        }
      }

      function step(dt, L) {
        updateTips(dt, L);
        // the slow mass update runs at half rate
        if (++stepN % 2 === 0) spread(dt * 2);
        repel(dt, L);
        updatePulses(dt);
        updateDrops(dt);
        updatePhase(dt);
      }

      // box blur (radius 2) along rows then columns, twice: a soft copy of the goo for its height
      function blurInto(dst) {
        const R = 2, k = 1 / (2 * R + 1);
        let src = goo;
        for (let pass = 0; pass < 2; pass++) {
          for (let j = 0; j < GH; j++) {
            const row = j * GW;
            let acc = 0;
            for (let i = -R; i <= R; i++) acc += src[row + clamp(i, 0, GW - 1)];
            for (let i = 0; i < GW; i++) {
              tmp[row + i] = acc * k;
              acc += src[row + Math.min(GW - 1, i + R + 1)] - src[row + Math.max(0, i - R)];
            }
          }
          for (let i = 0; i < GW; i++) {
            let acc = 0;
            for (let j = -R; j <= R; j++) acc += tmp[clamp(j, 0, GH - 1) * GW + i];
            for (let j = 0; j < GH; j++) {
              dst[j * GW + i] = acc * k;
              acc += tmp[Math.min(GH - 1, j + R + 1) * GW + i] - tmp[Math.max(0, j - R) * GW + i];
            }
          }
          src = dst;
        }
      }

      // ---------- widgets: tell each one how much goo covers it ----------
      function syncWidgets(dt) {
        if (thumbnail || !W.widgets || !W.widgets.elements) return;
        widgetT -= dt;
        if (widgetT > 0) return;
        widgetT = 0.25;
        for (const el of W.widgets.elements()) {
          const r = el.getBoundingClientRect();
          const i0 = clamp(Math.floor(r.left / cell), 0, GW - 1), i1 = clamp(Math.floor(r.right / cell), 0, GW - 1);
          const j0 = clamp(Math.floor(r.top / cell), 0, GH - 1), j1 = clamp(Math.floor(r.bottom / cell), 0, GH - 1);
          let sum = 0, n = 0;
          for (let j = j0; j <= j1; j += 2) {
            for (let i = i0; i <= i1; i += 2) {
              sum += goo[j * GW + i] > 0.5 ? 1 : 0;
              n++;
            }
          }
          el.style.setProperty('--goo', n ? (sum / n).toFixed(2) : '0');
          el.style.setProperty('--goo-color', sym().css);
          el.style.setProperty('--goo-rim', sym().rim);
          if (!el.style.getPropertyValue('--goo-shift')) el.style.setProperty('--goo-shift', `${Math.round(rand(220))}px`);
        }
      }
      function clearWidgets() {
        if (thumbnail || !W.widgets || !W.widgets.elements) return;
        for (const el of W.widgets.elements()) {
          el.style.removeProperty('--goo');
          el.style.removeProperty('--goo-color');
          el.style.removeProperty('--goo-rim');
          el.style.removeProperty('--goo-shift');
        }
      }

      return {
        resize(nw, nh, ndpr) {
          w = nw;
          h = nh;
          dpr = ndpr;
          gl.viewport(0, 0, canvas.width, canvas.height);
          layout();
        },
        frame(dt, t) {
          time = t;
          const L = light();
          // simulate at a steady 30 Hz whatever the frame rate
          acc = Math.min(acc + dt, 0.2);
          let stepped = false;
          while (acc >= 1 / 30) {
            step(1 / 30, L);
            acc -= 1 / 30;
            stepped = true;
          }
          if (stepped) blurInto(soft);
          if (opts.lightning && time > nextBolt) {
            flash = 1;
            nextBolt = time + rand(12, 28);
            if (!thumbnail) W.audio.cue('thunder', rand(0.6, 1.6));
          }
          flash = Math.max(0, flash - dt * 2.2);
          if (flash > 0.5 && flash < 0.6) flash = 0.2;
          syncWidgets(dt);

          // upload density and its soft copy, with any flying splatter drawn on top
          for (let k = 0; k < goo.length; k++) {
            bytes[k * 2] = goo[k] * 255;
            bytes[k * 2 + 1] = soft[k] * 255;
          }
          for (const d of drops) {
            const i0 = Math.max(0, Math.floor((d.x - d.r) / cell) - 1), i1 = Math.min(GW - 1, Math.ceil((d.x + d.r) / cell) + 1);
            const j0 = Math.max(0, Math.floor((d.y - d.r) / cell) - 1), j1 = Math.min(GH - 1, Math.ceil((d.y + d.r) / cell) + 1);
            for (let j = j0; j <= j1; j++) {
              for (let i = i0; i <= i1; i++) {
                const dd = Math.hypot((i + 0.5) * cell - d.x, (j + 0.5) * cell - d.y);
                const v = clamp(0.5 + (d.r - dd) / (cell * 1.5), 0, 1) * 255;
                const k = (j * GW + i) * 2;
                if (v > bytes[k]) bytes[k] = bytes[k + 1] = v;
              }
            }
          }
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, GW, GH, gl.RG, gl.UNSIGNED_BYTE, bytes);

          for (let i = 0; i < 4; i++) {
            const p = pulses[i];
            pulseData.set(p ? [p.x, p.y, p.R, p.s] : [0, 0, 0, 0], i * 4);
          }
          const v = sym();
          gl.uniform2f(u.uRes, canvas.width, canvas.height);
          gl.uniform1f(u.uPx, dpr);
          gl.uniform1f(u.uCell, cell);
          gl.uniform1f(u.uTime, time);
          gl.uniform4f(u.uLight, L.x, L.y, L.r, L.s);
          gl.uniform4fv(u.uPulse, pulseData);
          gl.uniform1f(u.uFlash, flash);
          gl.uniform1i(u.uBg, BACKDROPS[opts.backdrop] || 0);
          gl.uniform1f(u.uRain, opts.rain ? 1 : 0);
          gl.uniform2f(u.uParallax, input.px, input.py);
          gl.uniform3fv(u.uBase, vec3(v.base));
          gl.uniform3fv(u.uTint, vec3(v.tint));
          gl.uniform3fv(u.uAlt, vec3(v.alt));
          gl.uniform1i(u.uPattern, v.pattern);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
        },
        onPointerDown(x, y) {
          const m = Math.max(w, h);
          pulses.unshift({ x, y, R: 0, s: 1, speed: m * 0.9, max: m * 0.55 });
          pulses.length = Math.min(pulses.length, 4);
          // goo near the blast splatters outward and regrows wherever it lands
          const n = Math.round(26 * opts.splatter);
          const reach = Math.min(w, h) * 0.3;
          for (let k = 0, tries = 0; k < n && tries < n * 6; tries++) {
            const a = rand(Math.PI * 2), d = rand(0.1, 1) * reach;
            const sx = x + Math.cos(a) * d, sy = y + Math.sin(a) * d;
            const i = Math.floor(sx / cell), j = Math.floor(sy / cell);
            if (i < 0 || j < 0 || i >= GW || j >= GH || goo[j * GW + i] < 0.5) continue;
            const v = rand(250, 750) * scale();
            drops.push({ x: sx, y: sy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: rand(4, 12) * scale(), age: 0, life: rand(0.3, 0.8) });
            k++;
          }
          // a pulse breaks a takeover and the goo has to start over
          if (phase === 'takeover') {
            phase = 'creep';
            phaseT = 0;
          }
          if (!thumbnail) W.audio.cue('pulse');
        },
        destroy() {
          clearWidgets();
          gl.deleteTexture(tex);
          gl.deleteBuffer(buf);
          gl.deleteProgram(prog);
        },
      };
    },
  });
})();
