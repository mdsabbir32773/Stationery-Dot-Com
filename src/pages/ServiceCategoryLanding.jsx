import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowRight,ShieldCheck} from 'lucide-react';
import {publicRows} from '../lib/publicData';
import ServiceCard from '../components/ServiceCard';
import '../catalog.css';

export default function ServiceCategoryLanding({category,title,intro,guideTitle,guideItems,guideNote,faqs}){
  const [services,setServices]=useState(null);
  const [error,setError]=useState(false);
  const [retry,setRetry]=useState(0);

  useEffect(()=>{
    let live=true;
    setError(false);setServices(null);
    (async()=>{
      const {data,error:serviceError}=await publicRows('services',{select:'id,category,name,slug,description,requires_file,is_popular,is_active,sort_order,image_url',is_active:'eq.true',category:'eq.'+category,order:'sort_order.asc'});
      if(!live)return;
      if(serviceError){setError(true);setServices([]);return;}
      const rows=data||[];
      const ids=rows.map(x=>x.id);
      let packages=[];
      if(ids.length){
        const result=await publicRows('packages',{select:'id,service_id,name,price,is_active,sort_order',service_id:'in.('+ids.join(',')+')',is_active:'eq.true',order:'sort_order.asc'});
        if(!result.error)packages=result.data||[];
      }
      if(!live)return;
      const byService={};
      for(const p of packages)(byService[p.service_id]||(byService[p.service_id]=[])).push(p);
      setServices(rows.map(x=>({...x,order_count:0,packages:byService[x.id]||[]})));
    })().catch(()=>{if(live){setError(true);setServices([]);}});
    return()=>{live=false;};
  },[category,retry]);

  return <main className="category-landing-page">
    <section className="pagehead catalog-head">
      <div className="wrap">
        <span className="section-overline">STATIONERY DOT COM · BANGLADESH</span>
        <h1>{title}</h1>
        <p className="muted catalog-intro">{intro}</p>
        <Link className="btn sm" to={'/services?category='+encodeURIComponent(category)}>Browse all services <ArrowRight size={15}/></Link>
      </div>
    </section>

    <section className="wrap catalog-main" aria-label={category+' catalogue'}>
      <div className="catalog-results-head">
        <div>
          <span className="section-overline">AVAILABLE SERVICES</span>
          <h2>Explore {category.toLowerCase()}</h2>
        </div>
        <span className="catalog-results-count">{services===null?'Loading…':services.length+' services'}</span>
      </div>
      {error?<div className="card empty" role="alert"><h2>Services could not be loaded</h2><p>Please check your connection and try again.</p><button type="button" className="btn" onClick={()=>setRetry(v=>v+1)}>Try again</button><Link className="text-link" to="/contact">Contact our team</Link></div>
      :services===null?<div className="grid">{[1,2,3].map(n=><div className="sk" style={{height:300}} key={n}/>)}</div>
      :services.length?<div className="grid catalog-service-grid">{services.map((s,i)=><ServiceCard key={s.id} s={s} priority={i===services.findIndex(x=>x.image_url)}/>)}</div>
      :<div className="card empty"><h2>No services are currently listed in this category</h2><p>Check the main services catalogue or contact our team for current availability.</p><Link className="btn" to="/services">View services <ArrowRight size={16}/></Link></div>}
    </section>

    <section className="wrap catalog-main category-guide">
      <div className="card">
        <span className="section-overline">BEFORE YOU ORDER</span>
        <h2>{guideTitle}</h2>
        <ul>{guideItems.map((item,i)=><li key={i}><b>{item.label}</b> {item.text}</li>)}</ul>
        <p className="muted">{guideNote}</p>
      </div>
      <div className="card category-trust">
        <ShieldCheck size={22}/>
        <div>
          <h2>Clear scope and service terms</h2>
          <p>Stationery Dot Com is an independent online service provider. Review each service page and confirm the package scope before checkout.</p>
          <Link to="/help">Visit the Help Center <ArrowRight size={15}/></Link>
        </div>
      </div>
    </section>

    <section className="wrap catalog-main category-faqs">
      <span className="section-overline">COMMON QUESTIONS</span>
      <h2>{category} FAQs</h2>
      {faqs.map((item,i)=><details key={i}><summary>{item.question}</summary><p>{item.answer}</p></details>)}
      <Link to="/contact" className="btn alt">Contact Stationery Dot Com <ArrowRight size={16}/></Link>
    </section>
  </main>;
}
