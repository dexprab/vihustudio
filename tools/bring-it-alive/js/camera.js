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
 * physically wide) gets a CENTRED CROP to the writing sheet's own
 * proportions (HWSheet.GEOM.aspect where the sheet module is loaded,
 * A4 = 1:√2 otherwise — the same number, stated twice on purpose).
 * The preview shows exactly the crop (object-fit: cover on a box of the
 * crop's own aspect centres identically to the capture arithmetic), and
 * the captured frame is the crop region of the NATIVE stream — never a
 * CSS-sized redraw. Journeys may state a preferred shape through
 * setPreferredShape() (My Handwriting photographs a tall written
 * sheet); the child's own toggle choice wins over it for the session.
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
  const $ = (id) => document.getElementById(id);

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
  // The tall frame's width-over-height. The writing sheet's own geometry
  // when hwSheet.js is aboard (GEOM.aspect is H/W), A4's 1:√2 otherwise —
  // numerically the same value, so a bare copy of the tool cannot drift.
  // Read lazily: hwSheet.js loads after this file on the standalone page.
  function tallAspect() {
    try {
      const a = window.HWSheet && HWSheet.GEOM && HWSheet.GEOM.aspect;
      if (typeof a === 'number' && isFinite(a) && a > 1) return 1 / a;
    } catch (e) { /* the A4 fallback below */ }
    return 1 / Math.SQRT2;
  }

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

  function take() {
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

  function mount(o) {
    opts = Object.assign(opts, o);
    if (!supported()) return;        // no camera API → the step stays exactly as today
    els = (o && o.els) || defaultEls();
    savedLiveStyle = els.live.getAttribute('style') || '';
    savedShotStyle = els.shot.getAttribute('style') || '';
    ensureToggle();
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

  window.BIACamera = { mount, supported, stopTracks, closePanel, setPreferredShape };
})();
