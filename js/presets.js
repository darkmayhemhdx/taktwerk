/* Taktwerk – Grundeinstellung der Parts und Werks-Pattern */
(function () {
  'use strict';
  const TW = window.TW;
  const DEF = {
    osc: 0, pitch: 0, glide: 0, oscEdit: 0, filterType: 1, cutoff: 127, reso: 0, egInt: 0,
    modType: 0, modSpeed: 60, modDepth: 0, level: 100, pan: 0, attack: 0, decay: 127, ampEG: true,
    ifx: 0, ifxEdit: 64, ifxOn: false, mfxSend: true, voice: 0, priority: 0, motionMode: 1,
    trigVel: true, grooveType: 0, grooveDepth: 64, lastStep: 16, mute: false,
  };
  const KIT = [
    ['Kick 909', {}], ['Snare 909', {}], ['Clap 808', {}], ['Tom mittel', {}],
    ['Conga hoch', {}], ['Cowbell', {}], ['Crash', {}], ['Zap', {}],
    ['Saw + Sub', { voice: 0, filterType: 2, cutoff: 70, reso: 30, egInt: 20, decay: 70, oscEdit: 80, pitch: -24 }],
    ['Pulse', { voice: 0, filterType: 2, cutoff: 95, reso: 20, decay: 75, oscEdit: 40 }],
    ['Super Saw', { voice: 2, filterType: 2, cutoff: 90, decay: 85, oscEdit: 50, level: 85 }],
    ['FM E-Piano', { voice: 2, decay: 80, oscEdit: 50, level: 90 }],
    ['HiHat zu', { level: 85 }], ['HiHat offen', { level: 80 }], ['Shaker', { level: 85 }], ['Ride', { level: 75 }],
  ];
  TW.defPart = (i) => {
    const p = Object.assign({}, DEF, KIT[i][1]);
    p.osc = TW.oscIdx(KIT[i][0]);
    p.steps = new Array(64).fill(null);
    p.motion = null;
    return p;
  };
  TW.initPattern = () => ({
    name: 'Init', bpm: 120, swing: 0, length: 1, beat: 0, key: 0, scale: 6, chordSet: 0, gateArp: 0, level: 100,
    mfx: 1, mfxX: 0.45, mfxY: 0.6, mfxHold: false, alt1314: true, alt1516: false, chainTo: -1, chainRepeat: 1,
    parts: Array.from({ length: 16 }, (_, i) => TW.defPart(i)),
  });

  /* ---------- Kurzschrift für Pattern ---------- */
  const NN = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const midi = (s) => { const m = /^([A-G])(#?)(-?\d)$/.exec(s); return 12 * (+m[3] + 1) + NN[m[1]] + (m[2] ? 1 : 0); };
  function parseBar(str) {
    if (!/\s/.test(str.trim())) return [...str].map((ch) => (ch === 'x' ? { n: [60], v: 100, g: 0.75 } : ch === 'X' ? { n: [60], v: 127, g: 0.75 } : ch === 'o' ? { n: [60], v: 55, g: 0.75 } : null));
    return str.trim().split(/\s+/).map((tok) => {
      if (tok === '.' || tok === '-') return null;
      let v = 100, g = 0.75;
      if (tok.endsWith('!')) { v = 127; tok = tok.slice(0, -1); }
      if (tok.endsWith('?')) { v = 60; tok = tok.slice(0, -1); }
      const [ns, gs] = tok.split(':');
      if (gs) g = +gs;
      return { n: ns.split('+').map(midi), v, g };
    });
  }
  const NAMES = { osc: TW.oscIdx, filterType: TW.filtIdx, ifx: TW.ifxIdx, modType: (n) => Math.max(0, TW.MODS.findIndex((m) => m.n === n)) };
  function mk(name, bpm, opts, parts) {
    const pat = TW.initPattern();
    Object.assign(pat, { name, bpm }, opts);
    if (typeof pat.mfx === 'string') pat.mfx = TW.mfxIdx(pat.mfx);
    if (typeof pat.scale === 'string') pat.scale = Math.max(0, TW.SCALES.findIndex((s) => s[0] === pat.scale));
    for (const [num, params, ...bars] of parts) {
      const p = pat.parts[num - 1];
      for (const k in params) p[k] = NAMES[k] && typeof params[k] === 'string' ? NAMES[k](params[k]) : params[k];
      for (let b = 0; b < pat.length; b++) parseBar(bars[b % bars.length]).forEach((st, s) => { if (st) p.steps[b * 16 + s] = st; });
    }
    return pat;
  }

  const MOLL = 'Moll (Äolisch)';
  TW.FACTORY = [
    () => mk('Nachtfahrt', 124, { length: 2, key: 9, scale: MOLL, mfx: 'Hall', mfxX: 0.35, mfxY: 0.6 }, [
      [1, { osc: 'Kick 909', mfxSend: false }, 'x---x---x---x---'],
      [3, { osc: 'Clap 808', level: 88 }, '----x-------x---', '----x-------x-o-'],
      [13, { level: 70, grooveType: 4, grooveDepth: 90, mfxSend: false }, 'xoxoxoxoxoxoxoxo'],
      [14, { level: 72, decay: 70, mfxSend: false }, '--x---x---x---x-'],
      [15, { level: 60, mfxSend: false }, '-o-o-o-o-o-o-o-o'],
      [9, { osc: 'Saw + Sub', pitch: 0, filterType: 'LPF 24 dB', cutoff: 62, reso: 35, egInt: 28, decay: 62, oscEdit: 90, mfxSend: false, ifx: 'Pump', ifxOn: true, ifxEdit: 70 },
        '. . A1 . . A1 . A1 . . A1 . . C2 . G1', '. . A1 . . A1 . A1 . . F1 . . F1 G1 .'],
      [11, { osc: 'Super Saw', filterType: 'LPF 24 dB', cutoff: 84, reso: 15, egInt: 18, decay: 72, oscEdit: 45, level: 78, voice: 2, ifx: 'Pump', ifxOn: true, ifxEdit: 90 },
        'A3+C4+E4 . . A3+C4+E4 . . A3+C4+E4 . . . F3+A3+C4 . . F3+A3+C4 . .', 'G3+B3+D4 . . G3+B3+D4 . . G3+B3+D4 . . . E3+G3+B3 . . E3+G3+B3 . .'],
      [10, { osc: 'Pulse', pitch: 0, oscEdit: 55, filterType: 'LPF 12 dB', cutoff: 100, decay: 60, level: 70, ifx: 'Delay 3/16', ifxOn: true, ifxEdit: 55 },
        '. . . . . . . . . . . . E5 . D5 C5', 'A4 . . . . . . . . . . . . . . .'],
    ]),
    () => mk('Kellerdruck', 132, { length: 2, key: 9, scale: 'Phrygisch', mfx: 'Tiefpass-Sweep', mfxX: 0.6, mfxY: 0.5 }, [
      [1, { osc: 'Kick Hart', mfxSend: true }, 'x---x---x---x---'],
      [4, { osc: 'Tom tief', pitch: -5, level: 70, decay: 60, ifx: 'Raumhall', ifxOn: true, ifxEdit: 80 }, '--o---o---o---oo'],
      [3, { osc: 'Clap Eng', level: 80 }, '----x-------x---'],
      [13, { osc: 'HiHat zu kurz', level: 72, grooveType: 1, grooveDepth: 80 }, 'xxxxxxxxxxxxxxxx'],
      [14, { osc: 'HiHat offen', level: 74, decay: 62 }, '--x---x---x---x-'],
      [16, { osc: 'Ride', level: 55 }, 'x-x-x-x-x-x-x-x-'],
      [9, { osc: 'Saw', pitch: 0, filterType: 'LPF Acid', cutoff: 48, reso: 100, egInt: 36, decay: 48, voice: 1, glide: 38, level: 88, ifx: 'Overdrive', ifxOn: true, ifxEdit: 45 },
        'A1 . A1 A2:1 A1 . G1 A1 . A1! A2 . A1:1 C2 . A#1', 'A1 . A1 A2:1 A1 . G1 A1 . A2! A1 . D2:1 C2:1 A#1 A2'],
    ]),
    () => mk('Mitternacht', 140, { length: 2, key: 1, scale: MOLL, mfx: 'Hall', mfxX: 0.4, mfxY: 0.45, mfxHold: true }, [
      [1, { osc: 'Kick 808 lang', pitch: -11, decay: 100, mfxSend: false, ifx: 'Overdrive', ifxOn: true, ifxEdit: 30, voice: 0 },
        'x-----x---x-----', 'x-----x----x--x-'],
      [2, { osc: 'Snare Knack', level: 95 }, '--------x-------', '--------x-----o-'],
      [3, { osc: 'Clap Hall', level: 70 }, '--------x-------'],
      [13, { osc: 'HiHat zu kurz', level: 78, mfxSend: false, grooveType: 3, grooveDepth: 70 }, 'x-x-x-x-x-x-xxxx', 'x-x-xxx-x-x-x-x-'],
      [14, { level: 65, decay: 66, mfxSend: false }, '------x---------', '--------------x-'],
      [12, { osc: 'FM Glocke', pitch: 0, oscEdit: 45, decay: 88, level: 80, voice: 2, ifx: 'Delay 3/16', ifxOn: true, ifxEdit: 45 },
        'C#5 . . G#4 . . E4 . . . C#5 . . . D#5 .', 'E5 . . D#5 . . C#5 . . . G#4 . . . . .'],
      [11, { osc: 'Dual Triangle', oscEdit: 30, attack: 70, decay: 95, level: 62, voice: 2, ampEG: false, filterType: 'LPF 12 dB', cutoff: 90 },
        'C#3+E3+G#3:15 . . . . . . . . . . . . . . .', 'A2+C#3+E3:15 . . . . . . . . . . . . . . .'],
    ]),
    () => mk('Bruchkante', 172, { length: 2, key: 5, scale: MOLL, mfx: 'Hall', mfxX: 0.3, mfxY: 0.5 }, [
      [1, { osc: 'Kick Kurz', mfxSend: false }, 'x---------x-----', 'x--x------x-----'],
      [2, { osc: 'Snare 909', level: 100 }, '----x--o-o--x---', '----x--o-o--x--o'],
      [13, { level: 68, mfxSend: false, grooveType: 8, grooveDepth: 100 }, 'x-x-x-x-x-x-x-x-'],
      [15, { osc: 'Shaker', level: 55, mfxSend: false }, '-x-x-x-x-x-x-x-x'],
      [7, { osc: 'Crash', level: 60 }, 'x---------------', '----------------'],
      [9, { osc: 'Dual Saw', pitch: 0, oscEdit: 60, filterType: 'LPF 24 dB', cutoff: 52, reso: 40, voice: 1, glide: 30, ampEG: false, decay: 30, modType: 'LFO Dreieck BPM → Cutoff', modSpeed: 90, modDepth: 45, mfxSend: false, level: 92 },
        'F1:6 . . . . . . F1:2 . . G#1:4 . . . D#1:2 .', 'F1:6 . . . . . . F1:2 . . C2:3 . . A#1:3 . .'],
      [11, { osc: 'Super Saw', oscEdit: 40, attack: 60, ampEG: false, decay: 85, filterType: 'HPF 12 dB', cutoff: 50, level: 60, voice: 2 },
        'F3+G#3+C4:15 . . . . . . . . . . . . . . .', 'C#3+F3+G#3:15 . . . . . . . . . . . . . . .'],
    ]),
    () => mk('Blechfunk', 112, { length: 2, key: 2, scale: 'Dorisch', swing: 14, mfx: 'Tempo-Delay', mfxX: 0.7, mfxY: 0.4 }, [
      [1, { osc: 'Kick Elektro', mfxSend: false }, 'x-----x---x-----', 'x-----x---x--x--'],
      [2, { osc: 'Snare Elektro', mfxSend: false }, '----x-------x---'],
      [6, { osc: 'Cowbell', level: 62 }, '--x--x----x--x--'],
      [8, { osc: 'Zap', level: 60 }, '----------------', '--------------x-'],
      [5, { osc: 'Clave', level: 70 }, '---x--x---x--x--'],
      [13, { level: 70, mfxSend: false }, 'x-xxx-xxx-xxx-xx'],
      [14, { level: 70, decay: 60, mfxSend: false }, '--------------x-'],
      [9, { osc: 'FM Bass', pitch: 0, oscEdit: 70, decay: 55, level: 95, mfxSend: false, voice: 0 },
        'D2 . D2 . . D3 . D2 . . F2 . G2 . . C2', 'D2 . D2 . . D3 . D2 . . A2 . G2 . F2 .'],
      [10, { osc: 'Sync Saw', pitch: 0, oscEdit: 50, filterType: 'BPF 12 dB', cutoff: 85, reso: 40, decay: 50, level: 66, modType: 'EG+ → Cutoff', modSpeed: 80, modDepth: 60 },
        '. . . . A4 . . C5 . . . . D5 . . .', '. . . . A4 . . F4 . . . . G4 . A4 .'],
    ]),
    () => mk('Schwebebahn', 92, { length: 2, key: 4, scale: 'Dur-Pentatonik', mfx: 'Hall', mfxX: 0.6, mfxY: 0.7, mfxHold: true }, [
      [1, { osc: 'Kick Tief', level: 85, mfxSend: false }, 'x-------x-------', 'x-------x-----o-'],
      [15, { osc: 'Shaker', level: 50, grooveType: 4, grooveDepth: 90 }, 'xxxxxxxxxxxxxxxx'],
      [2, { osc: 'Rimshot', level: 60 }, '----x-------x---'],
      [11, { osc: 'Super Saw', oscEdit: 35, attack: 85, ampEG: false, decay: 100, filterType: 'LPF 24 dB', cutoff: 78, reso: 10, level: 66, voice: 2, modType: 'LFO Dreieck → Cutoff', modSpeed: 25, modDepth: 25 },
        'E3+G#3+B3+F#4:15 . . . . . . . . . . . . . . .', 'C#3+E3+G#3+B3:15 . . . . . . . . . . . . . . .'],
      [12, { osc: 'FM Glocke', pitch: 0, oscEdit: 35, decay: 90, level: 72, voice: 2, ifx: 'Delay 3/16', ifxOn: true, ifxEdit: 60 },
        'E4? . G#4 . B4? . C#5 . E5 . C#5? . B4 . G#4? .', 'F#4? . G#4 . B4? . E5 . F#5 . E5? . B4 . G#4? .'],
      [9, { osc: 'Sine', pitch: 0, oscEdit: 20, decay: 80, ampEG: false, level: 88, mfxSend: false, voice: 1 },
        'E1:7 . . . . . . . E1:6 . . . . . . .', 'C#1:7 . . . . . . . C#1:6 . . . . . B0:1 .'],
    ]),
  ];
})();
