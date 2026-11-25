import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowRight,ShieldCheck} from 'lucide-react';

import ServiceCard from '../components/ServiceCard';
import '../catalog.css';

export default function DigitalSubscriptions(){
  const [services,setServices]=useState(null);
  const [error,setError]=useState(false);
  const [retry,setRetry]=useState(0);

  useEffect(()=>{
    let live=true;
    setError(false);setServices(null);
    (async()=>{
      const {supabase}=await import('../lib/supabase');
      const {data,error:serviceError}=await supabase
        .from('services')
        .select('id,category,name,slug,description,requires_file,is_popular,is_active,sort_order,image_url')
        .eq('is_active',true)
        .eq('category','Digital Subscriptions')
        .order('sort_order');
      if(!live)return;
      if(serviceError){setError(true);setServices([]);return;}
      const rows=data||[];
      const ids=rows.map(x=>x.id);
      let packages=[];
      if(ids.length){
        const result=await supabase.from('packages')
          .select('id,service_id,name,price,is_active,sort_order')
          .in('service_id',ids).eq('is_active',true).order('sort_order');
        if(!result.error)packages=result.data||[];
      }
      const byService={};
      for(const p of packages)(byService[p.service_id]||(byService[p.service_id]=[])).push(p);
      setServices(rows.map(x=>({...x,order_count:0,packages:byService[x.id]||[]})));
    })().catch(()=>{if(live){setError(true);setServices([]);}});
    return()=>{live=false;};
  },[retry]);

  return <main className="digital-subscriptions-page">
    <section className="pagehead catalog-head">
      <div className="wrap">
        <span className="section-overline">STATIONERY DOT COM · BANGLADESH</span>
        <h1>Digital Subscriptions in Bangladesh</h1>
        <p className="muted catalog-intro">Explore currently listed digital subscription services. Compare available durations, package prices, access details and support terms before you order.</p>
        <Link className="btn sm" to="/services?category=Digital%20Subscriptions">Browse all services <ArrowRight size={15}/></Link>
      </div>
    </section>

    <section className="wrap catalog-main" aria-labelledby="subscription-services-title">
      <div className="catalog-results-head">
        <div>
          <span className="section-overline">AVAILABLE PACKAGES</span>
          <h2 id="subscription-services-title">Choose a subscription</h2>
        </div>
        <span className="catalog-results-count">{services===null?'Loading…':services.length+' services'}</span>
      </div>
      {error?<div className="card empty" role="alert"><h2>Subscription services could not be loaded</h2><p>Please check your connection and try again.</p><button type="button" className="btn" onClick={()=>setRetry(v=>v+1)}>Try again</button><Link className="text-link" to="/contact">Contact our team</Link></div>
      :services===null?<div className="grid">{[1,2,3].map(n=><div className="sk" style={{height:300}} key={n}/>)}</div>
      :services.length?<div className="grid catalog-service-grid">{services.map((s,i)=><ServiceCard key={s.id} s={s} priority={i===0}/>)}</div>
      :<div className="card empty"><h2>No subscription packages are currently listed</h2><p>Check the main services catalogue or contact our team for current availability.</p><Link className="btn" to="/services">View services <ArrowRight size={16}/></Link></div>}
    </section>

    <section className="wrap catalog-main subscription-guide">
      <div className="card">
        <span className="section-overline">BEFORE YOU ORDER</span>
        <h2>What to compare before choosing a digital subscription</h2>
        <ul>
          <li><b>Duration:</b> confirm the exact number of days or months included in the selected package.</li>
          <li><b>Access method:</b> check whether the package is personal, team-based or shared, and read its device and login conditions.</li>
          <li><b>Activation:</b> review what information is required and the delivery estimate shown on the service page.</li>
          <li><b>Support terms:</b> read the stated warranty, replacement, cancellation and support conditions before payment.</li>
          <li><b>Final price:</b> the selected package and checkout page show the amount payable; confirm it before placing the order.</li>
        </ul>
        <p className="muted">Access methods and terms can differ between services and packages. Do not assume every subscription uses the same account or activation method.</p>
      </div>
      <div className="card subscription-trust">
        <ShieldCheck size={22}/>
        <div>
          <h2>Clear details before checkout</h2>
          <p>Stationery Dot Com is an independent online service provider. Review the package-specific details and contact our team if anything is unclear.</p>
          <Link to="/help">Visit the Help Center <ArrowRight size={15}/></Link>
        </div>
      </div>
    </section>

    <section className="wrap catalog-main subscription-faqs">
      <span className="section-overline">COMMON QUESTIONS</span>
      <h2>Digital subscription FAQs</h2>
      <details><summary>Are all subscription packages personal accounts?</summary><p>No. Access methods can vary by service and package. Check the access type and account conditions on the selected service page before ordering.</p></details>
      <details><summary>How do I see the current price?</summary><p>Open a service, choose the package and review its displayed price. The checkout amount is the amount to confirm before payment.</p></details>
      <details><summary>How long does activation take?</summary><p>Delivery estimates and activation instructions vary. Review the service details and any delivery estimate shown before placing an order.</p></details>
      <details><summary>Where can I get help before ordering?</summary><p>Contact Stationery Dot Com through the Contact page or check the Help Center if you need clarification about a package.</p></details>
      <Link to="/contact" className="btn alt">Contact Stationery Dot Com <ArrowRight size={16}/></Link>
    </section>
  </main>;
}
