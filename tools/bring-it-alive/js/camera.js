/* CAMERA — the second way a photograph arrives. Beside the picker, never
 * instead of it: the product owner wants to COMPARE the camera against
 * uploading, so both stay first-class ("keep both options").
 *
 * Everything downstream is untouched. The captured frame is drawn at the
 * video's NATIVE resolution (videoWidth × videoHeight, never the CSS box),
 * wrapped in a File named camera-<timestamp>.png, and handed to the exact
 * same entry the picker uses — BIACapture.capture() via the app's
 * loadPhoto. One pipeline, no camera-specific branch after this file.
 *
 * House rules (Decision 16's spirit): it must never look like scanning —
 * no corner brackets, no reticle, no sweeping line, no percentages. Just
 * the live picture and one big button. And the language never blames: a
 * refused permission, a missing camera and an insecure context all end in
 * the same gentle line with the picker right there — never a technical
 * word at a child. The honest reason still goes to the developer log,
 * which is instrumentation, not the child's screen.
 *
 * The camera light never outlives its use: tracks stop the moment the
 * picture is taken (retake asks again), on Never Mind, and on page hide.
 *
 * THE FRAME HAS TWO SHAPES (product owner: "for taking handwriting pics
 * the camera needs to be portrait not landscape give a button to move
 * camera between landscape and protrait"). Child-facing they are the
 * WIDE PAGE and the TALL PAGE — one button on the live preview moves
 * between them. Wide is exactly what the camera always did: the full
 * native frame, untouched. Tall re-requests the stream with the ideals
 * swapped so hardware that CAN turn (phones, tablets) actually does;
 * hardware that stays wide anyway (laptop webcams — the sensor is
 * physically wide) gets a CENTRED CROP at TALL_ASPECT (4:5 — see the
 * constant for why it is wider than the sheet itself).
 * The preview shows exactly the crop (object-fit: cover on a box of the
 * crop's own aspect centres identically to the capture arithmetic), and
 * the captured frame is the crop region of the NATIVE stream — never a
 * CSS-sized redraw. Journeys may state a preferred shape through
 * setPreferredShape() (My Handwriting photographs a tall written
 * sheet); the child's own toggle choice wins over it for the session.
 *
 * THE PICTURE CAN WAIT (product owner: "for take photo button i need
 * 5sec and 10 sec timer"). A small three-choice control beside Take —
 * Now · 🕔 5 · 🕙 10 — so a child can press the button and then have
 * both hands free to hold the page up. With a wait chosen, Take starts
 * a big soft count drawn ON the live picture itself (product owner:
 * "show the count down on the camera itself" — the child is looking AT
 * the camera view, so the number lives there, centred over the video,
 * never beside it). No beeps, no flashing; the frame is captured at
 * zero through the exact same capture path, native resolution and
 * tall-crop respected. Take reads Stop while counting, and pressing it
 * — or Never mind, or leaving the step — ends the count with no
 * picture and no light left on. The choice is remembered for the
 * session and both hosts inherit all of it from this one file.
 */
