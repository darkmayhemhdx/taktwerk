/* Taktwerk – Audio-Engine: Stimmen, Filter, Modulation, Insert- und Master-Effekte */
(function () {
  'use strict';
  const TW = window.TW, C4 = 261.6256, clamp = TW.clamp;
  const cutHz = (c) => 20 * Math.pow(2, (c / 127) * 10);
  const atkT = (a) => 0.001 + Math.pow(a / 127, 3) * 2;
  const decT = (d) => 0.012 + Math.pow(d / 127, 3) * 8;
  const relT = (d) => 0.006 + Math.pow(d / 127, 3) * 4;
  const mkCurve = (fn, n = 2048) => { const a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = fn((i / (n - 1)) * 2 - 1); return a; };

  TW.FILTERS = [
    { n: 'Aus', g: 'off' },
    { n: 'LPF 12 dB', g: 'lp', t: 'lowpass', poles: 1 },
    { n: 'LPF 24 dB', g: 'lp', t: 'lowpass', poles: 2 },
    { n: 'LPF Acid', g: 'lp', t: 'lowpass', poles: 2, drive: true },
    { n: 'HPF 12 dB', g: 'hp', t: 'highpass', poles: 1 },
    { n: 'HPF 24 dB', g: 'hp', t: 'highpass', poles: 2 },
    { n: 'BPF 12 dB', g: 'bp', t: 'bandpass', poles: 1 },
    { n: 'BPF 24 dB', g: 'bp', t: 'bandpass', poles: 2 },
  ];
  TW.filtIdx = (n) => Math.max(0, TW.FILTERS.findIndex((f) => f.n === n));

  /* ---------- Baukasten für Effekte ---------- */
  function kit(E) {
    const c = E.ctx;
    const k = {
      c, E, nodes: [], srcs: [],
      reg(n) { k.nodes.push(n); return n; },
      g(v = 1) { const n = c.createGain(); n.gain.value = v; return k.reg(n); },
      f(type, freq, q = 1, gain = 0) { const n = c.createBiquadFilter(); n.type = type; n.frequency.value = freq; n.Q.value = q; n.gain.value = gain; return k.reg(n); },
      d(max, t) { const n = c.createDelay(max); n.delayTime.value = t; return k.reg(n); },
      ws(fn) { const n = c.createWaveShaper(); if (fn) n.curve = mkCurve(fn); n.oversample = '2x'; return k.reg(n); },
      lfo(type, f) { const o = c.createOscillator(); o.type = type; o.frequency.value = f; o.start(); k.srcs.push(o); return o; },
      pan(v = 0) { const n = c.createStereoPanner(); n.pan.value = v; return k.reg(n); },
      comp(th, ratio, a, r) { const n = c.createDynamicsCompressor(); n.threshold.value = th; n.ratio.value = ratio; n.attack.value = a; n.release.value = r; n.knee.value = 6; return k.reg(n); },
      conv(b) { const n = c.createConvolver(); n.buffer = b; return k.reg(n); },
      chain(...n) { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; },
      wd() { const i = k.g(), o = k.g(), dry = k.g(), wet = k.g(0); i.connect(dry); dry.connect(o); wet.connect(o); return { in: i, out: o, dry, wet }; },
      P(param, v) { E._sp(param, v); },
      dispose() { for (const s of k.srcs) { try { s.stop(); } catch (e) {} try { s.disconnect(); } catch (e) {} } for (const n of k.nodes) { try { n.disconnect(); } catch (e) {} } },
    };
    return k;
  }

  /* ---------- Insert-Effekte (pro Part) ---------- */
  const dly = (beats) => (k) => {
    const m = k.wd(), d = k.d(2, 0.3), fb = k.g(0.4), t = k.f('lowpass', 5000, 0.5);
    m.in.connect(d); d.connect(t); t.connect(fb); fb.connect(d); t.connect(m.wet);
    return { in: m.in, out: m.out, set(e) { m.wet.gain.value = 0.15 + e * 0.6; fb.gain.value = 0.2 + e * 0.55; }, tempo(bpm) { d.delayTime.value = Math.min(1.99, (60 / bpm) * beats); } };
  };
  const one = (k, n, set) => ({ in: n, out: n, set });
  TW.IFX = [
    { n: 'Aus', e: '—' },
    { n: 'Punch', e: 'Stärke', b(k) { const cp = k.comp(-24, 8, 0.03, 0.12), o = k.g(); cp.connect(o); return { in: cp, out: o, set(e) { cp.threshold.value = -8 - e * 32; o.gain.value = 1 + e * 2.2; } }; } },
    { n: 'Kompressor', e: 'Schwelle', b(k) { const cp = k.comp(-20, 4, 0.005, 0.15), o = k.g(); cp.connect(o); return { in: cp, out: o, set(e) { cp.threshold.value = -5 - e * 40; o.gain.value = 1 + e * 2; } }; } },
    { n: 'Overdrive', e: 'Gain', b(k) { const i = k.g(), o = k.g(); k.chain(i, k.ws((x) => Math.tanh(x * 2.5)), k.f('lowpass', 7000, 0.5), o); return { in: i, out: o, set(e) { i.gain.value = 1 + e * 9; o.gain.value = 0.9 / (1 + e * 1.2); } }; } },
    { n: 'Distortion', e: 'Gain', b(k) { const i = k.g(), o = k.g(); k.chain(i, k.ws((x) => clamp(x * 4, -0.7, 0.7) / 0.7), k.f('lowpass', 5500, 0.7), o); return { in: i, out: o, set(e) { i.gain.value = 1 + e * 30; o.gain.value = 0.6 / (1 + e); } }; } },
    { n: 'Fuzz Fold', e: 'Faltung', b(k) { const i = k.g(), o = k.g(0.7); k.chain(i, k.ws((x) => Math.sin(x * Math.PI * 1.5)), o); return { in: i, out: o, set(e) { i.gain.value = 0.4 + e * 3; } }; } },
    { n: 'Bit Crusher', e: 'Bits', b(k) { const w = k.ws(null), o = k.g(); w.oversample = 'none'; w.connect(o); return { in: w, out: o, set(e) { const L = Math.pow(2, Math.round(7 - e * 5.5)); w.curve = mkCurve((x) => Math.round(x * L) / L, 4096); } }; } },
    { n: 'Ring Mod', e: 'Frequenz', b(k) { const i = k.g(), m = k.g(0), l = k.lfo('sine', 200); i.connect(m); l.connect(m.gain); return { in: i, out: m, set(e) { l.frequency.value = 20 * Math.pow(150, e); } }; } },
    { n: 'Chorus', e: 'Tiefe', b(k) { const m = k.wd(), d = k.d(0.05, 0.02), l = k.lfo('sine', 0.7), lg = k.g(0.003); l.connect(lg); lg.connect(d.delayTime); m.in.connect(d); d.connect(m.wet); return { in: m.in, out: m.out, set(e) { m.wet.gain.value = 0.3 + e * 0.6; lg.gain.value = 0.001 + e * 0.005; } }; } },
    { n: 'Flanger', e: 'Tempo', b(k) { const m = k.wd(), d = k.d(0.02, 0.004), fb = k.g(0.7), l = k.lfo('sine', 0.3), lg = k.g(0.003); l.connect(lg); lg.connect(d.delayTime); m.in.connect(d); d.connect(fb); fb.connect(d); d.connect(m.wet); m.wet.gain.value = 0.8; return { in: m.in, out: m.out, set(e) { l.frequency.value = 0.05 * Math.pow(100, e); } }; } },
    { n: 'Phaser', e: 'Tempo', b(k) { const m = k.wd(), l = k.lfo('sine', 0.4), lg = k.g(1200); l.connect(lg); let n = m.in; for (let j = 0; j < 4; j++) { const a = k.f('allpass', 900 + j * 300, 0.6); lg.connect(a.detune); n.connect(a); n = a; } n.connect(m.wet); m.wet.gain.value = 0.9; return { in: m.in, out: m.out, set(e) { l.frequency.value = 0.05 * Math.pow(120, e); } }; } },
    { n: 'Tremolo', e: 'Tempo', b(k) { const i = k.g(0.6), l = k.lfo('sine', 5), lg = k.g(0.4); l.connect(lg); lg.connect(i.gain); return one(k, i, (e) => { l.frequency.value = 0.5 * Math.pow(40, e); }); } },
    { n: 'Auto Pan', e: 'Tempo', b(k) { const p = k.pan(), l = k.lfo('sine', 1), lg = k.g(0.9); l.connect(lg); lg.connect(p.pan); return one(k, p, (e) => { l.frequency.value = 0.1 * Math.pow(100, e); }); } },
    { n: 'Vibrato', e: 'Tiefe', b(k) { const d = k.d(0.05, 0.01), l = k.lfo('sine', 5.5), lg = k.g(0.001); l.connect(lg); lg.connect(d.delayTime); return one(k, d, (e) => { lg.gain.value = e * 0.004; }); } },
    { n: 'Auto Wah', e: 'Tempo', b(k) { const f = k.f('bandpass', 900, 4), o = k.g(2.5), l = k.lfo('sine', 2), lg = k.g(1800); l.connect(lg); lg.connect(f.detune); f.connect(o); return { in: f, out: o, set(e) { l.frequency.value = 0.2 * Math.pow(60, e); } }; } },
    { n: 'Delay 1/8', e: 'Anteil', b: dly(0.5) },
    { n: 'Delay 3/16', e: 'Anteil', b: dly(0.75) },
    { n: 'Delay 1/16', e: 'Anteil', b: dly(0.25) },
    { n: 'Raumhall', e: 'Anteil', b(k) { const m = k.wd(), cv = k.conv(k.E.ir(1.2)); m.in.connect(cv); cv.connect(m.wet); return { in: m.in, out: m.out, set(e) { m.wet.gain.value = e * 0.9; } }; } },
    { n: 'Bass Boost', e: 'Gain', b(k) { const f = k.f('lowshelf', 120, 1, 0); return one(k, f, (e) => { f.gain.value = e * 15; }); } },
    { n: 'Höhen Boost', e: 'Gain', b(k) { const f = k.f('highshelf', 6000, 1, 0); return one(k, f, (e) => { f.gain.value = e * 15; }); } },
    { n: 'Low Cut', e: 'Frequenz', b(k) { const f = k.f('highpass', 20, 0.7); return one(k, f, (e) => { f.frequency.value = 20 * Math.pow(150, e); }); } },
    { n: 'High Cut', e: 'Frequenz', b(k) { const f = k.f('lowpass', 20000, 0.7); return one(k, f, (e) => { f.frequency.value = 20000 * Math.pow(0.01, e); }); } },
    { n: 'Telefon', e: 'Enge', b(k) { const f = k.f('bandpass', 1500, 1), o = k.g(1.5); f.connect(o); return { in: f, out: o, set(e) { f.Q.value = 0.7 + e * 6; } }; } },
    { n: 'Stereo-Breite', e: 'Breite', b(k) { const i = k.g(), d = k.d(0.05, 0.01), mg = k.reg(k.c.createChannelMerger(2)); i.connect(mg, 0, 0); i.connect(d); d.connect(mg, 0, 1); return { in: i, out: mg, set(e) { d.delayTime.value = e * 0.025; } }; } },
    { n: 'Pump', e: 'Tiefe', b(k) { const g = k.g(); let depth = 0.5; return { in: g, out: g, set(e) { depth = e; }, step(t, sd, pos, spq) { if (pos % spq === 0) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(1 - depth * 0.95, t); g.gain.linearRampToValueAtTime(1, t + sd * spq * 0.85); } } }; } },
  ];
  TW.ifxIdx = (n) => Math.max(0, TW.IFX.findIndex((f) => f.n === n));

  /* ---------- Master-Effekte (Touchpad X/Y) ---------- */
  const sweep = (type, lo, span, name) => ({
    n: name, ins: 1, x: 'Cutoff', y: 'Resonanz',
    b(k) { const f = k.f(type, type === 'lowpass' ? 20000 : 20, 1), f2 = k.f(type, type === 'lowpass' ? 20000 : 20, 1); const o = k.g(); f.connect(f2); f2.connect(o); return { in: f, out: o, xy(x, y) { const hz = lo * Math.pow(span, x); k.P(f.frequency, hz); k.P(f2.frequency, hz); k.P(f.Q, type === 'bandpass' ? 0.5 + y * 12 : y * 18); if (type === 'bandpass') { k.P(f2.Q, 0.5 + y * 6); k.P(o.gain, 1.5 + y * 5); } } }; },
  });
  const hall = (name, sec) => ({
    n: name, x: 'Anteil', y: 'Helligkeit',
    b(k) { const i = k.g(), t = k.f('lowpass', 8000, 0.5), o = k.g(); k.chain(i, k.conv(k.E.ir(sec)), t, o); return { in: i, out: o, xy(x, y) { k.P(o.gain, x * 1.3); k.P(t.frequency, 400 * Math.pow(40, y)); } }; },
  });
  TW.MFX = [
    { n: 'Aus', x: '—', y: '—' },
    hall('Hall', 3.2),
    hall('Raum', 0.9),
    { n: 'Tempo-Delay', x: 'Zeit', y: 'Feedback', b(k) { const i = k.g(), d = k.d(2.5, 0.3), fb = k.g(0.4), t = k.f('lowpass', 6000, 0.5), o = k.g(0.8); i.connect(d); d.connect(t); t.connect(fb); fb.connect(d); t.connect(o); let bt = 0.75, bpm = 120; const upd = () => k.P(d.delayTime, Math.min(2.4, (60 / bpm) * bt)); return { in: i, out: o, xy(x, y) { bt = [0.25, 1 / 3, 0.5, 0.75, 1][Math.min(4, Math.floor(x * 5))]; upd(); k.P(fb.gain, y * 0.9); }, tempo(b) { bpm = b; upd(); } }; } },
    { n: 'Dub-Delay', x: 'Zeit', y: 'Feedback', b(k) { const i = k.g(), d = k.d(1.2, 0.3), fb = k.g(0.5), t = k.f('bandpass', 1300, 0.6), w = k.ws((x) => Math.tanh(x * 1.5)), o = k.g(0.9); i.connect(d); k.chain(d, t, w, fb, d); w.connect(o); return { in: i, out: o, xy(x, y) { k.P(d.delayTime, 0.05 + x * 0.75); k.P(fb.gain, y * 1.05); } }; } },
    { n: 'Ping-Pong', x: 'Zeit', y: 'Feedback', b(k) { const i = k.g(), dl = k.d(2, 0.3), dr = k.d(2, 0.3), fa = k.g(0.5), fb = k.g(0.5), pl = k.pan(-0.9), pr = k.pan(0.9), o = k.g(0.8); i.connect(dl); dl.connect(pl); pl.connect(o); dl.connect(fa); fa.connect(dr); dr.connect(pr); pr.connect(o); dr.connect(fb); fb.connect(dl); let bt = 0.5, bpm = 120; const upd = () => { const s = Math.min(1.9, (60 / bpm) * bt); k.P(dl.delayTime, s); k.P(dr.delayTime, s); }; return { in: i, out: o, xy(x, y) { bt = [0.25, 1 / 3, 0.5, 0.75, 1][Math.min(4, Math.floor(x * 5))]; upd(); k.P(fa.gain, y * 0.9); k.P(fb.gain, y * 0.9); }, tempo(b) { bpm = b; upd(); } }; } },
    sweep('lowpass', 60, 300, 'Tiefpass-Sweep'),
    sweep('highpass', 20, 400, 'Hochpass-Sweep'),
    sweep('bandpass', 100, 100, 'Bandpass-Sweep'),
    { n: 'Flanger', ins: 1, x: 'Tempo', y: 'Feedback', b(k) { const m = k.wd(), d = k.d(0.02, 0.004), fb = k.g(0.5), l = k.lfo('sine', 0.3), lg = k.g(0.003); l.connect(lg); lg.connect(d.delayTime); m.in.connect(d); d.connect(fb); fb.connect(d); d.connect(m.wet); m.wet.gain.value = 0.8; return { in: m.in, out: m.out, xy(x, y) { k.P(l.frequency, 0.05 * Math.pow(160, x)); k.P(fb.gain, y * 0.92); } }; } },
    { n: 'Phaser', ins: 1, x: 'Tempo', y: 'Tiefe', b(k) { const m = k.wd(), l = k.lfo('sine', 0.4), lg = k.g(1200); l.connect(lg); let n = m.in; for (let j = 0; j < 6; j++) { const a = k.f('allpass', 700 + j * 350, 0.6); lg.connect(a.detune); n.connect(a); n = a; } n.connect(m.wet); m.wet.gain.value = 0.9; return { in: m.in, out: m.out, xy(x, y) { k.P(l.frequency, 0.05 * Math.pow(160, x)); k.P(lg.gain, y * 2400); } }; } },
    { n: 'Chorus', ins: 1, x: 'Tempo', y: 'Tiefe', b(k) { const m = k.wd(), d = k.d(0.05, 0.02), l = k.lfo('sine', 0.7), lg = k.g(0.003); l.connect(lg); lg.connect(d.delayTime); m.in.connect(d); d.connect(m.wet); m.wet.gain.value = 0.8; return { in: m.in, out: m.out, xy(x, y) { k.P(l.frequency, 0.1 * Math.pow(60, x)); k.P(lg.gain, 0.0005 + y * 0.007); } }; } },
    { n: 'Verzerrer', ins: 1, x: 'Gain', y: 'Ton', b(k) { const i = k.g(), t = k.f('lowpass', 6000, 0.7), o = k.g(); k.chain(i, k.ws((x) => Math.tanh(x * 3)), t, o); return { in: i, out: o, xy(x, y) { k.P(i.gain, 1 + x * 25); k.P(o.gain, 0.8 / (1 + x * 1.5)); k.P(t.frequency, 300 * Math.pow(50, y)); } }; } },
    { n: 'Crusher', ins: 1, x: 'Bits', y: 'Filter', b(k) { const w = k.ws(null), t = k.f('lowpass', 12000, 2); w.oversample = 'none'; w.connect(t); let last = -1; return { in: w, out: t, xy(x, y) { const b = Math.round(7 - x * 5.5); if (b !== last) { last = b; const L = Math.pow(2, b); w.curve = mkCurve((v) => Math.round(v * L) / L, 4096); } k.P(t.frequency, 300 * Math.pow(60, y)); } }; } },
    { n: 'Slicer', ins: 1, x: 'Raster', y: 'Tiefe', b(k) { const g = k.g(); let r = 1, depth = 1; const pulse = (t, len) => { g.gain.setValueAtTime(1, t); g.gain.setValueAtTime(1 - depth, t + len * 0.5); }; return { in: g, out: g, xy(x, y) { r = [4, 2, 1, 0.5][Math.min(3, Math.floor(x * 4))]; depth = 0.3 + y * 0.7; }, step(t, sd, pos) { if (r >= 1) { if (pos % r === 0) pulse(t, r * sd); } else { pulse(t, sd / 2); pulse(t + sd / 2, sd / 2); } } }; } },
    { n: 'Ringmod', ins: 1, x: 'Frequenz', y: 'Mix', b(k) { const m = k.wd(), r = k.g(0), l = k.lfo('sine', 300); m.in.connect(r); l.connect(r.gain); r.connect(m.wet); return { in: m.in, out: m.out, xy(x, y) { k.P(l.frequency, 30 * Math.pow(120, x)); k.P(m.wet.gain, y); k.P(m.dry.gain, 1 - y); } }; } },
    { n: 'Kompressor', ins: 1, x: 'Schwelle', y: 'Gain', b(k) { const cp = k.comp(-20, 6, 0.004, 0.14), o = k.g(); cp.connect(o); return { in: cp, out: o, xy(x, y) { k.P(cp.threshold, -4 - x * 44); k.P(o.gain, 1 + y * 3); } }; } },
    { n: 'Pumpen', ins: 1, x: 'Tiefe', y: 'Länge', b(k) { const g = k.g(); let depth = 0.7, len = 0.8; return { in: g, out: g, xy(x, y) { depth = x; len = 0.3 + y * 0.65; }, step(t, sd, pos, spq) { if (pos % spq === 0) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(1 - depth * 0.96, t); g.gain.linearRampToValueAtTime(1, t + sd * spq * len); } } }; } },
  ];
  TW.mfxIdx = (n) => Math.max(0, TW.MFX.findIndex((f) => f.n === n));

  /* ---------- Engine ---------- */
  class Engine {
    constructor(ctx, offline) {
      const c = (this.ctx = ctx);
      this.offline = !!offline;
      this.bpm = 120; this.voices = []; this.bufs = new Map(); this.waves = new Map(); this.irs = new Map();
      this.alt = [false, false]; this.mx = 0.5; this.my = 0.5; this.mfxOn = false; this.mfxType = 0; this.mfx = null;
      this.master = c.createGain(); this.master.gain.value = 0.7;
      this.patLevel = c.createGain(); this.vol = c.createGain();
      this.lim = c.createDynamicsCompressor();
      this.lim.threshold.value = -5; this.lim.knee.value = 4; this.lim.ratio.value = 14; this.lim.attack.value = 0.002; this.lim.release.value = 0.12;
      this.analyser = c.createAnalyser(); this.analyser.fftSize = 1024;
      this.master.connect(this.patLevel); this.patLevel.connect(this.vol); this.vol.connect(this.lim); this.lim.connect(this.analyser); this.analyser.connect(c.destination);
      this.mfxIn = c.createGain(); this.mfxBypass = c.createGain(); this.mfxFeed = c.createGain(); this.mfxFeed.gain.value = 0; this.mfxOut = c.createGain();
      this.mfxIn.connect(this.mfxBypass); this.mfxBypass.connect(this.master); this.mfxIn.connect(this.mfxFeed); this.mfxOut.connect(this.master);
      this.tanh = mkCurve((x) => Math.tanh(x * 2));
      this.parts = [];
      for (let i = 0; i < 16; i++) {
        const pt = { in: c.createGain(), level: c.createGain(), pan: c.createStereoPanner(), dry: c.createGain(), send: c.createGain(), ifx: null, ifxType: 0, ifxE: -1, lastNote: null };
        pt.in.connect(pt.level); pt.level.connect(pt.pan); pt.pan.connect(pt.dry); pt.dry.connect(this.master); pt.pan.connect(pt.send); pt.send.connect(this.mfxIn);
        pt.send.gain.value = 0;
        this.parts.push(pt);
      }
      this.meterBuf = new Float32Array(1024);
    }
    resume() { if (this.ctx.state !== 'running' && this.ctx.resume) return this.ctx.resume(); }
    _sp(param, v, t) { if (this.offline && !t) param.value = v; else param.setTargetAtTime(v, t || this.ctx.currentTime, 0.012); }
    ir(sec) {
      if (this.irs.has(sec)) return this.irs.get(sec);
      const sr = this.ctx.sampleRate, len = Math.floor(sec * sr), b = this.ctx.createBuffer(2, len, sr);
      for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
      this.irs.set(sec, b); return b;
    }
    _buf(key, data) {
      let b = this.bufs.get(key);
      if (!b) { const d = data(); b = this.ctx.createBuffer(1, d.length, TW.SR); b.getChannelData(0).set(d); this.bufs.set(key, b); }
      return b;
    }
    _wave(name, e) {
      const q = Math.round(e * 15), key = name + q;
      let w = this.waves.get(key);
      if (!w) { const fn = TW.SHAPES[name], f = TW.fourier((p) => fn(p, q / 15)); w = this.ctx.createPeriodicWave(f.re, f.im); this.waves.set(key, w); }
      return w;
    }
    _sh() {
      return this._buf('sh', () => { const a = new Float32Array(256 * 64); for (let i = 0; i < 64; i++) { const v = Math.random() * 2 - 1; a.fill(v, i * 256, (i + 1) * 256); } return a; });
    }
    setTempo(bpm) {
      this.bpm = bpm;
      for (const pt of this.parts) if (pt.ifx && pt.ifx.tempo) pt.ifx.tempo(bpm);
      if (this.mfx && this.mfx.tempo) this.mfx.tempo(bpm);
    }
    setVolume(v) { this._sp(this.vol.gain, Math.pow(v / 127, 2) * 1.6); }
    setPatLevel(v) { this._sp(this.patLevel.gain, Math.pow(v / 127, 2) * 1.6); }

    /* --- Part-Kanal --- */
    syncPart(i, p, t) {
      const pt = this.parts[i], type = p.ifxOn ? p.ifx : 0;
      if (type !== pt.ifxType) {
        if (pt.ifx) pt.ifx.k.dispose();
        try { pt.in.disconnect(); } catch (e) {}
        pt.ifx = null; pt.ifxType = type; pt.ifxE = -1;
        const def = TW.IFX[type];
        if (def && def.b) { const k = kit(this), fx = def.b(k); fx.k = k; pt.in.connect(fx.in); fx.out.connect(pt.level); if (fx.tempo) fx.tempo(this.bpm); pt.ifx = fx; }
        else pt.in.connect(pt.level);
      }
      if (pt.ifx && pt.ifxE !== p.ifxEdit) { pt.ifxE = p.ifxEdit; pt.ifx.set(p.ifxEdit / 127); }
      this._sp(pt.level.gain, p.mute ? 0 : Math.pow(p.level / 127, 2), t);
      this._sp(pt.pan.pan, p.pan / 63, t);
      this._sp(pt.dry.gain, p.mfxSend ? 0 : 1, t);
      this._sp(pt.send.gain, p.mfxSend ? 1 : 0, t);
    }
    /* --- Master-Effekt --- */
    setMFX(type) {
      if (type !== this.mfxType || (!this.mfx && TW.MFX[type] && TW.MFX[type].b)) {
        if (this.mfx) { this.mfx.k.dispose(); try { this.mfxFeed.disconnect(); } catch (e) {} }
        this.mfx = null; this.mfxType = type;
        const def = TW.MFX[type];
        if (def && def.b) { const k = kit(this), fx = def.b(k); fx.k = k; this.mfxFeed.connect(fx.in); fx.out.connect(this.mfxOut); if (fx.tempo) fx.tempo(this.bpm); this.mfx = fx; }
      }
      this.mfxTouch(this.mfxOn, this.mx, this.my);
    }
    mfxTouch(on, x, y) {
      this.mfxOn = on;
      if (x != null) { this.mx = x; this.my = y; }
      if (this.mfx) this.mfx.xy(this.mx, this.my);
      const act = on && !!this.mfx, def = TW.MFX[this.mfxType] || {};
      this._sp(this.mfxFeed.gain, act ? 1 : 0);
      this._sp(this.mfxBypass.gain, act && def.ins ? 0 : 1);
    }
    step(t, sd, pos, spq) {
      for (const pt of this.parts) if (pt.ifx && pt.ifx.step) pt.ifx.step(t, sd, pos, spq);
      if (this.mfx && this.mfx.step) this.mfx.step(t, sd, pos, spq);
    }

    /* --- Stimmen --- */
    noteOn(i, p, note, vel, t, gate) {
      const c = this.ctx, pt = this.parts[i];
      t = Math.max(t, c.currentTime);
      if (this.alt[0] && (i === 12 || i === 13)) this.killPart(i === 12 ? 13 : 12, t);
      if (this.alt[1] && (i === 14 || i === 15)) this.killPart(i === 14 ? 15 : 14, t);
      const mine = this.voices.filter((v) => v.part === i && v.t0 <= t + 1e-4 && v.end > t && !v.cutAt);
      if (p.voice === 1) {
        const pv = mine.find((v) => v.gateEnd > t + 0.002);
        if (pv) {
          this._glideTo(pv, p, note, t);
          pv.note = note; pv.holds++;
          if (gate != null) this._release(pv, p, t + gate, true);
          else { if (isFinite(pv.gateEnd)) pv.rel.gain.cancelScheduledValues(pv.gateEnd - 0.001); pv.gateEnd = Infinity; if (!pv.eg) pv.end = Infinity; }
          pt.lastNote = note;
          return pv;
        }
      }
      if (p.voice <= 1) for (const v of mine) this._cut(v, t);
      else {
        if (p.voice === 2) for (const v of mine) if (v.note === note) this._cut(v, t);
        const act = mine.filter((v) => !v.cutAt);
        if (act.length >= 4) this._cut(act[0], t);
      }
      if (this.voices.length > 44) { const vic = this.voices.find((v) => !v.prio && !v.cutAt) || this.voices[0]; this._cut(vic, t); }
      const v = this._make(i, p, note, vel, t);
      if (gate != null) this._release(v, p, t + gate);
      pt.lastNote = note;
      this.voices.push(v);
      return v;
    }
    _make(i, p, note, vel, t) {
      const c = this.ctx, pt = this.parts[i], od = TW.OSCS[p.osc] || TW.OSCS[0];
      const semis = note - 60 + p.pitch, freq = C4 * Math.pow(2, semis / 12), e = p.oscEdit / 127;
      const v = { part: i, note, t0: t, srcs: [], nodes: [], pitch: [], freqP: [], rateP: null, filters: [], gateEnd: Infinity, end: Infinity, holds: 1, prio: p.priority, eg: !!p.ampEG };
      const pre = c.createGain(); v.nodes.push(pre);
      const from = p.glide > 0 && pt.lastNote != null && p.voice <= 1 ? Math.pow(2, (pt.lastNote - note) / 12) : 0;
      const gt = 0.005 + Math.pow(p.glide / 127, 2) * 1.5;
      const setF = (param, f) => { if (from) { param.setValueAtTime(f * from, t); param.exponentialRampToValueAtTime(f, t + gt); } else param.setValueAtTime(f, t); };
      const osc = (type, ratio = 1, cents = 0, gain = 1) => {
        const o = c.createOscillator();
        if (typeof type === 'string') o.type = type; else o.setPeriodicWave(type);
        setF(o.frequency, freq * ratio); v.freqP.push([o.frequency, ratio]);
        o.detune.value = cents;
        const g = c.createGain(); g.gain.value = gain; o.connect(g); g.connect(pre); v.nodes.push(g);
        o.start(t); v.srcs.push(o); v.pitch.push(o.detune);
        return o;
      };
      switch (od.k) {
        case 'pcm': {
          const b = this._buf('o' + p.osc, () => TW.pcmData(p.osc)), s = c.createBufferSource(), rate = Math.pow(2, semis / 12);
          s.buffer = b; setF(s.playbackRate, rate); v.rateP = s.playbackRate;
          s.connect(pre); s.start(t, e * b.duration * 0.5); v.srcs.push(s);
          if (s.detune) v.pitch.push(s.detune);
          v.pcmEnd = t + (b.duration * (1 - e * 0.5)) / Math.min(rate, from ? rate * from : rate) + 0.05;
          break;
        }
        case 'wave': osc(this._wave(od.w, e), 1, 0, 0.8); break;
        case 'uni': {
          const n = Math.sqrt(od.v.length) * 1.1;
          for (const [semi, dw, g, mix, w] of od.v) osc(w || od.w, Math.pow(2, semi / 12), dw * (mix ? od.det : e * od.det), (g * (mix ? e : 1)) / n);
          break;
        }
        case 'fm': {
          const car = osc('sine'), m = c.createOscillator(), mg = c.createGain();
          setF(m.frequency, freq * od.r); v.freqP.push([m.frequency, od.r]);
          const amt = freq * od.r * e * od.idx;
          mg.gain.setValueAtTime(amt, t);
          if (od.env) mg.gain.setTargetAtTime(amt * 0.15, t, od.env);
          m.connect(mg); mg.connect(car.frequency); m.start(t);
          v.srcs.push(m); v.nodes.push(mg); v.pitch.push(m.detune);
          break;
        }
        case 'ring': {
          const a = c.createOscillator(), rg = c.createGain(), m = c.createOscillator(), r = 0.5 + e * 3.5;
          a.type = 'sawtooth'; m.type = 'sine'; rg.gain.value = 0;
          setF(a.frequency, freq); setF(m.frequency, freq * r); v.freqP.push([a.frequency, 1], [m.frequency, r]);
          a.connect(rg); m.connect(rg.gain); rg.connect(pre); a.start(t); m.start(t);
          v.srcs.push(a, m); v.nodes.push(rg); v.pitch.push(a.detune, m.detune);
          break;
        }
        case 'noise': {
          const s = c.createBufferSource();
          s.buffer = this._buf('n' + od.col, () => TW.noiseData(od.col)); s.loop = true;
          s.playbackRate.value = clamp(Math.pow(2, semis / 12), 0.1, 4); v.rateP = s.playbackRate;
          s.connect(pre); s.start(t, Math.random()); v.srcs.push(s);
          if (s.detune) v.pitch.push(s.detune);
          break;
        }
      }
      // Filter
      let node = pre;
      const fd = TW.FILTERS[p.filterType] || TW.FILTERS[0], A = atkT(p.attack), D = decT(p.decay);
      if (fd.t) {
        for (let k = 0; k < fd.poles; k++) {
          const f = c.createBiquadFilter();
          f.type = fd.t; f.frequency.value = cutHz(p.cutoff); f.Q.value = this._q(fd, p.reso, k);
          if (p.egInt) { const amt = (p.egInt / 63) * 6000; f.detune.setValueAtTime(0, t); f.detune.linearRampToValueAtTime(amt, t + A); f.detune.setTargetAtTime(0, t + A, D / 3); }
          node.connect(f); node = f; v.filters.push(f); v.nodes.push(f);
        }
        if (fd.t === 'bandpass') { const g = c.createGain(); g.gain.value = 1.5 + v.filters[0].Q.value * 0.5; node.connect(g); node = g; v.nodes.push(g); }
        if (fd.drive) { const g = c.createGain(), ws = c.createWaveShaper(); g.gain.value = 1 + (p.reso / 127) * 2; ws.curve = this.tanh; node.connect(g); g.connect(ws); node = ws; v.nodes.push(g, ws); }
      }
      // Lautstärke-Hüllkurve
      const amp = c.createGain(), rel = c.createGain(), peak = Math.pow(vel / 127, 1.5);
      amp.gain.setValueAtTime(0, t); amp.gain.linearRampToValueAtTime(peak, t + A);
      if (v.eg) { amp.gain.setTargetAtTime(0, t + A, D / 4); v.end = t + A + D * 1.6 + 0.05; }
      if (v.pcmEnd) v.end = Math.min(v.end, v.pcmEnd);
      node.connect(amp); amp.connect(rel); node = rel; v.amp = amp; v.rel = rel; v.nodes.push(amp, rel);
      // Modulation
      if (p.modDepth > 0) node = this._mod(v, p, t, node);
      node.connect(pt.in);
      return v;
    }
    _q(fd, reso, k) { const r = reso / 127; return fd.t === 'bandpass' ? 0.7 + r * r * (k ? 6 : 18) : r * (k ? 8 : fd.drive ? 26 : 22); }
    _mod(v, p, t, node) {
      const c = this.ctx, md = TW.MODS[p.modType] || TW.MODS[0], d = p.modDepth / 127, eg = md.src === 'eg';
      let src;
      if (eg) { src = c.createConstantSource(); const T = 0.004 + Math.pow(1 - p.modSpeed / 127, 3) * 4; src.offset.setValueAtTime(1, t); src.offset.setTargetAtTime(0, t, T / 3); }
      else {
        const f = md.sync ? this.bpm / 60 / TW.SYNC[Math.round((p.modSpeed / 127) * (TW.SYNC.length - 1))] : 0.05 * Math.pow(600, p.modSpeed / 127);
        if (md.src === 'sh') { src = c.createBufferSource(); src.buffer = this._sh(); src.loop = true; src.playbackRate.value = (f * 256) / TW.SR; }
        else { src = c.createOscillator(); src.type = { tri: 'triangle', up: 'sawtooth', down: 'sawtooth', sq: 'square' }[md.src]; src.frequency.value = f; }
      }
      const g = c.createGain(); let amt = 0, targets = [];
      if (md.dst === 'cut') { amt = d * 4800; targets = v.filters.map((f) => f.detune); }
      else if (md.dst === 'pitch') { amt = d * d * 2400; targets = v.pitch; }
      else if (md.dst === 'level') { const tr = c.createGain(); tr.gain.value = eg ? 1 - d : 1 - d / 2; amt = eg ? d : d / 2; node.connect(tr); node = tr; v.nodes.push(tr); targets = [tr.gain]; }
      else { const pn = c.createStereoPanner(); amt = d; node.connect(pn); node = pn; v.nodes.push(pn); targets = [pn.pan]; }
      g.gain.value = md.src === 'down' ? -amt : amt;
      src.connect(g); for (const tg of targets) g.connect(tg);
      src.start(t); v.srcs.push(src); v.nodes.push(g);
      return node;
    }
    _glideTo(v, p, note, t) {
      const f = C4 * Math.pow(2, (note - 60 + p.pitch) / 12), tc = Math.max(0.012, (0.005 + Math.pow(p.glide / 127, 2) * 1.5) / 3);
      for (const [param, ratio] of v.freqP) { param.cancelScheduledValues(t); param.setTargetAtTime(f * ratio, t, tc); }
      if (v.rateP) { v.rateP.cancelScheduledValues(t); v.rateP.setTargetAtTime(Math.pow(2, (note - 60 + p.pitch) / 12), t, tc); }
    }
    _release(v, p, tr, resched) {
      if (resched && isFinite(v.gateEnd)) v.rel.gain.cancelScheduledValues(v.gateEnd - 0.001);
      v.gateEnd = tr;
      if (v.eg) return;
      const R = relT(p.decay);
      v.rel.gain.setTargetAtTime(0, tr, R / 4);
      v.end = Math.min(v.pcmEnd || Infinity, tr + R * 1.5 + 0.02);
    }
    _cut(v, t) {
      if (v.cutAt) return;
      v.rel.gain.cancelScheduledValues(t); v.rel.gain.setTargetAtTime(0, t, 0.004);
      v.end = Math.min(v.end, t + 0.035); v.cutAt = t; v.gateEnd = Math.min(v.gateEnd, t);
    }
    noteOff(v, p, t) {
      if (!v || v.cutAt) return;
      if (--v.holds > 0) return;
      this._release(v, p, Math.max(t, this.ctx.currentTime, v.t0 + 0.01));
    }
    killPart(i, t) { for (const v of this.voices) if (v.part === i && v.t0 <= t + 1e-4) this._cut(v, t); }
    allOff() { const t = this.ctx.currentTime; for (const v of this.voices) this._cut(v, t); }
    /* Laufende Stimmen an einen gedrehten Regler anpassen */
    live(i, p, name, t) {
      t = t || this.ctx.currentTime;
      for (const v of this.voices) {
        if (v.part !== i || v.cutAt) continue;
        if (name === 'cutoff') for (const f of v.filters) f.frequency.setTargetAtTime(cutHz(p.cutoff), t, 0.015);
        else if (name === 'reso') { const fd = TW.FILTERS[p.filterType]; v.filters.forEach((f, k) => f.Q.setTargetAtTime(this._q(fd, p.reso, k), t, 0.015)); }
        else if (name === 'pitch') {
          const f = C4 * Math.pow(2, (v.note - 60 + p.pitch) / 12);
          for (const [param, ratio] of v.freqP) param.setTargetAtTime(f * ratio, t, 0.015);
          if (v.rateP) v.rateP.setTargetAtTime(Math.pow(2, (v.note - 60 + p.pitch) / 12), t, 0.015);
        }
      }
    }
    _free(v, at) {
      for (const s of v.srcs) { try { at != null ? s.stop(at) : s.stop(); } catch (e) {} }
      if (at == null) { for (const s of v.srcs) { try { s.disconnect(); } catch (e) {} } for (const n of v.nodes) { try { n.disconnect(); } catch (e) {} } }
    }
    sweep() {
      const now = this.ctx.currentTime;
      if (!this.voices.some((v) => v.end < now)) return;
      this.voices = this.voices.filter((v) => { if (v.end < now) { this._free(v); return false; } return true; });
    }
    finalize() { for (const v of this.voices) if (isFinite(v.end)) this._free(v, v.end); }
    click(t, accent) {
      const c = this.ctx, o = c.createOscillator(), g = c.createGain();
      o.frequency.value = accent ? 1800 : 1200; o.type = 'square';
      g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      o.connect(g); g.connect(this.lim); o.start(t); o.stop(t + 0.05);
    }
    level() {
      this.analyser.getFloatTimeDomainData(this.meterBuf);
      let m = 0; for (let i = 0; i < 1024; i += 4) m = Math.max(m, Math.abs(this.meterBuf[i]));
      return m;
    }
  }
  TW.Engine = Engine;
})();
