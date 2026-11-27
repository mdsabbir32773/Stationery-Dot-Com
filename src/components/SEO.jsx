import {useEffect} from 'react';
import {useLocation} from 'react-router-dom';

const SITE='Stationery Dot Com';
const DEFAULT_DESCRIPTION='Stationery Dot Com is a fully online service platform serving customers across Bangladesh for digital subscriptions, social media services, Meta ads support, document assistance and creative design.';
const KEYWORDS='Stationery Dot Com, online services Bangladesh, digital services Bangladesh, document services Bangladesh, government document service Bangladesh, NID service Bangladesh, passport service Bangladesh, birth certificate service Bangladesh, Meta ads Bangladesh, Facebook ads service Bangladesh, social media marketing Bangladesh, SMM panel Bangladesh, Instagram growth Bangladesh, digital subscriptions Bangladesh, Canva Pro Bangladesh, ChatGPT Plus Bangladesh, graphic design Bangladesh, web design Bangladesh, video editing Bangladesh';

const BLOG_SEO_TITLES={
  'tiktok-likes-views-followers-bangladesh-guide':'TikTok Engagement Services: Platform Rules & Account Safety | Stationery Dot Com',

  'personal-vs-shared-digital-subscription-guide':'Personal নাকি Shared Subscription? ৬টি বিষয় | SDC',
  'smm-panel-bangladesh-order-checklist':'SMM Panel বাছাইয়ের আগে ৮টি বিষয় | SDC',
  'nid-correction-preparation-checklist':'NID সংশোধনের আগে ৭টি প্রস্তুতি | SDC',
  'design-video-editing-order-brief-checklist':'ডিজাইন বা Video Editing Brief: ৭টি তথ্য | SDC',
  'online-service-checklist':'অনলাইন সার্ভিস নেওয়ার আগে ৫টি বিষয় | SDC',
  'facebook-page-growth-quality':'ফেসবুক পেজের Growth: শুধু সংখ্যা নয় | SDC',
  'video-editing-footage-preparation-checklist':'ভিডিও এডিটিংয়ের ফুটেজ প্রস্তুতি: চেকলিস্ট | SDC',
  'bd-e-passport-application-enrollment-checklist':'ই-পাসপোর্ট আবেদন চেকলিস্ট | Stationery Dot Com',
  'trade-license-renewal-bangladesh-checklist':'Trade License Renewal Checklist BD | Stationery Dot Com'
};

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
        '/':{title:'Stationery Dot Com | Subscriptions & Followers BD',description:'Stationery Dot offers digital subscriptions in Bangladesh, Facebook and Instagram services, SMM panel services, Meta ads, document assistance and creative services.'},
        '/about':{title:'About Stationery Dot Com | Online Services Bangladesh',description:'Learn about Stationery Dot Com, a fully online service platform for digital subscriptions, SMM, Meta support, document assistance and creative services.'},
        '/refund-policy':{title:'Refund & Cancellation Policy | Stationery Dot Com',description:'Understand how Stationery Dot Com reviews order cancellation and refund requests.'},
        '/delivery-policy':{title:'Service Delivery Policy | Stationery Dot Com',description:'Learn how Stationery Dot Com reviews orders and handles online service delivery.'},
        '/services':{title:'Online Services in Bangladesh | Stationery Dot Com',description:'Explore document and government services, Meta and social media marketing, SMM panel, digital subscriptions, graphic design, web design and video services.'},
        '/digital-subscriptions':{title:'Digital Subscriptions Bangladesh | Stationery Dot Com',description:'Compare available digital subscription services in Bangladesh. Review package duration, access method, pricing and support terms before ordering.'},
        '/document-services':{title:'Online Document Services Bangladesh | Stationery Dot Com',description:'Explore birth certificate, NID, passport and trade license application assistance in Bangladesh. Review requirements and service terms before ordering.'},
        '/meta-services':{title:'Meta Ads & Page Services Bangladesh | Stationery Dot Com',description:'Explore Facebook page setup, Meta ads support and social media page management in Bangladesh. Review campaign scope and package terms.'},
        '/creative-services':{title:'Graphic Design & Video Editing BD | Stationery Dot Com',description:'Explore graphic design, video editing and web design services in Bangladesh. Compare package scope, deliverables and revision terms.'},
        '/smm':{title:'SMM Panel Bangladesh | Stationery Dot Com',description:'Compare Facebook followers, reactions, views, comments, shares, Instagram and Telegram services with clear rates and refill terms at Stationery Dot Com.'},
        '/track-order':{title:'Track Order Online | Stationery Dot Com',description:'Track your Stationery Dot Com order using your Order ID and see the latest order status.'},
        '/invoice':{title:'Invoice | Stationery Dot Com',description:'View your Stationery Dot Com order invoice.',noindex:true},
        '/contact':{title:'Contact Stationery Dot Com | Online Support Bangladesh',description:'Contact Stationery Dot Com online for digital subscriptions, SMM, Meta advertising, document support and creative services. Call or message our team.'},
        '/help':{title:'Help Center | Stationery Dot Com',description:'Find answers about ordering, payments, wallet deposits, delivery, documents and customer support at Stationery Dot Com.'},
        '/blog':{title:'Stationery Dot Com Blog | Online Service Guides',description:'Practical Bangladesh-focused guides about digital subscriptions, Facebook marketing, SMM, online services, documents and creative work.'},
        '/privacy-policy':{title:'Privacy Policy | Stationery Dot Com',description:'Read the Stationery Dot Com privacy policy and learn how customer information is handled.'},
        '/terms-of-service':{title:'Terms of Service | Stationery Dot Com',description:'Read the Stationery Dot Com terms of service for online orders and digital services.'},
        '/account':{title:'My Account | Stationery Dot Com',description:'Manage your Stationery Dot Com profile, orders and reviews.',noindex:true},
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
        const {publicRows}=await import('../lib/publicData');
        const slug=decodeURIComponent(route.slice('/blog/'.length));
        const {data}=await publicRows('blog_posts',{select:'id,title,slug,excerpt,category,cover_image_url,author,published_at,reading_minutes',slug:'eq.'+slug,status:'eq.published',and:'(published_at.not.is.null,published_at.lte.'+new Date().toISOString()+')',limit:'1'});
        if(cancelled)return;
        blogPost=data?.[0]||null;
        page=blogPost?{title:BLOG_SEO_TITLES[slug]||`${clean(blogPost.title)} | SDC Blog`,description:clean(blogPost.excerpt)||`Read ${clean(blogPost.title)} on the Stationery Dot Com blog.`,image:blogPost.cover_image_url}:{title:'Article Not Found | Stationery Dot Com Blog',description:'This article is unavailable.',noindex:true};
      }
      if(route.startsWith('/services/')){
        const {publicRows}=await import('../lib/publicData');
        const slug=decodeURIComponent(route.slice('/services/'.length));
        const {data}=await publicRows('services',{select:'id,name,slug,category,description,image_url,is_active',slug:'eq.'+slug,is_active:'eq.true',limit:'1'});
        if(cancelled)return;
        service=data?.[0]||null;
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
            'birth-certificate':{title:'Birth Certificate Service Bangladesh | Stationery Dot Com',description:'Get online assistance with birth certificate application and correction requests in Bangladesh. Requirements and eligibility are reviewed case by case.'},
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
            'smm-fb-reviews-genuine':{title:'Facebook Reviews Service Bangladesh | Stationery Dot Com',description:'Review the Facebook review service details, quantity limits, listed price and order requirements before placing an order.'},
            'smm-fb-views-nr':{title:'Facebook Video & Reels Views | Stationery Dot Com',description:'Review the Facebook video and Reels views option, quantity limits, listed price and no-refill terms.'},
            'smm-fb-views-r1':{title:'Facebook Video/Reels Views & Refill | Stationery Dot Com',description:'Explore the Facebook video and Reels views option with one-time refill terms, quantity limits and listed pricing.'},
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
          if(slug.startsWith('smm-tiktok-'))page.noindex=true;
        }else page={title:'Service Not Found | Stationery Dot Com',description:'This service page is unavailable. Browse current services from Stationery Dot Com.',noindex:true};
      }
      if(route==='/track-order'&&new URLSearchParams(search).has('token'))page={...page,noindex:true};
      const description=clean(page.description).slice(0,165);
      const canonical=new URL(route,window.location.origin).href;
      const serviceImage=service?.image_url||'';
      const usableServiceImage=/google\.com\/s2\/favicons/i.test(serviceImage)?'':serviceImage;
      const image=new URL(blogPost?.cover_image_url||usableServiceImage||'/stationery-dot-com-logo.webp',window.location.origin).href;
      document.documentElement.lang=/[\u0980-\u09FF]/.test(page.title+' '+description)?'bn-BD':'en-BD';
      document.title=page.title;
      setLink('canonical',canonical);
      setMeta('meta[name="description"]',{name:'description',content:description});
      setMeta('meta[name="keywords"]',{name:'keywords',content:service?[`${clean(service.name)} Bangladesh`,`${clean(service.name)} online`,clean(service.category),'Stationery Dot Com','online services Bangladesh'].filter(Boolean).join(', '):KEYWORDS});
      setMeta('meta[name="robots"]',{name:'robots',content:page.noindex?'noindex,nofollow':'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'});
      setMeta('meta[name="author"]',{name:'author',content:SITE});
      setMeta('meta[property="og:type"]',{property:'og:type',content:blogPost?'article':'website'});
      document.head.querySelectorAll('meta[property^="article:"]').forEach(el=>el.remove());
      if(blogPost){
        setMeta('meta[property="article:published_time"]',{property:'article:published_time',content:blogPost.published_at});
        setMeta('meta[property="article:author"]',{property:'article:author',content:clean(blogPost.author)||SITE});
        if(blogPost.category)setMeta('meta[property="article:section"]',{property:'article:section',content:clean(blogPost.category)});
      }
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
        {'@type':'Organization','@id':home+'#organization',name:SITE,url:home,logo:new URL('/stationery-dot-com-logo.webp',window.location.origin).href,description:DEFAULT_DESCRIPTION,telephone:['+8801827680520','+8801611103453'],contactPoint:[{'@type':'ContactPoint',telephone:'+8801827680520',contactType:'customer support',areaServed:'BD',availableLanguage:['English','Bengali']},{'@type':'ContactPoint',telephone:'+8801611103453',contactType:'customer support',areaServed:'BD',availableLanguage:['English','Bengali']}],sameAs:['https://www.facebook.com/StationeryDotCom2','https://www.tiktok.com/@stationerydotcom','https://www.instagram.com/stationerydotcom'],areaServed:{'@type':'Country',name:'Bangladesh'},knowsAbout:['Digital subscriptions in Bangladesh','Social media marketing services','TikTok platform policy and account safety','Meta advertising support','Online document application assistance','Graphic design','Video editing','Website design and development']}
      ];
      if(route==='/')graph.push({'@type':'WebSite','@id':home+'#website',name:SITE,alternateName:['Stationery Dot Com Dhaka','StationeryDotCom','stationerydotcom.me'],url:home,publisher:{'@id':home+'#organization'},potentialAction:{'@type':'SearchAction',target:new URL('/services?q={search_term_string}',window.location.origin).href,'query-input':'required name=search_term_string'}});
      const webPage={'@type':'WebPage','@id':canonical+'#webpage',url:canonical,name:page.title,description:description,inLanguage:'en-BD'};
      if(route==='/')webPage.isPartOf={'@id':home+'#website'};
      graph.push(webPage);
      if(route==='/')graph.push({'@type':'FAQPage','@id':home+'#faq',mainEntity:[{'@type':'Question',name:'What is Stationery Dot Com?',acceptedAnswer:{'@type':'Answer',text:'Stationery Dot Com is a fully online service platform serving customers across Bangladesh, with digital subscriptions, social media services, Meta advertising support, document assistance and creative services.'}},{'@type':'Question',name:'Do I need to visit an office?',acceptedAnswer:{'@type':'Answer',text:'No. Stationery Dot Com is fully online. Orders and customer support are handled remotely; no walk-in or office-visit service is offered.'}},{'@type':'Question',name:'Where can I check current prices and service terms?',acceptedAnswer:{'@type':'Answer',text:'Use the live service catalogue and the individual service detail page. Availability, prices, quantity limits, delivery estimates and refill terms can change.'}},{'@type':'Question',name:'Does a social media service guarantee viral reach or sales?',acceptedAnswer:{'@type':'Answer',text:'No. No service guarantees viral reach, organic growth, engagement, retention, sales or conversion. Content quality, audience relevance and platform rules matter.'}},{'@type':'Question',name:'Does Stationery Dot Com approve government applications?',acceptedAnswer:{'@type':'Answer',text:'No. Stationery Dot Com provides online assistance only. Eligibility, fees, processing, appointments and approvals are controlled by the relevant government authority.'}},{'@type':'Question',name:'How do I get help with an existing order?',acceptedAnswer:{'@type':'Answer',text:'Use the order tracking page or contact online support. Include your order ID when asking about an existing order, and never send passwords or one-time verification codes.'}}]});
      graph.push({'@type':'BreadcrumbList','itemListElement':breadcrumbItems});
      if(service)graph.push({'@type':'Service','@id':canonical+'#service',name:clean(service.name),serviceType:clean(service.category),description:description,url:canonical,provider:{'@id':home+'#organization'},areaServed:{'@type':'Country',name:'Bangladesh'}});
      if(blogPost)graph.push({'@type':'BlogPosting','@id':canonical+'#article',headline:clean(blogPost.title),description:description,datePublished:blogPost.published_at,image:image,author:{'@type':'Organization','name':clean(blogPost.author)||SITE},publisher:{'@id':home+'#organization'},mainEntityOfPage:{'@id':canonical+'#webpage'},articleSection:clean(blogPost.category)});
      ld.textContent=JSON.stringify({'@context':'https://schema.org','@graph':graph});
    };
    run();
    return()=>{cancelled=true;};
  },[pathname,search]);
  return null;
}
