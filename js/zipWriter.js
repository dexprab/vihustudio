// zipWriter — Sprint 9.0.3.
//
// Minimal ZIP writer that emits a valid PKZip archive with only
// STORED (method 0, no compression) entries. That's the right choice
// for VihuStudio because the file we bundle is PNG — PNGs already carry
// their own DEFLATE / filter compression, so wrapping them in a second
// DEFLATE layer inside ZIP just costs CPU for near-zero space savings.
//
// The output validates in every reader we tested (unzip, macOS Archive
// Utility, Windows Explorer, 7-Zip). Zero dependencies; ships in the
// project like `js/pdfWriter.js`.
//
// Public API:
//   ZipWriter.build(entries) → Blob  (application/zip)
//     entries: [{ name:'page-01.png', bytes:Uint8Array }]
//
//   ZipWriter.dataURLToBytes(dataURL) → Uint8Array
//     Convenience helper — extract raw bytes from a `canvas.toDataURL`.
//
// Format: PKZip 2.0 (matches the compatibility target of PdfWriter).
const ZipWriter=(function(){
  // CRC-32 (IEEE 802.3). Table generated once per session; the
  // 8-byte CRC is required in both the Local File Header + the
  // Central Directory Header.
  let _crcTable=null;
  function _crcTableGet(){
    if(_crcTable) return _crcTable;
    _crcTable=new Uint32Array(256);
    for(let i=0;i<256;i++){
      let c=i;
      for(let j=0;j<8;j++) c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);
      _crcTable[i]=c>>>0;
    }
    return _crcTable;
  }
  function _crc32(bytes){
    const t=_crcTableGet();
    let c=0xFFFFFFFF;
    for(let i=0;i<bytes.length;i++) c=(t[(c^bytes[i])&0xFF]^(c>>>8))>>>0;
    return (c^0xFFFFFFFF)>>>0;
  }

  // Little-endian writers into a plain Uint8Array via DataView.
  function _u16(view,off,v){ view.setUint16(off,v,true); }
  function _u32(view,off,v){ view.setUint32(off,v>>>0,true); }

  // MS-DOS date/time. We stamp every entry with the same value so
  // repeated exports of the same content produce byte-identical ZIPs
  // (deterministic hashing for the parity checks in Sprint 9.0.5).
  function _dosDateTime(){
    // 2026-06-30 12:00:00 → fixed epoch used across VihuStudio v1.
    const time=(12<<11)|(0<<5)|(0>>>1);            // hh mm ss/2
    const date=((2026-1980)<<9)|(6<<5)|30;          // yyyy mm dd
    return {time,date};
  }

  function _encodeName(name){
    // ZIP names are stored as bytes; we only ever emit ASCII names so
    // TextEncoder is overkill. Guard against sneaky non-ASCII by
    // stripping to a safe subset.
    const safe=String(name).replace(/[^A-Za-z0-9._\-\/]/g,'_');
    const out=new Uint8Array(safe.length);
    for(let i=0;i<safe.length;i++) out[i]=safe.charCodeAt(i)&0xFF;
    return out;
  }

  function dataURLToBytes(dataURL){
    if(typeof dataURL!=='string') return new Uint8Array(0);
    const idx=dataURL.indexOf(',');
    if(idx<0) return new Uint8Array(0);
    const b64=dataURL.slice(idx+1);
    const bin=(typeof atob==='function') ? atob(b64) : Buffer.from(b64,'base64').toString('binary');
    const out=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) out[i]=bin.charCodeAt(i)&0xFF;
    return out;
  }

  function build(entries){
    if(!Array.isArray(entries) || entries.length===0){
      return new Blob([new Uint8Array(0)],{type:'application/zip'});
    }
    const {time,date}=_dosDateTime();

    // First pass — build all Local File Headers + payload sections,
    // stash per-entry metadata for the Central Directory pass.
    const chunks=[];
    const meta=[];
    let offset=0;

    entries.forEach(function(entry){
      const nameBytes=_encodeName(entry.name||'file');
      const bytes=entry.bytes instanceof Uint8Array ? entry.bytes : new Uint8Array(entry.bytes||[]);
      const crc=_crc32(bytes);
      const size=bytes.length;

      const lfh=new Uint8Array(30+nameBytes.length);
      const view=new DataView(lfh.buffer);
      _u32(view,0,0x04034B50);        // Local file header signature
      _u16(view,4,20);                // Version needed to extract (2.0)
      _u16(view,6,0);                 // Flags
      _u16(view,8,0);                 // Method: 0 = STORED
      _u16(view,10,time);
      _u16(view,12,date);
      _u32(view,14,crc);
      _u32(view,18,size);             // Compressed size
      _u32(view,22,size);             // Uncompressed size
      _u16(view,26,nameBytes.length);
      _u16(view,28,0);                // Extra field length
      lfh.set(nameBytes,30);
      chunks.push(lfh);
      chunks.push(bytes);

      meta.push({
        nameBytes:nameBytes,
        crc:crc,
        size:size,
        offset:offset
      });
      offset+=lfh.length+bytes.length;
    });

    // Second pass — Central Directory Headers.
    let cdSize=0;
    const cdStart=offset;
    meta.forEach(function(m){
      const cdh=new Uint8Array(46+m.nameBytes.length);
      const view=new DataView(cdh.buffer);
      _u32(view,0,0x02014B50);        // Central directory header signature
      _u16(view,4,20);                // Version made by (2.0)
      _u16(view,6,20);                // Version needed to extract (2.0)
      _u16(view,8,0);                 // Flags
      _u16(view,10,0);                // Method: 0 = STORED
      _u16(view,12,time);
      _u16(view,14,date);
      _u32(view,16,m.crc);
      _u32(view,20,m.size);           // Compressed size
      _u32(view,24,m.size);           // Uncompressed size
      _u16(view,28,m.nameBytes.length);
      _u16(view,30,0);                // Extra field length
      _u16(view,32,0);                // Comment length
      _u16(view,34,0);                // Disk number start
      _u16(view,36,0);                // Internal attrs
      _u32(view,38,0);                // External attrs
      _u32(view,42,m.offset);         // Local header offset
      cdh.set(m.nameBytes,46);
      chunks.push(cdh);
      cdSize+=cdh.length;
    });

    // End of Central Directory record.
    const eocd=new Uint8Array(22);
    const view=new DataView(eocd.buffer);
    _u32(view,0,0x06054B50);          // EOCD signature
    _u16(view,4,0);                   // Disk #
    _u16(view,6,0);                   // Disk of central directory
    _u16(view,8,meta.length);         // Entries on this disk
    _u16(view,10,meta.length);        // Total entries
    _u32(view,12,cdSize);             // CD size
    _u32(view,16,cdStart);            // CD offset
    _u16(view,20,0);                  // Comment length
    chunks.push(eocd);

    return new Blob(chunks,{type:'application/zip'});
  }

  const api={build:build,dataURLToBytes:dataURLToBytes};
  try{ window.ZipWriter=api; }catch(e){}
  return api;
})();
