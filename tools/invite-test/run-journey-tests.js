// tools/invite-test/run-journey-tests.js — an invitation's four stages,
// walked on the real pages.
//
// It exists because of a bug report: "i clicked on the open door link in
// the email invite but the page still shows 0 opened." The cause was as
// plain as it gets — js/invite.js was written, reviewed and committed,
// and NO PAGE LOADED IT. Nothing called capture(), so `?invite=` was
// never read and the roll could only ever say nobody had opened
// anything. J0 is the check that would have caught it, and it is first
// on purpose: before asking whether a thing works, ask whether it runs.
//
// A second, quieter defect came out with it. reached() used to mark a
// stage as reported BEFORE the round trip, so that a failed send would
// not retry on every page load. But the platform client is not always
// ready the instant a page loads, and a stage marked locally is never
// sent again — so a real opening could be swallowed on the way out. It
// now remembers only what actually landed; J7 holds that line.
//
// THE STUB IS INSTALLED AT THE NETWORK, not through an init script.
// js/themeRepositoryClient.js loads after any init script and would
// simply overwrite one — which is exactly what made the first run of
// this suite report nothing at all and look like a product failure.
//
// Nothing here talks to a real platform: the build sandbox has no
// outbound network, so the client is replaced with one that records the
// calls it is asked to make. What is under test is that the right call
// is made at the right moment, which is the part that was broken.
//
// Run:
//   (node tools/bring-it-alive/test/serve.js 8781 > /dev/null 2>&1 &) \\
//     && sleep 1 && NODE_PATH=/opt/node22/lib/node_modules \\
//        node tools/invite-test/run-journey-tests.js
const {chromium}=require('playwright');
const BASE='http://127.0.0.1:8781';
let pass=0,fail=0;
const ck=(c,n,x)=>{ (c?pass++:fail++); console.log((c?'  ok  ':'  FAIL ')+n+(x?'  ('+x+')':'')); };
// The real js/themeRepositoryClient.js is REPLACED at the network, not
// shadowed by an init script — the real file loads after any init
// script and would overwrite the stub, which is exactly what made the
// first run of this suite report nothing at all.
const STUB_SRC = (ok) => `
  window.__rpc = window.__rpc || [];
  window.ThemeRepositoryClient = {
    isConfigured: () => Promise.resolve(${ok}),
    getClient: () => ({ rpc: (n,a) => { window.__rpc.push([n,a]); return Promise.resolve({error:null}); } })
  };`;
async function stubClient(target, ok){
  await target.route('**/js/themeRepositoryClient.js*', (route) =>
    route.fulfill({ status:200, contentType:'application/javascript', body: STUB_SRC(ok) }));
}
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const ctx=await b.newContext({viewport:{width:1440,height:900}});
  await stubClient(ctx, true);
  const page=await ctx.newPage();
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  const TOK='abc123def4567890';

  console.log('-- the letter is opened');
  await page.goto(BASE+'/?invite='+TOK);
  await page.waitForTimeout(1500);
  let r=await page.evaluate(()=>({
    tok:localStorage.getItem('vihu-invite-token'), url:location.search,
    rpc:window.__rpc, has:!!window.Invite }));
  ck(r.has, 'J0 the page actually loads js/invite.js');
  ck(r.tok===TOK, 'J1 the token is kept', JSON.stringify(r.tok));
  ck(r.url==='', 'J2 the address bar is left clean — an intent, consumed', JSON.stringify(r.url));
  ck(r.rpc.some(c=>c[0]==='invite_reached'&&c[1].p_stage==='opened'&&c[1].p_token===TOK),
     'J3 OPENED is reported', JSON.stringify(r.rpc));

  console.log('-- the threshold is crossed');
  await page.evaluate(()=>{window.__rpc.length=0;});
  await page.click('[data-threshold]');
  await page.waitForTimeout(1400);
  r=await page.evaluate(()=>window.__rpc);
  ck(r.some(c=>c[0]==='invite_reached'&&c[1].p_stage==='explored'),
     'J4 EXPLORED is reported when they are actually in', JSON.stringify(r));

  console.log('-- a stage already reported is not re-sent');
  await page.goto(BASE+'/');
  await page.waitForTimeout(1200);
  r=await page.evaluate(()=>({rpc:window.__rpc,tok:localStorage.getItem('vihu-invite-token')}));
  ck(r.tok===TOK, 'J5 the token survives the trip to another page');
  ck(!r.rpc.some(c=>c[1]&&c[1].p_stage==='opened'), 'J6 opened is not reported twice', JSON.stringify(r.rpc));

  console.log('-- a failed report is retried, not silently forgotten');
  const p2=await ctx.newPage();
  await stubClient(p2, false);   // a platform that is not configured
  await p2.goto(BASE+'/?invite=zzz999zzz999zzz9');
  await p2.waitForTimeout(1200);
  let stages=await p2.evaluate(()=>localStorage.getItem('vihu-invite-stages'));
  ck(!/zzz999zzz999zzz9/.test(stages||''),
     'J7 a stage that never reached the platform is NOT marked done', JSON.stringify(stages));
  await p2.close();

  console.log('-- becoming a Creator accepts the invitation');
  await page.goto(BASE+'/studio.html?author=on');
  await page.waitForTimeout(2500);
  r=await page.evaluate(()=>{
    window.__rpc.length=0;
    if(!window.MagicCard) return {no:'MagicCard'};
    MagicCard.claim('Test Traveller');
    return {rpc:window.__rpc};
  });
  await page.waitForTimeout(900);
  const after=await page.evaluate(()=>window.__rpc);
  ck(after.some(c=>c[0]==='invite_reached'&&c[1].p_stage==='creator'),
     'J8 CREATOR is reported the moment a Magic Card is claimed',
     r.no ? 'no '+r.no : JSON.stringify(after.filter(c=>c[0]==='invite_reached')));

  console.log('page errors:', errs.length?errs.slice(0,3).join(' | '):'none');
  console.log('='.repeat(50));
  console.log(pass+' passed, '+fail+' failed');
  await b.close();
  process.exit(fail?1:0);
})();
