import {useEffect} from 'react';
import {useLocation} from 'react-router-dom';
import {supabase} from '../lib/supabase';

const SITE='Stationery Dot Com';
const DEFAULT_DESCRIPTION='Stationery Dot Com is an online digital service platform in Bangladesh for document and government services, Meta ads, social media growth, SMM services, digital subscriptions and creative design.';
const KEYWORDS='Stationery Dot Com, online services Bangladesh, digital services Bangladesh, document services Bangladesh, government document service Bangladesh, NID service Bangladesh, passport service Bangladesh, birth certificate service Bangladesh, Meta ads Bangladesh, Facebook ads service Bangladesh, social media marketing Bangladesh, SMM panel Bangladesh, Instagram growth Bangladesh, digital subscriptions Bangladesh, Canva Pro Bangladesh, ChatGPT Plus Bangladesh, graphic design Bangladesh, web design Bangladesh, video editing Bangladesh';

function clean(value){return String(value||'').replace(/\s+/g,' ').trim();}
function setMeta(selector,attrs){
  let el=document.head.querySelector(selector);
  if(!el){el=document.createElement('meta');document.head.appendChild(el);}
  Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v));
}
function setLink(rel,href){
  let el=document.head.querySelector(`link[rel="${rel}"]`);
  if(!el){el=document.createElement('link');el.rel=rel;document.head.appendChild(el);}
  el.href=href;
}

