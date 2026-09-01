/* ADMIN CONSOLE 2 — @username on the roll, and account deletion.
 *
 * The whole design is what a deletion must NOT take: a sibling's card
 * on the same machine, a recalled Creator's records sitting under
 * somebody else's session, and anything stamped with a different card.
 * Owner-keyed leftovers (unowned records, family albums) go only with
 * the session's LAST card. Executed against a real PostgreSQL as real
 * sessions — admin and stranger alike.
 *
 * Run:
 *   NODE_PATH=/opt/node22/lib/node_modules \
 *     node tools/admin-delete-test/run-admin-delete-tests.js
 */
'use strict';
const path = require('path');
const fs = require('fs');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const PGDIR = '/tmp/vihu-admin-delete-pg';
const PGPORT = 55444;

let passed = 0, failed = 0;
const failures = [];
function ok(n, note) { passed++; console.log('  ok   ' + n + (note ? '  (' + note + ')' : '')); }
function no(n, note) { failed++; failures.push(n); console.log('  FAIL ' + n + (note ? '  (' + note + ')' : '')); }
function ck(c, n, note) { (c ? ok : no)(n, note); }

const A_UID = '11111111-1111-1111-1111-111111111111';
const B_UID = '22222222-2222-2222-2222-222222222222';
const ADMIN = 'boss@vihu.test';

