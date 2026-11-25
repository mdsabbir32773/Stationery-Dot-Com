const GA4_ID=String(import.meta.env.VITE_GA4_ID||'').trim();
const GA4_ID_RE=/^G-[A-Z0-9]{6,}$/i;
let initialized=false;

function validId(){return GA4_ID_RE.test(GA4_ID);}
export function sanitizeAnalyticsPath(path=''){
  const clean=String(path||'/').split(/[?#]/,1)[0]||'/';
  return clean
    .replace(/^\/invoice\/[^/]+(?:\/.*)?$/i,'/invoice/:code')
    .replace(/^\/order-success\/[^/]+(?:\/.*)?$/i,'/order-success/:code')
    .replace(/^\/admin(?:\/.*)?$/i,'/admin');
}
export function initGoogleAnalytics(){
  if(typeof window==='undefined'||!validId())return false;
  if(initialized&&typeof window.gtag==='function')return true;
  window.dataLayer=window.dataLayer||[];
  window.gtag=window.gtag||function(){window.dataLayer.push(arguments);};
  if(!document.querySelector('script[data-ga4]')){
    const script=document.createElement('script');
    script.async=true;
    script.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(GA4_ID);
    script.dataset.ga4='true';
    script.onerror=()=>{initialized=false;};
    document.head.appendChild(script);
  }
  window.gtag('js',new Date());
  window.gtag('config',GA4_ID,{send_page_view:false});
  initialized=true;
  return true;
}
export function trackGooglePageView(path,title){
  if(!initGoogleAnalytics())return false;
  const safePath=sanitizeAnalyticsPath(path);
  if(safePath==='/admin'||safePath.startsWith('/admin/'))return false;
  window.gtag('event','page_view',{
    page_title:String(title||document.title||'Stationery Dot Com').slice(0,120),
    page_path:safePath,
    page_location:window.location.origin+safePath
  });
  return true;
}
const ALLOWED_PARAMS=new Set(['contact_method','placement','page_path','cta_name','item_name','item_category','item_count','quantity','value','currency','lead_type']);
export function trackGoogleEvent(name,params={}){
  if(!initGoogleAnalytics()||! /^[a-z][a-z0-9_]{0,39}$/.test(String(name||'')))return false;
  const safe={};
  for(const [key,value] of Object.entries(params||{})){
    if(!ALLOWED_PARAMS.has(key)||value===undefined||value===null)continue;
    if(key==='page_path'){safe[key]=sanitizeAnalyticsPath(value);continue;}
    if(typeof value==='number'&&Number.isFinite(value)){safe[key]=value;continue;}
    if(typeof value==='string'){safe[key]=value.replace(/[\r\n]/g,' ').slice(0,100);}
  }
  window.gtag('event',name,safe);
  return true;
}
export function isGoogleAnalyticsConfigured(){return validId();}
