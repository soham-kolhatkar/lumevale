/* Theme: each scene styles the widgets (fonts, colours, card look) and the cursor.
   A scene's `theme` is an object or a function of its options; missing keys fall back to DEFAULT. */
(function () {
  const W = window.Lumevale;
  const U = W.util;

  const DEFAULT = {
    font: "'Outfit', system-ui, sans-serif",
    clockFont: null, // defaults to font
    clockWeight: 200,
    text: '#ffffff',
    dim: 'rgba(255,255,255,0.62)',
    accent: '#9fd8ff',
    card: 'rgba(16,18,28,0.42)',
    border: '1px solid rgba(255,255,255,0.14)',
    radius: '18px',
    shadow: '0 12px 40px rgba(0,0,0,0.25)',
    blur: '18px',
    textShadow: '0 2px 18px rgba(0,0,0,0.45)',
    field: 'rgba(255,255,255,0.08)', // inputs inside widgets
    cursor: null, // { svg, hot: [x, y], ring?: { size, border, background, shadow } }
  };

  // ---------- cursor helpers scenes can use ----------
  // Build a crisp pixel-art SVG from a map of characters → colours.
  function pixelSvg(rows, palette, scale = 2) {
    const h = rows.length, w = Math.max(...rows.map((r) => r.length));
    let rects = '';
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const c = palette[row[x]];
        if (c) rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${c}"/>`;
      }
    });
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w * scale}" height="${h * scale}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${rects}</svg>`;
  }
  const dotSvg = (fill, stroke, r = 4, size = 24) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/></svg>`;
  const glowSvg = (color, size = 28) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><defs><radialGradient id="g"><stop offset="0" stop-color="#fff"/><stop offset="0.3" stop-color="${color}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient></defs><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="url(#g)"/></svg>`;
  const starSvg = (fill, size = 26) => {
    const c = size / 2, r = size / 2 - 1, k = r * 0.22;
    const d = `M${c},${c - r} Q${c + k},${c - k} ${c + r},${c} Q${c + k},${c + k} ${c},${c + r} Q${c - k},${c + k} ${c - r},${c} Q${c - k},${c - k} ${c},${c - r}Z`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><path d="${d}" fill="${fill}" stroke="rgba(20,10,40,0.55)" stroke-width="1"/><circle cx="${c}" cy="${c}" r="1.6" fill="#fff"/></svg>`;
  };

  let current = DEFAULT;
  let ring = null;
  const rs = { x: 0, y: 0, shown: false };

  function cssUrl(svg) {
    return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
  }

  function apply(def, opts) {
    const raw = def && def.theme ? (typeof def.theme === 'function' ? def.theme(opts || {}) : def.theme) : {};
    const t = (current = { ...DEFAULT, ...raw });
    const root = document.documentElement.style;
    root.setProperty('--w-font', t.font);
    root.setProperty('--w-clock-font', t.clockFont || t.font);
    root.setProperty('--w-clock-weight', t.clockWeight);
    root.setProperty('--w-text', t.text);
    root.setProperty('--w-dim', t.dim);
    root.setProperty('--w-accent', t.accent);
    root.setProperty('--w-card', t.card);
    root.setProperty('--w-border', t.border);
    root.setProperty('--w-radius', t.radius);
    root.setProperty('--w-shadow', t.shadow);
    root.setProperty('--w-blur', t.blur);
    root.setProperty('--w-tshadow', t.textShadow);
    root.setProperty('--w-field', t.field);
    root.setProperty('--ui-accent', t.accent);

    const stage = document.getElementById('stage');
    const c = t.cursor;
    stage.style.cursor = c && c.svg ? `${cssUrl(c.svg)} ${c.hot[0]} ${c.hot[1]}, auto` : '';
    if (c && c.ring) {
      const r = c.ring;
      Object.assign(ring.style, {
        width: `${r.size}px`, height: `${r.size}px`,
        border: r.border || 'none',
        background: r.background || 'transparent',
        boxShadow: r.shadow || 'none',
        borderRadius: r.radius || '50%',
        display: 'block',
      });
    } else ring.style.display = 'none';
    document.body.dataset.scene = def ? def.id : '';
  }

  // The trailing ring lags behind the pointer for a soft, floaty feel.
  function tick(dt) {
    const c = current.cursor;
    if (!c || !c.ring) return;
    const inp = W.input;
    const show = inp.inside && !inp.overUi && !W.editing && !document.body.classList.contains('idle');
    rs.x = U.damp(rs.x, inp.x, 14, dt);
    rs.y = U.damp(rs.y, inp.y, 14, dt);
    const s = 1 + Math.min(0.6, inp.speed / 3000) + (inp.down ? -0.25 : 0);
    ring.style.transform = `translate(${rs.x - c.ring.size / 2}px, ${rs.y - c.ring.size / 2}px) scale(${s.toFixed(3)})`;
    if (show !== rs.shown) {
      ring.style.opacity = show ? '1' : '0';
      rs.shown = show;
    }
  }

  W.theme = {
    init() {
      ring = document.getElementById('cursor-ring');
      W.on('scene', (def, opts) => apply(def, opts));
      W.on('sceneOptions', (def, opts) => apply(def, opts));
      W.on('tick', tick);
    },
    current: () => current,
    pixelSvg, dotSvg, glowSvg, starSvg,
  };
})();
