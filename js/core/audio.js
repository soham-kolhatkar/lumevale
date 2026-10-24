/* Procedural ambient sound via Web Audio. No audio files: everything is synthesised. */
(function () {
  const W = window.Lumevale;
  const S = W.settings;
  const U = W.util;

  let ac = null, master = null, reverb = null, whiteBuf = null, brownBuf = null;
  let current = null; // { name, out, stop }
  let ambience = null; // requested ambience name
  let tracked = null; // long-running sources of the ambience being built, stopped on switch
  const track = (node) => (tracked && tracked.push(node), node);

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function ensure() {
    if (ac) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = 0;
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.ratio.value = 3;
    master.connect(comp).connect(ac.destination);

    reverb = ac.createConvolver();
    reverb.buffer = impulse(4, 2.2);
    const wet = ac.createGain();
    wet.gain.value = 0.7;
    reverb.connect(wet).connect(master);

    whiteBuf = noiseBuffer(false);
    brownBuf = noiseBuffer(true);
    return true;
  }

  function noiseBuffer(brown) {
    const len = ac.sampleRate * 4;
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else d[i] = w;
    }
    return buf;
  }

  function impulse(seconds, decay) {
    const len = ac.sampleRate * seconds;
    const buf = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  // ---------- Building blocks ----------
  function noise(buf, dest, { type = 'lowpass', freq = 1000, q = 0.7, gain = 0.2 } = {}) {
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.loopStart = Math.random() * 2;
    const f = ac.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ac.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(dest);
    src.start(0, Math.random() * 3);
    track(src);
    return { src, filter: f, gain: g };
  }

  function lfo(param, rate, depth, dest) {
    const o = ac.createOscillator();
    o.frequency.value = rate;
    const g = ac.createGain();
    g.gain.value = depth;
    o.connect(g).connect(param);
    o.start();
    return track(o);
  }

  function bell(freq, gain, dest, decay = 2.5, when = ac.currentTime) {
    [[1, 1], [2.01, 0.35], [3.98, 0.12]].forEach(([mult, amp]) => {
      const o = ac.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq * mult;
      const g = ac.createGain();
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(gain * amp, when + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, when + decay / mult);
      o.connect(g).connect(dest);
      o.start(when);
      o.stop(when + decay + 0.1);
    });
  }

  // Soft sustained chord with slow attack/release.
  function chord(notes, dur, gain, dest, { type = 'triangle', cutoff = 900, attack = 3 } = {}) {
    const t = ac.currentTime;
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.setValueAtTime(gain, t + dur - attack);
    g.gain.linearRampToValueAtTime(0, t + dur);
    f.connect(g).connect(dest);
    notes.forEach((m) => {
      [-4, 4].forEach((cents) => {
        const o = ac.createOscillator();
        o.type = type;
        o.frequency.value = mtof(m);
        o.detune.value = cents + U.rand(-2, 2);
        o.connect(f);
        o.start(t);
        o.stop(t + dur + 0.1);
      });
    });
  }

  // ---------- Ambiences ----------
  // Each builder gets (out, wet, every); `every` schedules random events. A builder may return
  // one-shot cues ({ name(...args) }) that its scene triggers through W.audio.cue(name).
  const builders = {
    rain(out, wet, every) {
      const hiss = noise(whiteBuf, out, { type: 'bandpass', freq: 2400, q: 0.35, gain: 0.22 });
      lfo(hiss.gain.gain, 0.07, 0.05);
      noise(brownBuf, out, { type: 'lowpass', freq: 500, gain: 0.35 });
      every(0.08, 0.5, () => bell(U.rand(2200, 4200), U.rand(0.004, 0.014), U.rand() < 0.5 ? out : wet, 0.12));
      const keys = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]];
      let i = 0;
      every(9, 9, () => chord(keys[i++ % keys.length], 10, 0.018, wet, { type: 'sine', cutoff: 1400, attack: 2.5 }), true);
    },
    water(out, wet, every) {
      const stream = noise(brownBuf, out, { type: 'bandpass', freq: 650, q: 0.6, gain: 0.5 });
      lfo(stream.filter.frequency, 0.05, 180);
      const babble = noise(whiteBuf, out, { type: 'bandpass', freq: 2600, q: 2.5, gain: 0.025 });
      lfo(babble.gain.gain, 0.6, 0.012);
      const scale = [74, 76, 78, 81, 83, 86, 88];
      every(2, 7, () => {
        const n = U.randInt(1, 3);
        for (let k = 0; k < n; k++) bell(mtof(U.choice(scale)), 0.03, wet, 3.5, ac.currentTime + k * U.rand(0.12, 0.35));
      });
    },
    deep(out, wet, every) {
      const rumble = noise(brownBuf, out, { type: 'lowpass', freq: 220, gain: 0.7 });
      lfo(rumble.filter.frequency, 0.03, 90);
      [33, 40, 45].forEach((m, k) => {
        const o = ac.createOscillator();
        o.frequency.value = mtof(m);
        const g = ac.createGain();
        g.gain.value = 0.035;
        lfo(g.gain, 0.05 + k * 0.03, 0.02);
        o.connect(g).connect(out);
        o.start();
        track(o);
      });
      every(7, 15, () => bell(U.choice([mtof(81), mtof(76), mtof(84)]), 0.035, wet, 4));
      every(3, 9, () => {
        const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
        o.frequency.setValueAtTime(U.rand(250, 400), t);
        o.frequency.exponentialRampToValueAtTime(U.rand(800, 1300), t + 0.08);
        g.gain.setValueAtTime(0.012, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
        o.connect(g).connect(wet);
        o.start(t);
        o.stop(t + 0.12);
      });
    },
    space(out, wet, every) {
      const air = noise(whiteBuf, out, { type: 'bandpass', freq: 700, q: 0.4, gain: 0.03 });
      lfo(air.gain.gain, 0.04, 0.015);
      const prog = [[45, 52, 57, 59, 64], [41, 48, 55, 57, 64], [48, 55, 59, 62, 64], [43, 50, 55, 57, 62]];
      let i = 0;
      every(11, 11, () => chord(prog[i++ % prog.length], 15, 0.022, wet, { cutoff: 800, attack: 4 }), true);
      const sparkle = [81, 84, 86, 88, 91, 93];
      every(1.5, 5, () => bell(mtof(U.choice(sparkle)), 0.012, wet, 2.5));
    },
    pad(out, wet, every) {
      noise(whiteBuf, out, { type: 'lowpass', freq: 500, gain: 0.03 });
      const prog = [[50, 57, 61, 64, 66], [47, 54, 57, 62, 66], [43, 50, 54, 57, 62], [45, 52, 57, 59, 64]];
      let i = 0;
      every(12, 12, () => chord(prog[i++ % prog.length], 17, 0.024, wet, { type: 'sine', cutoff: 1200, attack: 5 }), true);
      every(6, 14, () => bell(mtof(U.choice([62, 66, 69, 74])), 0.015, wet, 5));
    },
    chimes(out, wet, every) {
      // quiet room tone under a slow pad; the scene rings a bell per pendulum through the chime cue
      noise(brownBuf, out, { type: 'lowpass', freq: 320, gain: 0.07 });
      const prog = [[48, 55, 62, 64], [45, 52, 55, 60], [41, 48, 57, 64], [43, 50, 55, 64]];
      let i = 0;
      every(14, 14, () => chord(prog[i++ % prog.length], 19, 0.012, wet, { type: 'sine', cutoff: 900, attack: 6 }), true);
      return {
        chime(midi, gain = 0.03, pan = 0, delay = 0) {
          const p = ac.createStereoPanner();
          p.pan.value = U.clamp(pan, -1, 1);
          p.connect(wet);
          bell(mtof(midi), gain, p, 1.4, ac.currentTime + delay);
          setTimeout(() => p.disconnect(), (delay + 1.8) * 1000);
        },
      };
    },
    symbiote(out, wet, every) {
      // rain on the rooftops and a slow, wet, breathing growl
      const hiss = noise(whiteBuf, out, { type: 'bandpass', freq: 2600, q: 0.3, gain: 0.16 });
      lfo(hiss.gain.gain, 0.06, 0.04);
      noise(brownBuf, out, { type: 'lowpass', freq: 240, gain: 0.45 });
      const f = ac.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 200;
      f.Q.value = 4;
      const breath = ac.createGain();
      breath.gain.value = 0.035;
      [43.6, 44.1, 87.5].forEach((fr) => {
        const o = ac.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = fr;
        o.connect(f);
        o.start();
        track(o);
      });
      f.connect(breath).connect(out);
      lfo(breath.gain, 0.13, 0.028);
      lfo(f.frequency, 0.13, 80);
      every(9, 20, () => bell(mtof(U.choice([38, 41, 44])), 0.02, wet, 6));
      return {
        thunder(delay = 1) {
          const t = ac.currentTime + delay;
          const crack = noise(whiteBuf, out, { type: 'lowpass', freq: 2400, gain: 0 });
          crack.gain.gain.setValueAtTime(0, t);
          crack.gain.gain.linearRampToValueAtTime(0.35, t + 0.02);
          crack.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
          crack.src.stop(t + 0.6);
          const rumble = noise(brownBuf, wet, { type: 'lowpass', freq: 600, gain: 0 });
          rumble.filter.frequency.setValueAtTime(700, t);
          rumble.filter.frequency.exponentialRampToValueAtTime(110, t + 4);
          rumble.gain.gain.setValueAtTime(0, t);
          rumble.gain.gain.linearRampToValueAtTime(0.9, t + 0.15);
          rumble.gain.gain.setTargetAtTime(0.5, t + 0.6, 0.3);
          rumble.gain.gain.setTargetAtTime(0, t + 1.6, 1);
          rumble.src.stop(t + 6);
        },
        // sonic blast: a rising ringing tone, the symbiote's shriek, and a wet splat
        pulse() {
          const t = ac.currentTime;
          const ring = ac.createOscillator(), trem = ac.createOscillator();
          const tg = ac.createGain(), tremDepth = ac.createGain(), env = ac.createGain();
          ring.frequency.setValueAtTime(1500, t);
          ring.frequency.exponentialRampToValueAtTime(3400, t + 0.45);
          trem.frequency.value = 36;
          tg.gain.value = 0.5;
          tremDepth.gain.value = 0.5;
          trem.connect(tremDepth).connect(tg.gain);
          env.gain.setValueAtTime(0.0001, t);
          env.gain.exponentialRampToValueAtTime(0.05, t + 0.02);
          env.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
          ring.connect(tg).connect(env);
          env.connect(out);
          env.connect(wet);
          [ring, trem].forEach((o) => { o.start(t); o.stop(t + 0.75); });
          const shriek = ac.createOscillator(), bp = ac.createBiquadFilter(), sg = ac.createGain();
          shriek.type = 'sawtooth';
          shriek.frequency.setValueAtTime(520, t + 0.05);
          shriek.frequency.exponentialRampToValueAtTime(1300, t + 0.35);
          shriek.frequency.exponentialRampToValueAtTime(700, t + 0.7);
          bp.type = 'bandpass';
          bp.frequency.value = 1400;
          bp.Q.value = 2;
          sg.gain.setValueAtTime(0.0001, t);
          sg.gain.exponentialRampToValueAtTime(0.04, t + 0.1);
          sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
          shriek.connect(bp).connect(sg).connect(wet);
          shriek.start(t);
          shriek.stop(t + 0.8);
          const splat = noise(brownBuf, out, { type: 'lowpass', freq: 500, gain: 0 });
          splat.gain.gain.setValueAtTime(0, t);
          splat.gain.gain.linearRampToValueAtTime(0.5, t + 0.01);
          splat.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
          splat.src.stop(t + 0.35);
        },
      };
    },
  };

  function start(name) {
    const build = builders[name];
    if (!build) return null;
    const out = ac.createGain();
    out.gain.setValueAtTime(0, ac.currentTime);
    out.gain.linearRampToValueAtTime(1, ac.currentTime + 3);
    out.connect(master);
    const wet = ac.createGain();
    wet.connect(out);
    wet.connect(reverb);
    const timers = new Set();
    let alive = true;
    function every(min, max, fn, immediate) {
      const tick = () => {
        if (!alive) return;
        try { fn(); } catch (e) { /* ignore */ }
        const id = setTimeout(tick, U.rand(min, max) * 1000);
        timers.add(id);
      };
      const id = setTimeout(tick, immediate ? 50 : U.rand(min, max) * 1000);
      timers.add(id);
    }
    const nodes = (tracked = []);
    const cues = build(out, wet, every) || {};
    tracked = null;
    return {
      name,
      cues,
      stop() {
        alive = false;
        timers.forEach(clearTimeout);
        const t = ac.currentTime;
        out.gain.cancelScheduledValues(t);
        out.gain.setValueAtTime(out.gain.value, t);
        out.gain.linearRampToValueAtTime(0, t + 2.5);
        // Disconnecting the output silences all sources feeding it; they get GC'd.
        setTimeout(() => {
          nodes.forEach((n) => { try { n.stop(); } catch (e) { /* already stopped */ } });
          out.disconnect();
        }, 2800);
      },
    };
  }

  function sync() {
    const want = S.get('sound') ? ambience : null;
    if (!want) {
      if (current) { current.stop(); current = null; }
      if (ac) master.gain.setTargetAtTime(0, ac.currentTime, 0.4);
      return;
    }
    if (!ensure()) return;
    if (ac.state === 'suspended') ac.resume();
    master.gain.setTargetAtTime(S.get('volume') * 0.9, ac.currentTime, 0.5);
    if (current && current.name === want) return;
    if (current) current.stop();
    current = start(want);
  }

  // Browsers only allow audio after a user gesture; retry on the first one.
  function unlock() {
    if (S.get('sound')) sync();
    if (ac && ac.state === 'running') {
      removeEventListener('pointerdown', unlock);
      removeEventListener('keydown', unlock);
    }
  }
  addEventListener('pointerdown', unlock);
  addEventListener('keydown', unlock);

  S.onChange((k, v) => {
    if (k === 'sound') sync();
    if (k === 'volume' && ac && S.get('sound')) master.gain.setTargetAtTime(v * 0.9, ac.currentTime, 0.2);
  });

  W.audio = {
    setAmbience(name) {
      ambience = name || null;
      sync();
    },
    blocked: () => S.get('sound') && (!ac || ac.state !== 'running'),
    // One-shot sound from the current ambience (e.g. a sonic pulse); silent when sound is off.
    cue(name, ...args) {
      if (!current || !S.get('sound') || ac.state !== 'running' || !current.cues[name]) return;
      try { current.cues[name](...args); } catch (e) { /* ignore */ }
    },
    // Gentle three-note chime for timers; plays even when ambient sound is off.
    chime() {
      if (!ensure()) return;
      if (ac.state === 'suspended') ac.resume();
      const out = ac.createGain();
      out.gain.value = 0.9 * Math.max(0.3, S.get('volume'));
      out.connect(ac.destination);
      out.connect(reverb);
      [76, 81, 88].forEach((m, i) => bell(mtof(m), 0.12, out, 3, ac.currentTime + i * 0.28));
      setTimeout(() => out.disconnect(), 5000);
    },
  };
})();
