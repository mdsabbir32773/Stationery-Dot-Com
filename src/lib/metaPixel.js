const PIXEL_ID=String(import.meta.env.VITE_META_PIXEL_ID||'1095343416430829').trim();

let initialized=false;
let initPromise=null;

function enabled(){
  return typeof window!=='undefined'&&Boolean(PIXEL_ID);
}

function ensureFbq(){
  if(window.fbq)return window.fbq;
  const fbq=function(){
    if(fbq.callMethod)fbq.callMethod.apply(fbq,arguments);
    else fbq.queue.push(arguments);
  };
  fbq.push=fbq;
  fbq.loaded=true;
  fbq.version='2.0';
  fbq.queue=[];
  window.fbq=fbq;
  window._fbq=fbq;
  return fbq;
}

export function initMetaPixel(){
  if(!enabled())return Promise.resolve(false);
  if(initialized)return Promise.resolve(true);
  if(initPromise)return initPromise;

  initPromise=new Promise(resolve=>{
    // Initialize the standard queue before loading Meta's script.
    ensureFbq();

    window.fbq('init',PIXEL_ID);

    const existing=document.querySelector('script[data-meta-pixel]');
    if(existing){
      initialized=true;
      resolve(true);
      return;
    }

    const script=document.createElement('script');
    script.async=true;
    script.src='https://connect.facebook.net/en_US/fbevents.js';
    script.dataset.metaPixel='true';
    script.onload=()=>{
      initialized=true;
      resolve(true);
    };
    script.onerror=()=>resolve(false);
    document.head.appendChild(script);
  });

  return initPromise;
}

export function trackMetaEvent(eventName,params={}){
  if(!enabled()||typeof window==='undefined')return false;
  ensureFbq()('track',eventName,params);
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

// A successful manual-payment order is a lead until an administrator verifies payment.
export function trackLead({contentIds=[],contentName,value}={}){
  const amount=Number(value);
  return trackMetaEvent('Lead',{
    content_ids:contentIds.map(String),
    content_name:contentName,
    ...(Number.isFinite(amount)&&amount>=0?{value:amount,currency:'BDT'}:{}),
  });
}
