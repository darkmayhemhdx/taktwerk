/* Taktwerk – Klangquellen: selbst berechnete Drum-Samples und Wellenformen */
(function () {
  'use strict';
  const TW = window.TW, SR = 44100, PI2 = Math.PI * 2;
  TW.SR = SR;
  let seed = 22222;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2147483648 - 1; };
  const buf = (s) => new Float32Array(Math.max(64, Math.floor(s * SR)));

  function bq(type, f, q) {
    const w = (PI2 * Math.min(f, SR * 0.45)) / SR, c = Math.cos(w), al = Math.sin(w) / (2 * q);
    let b0, b1, b2;
    const a0 = 1 + al, a1 = (-2 * c) / a0, a2 = (1 - al) / a0;
    if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; }
    else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; }
    else { b0 = al; b1 = 0; b2 = -al; }
    b0 /= a0; b1 /= a0; b2 /= a0;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    return (x) => { const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
  }
  // Zustandsvariablen-Filter mit beweglicher Eckfrequenz
  function svf() {
    const s = { lo: 0, bd: 0, hi: 0, run(x, fc, q) { const f = 2 * Math.sin((Math.PI * Math.min(fc, SR / 7)) / SR); s.lo += f * s.bd; s.hi = x - s.lo - q * s.bd; s.bd += f * s.hi; return s; } };
    return s;
  }
  function norm(a, peak = 0.9) {
    let m = 0;
    for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i]));
    if (m > 0) { const g = peak / m; for (let i = 0; i < a.length; i++) a[i] *= g; }
    const f = Math.min(a.length, 300);
    for (let i = 0; i < f; i++) a[a.length - 1 - i] *= i / f;
    return a;
  }
  const gen = (sec, fn) => { const a = buf(sec); for (let i = 0; i < a.length; i++) a[i] = fn(i / SR, i); return norm(a); };
  const sq = (ph) => (ph % 1 < 0.5 ? 1 : -1);
  const METAL = [205.3, 304.4, 369.6, 522.7, 540, 800];
  function metal(base) { const ph = [0, 0, 0, 0, 0, 0]; return () => { let s = 0; for (let k = 0; k < 6; k++) { ph[k] += (METAL[k] * base) / SR; s += sq(ph[k]); } return s / 6; }; }

  const G = {
    kick({ f0 = 160, f1 = 48, pd = 0.045, d = 0.3, click = 0.3, drive = 1.5 }) {
      let ph = 0;
      return gen(Math.min(d * 5 + 0.05, 2.6), (t) => {
        ph += (PI2 * (f1 + (f0 - f1) * Math.exp(-t / pd))) / SR;
        let s = Math.sin(ph) * Math.exp(-t / d);
        if (t < 0.004) s += rnd() * click * (1 - t / 0.004);
        return Math.tanh(s * drive);
      });
    },
    snare({ f = 185, td = 0.09, nd = 0.16, mix = 0.55, hp = 1200, snap = 0.6 }) {
      const h = bq('hp', hp, 0.7); let p1 = 0, p2 = 0;
      return gen(nd * 6 + 0.05, (t) => {
        const ff = f * (1 + snap * Math.exp(-t / 0.012));
        p1 += (PI2 * ff) / SR; p2 += (PI2 * ff * 1.6) / SR;
        return (Math.sin(p1) + 0.5 * Math.sin(p2)) * Math.exp(-t / td) * (1 - mix) + h(rnd()) * Math.exp(-t / nd) * mix;
      });
    },
    clap({ d = 0.18, f = 1100, q = 1.2 }) {
      const b = bq('bp', f, q), h = bq('hp', 500, 0.7);
      return gen(d * 6 + 0.06, (t) => {
        let e = 0;
        for (const t0 of [0, 0.011, 0.022]) if (t >= t0 && t < t0 + 0.011) e = Math.max(e, Math.exp(-(t - t0) / 0.004));
        if (t >= 0.033) e = Math.exp(-(t - 0.033) / d);
        return h(b(rnd())) * e;
      });
    },
    hat({ d = 0.04, hp = 7000, base = 1, noise = 0.35, d2 = 0 }) {
      const h = bq('hp', hp, 0.8), h2 = bq('hp', hp * 0.8, 0.7), m = metal(base);
      return gen((d2 || d) * 7 + 0.03, (t) => {
        const e = d2 ? 0.6 * Math.exp(-t / d) + 0.4 * Math.exp(-t / d2) : Math.exp(-t / d);
        return h2(h(m() * (1 - noise) + rnd() * noise)) * e;
      });
    },
    ride({ d = 0.9, bell = 0.3 }) {
      const h = bq('hp', 5500, 0.8), m = metal(1.47); let p = 0;
      return gen(d * 4, (t) => { p += (PI2 * 3100) / SR; return h(m() * 0.7 + rnd() * 0.3) * Math.exp(-t / d) + (Math.sin(p) + 0.5 * Math.sin(p * 1.51)) * bell * Math.exp(-t / 0.25); });
    },
    tom({ f = 110, d = 0.25, sweep = 0.7 }) {
      let ph = 0;
      return gen(d * 5, (t) => { ph += (PI2 * f * (1 + sweep * Math.exp(-t / 0.03))) / SR; return Math.sin(ph) * Math.exp(-t / d) + (t < 0.003 ? rnd() * 0.3 : 0); });
    },
    rim({ f = 1700 }) {
      const b = bq('bp', f * 1.4, 2); let ph = 0;
      return gen(0.09, (t) => { ph += (PI2 * f) / SR; return Math.sin(ph) * Math.exp(-t / 0.009) + b(rnd()) * Math.exp(-t / 0.004) * 2; });
    },
    cowbell({ f = 540 }) {
      const b = bq('bp', f * 1.6, 2.5); let a = 0, c = 0;
      return gen(0.7, (t) => { a += f / SR; c += (f * 1.481) / SR; return b(sq(a) + sq(c)) * (0.7 * Math.exp(-t / 0.02) + 0.3 * Math.exp(-t / 0.16)); });
    },
    ping({ f = 2500, d = 0.02, f2 = 0, mix = 0.5 }) {
      let a = 0, b = 0;
      return gen(d * 6 + 0.02, (t) => { a += (PI2 * f) / SR; b += (PI2 * (f2 || f * 1.5)) / SR; return (Math.sin(a) + (f2 ? mix * Math.sin(b) : 0)) * Math.exp(-t / d); });
    },
    conga({ f = 330, d = 0.12 }) {
      let ph = 0;
      return gen(d * 6, (t) => { ph += (PI2 * f * (1 + 0.25 * Math.exp(-t / 0.012))) / SR; return Math.sin(ph) * Math.exp(-t / d) + (t < 0.002 ? rnd() * 0.5 : 0); });
    },
    shaker({ d = 0.05, atk = 0.012, hp = 6000 }) {
      const h = bq('hp', hp, 0.8);
      return gen(atk + d * 6, (t) => h(rnd()) * (t < atk ? t / atk : Math.exp(-(t - atk) / d)));
    },
    tamb() {
      const h = bq('hp', 8000, 0.8), m = metal(2.6);
      return gen(0.7, (t) => h(m() * 0.6 + rnd() * 0.4) * (0.7 * Math.exp(-t / 0.03) + 0.3 * Math.exp(-t / 0.14)));
    },
    zap({ f0 = 4000, f1 = 60, pd = 0.03, d = 0.15, square = false }) {
      let ph = 0;
      return gen(d * 5, (t) => { ph += (f1 + (f0 - f1) * Math.exp(-t / pd)) / SR; return (square ? sq(ph) * 0.7 : Math.sin(PI2 * ph)) * Math.exp(-t / d); });
    },
    blip() { let ph = 0; return gen(0.12, (t) => { ph += (t < 0.04 ? 880 : 1320) / SR; return sq(ph) * Math.exp(-t / 0.05); }); },
    sweep({ up = true, d = 1.2 }) {
      const f = svf();
      return gen(d, (t) => { const x = up ? t / d : 1 - t / d; return f.run(rnd(), 200 * Math.pow(40, x), 0.25).bd * Math.sin((Math.PI * t) / d); });
    },
    noise({ d = 0.3 }) { return gen(d * 5, (t) => rnd() * Math.exp(-t / d)); },
    bell({ f = 880, r = 3.5, idx = 4, d = 0.9 }) {
      let c = 0, m = 0;
      return gen(d * 4, (t) => { m += (PI2 * f * r) / SR; c += (PI2 * f) / SR; return Math.sin(c + idx * Math.exp(-t / 0.3) * Math.sin(m)) * Math.exp(-t / d); });
    },
    stab({ ints = [0, 3, 7, 10], d = 0.35 }) {
      const f = svf(), ph = ints.flatMap(() => [0, 0.37]);
      return gen(d * 5, (t) => {
        let s = 0;
        ints.forEach((n, k) => { const fr = 261.63 * Math.pow(2, n / 12); ph[k * 2] += fr / SR; ph[k * 2 + 1] += (fr * 1.007) / SR; s += ((ph[k * 2] % 1) + (ph[k * 2 + 1] % 1)) - 1; });
        return f.run(s / ints.length, 500 + 6500 * Math.exp(-t / 0.14), 0.6).lo * Math.exp(-t / d);
      });
    },
    vox({ f = 220, f1 = 700, f2 = 1100 }) {
      const a = bq('bp', f1, 6), b = bq('bp', f2, 8), c = bq('bp', 2600, 8); let ph = 0;
      return gen(0.9, (t) => { ph += (f * (1 + 0.006 * Math.sin(PI2 * 5.5 * t))) / SR; const s = (ph % 1) * 2 - 1; return (a(s) + 0.7 * b(s) + 0.3 * c(s)) * Math.min(1, t / 0.02) * Math.exp(-t / 0.3); });
    },
    rev(a) { const b = new Float32Array(a.length); for (let i = 0; i < a.length; i++) b[i] = a[a.length - 1 - i]; return norm(b); },
  };

  /* ---------- Wellenformen als Fourier-Reihe ---------- */
  const N = 2048, H = 256, ct = new Float32Array(N), st = new Float32Array(N);
  for (let n = 0; n < N; n++) { ct[n] = Math.cos((PI2 * n) / N); st[n] = Math.sin((PI2 * n) / N); }
  TW.fourier = function (fn) {
    const x = new Float32Array(N); let dc = 0;
    for (let n = 0; n < N; n++) { x[n] = fn(n / N); dc += x[n]; }
    dc /= N;
    const re = new Float32Array(H + 1), im = new Float32Array(H + 1);
    for (let k = 1; k <= H; k++) {
      let a = 0, b = 0;
      for (let n = 0; n < N; n++) { const j = (k * n) & (N - 1); a += (x[n] - dc) * ct[j]; b += (x[n] - dc) * st[j]; }
      re[k] = (2 * a) / N; im[k] = (2 * b) / N;
    }
    return { re, im };
  };
  const sn = (p) => Math.sin(PI2 * p);
  TW.SHAPES = {
    saw: (p, e) => 2 * Math.pow(p, 1 + 2 * e) - 1,
    pulse: (p, e) => (p < 0.5 - 0.46 * e ? 1 : -1),
    tri: (p, e) => TW.clamp((1 - 4 * Math.abs(p - 0.5)) * (1 + 4 * e), -1, 1),
    sine: (p, e) => Math.sin(PI2 * p + e * 3 * sn(p)),
    syncSaw: (p, e) => (2 * ((p * (1 + e * 5)) % 1) - 1) * (1 - 0.4 * p),
    syncPulse: (p, e) => ((p * (1 + e * 5)) % 1 < 0.5 ? 1 : -1) * (1 - 0.4 * p),
    fold: (p, e) => Math.sin((1 + e * 6) * (Math.PI / 2) * sn(p)),
    organ: (p, e) => sn(p) + 0.6 * sn(2 * p) + e * sn(3 * p) + 0.3 * sn(4 * p) + e * 0.6 * sn(8 * p) + (1 - e) * 0.2 * sn(6 * p),
    formant: (p, e) => sn(p * (2 + Math.round(e * 12))) * Math.pow(Math.sin(Math.PI * p), 2),
    stairs: (p, e) => { const L = 2 + Math.floor((1 - e) * 14); return Math.round((2 * p - 1) * (L / 2)) / (L / 2); },
    vocal: (p, e) => (sn(p * 3) * 0.8 + sn(p * (5 + Math.round(e * 6))) * 0.6 + sn(p) * 0.5) * Math.pow(1 - p, 1.5),
  };

  /* ---------- Oszillator-Liste ---------- */
  TW.OSCS = [];
  const add = (c, n, def) => TW.OSCS.push(Object.assign({ c, n }, def));
  const pcm = (c, n, g) => add(c, n, { k: 'pcm', g, e: 'Startpunkt' });

  pcm('Kick', 'Kick 808', () => G.kick({ f0: 130, f1: 46, pd: 0.06, d: 0.45, click: 0.12, drive: 1.2 }));
  pcm('Kick', 'Kick 808 lang', () => G.kick({ f0: 120, f1: 41, pd: 0.07, d: 0.5, click: 0.1, drive: 1.3 }));
  pcm('Kick', 'Kick 909', () => G.kick({ f0: 230, f1: 52, pd: 0.035, d: 0.24, click: 0.6, drive: 1.8 }));
  pcm('Kick', 'Kick Hart', () => G.kick({ f0: 320, f1: 55, pd: 0.03, d: 0.2, click: 0.8, drive: 4 }));
  pcm('Kick', 'Kick Tief', () => G.kick({ f0: 95, f1: 38, pd: 0.09, d: 0.38, click: 0.05, drive: 1.1 }));
  pcm('Kick', 'Kick Kurz', () => G.kick({ f0: 200, f1: 60, pd: 0.025, d: 0.11, click: 0.5, drive: 2 }));
  pcm('Kick', 'Kick Elektro', () => G.kick({ f0: 420, f1: 62, pd: 0.018, d: 0.16, click: 0.2, drive: 2.5 }));
  pcm('Kick', 'Kick Zerre', () => G.kick({ f0: 180, f1: 50, pd: 0.05, d: 0.34, click: 0.4, drive: 9 }));
  pcm('Snare', 'Snare 808', () => G.snare({ f: 175, td: 0.11, nd: 0.14, mix: 0.45 }));
  pcm('Snare', 'Snare 909', () => G.snare({ f: 205, td: 0.07, nd: 0.2, mix: 0.62, hp: 900 }));
  pcm('Snare', 'Snare Knack', () => G.snare({ f: 240, td: 0.04, nd: 0.09, mix: 0.6, hp: 1800, snap: 1 }));
  pcm('Snare', 'Snare Tief', () => G.snare({ f: 140, td: 0.13, nd: 0.22, mix: 0.5, hp: 700 }));
  pcm('Snare', 'Snare Rausch', () => G.snare({ f: 190, td: 0.05, nd: 0.28, mix: 0.82, hp: 1500 }));
  pcm('Snare', 'Snare Elektro', () => G.snare({ f: 300, td: 0.05, nd: 0.11, mix: 0.4, hp: 2500, snap: 1.6 }));
  pcm('Snare', 'Snare Hell', () => G.snare({ f: 260, td: 0.06, nd: 0.13, mix: 0.7, hp: 3000 }));
  pcm('Snare', 'Rimshot', () => G.rim({ f: 1700 }));
  pcm('Clap', 'Clap 808', () => G.clap({ d: 0.16, f: 1100 }));
  pcm('Clap', 'Clap Eng', () => G.clap({ d: 0.09, f: 1500, q: 2 }));
  pcm('Clap', 'Clap Hall', () => G.clap({ d: 0.4, f: 950, q: 0.9 }));
  pcm('HiHat', 'HiHat zu', () => G.hat({ d: 0.035 }));
  pcm('HiHat', 'HiHat zu kurz', () => G.hat({ d: 0.016, hp: 8500 }));
  pcm('HiHat', 'HiHat zu Rausch', () => G.hat({ d: 0.04, noise: 0.9, hp: 6500 }));
  pcm('HiHat', 'HiHat zu dunkel', () => G.hat({ d: 0.045, hp: 4200, base: 0.8 }));
  pcm('HiHat', 'HiHat offen', () => G.hat({ d: 0.09, d2: 0.26 }));
  pcm('HiHat', 'HiHat offen lang', () => G.hat({ d: 0.12, d2: 0.5, hp: 6000 }));
  pcm('HiHat', 'HiHat offen Rausch', () => G.hat({ d: 0.1, d2: 0.3, noise: 0.9 }));
  pcm('Becken', 'Crash', () => G.hat({ d: 0.25, d2: 1.1, hp: 3800, base: 1.3, noise: 0.6 }));
  pcm('Becken', 'Ride', () => G.ride({ d: 0.8, bell: 0.15 }));
  pcm('Becken', 'Ride Glocke', () => G.ride({ d: 0.5, bell: 0.8 }));
  pcm('Becken', 'Crash rückwärts', () => G.rev(G.hat({ d: 0.2, d2: 0.32, hp: 3800, base: 1.3, noise: 0.6 })));
  pcm('Tom', 'Tom tief', () => G.tom({ f: 82, d: 0.3 }));
  pcm('Tom', 'Tom mittel', () => G.tom({ f: 125, d: 0.24 }));
  pcm('Tom', 'Tom hoch', () => G.tom({ f: 185, d: 0.18 }));
  pcm('Tom', 'Tom Elektro', () => G.tom({ f: 150, d: 0.22, sweep: 2.5 }));
  pcm('Percussion', 'Cowbell', () => G.cowbell({ f: 540 }));
  pcm('Percussion', 'Clave', () => G.ping({ f: 2500, d: 0.02 }));
  pcm('Percussion', 'Holzblock', () => G.ping({ f: 1100, d: 0.02, f2: 1650 }));
  pcm('Percussion', 'Triangel', () => G.ping({ f: 4500, d: 0.35, f2: 6230, mix: 0.7 }));
  pcm('Percussion', 'Conga hoch', () => G.conga({ f: 390, d: 0.1 }));
  pcm('Percussion', 'Conga tief', () => G.conga({ f: 240, d: 0.14 }));
  pcm('Percussion', 'Bongo', () => G.conga({ f: 520, d: 0.06 }));
  pcm('Percussion', 'Shaker', () => G.shaker({ d: 0.04 }));
  pcm('Percussion', 'Maracas', () => G.shaker({ d: 0.02, atk: 0.004, hp: 8000 }));
  pcm('Percussion', 'Tamburin', () => G.tamb());
  pcm('FX & Hits', 'Zap', () => G.zap({}));
  pcm('FX & Hits', 'Laser', () => G.zap({ f0: 6000, f1: 200, pd: 0.12, d: 0.3, square: true }));
  pcm('FX & Hits', 'Blip', () => G.blip());
  pcm('FX & Hits', 'Rausch-Hit', () => G.noise({ d: 0.25 }));
  pcm('FX & Hits', 'Sweep auf', () => G.sweep({ up: true }));
  pcm('FX & Hits', 'Sweep ab', () => G.sweep({ up: false }));
  pcm('FX & Hits', 'Glocken-Hit', () => G.bell({}));
  pcm('FX & Hits', 'Metall-Hit', () => G.bell({ f: 440, r: 1.41, idx: 6, d: 0.5 }));
  pcm('FX & Hits', 'Stab Moll', () => G.stab({ ints: [0, 3, 7, 10] }));
  pcm('FX & Hits', 'Stab Dur', () => G.stab({ ints: [0, 4, 7, 11] }));
  pcm('FX & Hits', 'Vox Aah', () => G.vox({}));
  pcm('FX & Hits', 'Vox Ooh', () => G.vox({ f1: 380, f2: 850 }));

  const wave = (n, w, e) => add('Synth', n, { k: 'wave', w, e });
  wave('Saw', 'saw', 'Form');
  wave('Pulse', 'pulse', 'Pulsbreite');
  wave('Triangle', 'tri', 'Form');
  wave('Sine', 'sine', 'Obertöne');
  // v: [Halbton, Verstimm-Gewicht, Pegel, 1 = Pegel folgt Edit, eigene Wellenform]
  const uni = (n, w, v, det, e) => add('Synth', n, { k: 'uni', w, v, det, e });
  uni('Dual Saw', 'sawtooth', [[0, -1, 1], [0, 1, 1]], 45, 'Verstimmung');
  uni('Super Saw', 'sawtooth', [[0, 0, 1], [0, -1, 0.8], [0, 1, 0.8], [0, -0.55, 0.8], [0, 0.55, 0.8], [0, -0.22, 0.8], [0, 0.22, 0.8]], 70, 'Verstimmung');
  uni('Dual Pulse', 'square', [[0, -1, 1], [0, 1, 1]], 45, 'Verstimmung');
  uni('Super Pulse', 'square', [[0, 0, 1], [0, -1, 0.8], [0, 1, 0.8], [0, -0.5, 0.8], [0, 0.5, 0.8]], 60, 'Verstimmung');
  uni('Dual Triangle', 'triangle', [[0, -1, 1], [0, 1, 1]], 40, 'Verstimmung');
  uni('Saw + Sub', 'sawtooth', [[0, 0, 1], [-12, 0, 1.2, 1, 'square']], 0, 'Sub-Pegel');
  uni('Pulse + Sub', 'square', [[0, 0, 1], [-12, 0, 1.2, 1, 'sine']], 0, 'Sub-Pegel');
  uni('Oktav-Saw', 'sawtooth', [[0, 0, 1], [12, 0.3, 1, 1]], 12, 'Oktav-Pegel');
  uni('Quint-Saw', 'sawtooth', [[0, 0, 1], [7, 0.3, 1, 1]], 12, 'Quint-Pegel');
  uni('Quart-Pulse', 'square', [[0, 0, 1], [5, 0.3, 1, 1]], 12, 'Quart-Pegel');
  wave('Sync Saw', 'syncSaw', 'Sync');
  wave('Sync Pulse', 'syncPulse', 'Sync');
  wave('Faltung', 'fold', 'Faltung');
  wave('Orgel', 'organ', 'Register');
  wave('Formant', 'formant', 'Formant');
  wave('Stufen', 'stairs', 'Stufen');
  wave('Vokal', 'vocal', 'Vokal');
  const fm = (n, r, idx, env) => add('FM & Digital', n, { k: 'fm', r, idx, env, e: 'FM-Stärke' });
  fm('FM 1:1', 1, 4);
  fm('FM 1:2', 2, 3.5);
  fm('FM 2:1', 0.5, 5);
  fm('FM Bass', 0.5, 6, 0.12);
  fm('FM E-Piano', 1, 3, 0.4);
  fm('FM Glocke', 3.5, 4, 0.6);
  fm('FM Metall', 7.07, 3, 0.25);
  add('FM & Digital', 'Ring Mod', { k: 'ring', e: 'Verhältnis' });
  add('Rauschen', 'Rauschen weiß', { k: 'noise', col: 0, e: '—' });
  add('Rauschen', 'Rauschen rosa', { k: 'noise', col: 1, e: '—' });

  TW.oscIdx = (name) => { const i = TW.OSCS.findIndex((o) => o.n === name); if (i < 0) console.warn('Oszillator fehlt:', name); return Math.max(0, i); };
  TW.pcmData = (i) => { const o = TW.OSCS[i]; return o.data || (o.data = o.g()); };
  TW.noiseData = (col) => {
    const a = new Float32Array(SR * 2); let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < a.length; i++) {
      const w = Math.random() * 2 - 1;
      if (col) { b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; a[i] = (b0 + b1 + b2 + w * 0.1848) * 0.22; }
      else a[i] = w * 0.7;
    }
    return a;
  };
})();