(function main() {
  console.log('\nADMIN DELETE — the card, everything it owns, and NOTHING else');
  const pg = startPg();
  if (!pg) { no('A0  a PostgreSQL to run against', 'none found'); return finish(); }
  try {
    const fix = loadFile(pg, path.join(__dirname, 'fixture.sql'));
    if (fix) { no('A0  the fixture loads', fix.split('\n')[0]); return finish(); }
    for (const m of ['migrations_social_identity.sql', 'migrations_social_orbit.sql',
                     'migrations_social_sky.sql', 'migrations_admin_delete.sql']) {
      const err = loadFile(pg, path.join(ROOT, 'supabase', m));
      if (err) { no('A0  ' + m, err.split('\n')[0]); return finish(); }
    }
    const again = loadFile(pg, path.join(ROOT, 'supabase', 'migrations_admin_delete.sql'));
    ck(!again, 'A0  the migration applies, and applies twice', again || 'clean');

    psql(pg, `insert into public.platform_admins(email, note) values ('${ADMIN}', 'test');`);
    psql(pg, `insert into public.magic_card_identities(id,owner_id,nickname,constellation,pattern,username,companion_id)
      values ('card_a','${A_UID}','Vihaan','ORION','[[1,2]]','moonmaker','leafy'),
             ('card_b','${B_UID}','Meera','LYRA','[[3,4]]','stargirl','quill'),
             ('card_c','${B_UID}','Sib','CYGNUS','[[5,6]]','quietone','nimbus');`);
    const codeB = psql(pg, `select code from public.magic_card_identities where id='card_b';`);
    const codeC = psql(pg, `select code from public.magic_card_identities where id='card_c';`);

    // The world around card_b: its own work, its sibling's, the
    // session's unowned leftovers, and a RECALLED Creator's copy —
    // card_a's story living under owner B.
    psql(pg, `insert into public.creator_projects(id,owner_id,data) values
      ('pb1','${B_UID}','{"id":"pb1","cardId":"card_b","publishedAt":"2026-01-01T00:00:00Z"}'),
      ('pb2','${B_UID}','{"id":"pb2","cardId":"card_b"}'),
      ('pc1','${B_UID}','{"id":"pc1","cardId":"card_c"}'),
      ('porph','${B_UID}','{"id":"porph"}'),
      ('pa_recalled','${B_UID}','{"id":"pa_recalled","cardId":"card_a"}'),
      ('pa1','${A_UID}','{"id":"pa1","cardId":"card_a","publishedAt":"2026-01-02T00:00:00Z"}');`);
    psql(pg, `insert into public.story_cheers(story_id,cheerer) values
      ('pb1','x'),('pb1','y'),('pc1','z');`);
    psql(pg, `insert into public.creator_library(id,owner_id,data) values
      ('lb','${B_UID}','{"cardId":"card_b"}'),
      ('lc','${B_UID}','{"cardId":"card_c"}'),
      ('lorph','${B_UID}','{}');`);
    psql(pg, `insert into public.creator_handwriting(id,owner_id,data) values
      ('hb','${B_UID}','{"cardId":"card_b","ch":"A"}');`);
    psql(pg, `insert into public.creator_companion_memory(id,owner_id,card_id) values
      ('mb','${B_UID}','card_b'),('mc','${B_UID}','card_c');`);
    psql(pg, `insert into public.family_albums(id,owner_id,album_url) values
      ('fam','${B_UID}','https://photos.app.goo.gl/x');`);
    psql(pg, `insert into storage.objects(bucket_id,name) values
      ('draft-assets','creator/${B_UID}/pb1/asset1'),
      ('draft-assets','creator/${B_UID}/pb2/asset2'),
      ('draft-assets','creator/${B_UID}/pc1/asset3'),
      ('draft-assets','creator/${B_UID}/porph/asset4'),
      ('draft-assets','creator/${A_UID}/pa1/asset5');`);
    // Relationships and gifts around card_b, in every direction.
    psql(pg, `insert into public.creator_orbits(orbiter_id,orbited_id) values
      ('card_a','card_b'),('card_b','card_a'),('card_c','card_b'),('card_b','card_c');`);
    psql(pg, `insert into public.creator_shows(from_id,to_id,kind,name,payload) values
      ('card_a','card_b','drawing','x','{}'),('card_b','card_c','drawing','y','{}');`);
    psql(pg, `insert into public.magic_card_recalls(identity_id) values ('card_b');`);

    // Admin functions are granted to `authenticated` only — an
    // administrator signs in with a password, and even the refused
    // stranger below is a SIGNED-IN stranger probing (an anon child
    // session cannot execute the function at all, which the grant
    // itself enforces).
    const call = (uid, email, args) => {
      const r = asSession(pg, uid, `select public.admin_delete_creator(${args});`, email, 'authenticated');
      try { return JSON.parse(lines(r).find((l) => l.startsWith('{')) || '{}'); }
      catch (e) { return {}; }
    };
    const count = (sql) => Number(psql(pg, sql) || -1);

    // ---- who may ask, and how -------------------------------------
    let r = call(A_UID, null, `'${codeB}','${codeB}'`);
    ck(r.reason === 'not_admin' && count(`select count(*) from public.magic_card_identities`) === 3,
       'A1  A NON-ADMIN IS REFUSED BY NAME — and nothing was touched');
    r = call(A_UID, ADMIN, `'${codeB}','MC-WRONG'`);
    ck(r.reason === 'confirm',
       'A2  THE CARD CODE MUST BE TYPED BACK — a wrong confirmation deletes nothing');
    r = call(A_UID, ADMIN, `'MC-99999','MC-99999'`);
    ck(r.reason === 'unknown', 'A3  an unknown card is its own kind answer');

    // ---- the roll carries the public name -------------------------
    const roll = asSession(pg, A_UID, `select username from public.admin_creators_roll();`, ADMIN, 'authenticated').out;
    ck(/stargirl/.test(roll) && /moonmaker/.test(roll),
       'A4  THE ROLL CARRIES @USERNAME — beside last_seen, which it already had', roll.replace(/\n/g, ','));

    // ---- deleting card_b: everything of ITS, nothing of anyone's ---
    r = call(A_UID, ADMIN, `'${codeB}','${codeB}'`);
    ck(r.ok === true && r.lastCardOnDevice === false,
       'A5  THE DELETE ANSWERS WITH A RECEIPT — and knows a sibling still holds this device',
       JSON.stringify(r.deleted));
    ck(count(`select count(*) from public.magic_card_identities where id='card_b'`) === 0
       && count(`select count(*) from public.magic_card_identities where id='card_c'`) === 1,
       'A5b the card is gone; the SIBLING\'S card is untouched');
    ck(count(`select count(*) from public.creator_projects where id in ('pb1','pb2')`) === 0
       && count(`select count(*) from public.creator_projects where id in ('pc1','porph','pa_recalled','pa1')`) === 4,
       'A6  ITS STORIES DIE WITH IT — the sibling\'s, the unowned leftovers and the RECALLED Creator\'s copy all survive');
    ck(count(`select count(*) from public.story_cheers where story_id='pb1'`) === 0
       && count(`select count(*) from public.story_cheers where story_id='pc1'`) === 1,
       'A6b and the cheers on its stories go with them — the sibling\'s starlight stays');
    ck(count(`select count(*) from public.creator_library where id='lb'`) === 0
       && count(`select count(*) from public.creator_library where id in ('lc','lorph')`) === 2
       && count(`select count(*) from public.creator_handwriting`) === 0
       && count(`select count(*) from public.creator_companion_memory where card_id='card_b'`) === 0
       && count(`select count(*) from public.creator_companion_memory where card_id='card_c'`) === 1,
       'A7  GARDEN, LETTERS AND MEMORIES — the card\'s own go; the sibling\'s and the unowned stay');
    ck(count(`select count(*) from storage.objects where name like '%asset1' or name like '%asset2'`) === 0
       && count(`select count(*) from storage.objects`) === 3,
       'A8  THE STORAGE BEHIND ITS STORIES IS REMOVED — and nobody else\'s objects move');
    ck(count(`select count(*) from public.creator_orbits`) === 0
       && count(`select count(*) from public.creator_shows`) === 0
       && count(`select count(*) from public.magic_card_recalls`) === 0,
       'A9  RELATIONSHIPS, GIFTS AND RECALLS CASCADE — both directions, sent and received');
    ck(count(`select count(*) from public.family_albums`) === 1,
       'A9b the family album stays — a sibling\'s card still holds this device');

    // ---- deleting the LAST card sweeps the session's leftovers -----
    r = call(A_UID, ADMIN, `'${codeC}','${codeC}'`);
    ck(r.ok === true && r.lastCardOnDevice === true,
       'A10 THE LAST CARD ON A DEVICE — the receipt says so', JSON.stringify(r.deleted));
    ck(count(`select count(*) from public.creator_projects where id='porph'`) === 0
       && count(`select count(*) from public.creator_library where id='lorph'`) === 0
       && count(`select count(*) from public.family_albums`) === 0
       && count(`select count(*) from storage.objects where name like '%asset4'`) === 0,
       'A10b and the session\'s unowned leftovers and family album are swept with it');
    ck(count(`select count(*) from public.creator_projects where id='pa_recalled'`) === 1,
       'A11 A RECALLED CREATOR\'S COPY STILL SURVIVES EVEN THAT — a row stamped with another card is never touched');
    ck(count(`select count(*) from public.magic_card_identities`) === 1
       && count(`select count(*) from public.creator_projects where id='pa1'`) === 1
       && count(`select count(*) from storage.objects where name like '%asset5'`) === 1,
       'A12 THE OTHER CREATOR IS EXACTLY AS THEY WERE — card, story and storage');
  } finally { stopPg(pg); }
  finish();
})();

