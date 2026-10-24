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
  // Each builder gets (out, wet, every) and returns nothing; `every` schedules random events.
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
    build(out, wet, every);
    tracked = null;
    return {
      name,
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
