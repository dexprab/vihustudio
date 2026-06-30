// PdfWriter — Sprint 8.1.4.
//
// A minimal browser-side PDF emitter for image-only pages. Each page
// contains a single embedded JPEG that fills the page. The output is a
// Blob you can offer for download or attach to a future print-order
// upload.
//
// Why hand-rolled instead of jsPDF?
//   * Zero dependency: ships with the project, works offline, matches
//     the no-build-step convention of the codebase.
//   * Small surface: ~150 LOC, audit-friendly.
//   * Image-only PDFs are simple — every text element is already
//     rasterized into the canvas by SlideRenderer, so we never need
//     font embedding or text streams.
//
// Spec coverage:
//   - PDF 1.4 header
//   - Catalog + Pages + Page objects
//   - JPEG XObject per page (DCTDecode filter)
//   - Content stream that draws the image filling the page (CTM)
//   - Cross-reference table
//   - Trailer
//
// Out of scope (kept simple by design):
//   - Compression (FlateDecode on streams) — JPEGs are already compressed
//   - Multiple images per page
//   - Embedded fonts
//   - Bookmarks / outlines
const PdfWriter=(function(){
  // ASCII byte literals for PDF syntax.
  function _asBytes(str){
    const out=new Uint8Array(str.length);
    for(let i=0;i<str.length;i++) out[i]=str.charCodeAt(i)&0xFF;
    return out;
  }

  // Convert a data URL ("data:image/jpeg;base64,...") to a Uint8Array
  // of raw bytes. Used to extract JPEG payload from canvas.toDataURL.
  function dataURLToBytes(dataURL){
    const idx=dataURL.indexOf(',');
    if(idx===-1) return new Uint8Array(0);
    const b64=dataURL.substring(idx+1);
    const bin=atob(b64);
    const u8=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) u8[i]=bin.charCodeAt(i);
    return u8;
  }

  // Concatenate Uint8Array chunks into one buffer.
  function _concat(chunks){
    let total=0;
    for(let i=0;i<chunks.length;i++) total+=chunks[i].length;
    const out=new Uint8Array(total);
    let off=0;
    for(let i=0;i<chunks.length;i++){ out.set(chunks[i],off); off+=chunks[i].length; }
    return out;
  }

  // Build a PDF from an array of JPEG pages.
  //   pages: [{ jpegBytes:Uint8Array, srcW:number, srcH:number }]
  //   pageWidthPt / pageHeightPt: PDF page dimensions in points (72/in)
  //
  // Returns: Blob with type 'application/pdf'.
  function build(pages, pageWidthPt, pageHeightPt){
    if(!Array.isArray(pages) || pages.length===0){
      return new Blob([], {type:'application/pdf'});
    }

    const chunks=[];
    const offsets=[]; // byte offset of each object (1-indexed)
    let cursor=0;

    function writeChunk(u8){ chunks.push(u8); cursor+=u8.length; }
    function writeStr(s){ writeChunk(_asBytes(s)); }
    function startObject(num){
      offsets[num]=cursor;
      writeStr(num+' 0 obj\n');
    }
    function endObject(){ writeStr('\nendobj\n'); }

    // PDF header. The %binary comment with high-bit bytes is a hint to
    // viewers that the file contains binary streams (per ISO 32000).
    writeStr('%PDF-1.4\n');
    writeChunk(new Uint8Array([0x25,0xE2,0xE3,0xCF,0xD3,0x0A])); // %âãÏÓ\n

    // Reserve object numbers:
    //   1 = Catalog
    //   2 = Pages
    //   For each page i (0..n-1):
    //     3+i*3   = Page
    //     4+i*3   = Page contents stream
    //     5+i*3   = Image XObject
    const n=pages.length;
    const pageObjNums=[];
    for(let i=0;i<n;i++) pageObjNums.push(3+i*3);

    // 1: Catalog
    startObject(1);
    writeStr('<< /Type /Catalog /Pages 2 0 R >>');
    endObject();

    // 2: Pages
    startObject(2);
    writeStr('<< /Type /Pages /Count '+n+' /Kids [');
    for(let i=0;i<n;i++) writeStr(pageObjNums[i]+' 0 R ');
    writeStr('] >>');
    endObject();

    // Per-page objects.
    for(let i=0;i<n;i++){
      const pageNum=3+i*3;
      const contentsNum=4+i*3;
      const imageNum=5+i*3;

      // Page
      startObject(pageNum);
      writeStr(
        '<< /Type /Page /Parent 2 0 R '+
        '/MediaBox [0 0 '+pageWidthPt+' '+pageHeightPt+'] '+
        '/Contents '+contentsNum+' 0 R '+
        '/Resources << /XObject << /I0 '+imageNum+' 0 R >> >> >>'
      );
      endObject();

      // Content stream: draw the image filling the page.
      //   q              save graphics state
      //   W 0 0 H 0 0 cm scale CTM to page size
      //   /I0 Do         paint named XObject
      //   Q              restore graphics state
      const content=pageWidthPt+' 0 0 '+pageHeightPt+' 0 0 cm /I0 Do';
      startObject(contentsNum);
      writeStr('<< /Length '+(content.length+6)+' >>\nstream\nq\n'+content+'\nQ\nendstream');
      endObject();

      // JPEG XObject.
      const jpeg=pages[i].jpegBytes;
      const srcW=pages[i].srcW;
      const srcH=pages[i].srcH;
      startObject(imageNum);
      writeStr(
        '<< /Type /XObject /Subtype /Image '+
        '/Width '+srcW+' /Height '+srcH+' '+
        '/ColorSpace /DeviceRGB /BitsPerComponent 8 '+
        '/Filter /DCTDecode '+
        '/Length '+jpeg.length+' >>\nstream\n'
      );
      writeChunk(jpeg);
      writeStr('\nendstream');
      endObject();
    }

    // xref table.
    const xrefStart=cursor;
    const totalObjects=2+n*3; // 1 catalog + 1 pages + 3 per page
    writeStr('xref\n0 '+(totalObjects+1)+'\n');
    // Object 0 is always the free list head.
    writeStr('0000000000 65535 f \n');
    for(let i=1;i<=totalObjects;i++){
      const off=offsets[i]||0;
      writeStr(_padOffset(off)+' 00000 n \n');
    }

    // Trailer.
    writeStr(
      'trailer\n<< /Size '+(totalObjects+1)+' /Root 1 0 R >>\n'+
      'startxref\n'+xrefStart+'\n%%EOF\n'
    );

    return new Blob([_concat(chunks)],{type:'application/pdf'});
  }
  function _padOffset(n){
    let s=String(n);
    while(s.length<10) s='0'+s;
    return s;
  }

  const api={ build:build, dataURLToBytes:dataURLToBytes };
  try{ window.PdfWriter=api; }catch(e){}
  return api;
})();
