import {useEffect,useRef,useState} from 'react';
import {Download,ImagePlus,ShieldCheck,Trash2,RefreshCw,CheckCircle2,AlertCircle} from 'lucide-react';
import useTitle from '../lib/useTitle';
import './ImageMetadataCleaner.css';

const MAX_BYTES=20*1024*1024;
const ACCEPTED=['image/jpeg','image/png','image/webp'];
const encoder=new TextEncoder();
const decoder=new TextDecoder();
function formatBytes(bytes){if(bytes<1024)return bytes+' B';if(bytes<1024*1024)return (bytes/1024).toFixed(1)+' KB';return (bytes/1024/1024).toFixed(2)+' MB';}
function ascii(bytes,start,length){return decoder.decode(bytes.subarray(start,start+length));}
function u32be(bytes,offset){return new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(offset,false);}
function u32le(bytes,offset){return new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(offset,true);}
function putU32le(bytes,offset,value){new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).setUint32(offset,value,true);}
function concat(parts){const size=parts.reduce((n,p)=>n+p.length,0);const out=new Uint8Array(size);let offset=0;for(const part of parts){out.set(part,offset);offset+=part.length;}return out;}
function cleanJpeg(bytes){
 if(bytes.length<4||bytes[0]!==0xff||bytes[1]!==0xd8)throw new Error('This JPG file is invalid or unsupported.');
 const parts=[bytes.subarray(0,2)];let offset=2;
 while(offset<bytes.length){
  if(bytes[offset]!==0xff)throw new Error('This JPG file has an unexpected data structure.');
  let markerStart=offset;while(offset<bytes.length&&bytes[offset]===0xff)offset++;
  if(offset>=bytes.length)throw new Error('This JPG file is incomplete.');
  const marker=bytes[offset++];
  if(marker===0xda){parts.push(bytes.subarray(markerStart));return concat(parts);}
  if(marker===0xd9){parts.push(bytes.subarray(markerStart));return concat(parts);}
  if(marker===0x01||(marker>=0xd0&&marker<=0xd7)){parts.push(bytes.subarray(markerStart,offset));continue;}
  if(offset+2>bytes.length)throw new Error('This JPG file is incomplete.');
  const length=(bytes[offset]<<8)|bytes[offset+1];
  if(length<2||offset+length>bytes.length)throw new Error('This JPG file has an invalid metadata segment.');
  const payloadStart=offset+2;const payloadEnd=offset+length;
  const isApp1=marker===0xe1;const isApp13=marker===0xed;
  const isExif=isApp1&&payloadEnd-payloadStart>=6&&ascii(bytes,payloadStart,6)==='Exif\\0\\0';
  const isXmp=isApp1&&ascii(bytes,payloadStart,Math.min(29,payloadEnd-payloadStart)).startsWith('http://ns.adobe.com/xap/1.0/');
  // Keep EXIF orientation data so portrait photos continue to display correctly.
  const remove=(isApp13||isXmp||(isExif&&!hasExifOrientation(bytes,payloadStart+6,payloadEnd)));
  if(!remove)parts.push(bytes.subarray(markerStart,payloadEnd));
  offset=payloadEnd;
 }
 throw new Error('This JPG file has no complete image data.');
}
function hasExifOrientation(bytes,start,end){
 try{
  if(start+8>end)return false;
  const endian=ascii(bytes,start,2);const little=endian==='II';if(!little&&endian!=='MM')return false;
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const read16=(p)=>view.getUint16(p,little);const read32=(p)=>view.getUint32(p,little);
  if(read16(start+2)!==42)return false;
  const ifd=start+read32(start+4);if(ifd+2>end)return false;
  const count=read16(ifd);
  for(let i=0;i<count;i++){const p=ifd+2+i*12;if(p+12>end)break;if(read16(p)===0x0112)return read16(p+8)!==1;}
  return false;
 }catch{return false;}
}
function cleanPng(bytes){
 const signature=[137,80,78,71,13,10,26,10];if(bytes.length<8||!signature.every((v,i)=>bytes[i]===v))throw new Error('This PNG file is invalid or unsupported.');
 const removeTypes=new Set(['eXIf','tEXt','zTXt','iTXt']);const parts=[bytes.subarray(0,8)];let offset=8,ended=false;
 while(offset+12<=bytes.length){
  const length=u32be(bytes,offset);const end=offset+12+length;if(end>bytes.length)throw new Error('This PNG file is incomplete.');
  const type=ascii(bytes,offset+4,4);if(!removeTypes.has(type))parts.push(bytes.subarray(offset,end));offset=end;
  if(type==='IEND'){ended=true;break;}
 }
 if(!ended)throw new Error('This PNG file has no complete end marker.');
 if(offset<bytes.length)parts.push(bytes.subarray(offset));
 return concat(parts);
}
function cleanWebp(bytes){
 if(bytes.length<12||ascii(bytes,0,4)!=='RIFF'||ascii(bytes,8,4)!=='WEBP')throw new Error('This WebP file is invalid or unsupported.');
 const parts=[bytes.subarray(0,12)];let offset=12,removedExif=false,removedXmp=false;
 while(offset+8<=bytes.length){
  const type=ascii(bytes,offset,4);const size=u32le(bytes,offset+4);const end=offset+8+size+(size&1);if(end>bytes.length)throw new Error('This WebP file is incomplete.');
  if(type==='EXIF')removedExif=true;else if(type==='XMP ')removedXmp=true;else{
   const chunk=bytes.slice(offset,end);
   if(type==='VP8X'&&size>=1){chunk[8]&=~(0x08|0x04);}
   parts.push(chunk);
  }
  offset=end;
 }
 if(offset!==bytes.length)throw new Error('This WebP file has an invalid chunk structure.');
 const output=concat(parts);putU32le(output,4,output.length-8);return output;
}
async function cleanImageFile(file){
 const bytes=new Uint8Array(await file.arrayBuffer());let cleaned,type;
 if(file.type==='image/jpeg'){cleaned=cleanJpeg(bytes);type='image/jpeg';}
 else if(file.type==='image/png'){cleaned=cleanPng(bytes);type='image/png';}
 else if(file.type==='image/webp'){cleaned=cleanWebp(bytes);type='image/webp';}
 else throw new Error('Please choose a JPG, PNG or WebP image.');
 return new Blob([cleaned],{type});
}
export default function ImageMetadataCleaner(){
 useTitle('Free Image Metadata Cleaner | Stationery Dot Com','Remove common image metadata from JPG, PNG and WebP files in your browser. Free, private and processed on your device.');
 const inputRef=useRef(null);const urlsRef=useRef(new Set());const [file,setFile]=useState(null);const [preview,setPreview]=useState('');const [result,setResult]=useState(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 useEffect(()=>()=>{urlsRef.current.forEach(url=>URL.revokeObjectURL(url));urlsRef.current.clear();},[]);
 function clear(){urlsRef.current.forEach(url=>URL.revokeObjectURL(url));urlsRef.current.clear();setPreview('');setFile(null);setResult(null);setError('');if(inputRef.current)inputRef.current.value='';}
 function choose(next){setError('');setResult(null);if(!next)return;if(!ACCEPTED.includes(next.type)){setError('Please choose a JPG, PNG or WebP image.');return;}if(next.size>MAX_BYTES){setError('Please choose an image smaller than 20 MB.');return;}if(preview){URL.revokeObjectURL(preview);urlsRef.current.delete(preview);}const nextUrl=URL.createObjectURL(next);urlsRef.current.add(nextUrl);setFile(next);setPreview(nextUrl);}
 async function process(){if(!file||busy)return;setBusy(true);setError('');try{const blob=await cleanImageFile(file);const outputUrl=URL.createObjectURL(blob);urlsRef.current.add(outputUrl);const ext=file.type==='image/jpeg'?'jpg':file.type==='image/webp'?'webp':'png';setResult({blob,url:outputUrl,name:file.name.replace(/\\.[^.]+$/,'')+'-metadata-clean.'+ext,size:blob.size});}catch(e){setError(e?.message||'Something went wrong. Please try again.');}finally{setBusy(false);}}
 return <main className="wrap image-cleaner-page"><header className="image-cleaner-heading"><span className="image-cleaner-eyebrow"><ShieldCheck size={16}/> FREE ONLINE TOOL</span><h1>Image Metadata Cleaner</h1><p>Remove common hidden metadata from your image files — right in your browser.</p><div className="image-cleaner-trust"><span><ShieldCheck size={16}/> 100% free</span><span><ImagePlus size={16}/> No account needed</span><span><CheckCircle2 size={16}/> On-device processing</span></div></header>
 <section className="image-cleaner-card" aria-label="Image metadata removal tool">
 {!file?<button className="image-cleaner-drop" type="button" onClick={()=>inputRef.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();choose(e.dataTransfer.files?.[0]);}}><span className="image-cleaner-upload-icon"><ImagePlus size={28}/></span><strong>Choose an image to clean</strong><span>Tap to upload or drag and drop</span><small>JPG, PNG or WebP · Maximum 20 MB</small><span className="btn image-cleaner-select-btn">Select image</span></button>
 :<div className="image-cleaner-workspace"><div className="image-cleaner-preview"><img src={preview} alt="Selected image preview"/><span className="image-cleaner-file-tag">{file.type.replace('image/','').toUpperCase()}</span></div><div className="image-cleaner-file-details"><strong>{file.name}</strong><span>{formatBytes(file.size)} · {file.type.split('/')[1]?.toUpperCase()}</span>{result&&<div className="image-cleaner-success"><CheckCircle2 size={17}/> Metadata-clean copy is ready.</div>}{error&&<p className="image-cleaner-error" role="alert"><AlertCircle size={16}/>{error}</p>}<div className="image-cleaner-actions">{!result?<button className="btn image-cleaner-primary" type="button" disabled={busy} onClick={process}>{busy?<><RefreshCw className="image-cleaner-spin" size={17}/> Processing…</>:<><Trash2 size={17}/> Remove metadata</>}</button>:<a className="btn image-cleaner-primary" href={result.url} download={result.name}><Download size={17}/> Download cleaned image</a>}<button className="btn alt image-cleaner-reset" type="button" onClick={clear}>Choose another</button></div>{result&&<small className="image-cleaner-output-size">Output file: {formatBytes(result.size)}</small>}</div></div>}
 {error&&!file&&<p className="image-cleaner-error" role="alert"><AlertCircle size={16}/>{error}</p>}
 <input ref={inputRef} className="image-cleaner-hidden-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>choose(e.target.files?.[0])}/>
 </section>
 <section className="image-cleaner-info"><div><h2>How it works</h2><ol><li>Choose a JPG, PNG or WebP image.</li><li>The tool removes selected metadata chunks without decoding or re-encoding the image.</li><li>Download the cleaned file with the original image data preserved.</li></ol></div><div className="image-cleaner-privacy"><ShieldCheck size={22}/><h3>Your image stays on your device</h3><p>Image processing happens locally in your browser. The selected image is not uploaded to Stationery Dot Com or any image-processing server.</p></div></section>
 <aside className="image-cleaner-note"><strong>Important note</strong><p>This tool removes common metadata such as XMP, IPTC and selected EXIF/text chunks while preserving the original compressed image data, so it does not recompress or reduce image quality. JPEG orientation information is retained when needed so photos display correctly. It does not remove information embedded in image pixels, invisible watermarks, or platform-side AI detection. Social networks may still show AI-generated labels; removing metadata cannot guarantee that a label will disappear.</p></aside>
 </main>;
}
