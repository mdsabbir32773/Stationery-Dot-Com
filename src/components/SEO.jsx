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
  const {pathname,search}=useLocation();
  useEffect(()=>{
    let cancelled=false;
    const run=async()=>{
      const route=pathname.replace(/\/+$/,'')||'/';
      const pages={
        '/':{title:'Stationery Dot Com | Online Digital Services in Bangladesh',description:'Order online document and government services, Meta ads, social media growth, SMM services, digital subscriptions and creative design from Stationery Dot Com.'},
        '/about':{title:'About Stationery Dot Com | Online Services in Bangladesh',description:'Learn about Stationery Dot Com, our online service catalogue and how to contact our team.'},
        '/refund-policy':{title:'Refund & Cancellation Policy | Stationery Dot Com',description:'Understand how Stationery Dot Com reviews order cancellation and refund requests.'},
        '/delivery-policy':{title:'Service Delivery Policy | Stationery Dot Com',description:'Learn how Stationery Dot Com reviews orders and handles online service delivery.'},
        '/services':{title:'Online Services in Bangladesh | Stationery Dot Com',description:'Explore document and government services, Meta and social media marketing, SMM panel, digital subscriptions, graphic design, web design and video services.'},
        '/smm':{title:'SMM Panel Bangladesh | Social Media Growth Services',description:'Order Facebook, Instagram and other social media growth services from Stationery Dot Com.'},
        '/track-order':{title:'Track Order Online | Stationery Dot Com',description:'Track your Stationery Dot Com order using your Order ID and see the latest order status.'},
        '/invoice':{title:'Invoice | Stationery Dot Com',description:'View your Stationery Dot Com order invoice.',noindex:true},
        '/contact':{title:'Contact Stationery Dot Com | Online Support',description:'Contact Stationery Dot Com for online service support, order help and service enquiries.'},
        '/help':{title:'Help Center | Stationery Dot Com',description:'Find answers about ordering, payments, wallet deposits, delivery, documents and customer support at Stationery Dot Com.'},
        '/blog':{title:'Digital Services, SMM & Online Service Guides | Stationery Dot Com Blog',description:'Practical Bangladesh-focused guides about digital subscriptions, Facebook marketing, SMM, online services, documents and creative work.'},
        '/privacy-policy':{title:'Privacy Policy | Stationery Dot Com',description:'Read the Stationery Dot Com privacy policy and learn how customer information is handled.'},
        '/terms-of-service':{title:'Terms of Service | Stationery Dot Com',description:'Read the Stationery Dot Com terms of service for online orders and digital services.'},
        '/account':{title:'My Account | Stationery Dot Com',description:'Manage your Stationery Dot Com profile, orders and reviews.'},
        '/cart':{title:'Shopping Cart | Stationery Dot Com',description:'Review selected services and continue to checkout.',noindex:true},
        '/order':{title:'Place an Order | Stationery Dot Com',description:'Complete your Stationery Dot Com service order online.',noindex:true}
      };
      let page=pages[route]||(
        route.startsWith('/invoice/')?{title:'Invoice | Stationery Dot Com',description:'View your Stationery Dot Com order invoice.',noindex:true}:
        route.startsWith('/order-success/')?{title:'Order Confirmation | Stationery Dot Com',description:'Your Stationery Dot Com order confirmation.',noindex:true}:
        route.startsWith('/admin')?{title:'Admin | Stationery Dot Com',description:'Stationery Dot Com administration.',noindex:true}:
        {title:'Page Not Found | Stationery Dot Com',description:'The page you requested could not be found on Stationery Dot Com.',noindex:true}
      );
      let service=null;
      let blogPost=null;
      if(route.startsWith('/blog/')){
        const slug=decodeURIComponent(route.slice('/blog/'.length));
        const {data}=await supabase.from('blog_posts').select('id,title,slug,excerpt,category,cover_image_url,author,published_at,reading_minutes').eq('slug',slug).eq('status','published').not('published_at','is',null).lte('published_at',new Date().toISOString()).maybeSingle();
        if(cancelled)return;
        blogPost=data||null;
        page=blogPost?{title:`${clean(blogPost.title)} | Stationery Dot Com Blog`,description:clean(blogPost.excerpt)||`Read ${clean(blogPost.title)} on the Stationery Dot Com blog.`,image:blogPost.cover_image_url}:{title:'Article Not Found | Stationery Dot Com Blog',description:'This article is unavailable.',noindex:true};
      }
      if(route.startsWith('/services/')){
        const slug=decodeURIComponent(route.slice('/services/'.length));
        const {data}=await supabase.from('services').select('id,name,slug,category,description,image_url,is_active').eq('slug',slug).eq('is_active',true).maybeSingle();
        if(cancelled)return;
        service=data||null;
        if(service){
          const serviceSeo={
            'canva':{title:'Canva Pro Subscription Bangladesh | Stationery Dot Com',description:'Explore Canva subscription options in Bangladesh. Compare available plans, review package details and order online from Stationery Dot Com.'},
            'capcut-pro':{title:'CapCut Pro Subscription BD | Stationery Dot Com',description:'Check the available CapCut Pro subscription package in Bangladesh, including its duration, device details and current price.'},
            'chatgpt-go-plus':{title:'ChatGPT Go & Plus Subscription BD | Stationery Dot Com',description:'Explore ChatGPT Go and Plus subscription options in Bangladesh. Review the available plan details and place an online order.'},
            'claude':{title:'Claude AI Subscription Bangladesh | Stationery Dot Com',description:'View available Claude AI subscription plans in Bangladesh, compare package details and contact Stationery Dot Com for assistance.'},
            'gemini-ai-google-ai':{title:'Google AI & Gemini Subscription BD | Stationery Dot Com',description:'Explore available Google AI and Google One subscription options in Bangladesh, with package details and online ordering.'},
            'spotify-premium':{title:'Spotify Premium Subscription BD | Stationery Dot Com',description:'Review available Spotify Premium subscription options in Bangladesh and check current package details before ordering.'},
            'youtube-premium':{title:'YouTube Premium Subscription BD | Stationery Dot Com',description:'Explore YouTube Premium subscription options in Bangladesh. Compare available plans and review package details online.'},
            'facebook':{title:'Facebook Page Setup & Optimization BD | Stationery Dot Com',description:'Get help with Facebook Page setup, profile information, page optimization and business presence in Bangladesh.'},
            'social-media-boosting-ads-run':{title:'Facebook & Instagram Ads Management BD | Stationery Dot Com',description:'Explore Facebook and Instagram advertising support in Bangladesh, including campaign setup, audience targeting and promotion planning.'},
            'social-media-page-management':{title:'Social Media Page Management BD | Stationery Dot Com',description:'Get support for social media content posting, page updates, inbox and comment management, and consistent brand communication.'},
            'graphic-design':{title:'Graphic Design Services Bangladesh | Stationery Dot Com',description:'Order graphic design for business branding, social media posts, marketing materials and print from Stationery Dot Com.'},
            'video-editing-creation':{title:'Video Editing Services Bangladesh | Stationery Dot Com',description:'Explore video editing services for social media and business content, including editing supplied footage and short-form videos.'},
            'web-design-development':{title:'Website Design & Development BD | Stationery Dot Com',description:'Explore responsive website design and development for business websites, portfolios, landing pages, blogs and online stores.'},
            'birth-certificate':{title:'Birth Certificate Application & Correction Support BD | Stationery Dot Com',description:'Get online assistance with birth certificate application and correction requests in Bangladesh. Requirements and eligibility are reviewed case by case.'},
            'nid':{title:'NID Application & Correction Support BD | Stationery Dot Com',description:'Explore online assistance for NID application and information correction in Bangladesh. Final decisions remain with the relevant authority.'},
            'passport':{title:'Passport Application Support Bangladesh | Stationery Dot Com',description:'Get online assistance with passport application and information correction requests in Bangladesh. Review requirements before placing an order.'},
            'trade-license':{title:'Trade License Application & Renewal BD | Stationery Dot Com',description:'Explore online assistance for new trade license applications and renewals in Bangladesh. Requirements depend on the relevant authority.'},
            'smm-fb-fol-ww':{title:'Facebook Followers Worldwide Service | Stationery Dot Com',description:'Review the worldwide Facebook follower service, minimum and maximum quantity, listed price and refill terms before ordering.'},
            'smm-fb-fol-mix':{title:'Facebook Followers BD & Worldwide Mixed | Stationery Dot Com',description:'Compare the Bangladesh and worldwide mixed Facebook follower option, quantity limits, listed price and refill details.'},
            'smm-fb-fol-bd-n':{title:'Facebook Followers BD Normal | Stationery Dot Com',description:'Review the Bangladesh Facebook follower option, quantity limits, listed price and included refill terms before placing an order.'},
            'smm-fb-fol-bd-p':{title:'Facebook Followers BD Premium | Stationery Dot Com',description:'Explore the Bangladesh premium Facebook follower option and review its quantity limits, listed price and refill information.'},
            'smm-fb-fol-bd-life':{title:'Facebook Followers BD Lifetime Refill | Stationery Dot Com',description:'Review the Bangladesh premium Facebook follower option with lifetime refill terms, quantity limits and listed price.'},
            'smm-fb-rea-ww':{title:'Facebook Reactions Worldwide | Stationery Dot Com',description:'Explore worldwide Facebook reaction options and review available reaction types, quantity limits and listed pricing.'},
            'smm-fb-rea-bd':{title:'Facebook Reactions BD | Stationery Dot Com',description:'Review Bangladesh Facebook reaction options, available reaction types, quantity limits and listed pricing.'},
            'smm-fb-views-nr':{title:'Facebook Video & Reels Views | Stationery Dot Com',description:'Review the Facebook video and Reels views option, quantity limits, listed price and no-refill terms.'},
            'smm-fb-views-r1':{title:'Facebook Video & Reels Views with Refill | Stationery Dot Com',description:'Explore the Facebook video and Reels views option with one-time refill terms, quantity limits and listed pricing.'},
            'smm-fb-com-rnd':{title:'Facebook Comments Service | Stationery Dot Com',description:'Review the random Facebook comments service, quantity limits, listed pricing and order requirements.'},
            'smm-fb-com-cus':{title:'Custom Facebook Comments Service | Stationery Dot Com',description:'Explore custom Facebook comments and review the required post details, quantity limits and listed pricing.'},
            'smm-fb-com-pcus':{title:'Premium Custom Facebook Comments | Stationery Dot Com',description:'Review the premium custom Facebook comments option, order requirements, quantity limits and listed pricing.'},
            'smm-fb-shr-nr':{title:'Facebook Post Shares Service | Stationery Dot Com',description:'Review the Facebook photo and text post sharing option, quantity limits, listed price and no-refill terms.'},
            'smm-fb-shr-r1':{title:'Facebook Post Shares with Refill | Stationery Dot Com',description:'Explore the Facebook photo and text post sharing option with one-time refill terms and listed quantity limits.'},
            'smm-fb-shr-life':{title:'Facebook Post Shares Lifetime Refill | Stationery Dot Com',description:'Review the Facebook photo and text post sharing option with lifetime refill terms, quantity limits and listed price.'},
            'smm-tg-mem-bot':{title:'Telegram Members Service | Stationery Dot Com',description:'Review the Telegram bot member option, quantity limits, listed price and order requirements before checkout.'},
            'smm-tg-mem-low':{title:'Telegram Members Low Quality | Stationery Dot Com',description:'Review the Telegram low-quality member option, quantity limits and listed pricing before placing an order.'},
            'smm-tg-mem-med':{title:'Telegram Members Medium Quality | Stationery Dot Com',description:'Explore the Telegram medium-quality member option and review quantity limits and listed pricing.'},
            'smm-tg-mem-high':{title:'Telegram Members High Quality | Stationery Dot Com',description:'Review the Telegram high-quality member option, quantity limits and listed price before ordering.'},
            'smm-tg-mem-ultra-life':{title:'Telegram Members Lifetime Refill | Stationery Dot Com',description:'Explore the Telegram member option with lifetime refill terms and review the current quantity and price details.'},
            'smm-ig-fol-real-bot':{title:'Instagram Followers Service | Stationery Dot Com',description:'Review the Instagram follower option and check listed quantity limits, pricing and order requirements.'},
            'smm-ig-fol-old-post':{title:'Instagram Followers from Aged Accounts | Stationery Dot Com',description:'Review the Instagram follower option described as aged accounts with posts, including quantity limits and listed pricing.'},
            'smm-ig-fol-real-hq':{title:'Instagram Followers High Quality | Stationery Dot Com',description:'Explore the Instagram follower option described as high quality and review current quantity limits and listed pricing.'},
            'smm-ig-fol-old-post-r30':{title:'Instagram Followers with 30-Day Refill | Stationery Dot Com',description:'Review the Instagram follower option with aged accounts, posts and 30-day refill terms before ordering.'}
          };
          const custom=serviceSeo[slug];
          page=custom?custom:{title:clean(service.name)+' | '+(clean(service.category)||'Online Service')+' | Stationery Dot Com',description:clean(service.description)||'Order '+clean(service.name)+' online from Stationery Dot Com in Bangladesh. View packages, pricing and service details.'};
        }else page={title:'Service Not Found | Stationery Dot Com',description:'This service page is unavailable. Browse current services from Stationery Dot Com.',noindex:true};
      }
      if(route==='/track-order'&&new URLSearchParams(search).has('token'))page={...page,noindex:true};
      const description=clean(page.description).slice(0,165);
      const canonical=new URL(route,window.location.origin).href;
      const image=new URL(blogPost?.cover_image_url||service?.image_url||'/stationery-dot-com-logo.webp',window.location.origin).href;
      document.documentElement.lang='en';
      document.title=page.title;
      setLink('canonical',canonical);
      setMeta('meta[name="description"]',{name:'description',content:description});
      setMeta('meta[name="keywords"]',{name:'keywords',content:service?[`${clean(service.name)} Bangladesh`,`${clean(service.name)} online`,clean(service.category),'Stationery Dot Com','online services Bangladesh'].filter(Boolean).join(', '):KEYWORDS});
      setMeta('meta[name="robots"]',{name:'robots',content:page.noindex?'noindex,nofollow':'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'});
      setMeta('meta[name="author"]',{name:'author',content:SITE});
      setMeta('meta[property="og:type"]',{property:'og:type',content:'website'});
      setMeta('meta[property="og:locale"]',{property:'og:locale',content:'en_BD'});
      setMeta('meta[property="og:image:alt"]',{property:'og:image:alt',content:service?`${clean(service.name)} — Stationery Dot Com`:'Stationery Dot Com logo'});
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
        {'@type':'Organization','@id':home+'#organization',name:SITE,url:home,logo:image,description:DEFAULT_DESCRIPTION,telephone:['+8801827680520','+8801611103453'],address:{'@type':'PostalAddress',streetAddress:'116, 117, G-Nat Tower (2nd Floor), Fakirapool, VIP Road',addressLocality:'Dhaka',postalCode:'1000',addressCountry:'BD'},contactPoint:[{'@type':'ContactPoint',telephone:'+8801827680520',contactType:'customer support',areaServed:'BD',availableLanguage:['English','Bengali']},{'@type':'ContactPoint',telephone:'+8801611103453',contactType:'customer support',areaServed:'BD',availableLanguage:['English','Bengali']}],sameAs:['https://www.facebook.com/StationeryDotCom2','https://www.tiktok.com/@stationerydotcom','https://www.instagram.com/stationerydotcom','https://www.google.com/maps/place/Stationery+Dot+Com+Dhaka/data=!4m2!3m1!1s0x3755b9b06ac9e28d:0xffb9e0116d51b13a']},
        {'@type':'WebSite','@id':home+'#website',name:SITE,alternateName:['StationeryDotCom','stationerydotcom.me'],url:home,publisher:{'@id':home+'#organization'},potentialAction:{'@type':'SearchAction',target:new URL('/services?q={search_term_string}',window.location.origin).href,'query-input':'required name=search_term_string'}},
        {'@type':'WebPage','@id':canonical+'#webpage',url:canonical,name:page.title,description:description,inLanguage:'en-BD',isPartOf:{'@id':home+'#website'}},
        {'@type':'BreadcrumbList','itemListElement':breadcrumbItems}
      ];
      if(service)graph.push({'@type':'Service','@id':canonical+'#service',name:clean(service.name),serviceType:clean(service.category),description:description,url:canonical,provider:{'@id':home+'#organization'},areaServed:{'@type':'Country',name:'Bangladesh'}});
      if(blogPost)graph.push({'@type':'BlogPosting','@id':canonical+'#article',headline:clean(blogPost.title),description:description,datePublished:blogPost.published_at,image:image,author:{'@type':'Organization','name':clean(blogPost.author)||SITE},publisher:{'@id':home+'#organization'},mainEntityOfPage:{'@id':canonical+'#webpage'},articleSection:clean(blogPost.category)});
      ld.textContent=JSON.stringify({'@context':'https://schema.org','@graph':graph});
    };
    run();
    return()=>{cancelled=true;};
  },[pathname]);
  return null;
}