(function () {
  'use strict';

  let stream = null;
  let opts = { onPicture: null, log: function () {} };
  let els = null;      // the mounted host's elements (defaultEls() = this page's ids)
  let hooked = false;  // page-level listeners attach once, whatever remounts
  let shape = 'wide';       // 'wide' | 'tall' — the frame the child sees now
  let childChose = false;   // the child pressed the button — their choice wins
  let savedLiveStyle = '';  // the host's own inline styles, restored on wide
  let savedShotStyle = '';
  const PREVIEW_H = 380;    // tall preview height budget — fits both hosts
  let timerSeconds = 0;     // 0 · 5 · 10 — the child's choice, kept for the session
  let counting = null;      // { endAt, overlay, label, shown, raf } while the count runs
  let timeScale = 1;        // test seam (_setTimeScale) — the product always runs at 1
  const $ = (id) => document.getElementById(id);

  // The three choices for WHEN the picture is taken. Words a child can
  // read: right away, or after a little clock's count — never a
  // technical word for it.
  const TIMER_CHOICES = [
    { s: 0,  words: 'Now',
      hint: 'The picture is taken right away' },
    { s: 5,  words: '🕔 5',
      hint: 'The picture waits 5 seconds — time to hold your page up' },
    { s: 10, words: '🕙 10',
      hint: 'The picture waits 10 seconds — time to hold your page up' }
  ];

  // The standalone page's own elements — the default host. A second host
  // (the Studio overlay) passes its own map into mount({els}), so ONE
  // camera implementation serves both and neither page's markup leaks
  // into the other.
  function defaultEls() {
    return {
      button: $('cameraBtn'), panel: $('cameraPanel'),
      live: $('cameraLive'), shot: $('cameraShot'),
      take: $('cameraTakeBtn'), use: $('cameraUseBtn'),
      retake: $('cameraRetakeBtn'), close: $('cameraCloseBtn'),
      quiet: $('cameraQuiet'), step: $('stepCapture')
    };
  }

  function supported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  // ---- the two shapes ------------------------------------------------------
  // The tall frame's width-over-height: 4:5, a natural portrait-photo
  // shape — deliberately WIDER than the writing sheet's own 1:√2
  // (0.707). The first tall frame WAS the sheet's exact aspect, and the
  // product owner found it in the field: "the tall page needs to be a
  // bit wider." Measured, the sheet aspect left literally zero aiming
  // margin — a sheet at full frame height had 0 columns to spare — and
  // the field photo the reader was tuned against (HW-E) shows the real
  // hold: ~10–20° of tilt with the page nearly filling the frame. A
  // √2-tall sheet tilted 10° needs a bounding box 0.87× its height
  // wide; at a 90%-of-height hold that is 0.78 of the frame height —
  // more than a 3:4 frame (0.75) can hold, inside 4:5 (0.80) with
  // margin either side. So 4:5 is the first standard portrait aspect
  // that absorbs the tilt a child's hold actually has, while still
  // reading unmistakably TALL on the preview. Widening costs no sheet
  // resolution: the crop is fitted by frame height, so the sheet keeps
  // every pixel it had and the extra columns are pure aiming room.
  const TALL_ASPECT = 4 / 5;
  function tallAspect() { return TALL_ASPECT; }

  // The centred crop of a native vw×vh stream to the tall aspect. On a
  // camera that really turned, the stream is already tall and the crop is
  // (nearly) the whole frame; on a laptop webcam that stays wide, this is
  // the middle column of the frame.
  function tallCrop(vw, vh) {
    const a = tallAspect();
    let w, h;
    if (vw / vh > a) { h = vh; w = Math.round(vh * a); }
    else { w = vw; h = Math.round(vw / a); }
    return { x: Math.round((vw - w) / 2), y: Math.round((vh - h) / 2), w, h };
  }

  // Preview honesty: the child sees exactly what will be captured. Tall
  // gives the video a box of the crop's own aspect and lets object-fit:
  // cover centre it — the same centring the capture arithmetic does.
  // Wide restores the host's own inline styles byte for byte.
  function styleForShape() {
    if (shape === 'tall') {
      const w = Math.round(PREVIEW_H * tallAspect());
      for (const el of [els.live, els.shot]) {
        el.style.width = w + 'px';
        el.style.height = PREVIEW_H + 'px';
        el.style.maxWidth = '100%';
      }
      els.live.style.objectFit = 'cover';
      els.live.style.objectPosition = 'center';
    } else {
      els.live.setAttribute('style', savedLiveStyle);
      els.shot.setAttribute('style', savedShotStyle);
    }
  }

  function updateToggle() {
    if (!els || !els.shapeBtn) return;
    // The words name where the button goes, never how cameras work.
    els.shapeBtn.textContent = shape === 'wide' ? '⇄ Tall page' : '⇄ Wide page';
    els.shapeBtn.title = shape === 'wide'
      ? 'Make the picture tall — good for a written page'
      : 'Make the picture wide again';
  }

  // The seam a journey states its preference through (My Handwriting
  // photographs a tall written sheet). The child's own press of the
  // button wins over every preference for the rest of the session.
  function setPreferredShape(s) {
    if (s !== 'tall' && s !== 'wide') return;
    if (childChose) return;
    shape = s;
    updateToggle();
  }

  async function switchShape() {
    childChose = true;
    const from = shape;
    shape = (from === 'wide') ? 'tall' : 'wide';
    updateToggle();
    if (!stream) return;         // the button only shows on a live preview
    stopTracks();                // light off before asking again
    if (await open()) return;
    // The new shape didn't arrive — go back kindly to the one that worked.
    shape = from;
    updateToggle();
    await open();
  }

  function stopTracks() {
    cancelCountdown();     // a count never outlives its live preview
    if (!stream) return;
    for (const t of stream.getTracks()) t.stop();
    stream = null;
    // video.srcObject is left in place deliberately: the suite reads the
    // stopped tracks' readyState off it to prove the light is off.
  }

  function showLive(live) {
    els.live.style.display = live ? 'block' : 'none';
    els.shot.style.display = live ? 'none' : 'block';
    els.take.style.display = live ? '' : 'none';
    els.use.style.display = live ? 'none' : '';
    els.retake.style.display = live ? 'none' : '';
    // The shape button belongs to the live preview only — while the child
    // is deciding about a taken picture, changing shape means retaking.
    if (els.shapeBtn) els.shapeBtn.style.display = live ? '' : 'none';
    // …and so does the little clock: it says when the NEXT picture
    // happens, which only means something while the camera is live.
    if (els.timerWrap) els.timerWrap.style.display = live ? 'inline-flex' : 'none';
  }

  function closePanel() {
    stopTracks();
    if (els && els.panel) els.panel.style.display = 'none';
  }

  // The one gentle line for every way the camera can be unreachable.
  function cannotSee(err) {
    closePanel();
    const q = els.quiet;
    q.textContent = 'I can’t see through the camera here — you can ' +
      'still choose a photo of your drawing.';
    q.style.display = 'block';
    opts.log('camera: not available (' + ((err && err.name) || 'no camera API') + ')');
  }

  async function open() {
    els.quiet.style.display = 'none';
    let s;
    try {
      // Ask for the back camera and as much resolution as the camera
      // honestly has; ideals never fail a camera that offers less. The
      // tall shape swaps the ideals so hardware that can deliver a tall
      // stream does; hardware that stays wide is centre-cropped instead.
      const ideal = shape === 'tall'
        ? { width: { ideal: 1440 }, height: { ideal: 2560 } }
        : { width: { ideal: 2560 }, height: { ideal: 1440 } };
      s = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' },
                 width: ideal.width, height: ideal.height }
      });
    } catch (err) { cannotSee(err); return false; }
    stream = s;
    const v = els.live;
    v.srcObject = s;
    try { await v.play(); } catch (e) { /* play() races tab hiding; the frame wait below decides */ }
    styleForShape();
    els.panel.style.display = 'block';
    showLive(true);
    const started = await new Promise((res) => {
      let waited = 0;
      const tick = () => {
        if (v.videoWidth > 0) return res(true);
        if (!stream || (waited += 100) > 8000) return res(false);
        setTimeout(tick, 100);
      };
      tick();
    });
    if (!started) { cannotSee({ name: 'no frames arrived' }); return false; }
    opts.log('camera: looking through the camera at ' +
             v.videoWidth + 'x' + v.videoHeight + ' (native)');
    if (shape === 'tall') {
      const r = tallCrop(v.videoWidth, v.videoHeight);
      opts.log('camera: tall page — keeping the middle ' + r.w + 'x' + r.h +
               ' of the ' + v.videoWidth + 'x' + v.videoHeight + ' frame');
    }
    return true;
  }

  // ---- the picture can wait -----------------------------------------------
  // The count is drawn ON the live picture itself — a big soft numeral
  // centred over the video, where the child holding a page up is already
  // looking. It is not a control (pointer-events: none, aria-hidden),
  // and it is fixed-positioned to the video's own box, re-measured every
  // frame, so it stays on the picture in both hosts whatever their
  // layout does.
  function countdownOverlay() {
    const o = document.createElement('div');
    o.className = 'bia-camera-count';
    o.setAttribute('aria-hidden', 'true');
    Object.assign(o.style, {
      position: 'fixed', display: 'flex', alignItems: 'center',
      justifyContent: 'center', pointerEvents: 'none', zIndex: '9999',
      color: 'rgba(255,255,255,.94)', fontWeight: '700', lineHeight: '1',
      textShadow: '0 2px 26px rgba(0,0,0,.6), 0 0 8px rgba(0,0,0,.35)',
      transition: 'transform .3s ease'
    });
    document.body.appendChild(o);
    return o;
  }

  function placeCount() {
    if (!counting) return;
    const r = els.live.getBoundingClientRect();
    const o = counting.overlay;
    o.style.left = r.left + 'px';
    o.style.top = r.top + 'px';
    o.style.width = r.width + 'px';
    o.style.height = r.height + 'px';
    o.style.fontSize = Math.round(Math.min(r.width, r.height) * 0.5) + 'px';
  }

  // Ends the count with no picture. quiet=true is the count reaching
  // zero on its own — the capture that follows tells its own story.
  function cancelCountdown(quiet) {
    if (!counting) return;
    cancelAnimationFrame(counting.raf);
    counting.overlay.remove();
    els.take.textContent = counting.label;
    counting = null;
    if (!quiet) opts.log('camera: the count stopped — no picture taken');
  }

  function startCountdown() {
    const secs = timerSeconds;
    counting = { endAt: performance.now() + secs * 1000 * timeScale,
                 overlay: countdownOverlay(),
                 label: els.take.textContent, shown: 0, raf: 0 };
    els.take.textContent = 'Stop';
    opts.log('camera: taking the picture in ' + secs + ' seconds');
    const tick = () => {
      if (!counting) return;
      const left = counting.endAt - performance.now();
      if (left <= 0 || !stream) {
        const ready = !!stream;
        cancelCountdown(ready);          // the numeral leaves the picture…
        if (ready) capture();            // …then the exact existing capture
        return;
      }
      placeCount();                      // stay on the video, every frame
      const n = Math.ceil(left / (1000 * timeScale));
      if (n !== counting.shown) {
        counting.shown = n;
        counting.overlay.textContent = String(n);
        counting.overlay.style.transform = 'scale(1.14)';   // a soft breath
        requestAnimationFrame(() => {
          if (counting) counting.overlay.style.transform = 'scale(1)';
        });
      }
      counting.raf = requestAnimationFrame(tick);
    };
    tick();
  }

  // Take the picture — or, while a count runs, stop it; or, with a wait
  // chosen, start one. With the clock on Now this is byte-for-byte the
  // capture the button always did.
  function take() {
    if (counting) { cancelCountdown(); return; }
    if (!stream || !els.live.videoWidth) return;
    if (timerSeconds > 0) { startCountdown(); return; }
    capture();
  }

  function capture() {
    const v = els.live;
    if (!stream || !v.videoWidth) return;
    const c = els.shot;
    if (shape === 'tall') {
      // The centred tall crop at NATIVE stream resolution — the crop
      // region of videoWidth×videoHeight, never a CSS-sized redraw.
      const r = tallCrop(v.videoWidth, v.videoHeight);
      c.width = r.w; c.height = r.h;
      c.getContext('2d').drawImage(v, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
      opts.log('camera: picture taken at native ' + c.width + 'x' + c.height +
               ' (the middle of ' + v.videoWidth + 'x' + v.videoHeight + ')');
    } else {
      c.width = v.videoWidth;        // NATIVE pixels, never the CSS size
      c.height = v.videoHeight;
      c.getContext('2d').drawImage(v, 0, 0);
      opts.log('camera: picture taken at native ' + c.width + 'x' + c.height);
    }
    stopTracks();                    // light off while the child decides
    showLive(false);
  }

  function useIt() {
    const c = els.shot;
    c.toBlob((blob) => {
      closePanel();
      if (!blob || !opts.onPicture) return;
      opts.onPicture(new File([blob], 'camera-' + Date.now() + '.png',
                              { type: 'image/png' }));
    }, 'image/png');
  }

  // The shape button lives INSIDE the camera panel, created here so BOTH
  // hosts (the standalone page and the Studio overlay) inherit it from
  // the one implementation. It joins the host's own action row beside
  // Never Mind, so each host's own layout and words carry it; the class
  // list names both hosts' button styles — whichever stylesheet is
  // present dresses it, the other class is inert.
  function ensureToggle() {
    let btn = els.panel.querySelector('.bia-camera-shape');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ghost bia-studio-btn bia-camera-shape';
      btn.addEventListener('click', switchShape);
      els.close.parentNode.insertBefore(btn, els.close);
    }
    els.shapeBtn = btn;
    updateToggle();
  }

  // The little clock lives right beside Take the picture, created here
  // for the same reason the shape button is: one implementation, both
  // hosts. Three choices — Now, 🕔 5, 🕙 10 — one of them always chosen,
  // and the choice stands for the session.
  function ensureTimer() {
    let wrap = els.panel.querySelector('.bia-camera-timer');
    if (!wrap) {
      wrap = document.createElement('span');
      wrap.className = 'bia-camera-timer';
      wrap.setAttribute('role', 'group');
      wrap.setAttribute('aria-label', 'When the picture is taken');
      Object.assign(wrap.style,
        { display: 'inline-flex', gap: '.35rem', alignItems: 'center' });
      for (const c of TIMER_CHOICES) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'ghost bia-studio-btn bia-camera-timer-choice';
        b.dataset.seconds = String(c.s);
        b.textContent = c.words;
        b.title = c.hint;
        b.addEventListener('click', () => { timerSeconds = c.s; updateTimer(); });
        wrap.appendChild(b);
      }
      els.take.parentNode.insertBefore(wrap, els.take.nextSibling);
    }
    els.timerWrap = wrap;
    updateTimer();
  }

  function updateTimer() {
    if (!els || !els.timerWrap) return;
    for (const b of els.timerWrap.children) {
      const on = Number(b.dataset.seconds) === timerSeconds;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.style.fontWeight = on ? '700' : '';
      b.style.opacity = on ? '1' : '.55';
      b.style.boxShadow = on ? 'inset 0 0 0 2px currentColor' : '';
    }
  }

  function mount(o) {
    opts = Object.assign(opts, o);
    if (!supported()) return;        // no camera API → the step stays exactly as today
    els = (o && o.els) || defaultEls();
    savedLiveStyle = els.live.getAttribute('style') || '';
    savedShotStyle = els.shot.getAttribute('style') || '';
    ensureToggle();
    ensureTimer();
    const btn = els.button;
    btn.style.display = '';
    btn.addEventListener('click', open);
    els.take.addEventListener('click', take);
    els.use.addEventListener('click', useIt);
    els.retake.addEventListener('click', open);
    els.close.addEventListener('click', closePanel);
    // Never leave the camera light on behind a hidden page — attached
    // once, however many times a host remounts fresh elements.
    if (!hooked) {
      hooked = true;
      window.addEventListener('pagehide', stopTracks);
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) closePanel();
      });
    }
    // …or behind a left step: whatever route leaves Photograph (a picked
    // file, the test page, a drop, a reopened creation), the light goes
    // off. Only where the host HAS a step element to watch — the Studio
    // overlay closes the camera through its own step changes and close.
    if (els.step) {
      const step = els.step;
      new MutationObserver(() => {
        if (!step.classList.contains('here')) closePanel();
      }).observe(step, { attributes: true, attributeFilter: ['class'] });
    }
  }

  // _setTimeScale is a TEST seam only: it compresses the count so a suite
  // can walk the 10-second path without waiting ten seconds. The product
  // never calls it and the real pace is also exercised for real.
  window.BIACamera = { mount, supported, stopTracks, closePanel,
                       setPreferredShape, tallAspect,
                       _setTimeScale: (s) => { timeScale = (s > 0 ? s : 1); } };
})();
