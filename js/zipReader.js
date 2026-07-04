// zipReader — Sprint 9.6 (Museum Gallery Theme Support).
//
// Minimal, dependency-free ZIP reader — the read-side counterpart to
// js/zipWriter.js. Exists so a .vtheme can be a real folder-based
// package (manifest + theme JSON, metadata.json, preview/thumbnail
// images, layouts/, frames/, layer-packs/, assets/) shipped as a single
// zipped file, without pulling in a third-party unzip library.
//
// Supports the two compression methods any real-world zip tool
// produces: 0 (stored, what ZipWriter itself emits) and 8 (deflate,
// what macOS Archive Utility / 7-Zip / most OS "Compress" actions use
// by default) via the browser's native DecompressionStream('deflate-raw').
// Anything else (rare methods like bzip2) is reported as an error
// rather than silently producing garbage.
//
// Public API:
//   ZipReader.isZip(bytesOrBuffer) → boolean
//     Sniffs the local-file-header magic ('PK\x03\x04') so callers can
//     branch between "this is a package" and "this is a legacy flat
//     JSON .vtheme" before committing to a parse.
//   ZipReader.read(fileOrBlobOrArrayBuffer) → Promise<{name:Uint8Array}>
//     Flat map of every non-directory entry's full path (forward
//     slashes, matching the zip spec) to its decompressed bytes.
//   ZipReader.bytesToText(bytes) → string (UTF-8 decode)
//   ZipReader.bytesToDataURL(bytes, mimeType) → string (base64 data URI)
const ZipReader=(function(){
  'use strict';

  function _u16(view,off){ return view.getUint16(off,true); }
  function _u32(view,off){ return view.getUint32(off,true); }

  function _toArrayBuffer(input){
    if(input instanceof ArrayBuffer) return Promise.resolve(input);
    if(input instanceof Uint8Array) return Promise.resolve(input.buffer.slice(input.byteOffset,input.byteOffset+input.byteLength));
    if(input && typeof input.arrayBuffer==='function') return input.arrayBuffer();
    return Promise.reject(new Error('Unsupported input to ZipReader'));
  }

  function isZip(input){
    let bytes;
    if(input instanceof ArrayBuffer) bytes=new Uint8Array(input,0,Math.min(4,input.byteLength));
    else if(input instanceof Uint8Array) bytes=input.subarray(0,4);
    else return false;
    return bytes.length>=4 && bytes[0]===0x50 && bytes[1]===0x4B && bytes[2]===0x03 && bytes[3]===0x04;
  }

  // Names are ASCII-safe in every zip ZipWriter itself produces, but a
  // theme authored with a real zip tool may use UTF-8 filenames — decode
  // properly rather than assuming Latin-1.
  function _decodeName(nameBytes){
    try{ return new TextDecoder('utf-8').decode(nameBytes); }
    catch(e){
      let out='';
      for(let i=0;i<nameBytes.length;i++) out+=String.fromCharCode(nameBytes[i]);
      return out;
    }
  }

  // End Of Central Directory record: fixed 22 bytes + up to 65535 bytes
  // of trailing comment, so scan backward for the signature rather than
  // assuming it's the very last 22 bytes.
  function _findEOCD(view,len){
    const scanBack=Math.min(len,22+65535);
    for(let i=len-22;i>=len-scanBack;i--){
      if(i>=0 && _u32(view,i)===0x06054B50) return i;
    }
    return -1;
  }

  async function _inflate(compBytes,method){
    if(method===0) return compBytes.slice();
    if(method===8){
      if(typeof DecompressionStream==='undefined'){
        throw new Error('This browser cannot read compressed theme packages (DecompressionStream unsupported).');
      }
      const ds=new DecompressionStream('deflate-raw');
      const stream=new Blob([compBytes]).stream().pipeThrough(ds);
      const buf=await new Response(stream).arrayBuffer();
      return new Uint8Array(buf);
    }
    throw new Error('Unsupported zip compression method: '+method);
  }

  async function read(input){
    const buf=await _toArrayBuffer(input);
    const view=new DataView(buf);
    const bytes=new Uint8Array(buf);
    const eocdOff=_findEOCD(view,buf.byteLength);
    if(eocdOff<0) throw new Error('Not a valid ZIP archive.');

    const cdCount=_u16(view,eocdOff+10);
    const cdOffset=_u32(view,eocdOff+16);

    const entries=[];
    let p=cdOffset;
    for(let i=0;i<cdCount;i++){
      if(p+46>buf.byteLength || _u32(view,p)!==0x02014B50) break; // truncated/corrupt — stop, keep what we parsed
      const method=_u16(view,p+10);
      const compSize=_u32(view,p+20);
      const nameLen=_u16(view,p+28);
      const extraLen=_u16(view,p+30);
      const commentLen=_u16(view,p+32);
      const lfhOffset=_u32(view,p+42);
      const name=_decodeName(bytes.subarray(p+46,p+46+nameLen));
      p+=46+nameLen+extraLen+commentLen;

      if(name.charAt(name.length-1)==='/') continue; // directory entry, no data

      const lfhNameLen=_u16(view,lfhOffset+26);
      const lfhExtraLen=_u16(view,lfhOffset+28);
      const dataStart=lfhOffset+30+lfhNameLen+lfhExtraLen;
      const compBytes=bytes.subarray(dataStart,dataStart+compSize);
      entries.push({name:name,method:method,compBytes:compBytes});
    }

    const out={};
    await Promise.all(entries.map(async function(e){
      out[e.name]=await _inflate(e.compBytes,e.method);
    }));
    return out;
  }

  function bytesToText(bytes){
    return new TextDecoder('utf-8').decode(bytes);
  }

  // Chunked so large images don't blow the call stack on
  // String.fromCharCode(...bytes) / apply().
  function bytesToDataURL(bytes,mimeType){
    let bin='';
    const chunk=0x8000;
    for(let i=0;i<bytes.length;i+=chunk){
      bin+=String.fromCharCode.apply(null,bytes.subarray(i,i+chunk));
    }
    return 'data:'+(mimeType||'application/octet-stream')+';base64,'+btoa(bin);
  }

  const api={
    isZip:isZip,
    read:read,
    bytesToText:bytesToText,
    bytesToDataURL:bytesToDataURL
  };
  try{ window.ZipReader=api; }catch(e){}
  return api;
})();
