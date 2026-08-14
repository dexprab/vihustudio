// tools/ether-check.js — why is a Story not in the Ether?
//
// Paste this into the browser console ON THE VIHUPLANET PAGE (the one
// showing the universe). It reads only; it changes nothing.
//
// A Story is in the Ether when its own record carries `publishedAt`
// (CLAUDE.md, Decision 9). Almost every "my story isn't showing" comes
// down to one of four things, and this says which:
//
//   - the Story has no record at all on this device
//   - the record exists but was never stamped (finished, never shared)
//   - it is stamped and the feed HAS it, but the universe does not
//   - it lives only in the cloud and this device has not hydrated it
(async function () {
  function line(s) { console.log(s); }
  line('--- ETHER CHECK ---');

  if (typeof CreatorProjectStore === 'undefined') {
    line('CreatorProjectStore is not on this page. Run this on the VihuPlanet page.');
    return;
  }

  var all = [];
  try { all = CreatorProjectStore.list() || []; } catch (e) {}
  line('projects on this device : ' + all.length);
  all.forEach(function (r) {
    var pages = (r.data && (r.data.pages || r.data.slides) || []).length;
    line('   ' + (r.publishedAt ? '[SHARED] ' : '[not shared] ') +
         (r.name || '(untitled)') + '  id=' + r.id +
         '  pages=' + pages +
         (r.publishedAt ? ('  publishedAt=' + r.publishedAt) : ''));
  });

  var published = [];
  try { published = CreatorProjectStore.listPublished() || []; } catch (e) {}
  line('stamped as shared       : ' + published.length);

  var canon = [];
  try { canon = (typeof CanonRepository !== 'undefined' && CanonRepository.list) ? CanonRepository.list() : []; } catch (e) {}
  line('canon stories           : ' + canon.length +
       (canon.length ? ('  (' + canon.map(function (c) { return c.name || c.id; }).join(', ') + ')') : ''));

  var feed = [];
  try { feed = await EtherFeed.load(); } catch (e) { line('EtherFeed.load() threw: ' + e); }
  line('EtherFeed returns       : ' + feed.length);
  feed.forEach(function (s) {
    line('   ' + s.title + '  [' + (s.origin || 'creator') + ']  pages=' + s.pages +
         '  cover=' + (s.cover ? 'yes' : 'NO'));
  });

  var live = [];
  try { live = window.vihuPlanetUniverse ? window.vihuPlanetUniverse.stories.all() : []; } catch (e) {}
  line('Spirits in the universe : ' + live.length);
  live.forEach(function (e) { line('   ' + e.title); });

  line('');
  if (feed.length !== live.length) {
    line('>> The feed and the universe DISAGREE. Reload the page; if that fixes');
    line('   it, a Story was lost between loading and being placed.');
  } else if (all.length > published.length) {
    line('>> ' + (all.length - published.length) + ' story/stories exist but were never SHARED.');
    line('   Finishing a story does not share it — the share ceremony does.');
    line('   Open the story, Finish Story, then Share with VihuPlanet.');
  } else {
    line('>> Feed and universe agree. If a story is missing from this list');
    line('   entirely, it is not on this device: it was made in another');
    line('   browser/profile, or on a device whose Magic Card has not synced.');
  }
})();