export default function SEO(){
  const {pathname}=useLocation();
  useEffect(()=>{
    let cancelled=false;
    const run=async()=>{
      const route=pathname.replace(/\/+$/,'')||'/';
      const pages={
        '/':{title:'Stationery Dot Com | Online Digital Services in Bangladesh',description:'Order online document and government services, Meta ads, social media growth, SMM services, digital subscriptions and creative design from Stationery Dot Com.'},
        '/services':{title:'Online Services in Bangladesh | Stationery Dot Com',description:'Explore document and government services, Meta and social media marketing, SMM panel, digital subscriptions, graphic design, web design and video services.'},
        '/smm':{title:'SMM Panel Bangladesh | Social Media Growth Services',description:'Order Facebook, Instagram and other social media growth services from Stationery Dot Com.'},
        '/track-order':{title:'Track Order Online | Stationery Dot Com',description:'Track your Stationery Dot Com order using your Order ID and see the latest order status.'},
        '/contact':{title:'Contact Stationery Dot Com | Online Support',description:'Contact Stationery Dot Com for online service support, order help and service enquiries.'},
        '/privacy-policy':{title:'Privacy Policy | Stationery Dot Com',description:'Read the Stationery Dot Com privacy policy and learn how customer information is handled.'},
        '/terms-of-service':{title:'Terms of Service | Stationery Dot Com',description:'Read the Stationery Dot Com terms of service for online orders and digital services.'},
        '/account':{title:'My Account | Stationery Dot Com',description:'Manage your Stationery Dot Com profile, orders and reviews.'},
        '/cart':{title:'Shopping Cart | Stationery Dot Com',description:'Review selected services and continue to checkout.',noindex:true},
        '/order':{title:'Place an Order | Stationery Dot Com',description:'Complete your Stationery Dot Com service order online.',noindex:true}
      };
      let page=pages[route]||(
        route.startsWith('/order-success/')?{title:'Order Confirmation | Stationery Dot Com',description:'Your Stationery Dot Com order confirmation.',noindex:true}:
        route.startsWith('/admin')?{title:'Admin | Stationery Dot Com',description:'Stationery Dot Com administration.',noindex:true}:
        {title:SITE+' | Online Digital Services in Bangladesh',description:DEFAULT_DESCRIPTION}
      );
      let service=null;
      if(route.startsWith('/services/')){
        const slug=decodeURIComponent(route.slice('/services/'.length));
        const {data}=await supabase.from('services').select('id,name,slug,category,description,image_url,is_active').eq('slug',slug).eq('is_active',true).maybeSingle();
        if(cancelled)return;
        service=data||null;
        if(service){
          page={
            title:`${clean(service.name)} | ${clean(service.category)||'Online Service'} | Stationery Dot Com`,
            description:clean(service.description)||`Order ${clean(service.name)} online from Stationery Dot Com in Bangladesh. View packages, pricing and service details.`
          };
        }else page={title:'Service Details | Stationery Dot Com',description:'View service details, packages, pricing and ordering information from Stationery Dot Com.'};
      }
      const description=clean(page.description).slice(0,165);
      const canonical=new URL(route,window.location.origin).href;
      const image=new URL(service?.image_url||'/stationery-dot-com-logo.webp',window.location.origin).href;
      document.documentElement.lang='en';
      document.title=page.title;
      setLink('canonical',canonical);
      setMeta('meta[name="description"]',{name:'description',content:description});
      setMeta('meta[name="keywords"]',{name:'keywords',content:service?[`${clean(service.name)} Bangladesh`,`${clean(service.name)} online`,clean(service.category),'Stationery Dot Com','online services Bangladesh'].filter(Boolean).join(', '):KEYWORDS});
      setMeta('meta[name="robots"]',{name:'robots',content:page.noindex?'noindex,nofollow':'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'});
      setMeta('meta[name="author"]',{name:'author',content:SITE});
      setMeta('meta[property="og:type"]',{property:'og:type',content:'website'});
      setMeta('meta[property="og:site_name"]',{property:'og:site_name',content:SITE});
      setMeta('meta[property="og:title"]',{property:'og:title',content:page.title});
      setMeta('meta[property="og:description"]',{property:'og:description',content:description});
      setMeta('meta[property="og:url"]',{property:'og:url',content:canonical});
      setMeta('meta[property="og:image"]',{property:'og:image',content:image});
      setMeta('meta[name="twitter:card"]',{name:'twitter:card',content:'summary_large_image'});
      setMeta('meta[name="twitter:title"]',{name:'twitter:title',content:page.title});
      setMeta('meta[name="twitter:description"]',{name:'twitter:description',content:description});
      setMeta('meta[name="twitter:image"]',{name:'twitter:image',content:image});

      let ld=document.head.querySelector('#stationery-seo-jsonld');
      if(!ld){ld=document.createElement('script');ld.id='stationery-seo-jsonld';ld.type='application/ld+json';document.head.appendChild(ld);}
      const home=new URL('/',window.location.origin).href;
      const breadcrumbItems=[{'@type':'ListItem',position:1,name:'Home',item:home}];
      if(route!=='/'){
        if(route.startsWith('/services/')){
          breadcrumbItems.push({'@type':'ListItem',position:2,name:'Services',item:new URL('/services',window.location.origin).href});
          breadcrumbItems.push({'@type':'ListItem',position:3,name:clean(service?.name||'Service Details').slice(0,80),item:canonical});
        }else breadcrumbItems.push({'@type':'ListItem',position:2,name:clean(page.title.split('|')[0]).slice(0,80),item:canonical});
      }
      const graph=[
        {'@type':'Organization','@id':home+'#organization',name:SITE,url:home,logo:image,sameAs:['https://www.facebook.com/StationeryDotCom2','https://www.tiktok.com/@stationerydotcom','https://www.instagram.com/stationerydotcom']},
        {'@type':'WebSite','@id':home+'#website',name:SITE,url:home,publisher:{'@id':home+'#organization'},potentialAction:{'@type':'SearchAction',target:new URL('/services?search={search_term_string}',window.location.origin).href,'query-input':'required name=search_term_string'}},
        {'@type':'WebPage','@id':canonical+'#webpage',url:canonical,name:page.title,description:description,isPartOf:{'@id':home+'#website'}},
        {'@type':'BreadcrumbList','itemListElement':breadcrumbItems}
      ];
      if(service)graph.push({'@type':'Service','@id':canonical+'#service',name:clean(service.name),serviceType:clean(service.category),description:description,url:canonical,provider:{'@id':home+'#organization'},areaServed:{'@type':'Country',name:'Bangladesh'}});
      ld.textContent=JSON.stringify({'@context':'https://schema.org','@graph':graph});
    };
    run();
    return()=>{cancelled=true;};
  },[pathname]);
  return null;
}
