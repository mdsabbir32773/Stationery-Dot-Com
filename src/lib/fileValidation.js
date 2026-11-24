const MIME_BY_EXT=Object.freeze({
  jpg:'image/jpeg',
  jpeg:'image/jpeg',
  png:'image/png',
  webp:'image/webp',
  pdf:'application/pdf',
  doc:'application/msword',
  docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
});
const ALLOWED=new Set(Object.values(MIME_BY_EXT));
const PROOF=new Set(['image/jpeg','image/png','image/webp']);

export function getUploadMime(file) {
  if(!file)return '';
  const type=String(file.type||'').toLowerCase();
  if(ALLOWED.has(type))return type;
  if(type&&type!=='application/octet-stream'&&type!=='binary/octet-stream'&&type!=='image/jpg')return '';
  const ext=String(file.name||'').split('.').pop().toLowerCase();
  return MIME_BY_EXT[ext]||'';
}
export function getPaymentProofMime(file) {
  const type=getUploadMime(file);
  return PROOF.has(type)?type:'';
}
