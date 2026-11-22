const KEY='sdc_recent_services_v1';
export function trackRecentService(service){
 if(!service?.id||!service?.slug)return;
 try{const current=JSON.parse(localStorage.getItem(KEY)||'[]');const next=[{id:service.id,slug:service.slug},...current.filter(x=>x.id!==service.id)].slice(0,6);localStorage.setItem(KEY,JSON.stringify(next));}catch{}
}
export function getRecentServiceIds(){
 try{return JSON.parse(localStorage.getItem(KEY)||'[]').map(x=>x.id).filter(Boolean).slice(0,6);}catch{return [];}
}