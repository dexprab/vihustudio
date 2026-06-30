// PublishValidator — Sprint 8.1.3.
//
// Pure rules on slides. Returns an ordered list of friendly nudges.
// Each nudge carries:
//   { id, message, slideIndex|null, fixHint }
// `fixHint` is an opaque string the Publish Studio uses to decide
// where to route the editor when the child clicks "Fix in Editor".
//
// Design rules:
//   * Friendly language only. Never "error", never "warning".
//   * Never blocks publishing. The studio always offers Publish My
//     Book regardless of how many nudges are returned.
//   * Cheap. Each rule is O(slides). No rendering during validation.
const PublishValidator=(function(){
  const LOW_QUALITY_PX=600;   // long-edge minimum before nudging
  const TEXT_LIKELY_OVERFLOW=120; // chars per story page

  function run(slides, project){
    const list=[];
    if(!Array.isArray(slides)) return list;

    // 1. No Cover.
    const hasCover=slides.some(function(s){ return s && s.pageType==='cover'; });
    if(!hasCover){
      list.push({
        id:'no-cover',
        message:"Your story doesn't have a cover yet.",
        slideIndex:0,
        fixHint:'add-cover'
      });
    }

    // 2. Missing book title.
    const projectTitle=(project && (project.bookTitle||project.title))||'';
    if(!projectTitle.trim()){
      list.push({
        id:'no-title',
        message:"Your story doesn't have a name yet.",
        slideIndex:0,
        fixHint:'book-title'
      });
    }

    // 3 + 4. Per-slide checks.
    slides.forEach(function(s,i){
      if(!s) return;

      // Empty Story page — no words AND no picture.
      const role=s.pageType||'story';
      const storyBeat=(s.storyBeat||'').trim();
      const hasImage=!!s.image;
      if(role==='story' && !storyBeat && !hasImage){
        list.push({
          id:'empty-page-'+i,
          message:'Page '+(i+1)+' is empty — add a picture or some words.',
          slideIndex:i,
          fixHint:'empty-page'
        });
      }

      // Low-quality picture — small natural dimensions tend to look
      // fuzzy at print scale.
      if(s.image && s.image.width && s.image.height){
        const longEdge=Math.max(s.image.width, s.image.height);
        if(longEdge>0 && longEdge<LOW_QUALITY_PX){
          list.push({
            id:'low-quality-'+i,
            message:'Your picture on page '+(i+1)+' might look a little fuzzy when printed.',
            slideIndex:i,
            fixHint:'low-quality'
          });
        }
      }

      // Text overflow — heuristic on the storyBeat. Multi-line input
      // or very long single lines tend to overflow the panel.
      if(role==='story' && storyBeat){
        const overflows=storyBeat.indexOf('\n')!==-1 || storyBeat.length>TEXT_LIKELY_OVERFLOW;
        if(overflows){
          list.push({
            id:'text-overflow-'+i,
            message:"Your story on page "+(i+1)+" doesn't quite fit.",
            slideIndex:i,
            fixHint:'text-overflow'
          });
        }
      }
    });

    return list;
  }

  const api={ run:run };
  try{ window.PublishValidator=api; }catch(e){}
  return api;
})();
