/* Taktwerk – Grunddaten: Skalen, Akkorde, Grooves, Gate-Arp, Modulationstypen */
(function () {
  'use strict';
  const TW = (window.TW = {});
  TW.VERSION = '1.0';
  TW.NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  TW.noteName = (n) => TW.NOTES[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 1);
  TW.clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  TW.SCALES = [
    ['Chromatisch', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]],
    ['Dur (Ionisch)', [0, 2, 4, 5, 7, 9, 11]],
    ['Dorisch', [0, 2, 3, 5, 7, 9, 10]],
    ['Phrygisch', [0, 1, 3, 5, 7, 8, 10]],
    ['Lydisch', [0, 2, 4, 6, 7, 9, 11]],
    ['Mixolydisch', [0, 2, 4, 5, 7, 9, 10]],
    ['Moll (Äolisch)', [0, 2, 3, 5, 7, 8, 10]],
    ['Lokrisch', [0, 1, 3, 5, 6, 8, 10]],
    ['Harmonisch Moll', [0, 2, 3, 5, 7, 8, 11]],
    ['Melodisch Moll', [0, 2, 3, 5, 7, 9, 11]],
    ['Dur-Blues', [0, 2, 3, 4, 7, 9]],
    ['Moll-Blues', [0, 3, 5, 6, 7, 10]],
    ['Dur-Pentatonik', [0, 2, 4, 7, 9]],
    ['Moll-Pentatonik', [0, 3, 5, 7, 10]],
    ['Ganzton', [0, 2, 4, 6, 8, 10]],
    ['Vermindert', [0, 2, 3, 5, 6, 8, 9, 11]],
    ['Spanisch', [0, 1, 4, 5, 7, 8, 10]],
    ['Zigeuner', [0, 2, 3, 6, 7, 8, 11]],
    ['Arabisch', [0, 1, 4, 5, 7, 8, 11]],
    ['Ägyptisch', [0, 2, 5, 7, 10]],
    ['Hirajoshi', [0, 2, 3, 7, 8]],
    ['In-Sen', [0, 1, 5, 7, 10]],
    ['Iwato', [0, 1, 5, 6, 10]],
    ['Kumoi', [0, 2, 3, 7, 9]],
    ['Pelog', [0, 1, 3, 7, 8]],
    ['Ryukyu', [0, 4, 5, 7, 11]],
    ['Raga Bhairav', [0, 1, 4, 5, 7, 8, 11]],
    ['Oktave + Quinte', [0, 7]],
  ];

  // d = Stufen-Abstände in der Skala, s = Halbtöne (für die chromatische Skala)
  TW.CHORD_SETS = [
    { n: 'Dreiklänge', d: [0, 2, 4], s: [0, 4, 7] },
    { n: 'Septakkorde', d: [0, 2, 4, 6], s: [0, 4, 7, 10] },
    { n: 'Sus4', d: [0, 3, 4], s: [0, 5, 7] },
    { n: 'Add9', d: [0, 2, 4, 8], s: [0, 4, 7, 14] },
    { n: 'Weit', d: [0, 4, 7, 9], s: [0, 7, 12, 16] },
  ];

  TW.BEATS = ['16tel', '32stel', '8tel-Triole', '16tel-Triole'];
  TW.STEP_BEATS = [0.25, 0.125, 1 / 3, 1 / 6];
  TW.spb = (pat) => (pat.beat >= 2 ? 12 : 16); // Steps pro Takt-Seite
  TW.stepDur = (pat) => (60 / pat.bpm) * TW.STEP_BEATS[pat.beat];
  TW.partLen = (pat, p) => (pat.length - 1) * TW.spb(pat) + Math.min(p.lastStep, TW.spb(pat));

  const r4 = (a) => [...a, ...a, ...a, ...a];
  TW.GROOVES = [
    { n: 'Aus' },
    { n: 'Akzent Viertel', v: r4([1, 0.55, 0.7, 0.55]) },
    { n: 'Akzent Offbeat', v: r4([0.6, 0.55, 1, 0.55]) },
    { n: 'Akzent Achtel', v: r4([1, 0.5, 0.9, 0.5]) },
    { n: 'Shaker', v: r4([1, 0.45, 0.75, 0.5]), t: r4([0, 0.06, 0, 0.09]) },
    { n: 'Conga', v: [1, 0.5, 0.6, 0.9, 0.5, 0.6, 1, 0.5, 0.9, 0.5, 0.6, 1, 0.5, 0.9, 0.6, 0.7], t: r4([0, 0.04, -0.03, 0.05]) },
    { n: 'Laid Back', t: r4([0, 0.14, 0.05, 0.16]) },
    { n: 'Push', t: r4([0, -0.1, -0.03, -0.12]) },
    { n: 'Human', v: [1, 0.82, 0.9, 0.78, 0.96, 0.8, 0.88, 0.84, 1, 0.79, 0.92, 0.8, 0.95, 0.83, 0.87, 0.9], t: [0, 0.03, -0.02, 0.05, 0.01, -0.03, 0.04, 0.02, 0, 0.05, -0.01, 0.03, 0.02, -0.02, 0.04, 0.06] },
    { n: 'Crescendo', v: Array.from({ length: 16 }, (_, i) => 0.35 + (i / 15) * 0.65) },
    { n: 'Decrescendo', v: Array.from({ length: 16 }, (_, i) => 1 - (i / 15) * 0.65) },
  ];

  // g = Gate je Step (0 = Pause), d = Unterteilungen je Step
  TW.GATE_ARPS = [
    { n: '16tel', g: [0.5] },
    { n: '16tel Staccato', g: [0.2] },
    { n: '16tel Legato', g: [1] },
    { n: '8tel', g: [0.9, 0] },
    { n: '8tel Offbeat', g: [0, 0, 0.9, 0] },
    { n: 'Viertel', g: [1.8, 0, 0, 0] },
    { n: '32stel', g: [0.5], d: 2 },
    { n: 'Triole', g: [0.5], d: 3 },
    { n: 'Galopp', g: [0.6, 0, 0.5, 0.5] },
    { n: 'Synkope', g: [0.8, 0, 0, 0.8, 0, 0, 0.8, 0] },
    { n: 'Tresillo', g: [0.8, 0, 0, 0.8, 0, 0, 0.8, 0, 0, 0, 0.8, 0, 0.8, 0, 0, 0] },
    { n: 'Stotter', g: [0.4, 0.4, 0, 0.4, 0.4, 0, 0.4, 0, 0.4, 0.4, 0, 0.4, 0, 0.4, 0.4, 0.4] },
    { n: 'Lauf', g: [0.9, 0, 0.5, 0, 0.5, 0.5, 0.5, 0.5, 0.9, 0, 0.5, 0, 0.5, 0.5, 0.5, 0.5], d: 1 },
  ];

  const SRC = [['tri', 'LFO Dreieck'], ['up', 'LFO Säge auf'], ['down', 'LFO Säge ab'], ['sq', 'LFO Rechteck'], ['sh', 'LFO Zufall']];
  const DST = [['cut', 'Cutoff'], ['pitch', 'Pitch'], ['level', 'Level'], ['pan', 'Pan']];
  TW.MODS = [];
  for (const [d, dn] of DST) TW.MODS.push({ n: 'EG+ → ' + dn, src: 'eg', dst: d, c: 'EG' });
  for (const sync of [0, 1])
    for (const [s, sn] of SRC)
      for (const [d, dn] of DST) TW.MODS.push({ n: sn + (sync ? ' BPM' : '') + ' → ' + dn, src: s, dst: d, sync, c: sync ? 'LFO BPM' : 'LFO frei' });
  TW.SYNC = [16, 8, 4, 3, 2, 1.5, 1, 0.75, 2 / 3, 0.5, 0.375, 1 / 3, 0.25, 3 / 16, 1 / 6, 0.125, 1 / 12, 1 / 16];
  TW.SYNC_N = ['4 Takte', '2 Takte', '1 Takt', '3/4', '1/2', '3/8', '1/4', '3/16', '1/4T', '1/8', '3/32', '1/8T', '1/16', '3/64', '1/16T', '1/32', '1/32T', '1/64'];
  TW.VOICES = ['Mono 1', 'Mono 2 (Legato)', 'Poly 1', 'Poly 2'];
  TW.MOTION = ['Aus', 'Smooth', 'Trigger Hold'];
  TW.MOTION_PARAMS = ['pitch', 'glide', 'oscEdit', 'cutoff', 'reso', 'egInt', 'modSpeed', 'modDepth', 'level', 'pan', 'attack', 'decay', 'ifxEdit'];

  // Tonleiter-Hilfen
  TW.scaleNote = (pat, deg) => {
    const ints = TW.SCALES[pat.scale][1];
    const L = ints.length;
    return 12 * Math.floor(deg / L) + ints[((deg % L) + L) % L];
  };
  TW.keyNote = (pat, k, oct) => 48 + pat.key + 12 * oct + TW.scaleNote(pat, k);
  TW.chordNotes = (pat, k, oct) => {
    const cs = TW.CHORD_SETS[pat.chordSet];
    if (TW.SCALES[pat.scale][1].length === 12) return cs.s.map((s) => 48 + pat.key + 12 * oct + k + s);
    return cs.d.map((d) => TW.keyNote(pat, k + d, oct));
  };
  TW.chordName = (notes) => {
    const r = notes[0], t = notes[1] - r, f = notes[2] - r;
    let q = t === 3 && f === 6 ? 'dim' : t === 3 ? 'm' : t === 4 && f === 8 ? 'aug' : t === 5 ? 'sus4' : t === 2 ? 'sus2' : t === 7 ? '5' : '';
    if (notes[3] != null && t !== 7) {
      const s = notes[3] - r;
      if (s === 10) q += '7';
      else if (s === 11) q += q === '' ? 'maj7' : 'M7';
      else if (s === 9) q += '6';
      else if (s === 13 || s === 14) q += 'add9';
    }
    return TW.NOTES[r % 12] + q;
  };
})();
