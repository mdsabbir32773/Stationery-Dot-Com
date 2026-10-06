import {useEffect} from 'react';
import {useLocation} from 'react-router-dom';

const SITE='Stationery Dot Com';
const DEFAULT_DESCRIPTION='Stationery Dot Com is an online digital service platform in Bangladesh for document and government services, Meta ads, social media growth, SMM services, digital subscriptions and creative design.';
const KEYWORDS='Stationery Dot Com, online services Bangladesh, digital services Bangladesh, document services Bangladesh, government document service, Meta ads Bangladesh, Facebook ads service, social media marketing Bangladesh, SMM panel Bangladesh, digital subscriptions Bangladesh, Canva Pro Bangladesh, ChatGPT Plus Bangladesh, graphic design Bangladesh, web design Bangladesh, video editing Bangladesh';

function clean(value){return String(value||'').replace(/\s+/g,' ').trim();}

export default function SEO(){
  const {pathname}=useLocation();
  useEffect(()=>{
    const route=pathname.replace(/\/+$/,'')||'/';
    const pages={
      '/':{title:'Stationery Dot Com | Online Digital Services in Bangladesh',description:'Order online document and government services, Meta ads, social media growth, SMM services, digital subscriptions and creative design from Stationery Dot Com.'},
      '/services':{title:'Online Services in Bangladesh | Stationery Dot Com',description:'Explore online document and government services, Meta and social media services, digital subscriptions, creative design and more.'},
      '/smm':{title:'SMM Panel Bangladesh | Social Media Growth Services',description:'Browse social media growth and SMM panel services for Facebook, Instagram and other platforms with easy online ordering.'},
      '/track-order':{title:'Track Your Order | Stationery Dot Com',description:'Track your Stationery Dot Com order using your Order ID and view the latest order status.'},
      '/contact':{title:'Contact Stationery Dot Com | Online Support',description:'Contact Stationery Dot Com for online service support, order help and service enquiries.'},
      '/privacy-policy':{title:'Privacy Policy | Stationery Dot Com',description:'Read the Stationery Dot Com privacy policy and learn how customer information is handled.'},
      '/terms-of-service':{title:'Terms of Service | Stationery Dot Com',description:'Read the Stationery Dot Com terms of service for online orders and digital services.'},
      '/account':{title:'My Account | Stationery Dot Com',description:'Sign in to manage your Stationery Dot Com profile, orders, reviews and wallet.'},
      '/cart':{title:'Shopping Cart | Stationery Dot Com',description:'Review selected Stationery Dot Com services and continue to checkout.',noindex:true},
      '/order':{title:'Place an Order | Stationery Dot Com',description:'Complete your Stationery Dot Com service order securely online.',noindex:true},
    };
    const page=pages[route]||(
      route.startsWith('/services/')?
      {title:'Service Details | Stationery Dot Com',description:'View service details, packages, pricing and ordering information from Stationery Dot Com.'}:
      route.startsWith('/order-success/')?
      {title:'Order Confirmation | Stationery Dot Com',description:'Your Stationery Dot Com order confirmation.',noindex:true}:
      route.startsWith('/admin')?
      {title:'Admin | Stationery Dot Com',description:'Stationery Dot Com administration.',noindex:true}:
      {title:SITE+' | Online Digital Services in Bangladesh',description:DEFAULT_DESCRIPTION}
    );
    const description=clean(page.description||DEFAULT_DESCRIPTION);
    document.title=page.title;
    const canonical=new URL(route,window.location.origin).href;
    const image=new URL('/stationery-dot-com-logo.webp',window.location.origin).href;
    const setMeta=(selector,attrs)=>{
      let el=document.head.querySelector(selector);
      if(!el){el=document.createElement('meta');document.head.appendChild(el);}
      Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v));
    };
    let link=document.head.querySelector('link[rel="canonical"]');
    if(!link){link=document.createElement('link');link.rel='canonical';document.head.appendChild(link);}
    link.href=canonical;
    setMeta('meta[name="description"]',{name:'description',content:description});
    setMeta('meta[name="keywords"]',{name:'keywords',content:KEYWORDS});
    setMeta('meta[name="robots"]',{name:'robots',content:page.noindex?'noindex,nofollow':'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'});
    setMeta('meta[property="og:type"]',{property:'og:type',content:'website'});
    setMeta('meta[property="og:site_name"]',{property:'og:site_name',content:SITE});
    setMeta('meta[property="og:title"]',{property:'og:title',content:page.title});
    setMeta('meta[property="og:description"]',{property:'og:description',content:description});
    setMeta('meta[property="og:url"]',{property:'og:url',content:canonical});
    setMeta('meta[property="og:image"]',{property:'og:image',content:image});
    setMeta('meta[name="twitter:card"]',{name:'twitter:card',content:'summary'});
    setMeta('meta[name="twitter:title"]',{name:'twitter:title',content:page.title});
    setMeta('meta[name="twitter:description"]',{name:'twitter:description',content:description});
    setMeta('meta[name="twitter:image"]',{name:'twitter:image',content:image});

    let ld=document.head.querySelector('#stationery-seo-jsonld');
    if(!ld){ld=document.createElement('script');ld.id='stationery-seo-jsonld';ld.type='application/ld+json';document.head.appendChild(ld);}
    const graph=[
      {'@type':'Organization','@id':new URL('/#organization',window.location.origin).href,name:SITE,url:window.location.origin,logo:image,sameAs:['https://www.facebook.com/StationeryDotCom2','https://www.tiktok.com/@stationerydotcom','https://www.instagram.com/stationerydotcom']},
      {'@type':'WebSite','@id':new URL('/#website',window.location.origin).href,name:SITE,url:window.location.origin,publisher:{'@id':new URL('/#organization',window.location.origin).href},potentialAction:{'@type':'SearchAction',target:new URL('/services?search={search_term_string}',window.location.origin).href, 'query-input':'required name=search_term_string'}},
      {'@type':'BreadcrumbList','itemListElement':[{'@type':'ListItem',position:1,name:'Home',item:new URL('/',window.location.origin).href},...route!=='/'?route.startsWith('/services/')?[{'@type':'ListItem',position:2,name:'Services',item:new URL('/services',window.location.origin).href},{'@type':'ListItem',position:3,name:'Service Details',item:canonical}]:[{'@type':'ListItem',position:2,name:clean(page.title.replace(/ \| Stationery Dot Com.*/,'')).slice(0,80),item:canonical}]:[]]}
    ];
    ld.textContent=JSON.stringify({'@context':'https://schema.org', '@graph':graph});
  },[pathname]);
  return null;
}
