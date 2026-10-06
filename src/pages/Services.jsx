import {useEffect,useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {ArrowRight,Search,Sparkles} from 'lucide-react';
import {supabase,getSettings} from '../lib/supabase';
import {categoriesFromServices} from '../data/services';
import {catStyle} from '../components/ServiceCover';
import ServiceCard from '../components/ServiceCard';
import useTitle from '../lib/useTitle';
import {waLink} from '../lib/whatsapp';
import '../catalog.css';

const PAGE_SIZE=9;
const categoryCopy={
  'Document & Government Services':'Online document and application support.',
  'Meta & Social Media Services':'Setup, promotion and social media help.',
  'Creative Services':'Design, video and website work.',
  'Digital Subscriptions':'Digital tools and subscriptions.',
  'SMM Panel Services':'Followers, reactions, views and more by platform.',
};

export default function Services(){
  const[sp,setSp]=useSearchParams();
  const cat=sp.get('category')||'',q=sp.get('q')||'';
  const[list,setList]=useState(null),[err,setErr]=useState(false),[s,setS]=useState({}),[visibleCount,setVisibleCount]=useState(PAGE_SIZE);
  useTitle(s.catalog_title||'Services',s.catalog_intro||'Browse our services and packages.');
  useEffect(()=>{
    getSettings().then(setS).catch(()=>{});
    supabase.from('services').select('*,packages(price,is_active)').eq('is_active',true).order('sort_order').then(r=>{if(r.error)setErr(true);setList(r.data||[]);});
  },[]);
  useEffect(()=>setVisibleCount(PAGE_SIZE),[cat,q]);
  const categoryList=list?categoriesFromServices(list):[];
  const upd=(k,v)=>{const n=new URLSearchParams(sp);v?n.set(k,v):n.delete(k);setSp(n,{replace:true});};
  const shown=(list||[]).filter(x=>(!cat||x.category===cat)&&(!q||(x.name+' '+(x.description||'')+' '+(x.smm_platform||'')+' '+(x.smm_category||'')).toLowerCase().includes(q.toLowerCase())));
  const showCategories=!cat&&!q;
  return <>
    <div className="pagehead catalog-head"><div className="wrap">
      <span className="section-overline">STATIONERY DOT COM</span>
      <h1>{cat||s.catalog_title||'Services'}</h1>
      <p className="muted catalog-intro">{s.catalog_intro||'Choose a service area to explore clear options and prices.'}</p>
      <div className="search catalog-search"><Search size={18}/><input aria-label="Search services" placeholder="Search services, platform or type" value={q} onChange={e=>upd('q',e.target.value)}/></div>
      {list?.length>0&&<div className="chips catalog-chips" role="group" aria-label="Service categories"><button className="chip" aria-pressed={!cat} onClick={()=>upd('category','')}>All categories</button>{categoryList.map(c=><button key={c.name} className="chip" aria-pressed={cat===c.name} onClick={()=>upd('category',c.name)}>{c.name}</button>)}</div>}
    </div></div>
    <main className="wrap catalog-main">
      {err?<div className="card empty" role="alert">Could not load services. Please refresh the page or contact us for help.</div>
      :list===null?<div className="grid">{[1,2,3,4,5,6].map(i=><div className="sk" style={{height:300}} key={i}/>)}</div>
      :showCategories?<section className="catalog-category-grid" aria-label="Browse service categories">{categoryList.map((c,i)=>{const style=catStyle(c.name),Icon=style.I;return <button type="button" className="catalog-category-card" key={c.name} onClick={()=>upd('category',c.name)}><span className="catalog-category-icon"><Icon size={21}/></span><span className="catalog-category-count">{c.items.length} services</span><h2>{c.name}</h2><p>{categoryCopy[c.name]||'Explore available services and order online.'}</p><span className="catalog-category-link">Explore category <ArrowRight size={15}/></span></button>;})}</section>
      :shown.length===0?<div className="card empty catalogue-empty"><span className="account-icon"><Sparkles size={20}/></span><h2>{q||cat?'No matching services yet':'We are preparing our service list.'}</h2><p>{q||cat?'Try another search or ask us about the service you need.':'New services will show here once they are available. Need something specific? Our team can help.'}</p><a className="btn wa" href={waLink('Hello, I would like to ask about available services')}>Ask us on WhatsApp</a></div>
      :<><div className="catalog-results-head"><div><span className="section-overline">{cat==='SMM Panel Services'?'SOCIAL MEDIA SERVICES':'AVAILABLE ONLINE'}</span><h2>{q?'Search results':cat||'Services'}</h2></div><span className="catalog-results-count">{shown.length} {shown.length===1?'service':'services'}</span></div><div className="grid catalog-service-grid">{shown.slice(0,visibleCount).map(x=><ServiceCard key={x.id} s={x}/>)}</div>{shown.length>visibleCount&&<div className="catalog-more"><button type="button" className="btn alt" onClick={()=>setVisibleCount(n=>n+PAGE_SIZE)}>Show more services <ArrowRight size={16}/></button><span>Showing {Math.min(visibleCount,shown.length)} of {shown.length}</span></div>}</>}
    </main>
  </>;
}
