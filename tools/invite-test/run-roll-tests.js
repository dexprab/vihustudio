// tools/invite-test/run-roll-tests.js — removing an invitation.
//
// Asked for after real use: "i need delete action against each invite to
// remove the junk/test invites." A roll that cannot be tidied stops
// being read, and a roll nobody reads is not tracking anything.
//
// It drives the page's own `render(rows)` against fabricated rows rather
// than a live platform — the module cannot run here (it imports
// supabase-js from esm.sh and the sandbox has no outbound network), and
// `render` is a clean seam that takes exactly what `invite_roll` returns.
// So the markup, the ids, the wiring and the copy under test are the
// shipped ones.
//
// D6 is the check worth keeping. Deleting a letter nobody opened is
// tidying; deleting one a child actually answered throws away the only
// record that it happened. Those are different acts and the question
// must not look the same for both.
//
// Run:
//   (node tools/bring-it-alive/test/serve.js 8781 > /dev/null 2>&1 &) \\
//     && sleep 1 && NODE_PATH=/opt/node22/lib/node_modules \\
//        node tools/invite-test/run-roll-tests.js
const {chromium}=require('playwright');
const fs=require('fs');
const B='http://127.0.0.1:8781';
let pass=0,fail=0; const ck=(c,n,x)=>{(c?pass++:fail++);console.log((c?'  ok  ':'  FAIL ')+n+(x?'  ('+x+')':''));};
(async()=>{
  const html=fs.readFileSync('admin/invites.html','utf8');
  const render=html.match(/function render\(rows\) \{[\s\S]*?\n\}\n/)[0];
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const p=await b.newPage({viewport:{width:1200,height:700},deviceScaleFactor:2});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(B+'/admin/invites.html');
  await p.waitForTimeout(400);
  await p.evaluate(()=>{document.getElementById('gate').classList.add('hidden');
                        document.getElementById('desk').classList.remove('hidden');});
  await p.evaluate((renderSrc)=>{
    window.$=(id)=>document.getElementById(id);
    window.esc=(s)=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    window.BASE='https://vihuplanet.com';
    window.when=(t)=>t?'today':'—';
    window.note=(el,t)=>{ if(el) el.textContent=t; };
    window.__rpc=[]; window.__confirms=[];
    window.sb={ rpc:async(fn,args)=>{ window.__rpc.push([fn,args]); return {error:null}; } };
    window.confirm=(m)=>{ window.__confirms.push(m); return true; };
    window.show=function(){ window.__reshown=(window.__reshown||0)+1; };
    eval(renderSrc);
    render([
      {token:'junk000000000001',channel:'email',recipient:'test@test.com',label:'',sent_at:1},
      {token:'real000000000002',channel:'email',recipient:'a@b.com',label:"Aarav's mum",
       sent_at:1,opened_at:1,explored_at:1,creator_at:1}
    ]);
  },render);
  await p.waitForTimeout(200);

  const st=await p.evaluate(()=>({rows:document.querySelectorAll('#rows tr').length,
                                 dels:document.querySelectorAll('[data-del]').length,
                                 cols:document.querySelectorAll('#rows tr:first-child td').length,
                                 heads:document.querySelectorAll('thead th').length}));
  ck(st.rows===2 && st.dels===2, 'D1 every invitation has its own remove', JSON.stringify(st));
  ck(st.cols===st.heads, 'D2 the new column has a header, so nothing is misaligned',
     st.cols+' cells vs '+st.heads+' headers');

  // the junk one — no journey, plain question
  await p.evaluate(()=>document.querySelector('[data-del="junk000000000001"]').click());
  await p.waitForTimeout(200);
  let r=await p.evaluate(()=>({c:window.__confirms.slice(),rpc:window.__rpc.slice(),re:window.__reshown||0}));
  ck(/Remove the invitation for test@test\.com\?$/.test(r.c[0]||''),
     'D3 a letter nobody answered asks a plain question', JSON.stringify(r.c[0]));
  ck(r.rpc.length===1 && r.rpc[0][0]==='invite_delete' && r.rpc[0][1].p_token==='junk000000000001',
     'D4 and removes exactly that one', JSON.stringify(r.rpc[0]));
  ck(r.re===1, 'D5 the roll refreshes afterwards');

  // the real one — journey, so the question says what is being thrown away
  await p.evaluate(()=>document.querySelector('[data-del="real000000000002"]').click());
  await p.waitForTimeout(200);
  r=await p.evaluate(()=>({c:window.__confirms.slice()}));
  ck(/Aarav's mum/.test(r.c[1]||'') && /became a Creator/.test(r.c[1]||'')
     && /only record/.test(r.c[1]||''),
     'D6 an invitation that got somewhere says so before it goes', JSON.stringify(r.c[1]));

  // declining changes nothing
  await p.evaluate(()=>{ window.confirm=()=>false; window.__rpc.length=0; });
  await p.evaluate(()=>document.querySelector('[data-del="junk000000000001"]').click());
  await p.waitForTimeout(200);
  r=await p.evaluate(()=>window.__rpc.length);
  ck(r===0, 'D7 saying no removes nothing');

  console.log('page errors:', errs.length?errs.slice(0,2).join(' | '):'none');
  try{require('fs').mkdirSync('tools/invite-test/shots',{recursive:true});}catch(e){}
  const t=await p.$('.tablewrap');
  if(t) await t.screenshot({path:'tools/invite-test/shots/roll.png'});
  console.log('='.repeat(46)); console.log(pass+' passed, '+fail+' failed');
  await b.close(); process.exit(fail?1:0);
})();
