const PIXEL_ID=String(import.meta.env.VITE_META_PIXEL_ID||'').trim();

let initialized=false;
let initPromise=null;

function enabled(){
  return typeof window!=='undefined'&&Boolean(PIXEL_ID);
}

export function initMetaPixel(){
  if(!enabled()||initialized)return Promise.resolve(Boolean(PIXEL_ID));
  if(initPromise)return initPromise;
  initPromise=new Promise(resolve=>{
    window.fbq=window.fbq||function(){(window.fbq.q=window.fbq.q||[]).push(arguments)};
    window._fbq=window._fbq||window.fbq;
    window.fbq('init',PIXEL_ID);
    const existing=document.querySelector('script[data-meta-pixel]');
    if(existing){initialized=true;resolve(true);return;}
    const script=document.createElement('script');
    script.async=true;
    script.src='https://connect.facebook.net/en_US/fbevents.js';
    script.dataset.metaPixel='true';
    script.onload=()=>{initialized=true;resolve(true)};
    script.onerror=()=>resolve(false);
    document.head.appendChild(script);
  });
  return initPromise;
}

export function trackMetaEvent(eventName,params={}){
  if(!enabled())return false;
  window.fbq=window.fbq||function(){(window.fbq.q=window.fbq.q||[]).push(arguments)};
  window.fbq('track',eventName,params);
  return true;
}

export function trackPageView(){
  return trackMetaEvent('PageView');
}

export function trackViewContent({contentId,contentName,category,value}={}){
  return trackMetaEvent('ViewContent',{
    content_ids:contentId?[String(contentId)]:undefined,
    content_name:contentName,
    content_category:category,
    value:value!==undefined?Number(value):undefined,
    currency:value!==undefined?'BDT':undefined,
  });
}

export function trackAddToCart({contentId,contentName,value,quantity=1}={}){
  return trackMetaEvent('AddToCart',{
    content_ids:contentId?[String(contentId)]:undefined,
    content_name:contentName,
    value:value!==undefined?Number(value):undefined,
    currency:'BDT',
    contents:contentId?[{id:String(contentId),quantity:Number(quantity)||1}]:undefined,
  });
}

export function trackInitiateCheckout({contentIds=[],value,numItems}={}){
  return trackMetaEvent('InitiateCheckout',{
    content_ids:contentIds.map(String),
    value:Number(value)||0,
    currency:'BDT',
    num_items:Number(numItems)||contentIds.length||1,
  });
}

export function trackPurchase({orderId,contentIds=[],value,numItems}={}){
  return trackMetaEvent('Purchase',{
    content_ids:contentIds.map(String),
    value:Number(value)||0,
    currency:'BDT',
    num_items:Number(numItems)||contentIds.length||1,
    order_id:String(orderId||''),
  });
}

export function isMetaPixelConfigured(){
  return Boolean(PIXEL_ID);
}