function finish() {
  console.log('\n' + (failed ? 'FAILED' : 'PASSED') +
    ' — ' + passed + ' passed, ' + failed + ' failed');
  if (failures.length) console.log('failures:\n  ' + failures.join('\n  '));
  process.exit(failed ? 1 : 0);
}

// ---- the throwaway-PostgreSQL harness (the social-sky shape) --------
function sh(cmd) { return cp.execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] }).toString(); }

function startPg() {
  if (process.env.ADMIN_TEST_PG) return { conn: process.env.ADMIN_TEST_PG, own: false };
  let bin = null;
  for (const c of ['/usr/lib/postgresql/16/bin', '/usr/lib/postgresql/15/bin', '/usr/lib/postgresql/14/bin']) {
    if (fs.existsSync(path.join(c, 'initdb'))) { bin = c; break; }
  }
  if (!bin) { try { bin = path.dirname(sh('which initdb').trim()); } catch (e) { return null; } }
  const asRoot = (typeof process.getuid === 'function') && process.getuid() === 0;
  const wrap = (c) => (asRoot ? `su postgres -c '${c.replace(/'/g, "'\\''")}'` : c);
  try { sh(wrap(`"${bin}/pg_ctl" -D "${PGDIR}" stop -m immediate`)); } catch (e) { /* not running */ }
  try { fs.rmSync(PGDIR, { recursive: true, force: true }); } catch (e) {}
  try {
    fs.mkdirSync(PGDIR, { recursive: true });
    if (asRoot) sh(`chown postgres "${PGDIR}"`);
    sh(wrap(`"${bin}/initdb" -D "${PGDIR}" -A trust -U postgres`));
    sh(wrap(`"${bin}/pg_ctl" -D "${PGDIR}" -o "-p ${PGPORT} -k /tmp" -l "${PGDIR}/log" start`));
    return { conn: `-h /tmp -p ${PGPORT} -U postgres`, own: true, bin };
  } catch (e) { return null; }
}

function stopPg(pg) {
  if (!pg || !pg.own) return;
  const asRoot = (typeof process.getuid === 'function') && process.getuid() === 0;
  const wrap = (c) => (asRoot ? `su postgres -c '${c.replace(/'/g, "'\\''")}'` : c);
  try { sh(wrap(`"${pg.bin}/pg_ctl" -D "${PGDIR}" stop -m immediate`)); } catch (e) {}
}

function run(pg, args) {
  const r = cp.spawnSync('psql', [...pg.conn.split(' ').filter(Boolean), '-X', '-v', 'ON_ERROR_STOP=1', ...args],
    { encoding: 'utf8' });
  return { out: (r.stdout || '').trim(), err: (r.stderr || '').trim(), code: r.status };
}
function psql(pg, sql) { return run(pg, ['-q', '-t', '-A', '-c', sql]).out; }
function loadFile(pg, file) { const r = run(pg, ['-q', '-f', file]); return r.code === 0 ? '' : (r.err || 'failed'); }
function lines(r) { return (r.out || '').split('\n').map((l) => l.trim()); }

function asSession(pg, uid, sql, email, role) {
  return run(pg, ['-q', '-t', '-A', '-c', ['begin;', 'set local role ' + (role || 'anon') + ';',
    `set local "test.uid" = '${uid}';`,
    email ? `set local "test.email" = '${email}';` : `set local "test.email" = '';`,
    sql, 'commit;'].join('\n')]);
}
