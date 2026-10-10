// feedback.js — optional dice sound and vibration (Settings: Dice sound, Vibrate on rolls; both off
// by default). It listens for dice landing anywhere in the app — a new `.dice-row` — so no roll path
// needs to know about it. The clatter is synthesised with Web Audio; nothing is downloaded.

import { Settings } from "./settings.js";

let ctx = null;

/** A short clatter: one filtered noise tick per die, staggered, capped at eight. */
function clatter(dice = 3) {
  if (!Settings.diceSound()) return false;
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    const n = Math.max(1, Math.min(8, dice));
    for (let i = 0; i < n; i++) {
      const t = ctx.currentTime + i * 0.045 + Math.random() * 0.02;
      const len = 0.05;
      const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let j = 0; j < data.length; j++) data[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / data.length, 3);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass"; bp.frequency.value = 1800 + Math.random() * 1600; bp.Q.value = 4;
      const g = ctx.createGain(); g.gain.value = 0.5;
      src.connect(bp).connect(g).connect(ctx.destination);
      src.start(t);
    }
    return true;
  } catch { return false; }
}

/** A buzz pattern; a no-op on devices without vibration or with the setting off. */
function buzz(pattern = 30) {
  if (!Settings.haptics() || !navigator.vibrate) return false;
  try { return navigator.vibrate(pattern); } catch { return false; }
}

/** Watch for dice landing and for critical-injury bursts. */
export function installFeedback(root = document.body) {
  new MutationObserver((records) => {
    for (const r of records) for (const n of r.addedNodes) {
      if (!(n instanceof Element)) continue;
      const rows = n.matches(".dice-row") ? [n] : Array.from(n.querySelectorAll(".dice-row"));
      for (const row of rows) {
        const dice = row.querySelectorAll(".die").length;
        if (!dice) continue;
        clatter(dice);
        buzz(row.querySelector(".die.six") ? [25, 40, 25] : 25);
      }
      if (n.matches?.(".sfx.krak") || n.querySelector?.(".sfx.krak")) buzz([60, 40, 120]);
    }
  }).observe(root, { childList: true, subtree: true });
}
