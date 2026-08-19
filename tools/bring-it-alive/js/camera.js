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
 */
(function () {
  'use strict';

  let stream = null;
  let opts = { onPicture: null, log: function () {} };
  const $ = (id) => document.getElementById(id);

  function supported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  function stopTracks() {
    if (!stream) return;
    for (const t of stream.getTracks()) t.stop();
    stream = null;
    // video.srcObject is left in place deliberately: the suite reads the
    // stopped tracks' readyState off it to prove the light is off.
  }

  function showLive(live) {
    $('cameraLive').style.display = live ? 'block' : 'none';
    $('cameraShot').style.display = live ? 'none' : 'block';
    $('cameraTakeBtn').style.display = live ? '' : 'none';
    $('cameraUseBtn').style.display = live ? 'none' : '';
    $('cameraRetakeBtn').style.display = live ? 'none' : '';
  }

  function closePanel() {
    stopTracks();
    $('cameraPanel').style.display = 'none';
  }

  // The one gentle line for every way the camera can be unreachable.
  function cannotSee(err) {
    closePanel();
    const q = $('cameraQuiet');
    q.textContent = 'I can’t see through the camera here — you can ' +
      'still choose a photo of your drawing.';
    q.style.display = 'block';
    opts.log('camera: not available (' + ((err && err.name) || 'no camera API') + ')');
  }

  async function open() {
    $('cameraQuiet').style.display = 'none';
    let s;
    try {
      // Ask for the back camera and as much resolution as the camera
      // honestly has; ideals never fail a camera that offers less.
      s = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' },
                 width: { ideal: 2560 }, height: { ideal: 1440 } }
      });
    } catch (err) { cannotSee(err); return; }
    stream = s;
    const v = $('cameraLive');
    v.srcObject = s;
    try { await v.play(); } catch (e) { /* play() races tab hiding; the frame wait below decides */ }
    $('cameraPanel').style.display = 'block';
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
    if (!started) { cannotSee({ name: 'no frames arrived' }); return; }
    opts.log('camera: looking through the camera at ' +
             v.videoWidth + 'x' + v.videoHeight + ' (native)');
  }

  function take() {
    const v = $('cameraLive');
    if (!stream || !v.videoWidth) return;
    const c = $('cameraShot');
    c.width = v.videoWidth;          // NATIVE pixels, never the CSS size
    c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    opts.log('camera: picture taken at native ' + c.width + 'x' + c.height);
    stopTracks();                    // light off while the child decides
    showLive(false);
  }

  function useIt() {
    const c = $('cameraShot');
    c.toBlob((blob) => {
      closePanel();
      if (!blob || !opts.onPicture) return;
      opts.onPicture(new File([blob], 'camera-' + Date.now() + '.png',
                              { type: 'image/png' }));
    }, 'image/png');
  }

  function mount(o) {
    opts = Object.assign(opts, o);
    if (!supported()) return;        // no camera API → the step stays exactly as today
    const btn = $('cameraBtn');
    btn.style.display = '';
    btn.addEventListener('click', open);
    $('cameraTakeBtn').addEventListener('click', take);
    $('cameraUseBtn').addEventListener('click', useIt);
    $('cameraRetakeBtn').addEventListener('click', open);
    $('cameraCloseBtn').addEventListener('click', closePanel);
    // Never leave the camera light on behind a hidden page.
    window.addEventListener('pagehide', stopTracks);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) closePanel();
    });
    // …or behind a left step: whatever route leaves Photograph (a picked
    // file, the test page, a drop, a reopened creation), the light goes off.
    const step = $('stepCapture');
    new MutationObserver(() => {
      if (!step.classList.contains('here')) closePanel();
    }).observe(step, { attributes: true, attributeFilter: ['class'] });
  }

  window.BIACamera = { mount, supported, stopTracks, closePanel };
})();
