// tools/invite-test/run-invite-tests.js — the WhatsApp invitation, on a
// real browser with a real click and a real clipboard.
//
// It exists because of a bug report from a real send: "its adding only
// image no caption. and caption is not in my clipboard also so that i
// can paste myself." BOTH halves were true and they had different
// causes, which is exactly why this is a suite and not a fix.
//
//   1. WhatsApp DISCARDS `text` when a file is attached. navigator
//      .share({files, text}) is a request each target answers as it
//      likes, and WhatsApp's answer is to keep the picture and drop the
//      words. So the caption can never ride along, and S4 asserts that
//      nothing is even asked for — a promise the product cannot keep is
//      worse than no promise.
//   2. clipboard.writeText() needs transient user activation, and
//      `await navigator.share(...)` SPENDS it. The first version copied
//      after the share, so every write was rejected — and a bare
//      .catch() swallowed the rejection, leaving the page claiming the
//      words were copied when they were not. S2 is the check that would
//      have caught it.
//
// The page's own module cannot run here: it imports supabase-js from
// esm.sh and the build sandbox has no outbound network. So the handlers
// are lifted out of the page BY NAME and evaluated against the page's
// real DOM with the platform edges stubbed — the markup, the ids, the
// wiring and the copy under test are the shipped ones.
//
// DISCLOSED: Playwright grants clipboard permission outright, so S2
// proves the caption is written and written EARLY, but it cannot prove
// the activation ordering the way a real browser would refuse it. That
// is why `Copy the words` exists at all — its own click is a fresh
// activation, C1 covers it, and it is the path that cannot fail.
//
// Run:
//   (node tools/bring-it-alive/test/serve.js 8781 > /dev/null 2>&1 &) \
//     && sleep 1 && NODE_PATH=/opt/node22/lib/node_modules \
//        node tools/invite-test/run-invite-tests.js
const {chromium}=require('playwright');
const fs=require('fs');
const BASE='http://127.0.0.1:8781';
let pass=0,fail=0;
const ok=(n,x)=>{pass++;console.log('  ok  '+n+(x?'  ('+x+')':''))};
const no=(n,x)=>{fail++;console.log('  FAIL '+n+(x?'  ('+x+')':''))};
const ck=(c,n,x)=>c?ok(n,x):no(n,x);

(async()=>{
  const html=fs.readFileSync('admin/invites.html','utf8');
  const grab=(re)=>html.match(re)[0];
  const src=[
    grab(/const CARD_SRC = '[^']+';/),
    grab(/function waCaption\(link\) \{[\s\S]*?\n\}/),
    grab(/async function loadCard\(\) \{[\s\S]*?\n\}/),
    grab(/function showWords\(text\) \{[\s\S]*?\n\}/),
    grab(/async function copyWords\(text\) \{[\s\S]*?\n\}/),
    grab(/\$\('copyWords'\)\.onclick = async \(\) => \{[\s\S]*?\n\};/),
    grab(/function downloadCard\(filename\) \{[\s\S]*?\n\}/),
    grab(/\$\('sendWaCard'\)\.onclick = async \(\) => \{[\s\S]*?\n\};/),
  ].join('\n');

  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const ctx=await b.newContext({viewport:{width:560,height:900},deviceScaleFactor:2,
    permissions:['clipboard-read','clipboard-write']});
  const page=await ctx.newPage();
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));

  async function boot(shareMode){
    await page.goto(BASE+'/admin/invites.html');
    await page.waitForTimeout(300);
    await page.evaluate(()=>{document.getElementById('gate').classList.add('hidden');
                            document.getElementById('desk').classList.remove('hidden');});
    await page.evaluate(({src,shareMode})=>{
      window.$=(id)=>document.getElementById(id);
      window.BASE='https://vihuplanet.com';
      window.note=(el,t,good)=>{el.textContent=t;el.className='msg'+(good?' ok':'');};
      window.mint=async()=>'tok123456789abc';
      window.sb={rpc:async()=>({})};
      window.show=()=>{};
      window.__shared=null;
      if(shareMode==='none'){ delete navigator.canShare; delete navigator.share; }
      else {
        navigator.canShare=()=>true;
        navigator.share=async(d)=>{ window.__shared={files:(d.files||[]).map(f=>f.name), text:d.text||null}; };
      }
      eval(src);
      window.__ready=loadCard();
    },{src,shareMode});
    await page.evaluate(()=>window.__ready);
    await page.evaluate(()=>navigator.clipboard.writeText('SENTINEL'));
    await page.fill('#waTo','919876543210');
  }

  console.log('-- share path (a phone-like browser)');
  await boot('share');
  await page.click('#sendWaCard');            // a REAL user gesture
  await page.waitForTimeout(900);
  let r=await page.evaluate(async()=>({
    words:$('waWords').value, boxShown:!$('waWordsBox').classList.contains('hidden'),
    clip:await navigator.clipboard.readText(), shared:window.__shared,
    msg:$('waMsg').textContent
  }));
  ck(r.boxShown && r.words.includes('vihuplanet.com/?invite=tok123456789abc'),
     'S1 the words for THIS invitation are on the page', r.words.length+' chars');
  ck(r.clip===r.words, 'S2 the caption really reached the clipboard',
     r.clip==='SENTINEL'?'clipboard still holds the sentinel':'clipboard matches');
  ck(r.shared && r.shared.files.length===1, 'S3 the card was handed to the share sheet',
     JSON.stringify(r.shared&&r.shared.files));
  ck(r.shared && r.shared.text===null,
     'S4 no `text` is sent with the file — WhatsApp discards it, so it is not claimed',
     'text='+JSON.stringify(r.shared&&r.shared.text));
  ck(/paste them under the picture/.test(r.msg), 'S5 the message says what to do next', JSON.stringify(r.msg));

  console.log('-- the copy button, on its own gesture');
  await page.evaluate(()=>navigator.clipboard.writeText('SENTINEL'));
  await page.click('#copyWords');
  await page.waitForTimeout(400);
  r=await page.evaluate(async()=>({clip:await navigator.clipboard.readText(), words:$('waWords').value}));
  ck(r.clip===r.words, 'C1 Copy the words works as its own action', r.clip==='SENTINEL'?'still sentinel':'ok');

  console.log('-- no file sharing (a desktop browser)');
  await boot('none');
  await page.click('#sendWaCard');
  await page.waitForTimeout(900);
  r=await page.evaluate(async()=>({
    clip:await navigator.clipboard.readText(), words:$('waWords').value,
    boxShown:!$('waWordsBox').classList.contains('hidden'), msg:$('waMsg').textContent}));
  ck(r.boxShown && r.clip===r.words, 'D1 the words still land, with no share available');
  ck(/downloads/.test(r.msg), 'D2 the card goes to downloads and says so', JSON.stringify(r.msg));

  try{require('fs').mkdirSync('tools/invite-test/shots',{recursive:true});}catch(e){}
  await page.screenshot({path:'tools/invite-test/shots/wa-words.png'});
  console.log('page errors:', errs.length?errs.join(' | '):'none');
  console.log('='.repeat(50));
  console.log(pass+' passed, '+fail+' failed');
  await b.close();
  process.exit(fail?1:0);
})();
