// js/heroAudio.js — VihuPlanet Hero Audio (Sprint H4-H6).
//
// The Hero should sound like opening an old storybook, not a game:
// no hover sounds, no looping ambience, no background music, no
// repetitive effects (Part 7 of the sprint brief). Only a meaningful
// click produces a sound, and only ever a soft, short, handcrafted
// one.
//
// Every sound here is synthesized with the Web Audio API at the
// moment it's needed — no binary audio assets, no CDN, nothing for
// the World Library pipeline to carry or a future sprint to hunt
// licenses for. Playing only ever happens from inside a real click/
// keydown handler (a user gesture), which is exactly the condition
// browsers already require before they'll let a page make sound —
// no autoplay-unlock workaround needed.
//
// Public API:
//   HeroAudio.storyWorldClick()    — soft paper-touch, <250ms
//   HeroAudio.telescopeClick()     — tiny brass tick
//   HeroAudio.dreamingHomeClick()  — soft wood tap + warm chime

(function (global) {
  'use strict';

  var _ctx = null;
  function _context() {
    if (_ctx) return _ctx;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    try { _ctx = new AC(); } catch (e) { _ctx = null; }
    return _ctx;
  }

  // A short burst of filtered noise — reads as a soft paper/cloth/
  // wood touch rather than a synth blip. Band-pass filtered so it
  // sits at one gentle pitch rather than a full-spectrum hiss.
  function _noiseBurst(ctx, opts) {
    var duration = opts.duration;
    var buffer = ctx.createBuffer(1, Math.max(1, Math.ceil(ctx.sampleRate * duration)), ctx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);

    var src = ctx.createBufferSource();
    src.buffer = buffer;

    var filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = opts.frequency;
    filter.Q.value = opts.q || 1;

    var gain = ctx.createGain();
    var now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(opts.peak, now + opts.attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
    src.stop(now + duration);
  }

  // A single quiet, quickly-decaying tone — reads as a small metal
  // tick or a warm chime overtone depending on frequency/type, never
  // a game "coin" sound (kept well under game-SFX volume/brightness).
  function _tone(ctx, opts) {
    var now = ctx.currentTime;
    var osc = ctx.createOscillator();
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(opts.frequency, now);
    if (opts.frequencyEnd) osc.frequency.exponentialRampToValueAtTime(opts.frequencyEnd, now + opts.duration);

    var gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(opts.peak, now + (opts.attack || 0.005));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + opts.duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + opts.duration);
  }

  function storyWorldClick() {
    var ctx = _context();
    if (!ctx) return;
    _noiseBurst(ctx, { duration: 0.16, frequency: 2200, q: 0.7, peak: 0.05, attack: 0.008 });
  }

  function telescopeClick() {
    var ctx = _context();
    if (!ctx) return;
    _tone(ctx, { type: 'triangle', frequency: 1046.5, frequencyEnd: 900, duration: 0.09, peak: 0.035 });
    _tone(ctx, { type: 'sine', frequency: 1568, duration: 0.06, peak: 0.02, attack: 0.002 });
  }

  function dreamingHomeClick() {
    var ctx = _context();
    if (!ctx) return;
    _noiseBurst(ctx, { duration: 0.12, frequency: 380, q: 1.2, peak: 0.045, attack: 0.004 });
    _tone(ctx, { type: 'sine', frequency: 523.25, duration: 0.22, peak: 0.025, attack: 0.01 });
  }

  var api = {
    storyWorldClick: storyWorldClick,
    telescopeClick: telescopeClick,
    dreamingHomeClick: dreamingHomeClick
  };
  try { global.HeroAudio = api; } catch (e) {}
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
