# Lumevale — live wallpaper / screensaver

A full-screen animated wallpaper that runs in the browser. Plain HTML/JS, no build step, no assets to download.

## Run it

Double-click `index.html` (or open it in Chrome / Edge / Firefox), then press **F** or double-click for fullscreen.

Open a specific scene directly: `index.html?scene=koi` (ids: `rain`, `koi`, `jelly`, `astro`, `flow`, `venom`, `pendulum`).
Preview time-of-day lighting at any hour: `index.html?hour=19`.

## Scenes

| # | Scene | Style | Mouse |
|---|-------|-------|-------|
| 1 | Rainy Window | Pixel art · lofi | Wipe the fogged glass, wake the cat, click the cat to pet it, click glass for drops |
| 2 | Koi Pond | Watercolour | Koi get curious about a resting cursor, scatter from fast moves; click to feed |
| 3 | Deep Ocean | Bioluminescent glow | Plankton trail, jellies drift away; click sends a light pulse |
| 4 | Lonely Astronaut | Flat illustration | Parallax, the astronaut watches the cursor; click for a shooting star |
| 5 | Silk Flow | Abstract shader (WebGL2) | Cursor stirs the silk; click for ripples |
| 6 | Venom | Symbiote takeover (WebGL2) | Goo creeps across the window and swallows it; the cursor is a light it shrinks from (hold still and it creeps back), click for a sonic pulse that blasts it away |
| 7 | Pendulum Wave | Satisfying · soft 3D | A row of pendulums drifts into snakes and braids and lines up again every cycle, ringing a note per swing; grab a ball and let go, swipe across the strings to pluck them, click empty space to gather every ball and release them together |

## Keys

`←` `→` switch scene · `1`–`9` jump · `T` customize scene · `W` widgets · `E` arrange widgets · `F` fullscreen ·
`Space` pause · `M` sound · `S` settings · `G` scenes · `H` hide all UI · `Esc` close

## Customizing scenes (palette button / `T`)

Every scene has its own options, for example the cat, room colours, rain and pixel size in Rainy Window;
water, koi varieties and falling petals or maple leaves in Koi Pond; glow colours and density in Deep Ocean;
sky, planet and spacesuit in Lonely Astronaut; palette (including custom colours), pattern (silk, marble, smoke,
waves, aurora), speed, zoom, sheen and grain in Silk Flow; symbiote (Venom, Carnage, Anti-Venom), what's behind the
glass (neon city, moonlit rooftops, plain dark), creep speed, splatter, rain and lightning in Venom; room (studio or midnight glow), ball colours, number of pendulums,
seconds until they line up, swing, motion trails, a traced wave line and chimes in Pendulum Wave. The scene picker shows live thumbnails rendered from
each scene with your options applied.

Each scene also themes the widgets (fonts, colours, card style) and the cursor: a pixel arrow in the rain,
a ripple ring over the pond, a glowing orb in the ocean, a star with a sparkle trail in space, a soft ring on silk,
a little torch for Venom (with a dripping clock, and goo that drips down any widget it crawls over), a soft ring
with frosted cards in Pendulum Wave.

## Widgets (grid button / `W`)

Clock, greeting & daily focus, weather (Open-Meteo, no key needed), note, to-do, focus timer (pomodoro),
calendar, world clock, countdown, moon phase, quote, breathing guide. Each can be switched on and configured
on its own. Press **Arrange widgets** (or `E`) to drag them anywhere and scroll over one to resize it.

## Saved settings

Everything is kept in your browser's localStorage: global settings, each scene's options, widget positions
and sizes, your note, to-dos, daily focus and timer state.

## Adding a scene

Create `js/scenes/my-scene.js` and add a `<script>` tag for it in `index.html`:

```js
Lumevale.registerScene({
  id: 'mine', name: 'My Scene', style: 'Whatever', swatch: ['#000', '#fff'],
  ambience: 'pad',            // rain | water | deep | space | pad | symbiote | chimes
  type: '2d',                 // or 'webgl' (WebGL2 context)
  // pixelHeight: 216,        // optional: crisp pixel-art rendering (number or (opts) => number)
  options: [                  // shown in the Customize panel, saved per scene
    { key: 'color', label: 'Colour', type: 'color', default: '#88ccff' },
    { key: 'amount', label: 'Amount', type: 'range', min: 0, max: 2, step: 0.1, default: 1 },
    { key: 'style', label: 'Style', type: 'select', default: 'a', options: [['a', 'A'], ['b', 'B']], rebuild: true },
  ],
  theme: (opts) => ({ font: "'Outfit'", accent: opts.color, card: 'rgba(0,0,0,.4)' }), // widgets + cursor
  create({ canvas, ctx, input, env, opts, util }) {
    return {
      resize(w, h, dpr) {},   // CSS px; 2D contexts are pre-scaled by dpr
      frame(dt, t) {},        // draw one frame; read opts.* live
      onPointerDown(x, y) {}, // optional
      onPointerMove(x, y) {}, // optional
      destroy() {},           // optional
    };
  },
});
```

`input` gives the pointer (`x`, `y`, smoothed `sx`/`sy`, parallax `px`/`py` in -1..1, `speed`, `active`).
`env.mood(defaultDay, defaultDusk)` returns the lighting to use, following local time when that setting is on.
`Lumevale.audio.cue(name)` plays a one-shot sound from the current ambience (`thunder` and `pulse` for `symbiote`,
`chime(midi, gain, pan, delay)` for `chimes`);
it does nothing while sound is off. Skip it when `create` receives `thumbnail: true`.

## Adding a widget

Add a file to `js/widgets/` (and a script tag) that calls `Lumevale.registerWidget({ id, name, desc, pos, defaults,
config, card, live, create(el, cfg, api) })`. Style it with the `--w-*` CSS variables so it follows each scene's theme.
Scenes can find mounted widgets with `Lumevale.widgets.elements()` (Venom uses it to drip goo over them).
