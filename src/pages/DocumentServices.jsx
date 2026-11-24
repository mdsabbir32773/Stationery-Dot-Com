import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowRight,ShieldCheck} from 'lucide-react';
import {supabase} from '../lib/supabase';
import ServiceCard from '../components/ServiceCard';
import '../catalog.css';

export default function DocumentServices(){
  const [services,setServices]=useState(null);
  const [error,setError]=useState(false);

  useEffect(()=>{
    let live=true;
    (async()=>{
      const {data,error:serviceError}=await supabase
        .from('services')
        .select('id,category,name,slug,description,requires_file,is_popular,is_active,sort_order,image_url')
        .eq('is_active',true)
        .eq('category','Document & Government Services')
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
      if(!live)return;
      const byService={};
      for(const p of packages)(byService[p.service_id]||(byService[p.service_id]=[])).push(p);
      setServices(rows.map(x=>({...x,order_count:0,packages:byService[x.id]||[]})));
    })();
    return()=>{live=false;};
  },[]);

  return <main className="document-services-page">
    <section className="pagehead catalog-head">
      <div className="wrap">
        <span className="section-overline">STATIONERY DOT COM · BANGLADESH</span>
        <h1>Online Document Services in Bangladesh</h1>
        <p className="muted catalog-intro">Explore online assistance for selected birth certificate, NID, passport and trade license requests. Review the service details and application requirements before ordering.</p>
        <Link className="btn sm" to="/services?category=Document%20%26%20Government%20Services">Browse all services <ArrowRight size={15}/></Link>
      </div>
    </section>

    <section className="wrap catalog-main" aria-labelledby="document-services-title">
      <div className="catalog-results-head">
        <div>
          <span className="section-overline">AVAILABLE SUPPORT</span>
          <h2 id="document-services-title">Choose a document service</h2>
        </div>
        <span className="catalog-results-count">{services===null?'Loading…':services.length+' services'}</span>
      </div>
      {error?<div className="card empty" role="alert">Document services could not be loaded. Please refresh or contact our team.</div>
      :services===null?<div className="grid">{[1,2,3,4].map(n=><div className="sk" style={{height:300}} key={n}/>)}</div>
      :services.length?<div className="grid catalog-service-grid">{services.map(s=><ServiceCard key={s.id} s={s}/>)}</div>
      :<div className="card empty"><h2>No document services are currently listed</h2><p>Check the main services catalogue or contact our team for current availability.</p><Link className="btn" to="/services">View services <ArrowRight size={16}/></Link></div>}
    </section>

    <section className="wrap catalog-main document-guide">
      <div className="card">
        <span className="section-overline">BEFORE YOU APPLY</span>
        <h2>Prepare carefully before placing a document request</h2>
        <ul>
          <li><b>Choose the correct request:</b> new application, correction, renewal or another request may have different requirements.</li>
          <li><b>Check your information:</b> make sure names, dates, addresses and other details match the supporting documents you provide.</li>
          <li><b>Review required documents:</b> requirements depend on the document type, application reason and issuing authority.</li>
          <li><b>Understand the fees:</b> check the listed package and confirm which official fees and service charges are included before payment.</li>
          <li><b>Keep your order reference:</b> save the Order ID and use your account or order tracking to follow the request.</li>
        </ul>
        <p className="muted">Stationery Dot Com is an independent online assistance provider, not a government office. Final approval and processing decisions are made by the relevant authority. No approval or completion time can be guaranteed.</p>
      </div>
      <div className="card document-trust">
        <ShieldCheck size={22}/>
        <div>
          <h2>Handle personal documents carefully</h2>
          <p>Submit only the information requested for your selected service. Never share account passwords, OTPs or recovery codes. Use the website's order flow for document uploads.</p>
          <Link to="/help">Visit the Help Center <ArrowRight size={15}/></Link>
        </div>
      </div>
    </section>

    <section className="wrap catalog-main document-faqs">
      <span className="section-overline">COMMON QUESTIONS</span>
      <h2>Document service FAQs</h2>
      <details><summary>Can Stationery Dot Com guarantee government approval?</summary><p>No. We provide independent application assistance. The relevant government authority makes the final decision, and approval is not guaranteed.</p></details>
      <details><summary>Which documents will I need?</summary><p>Required documents vary by application type and individual case. Review the selected service page and confirm the current official requirements before submitting.</p></details>
      <details><summary>Are government fees included in the package price?</summary><p>Do not assume all fees are included. Check the package description and confirm any official fee or additional charge with our team before payment.</p></details>
      <details><summary>How can I track my request?</summary><p>Keep your Order ID and check the order status from your Stationery Dot Com account or the order tracking page.</p></details>
      <Link to="/contact" className="btn alt">Contact Stationery Dot Com <ArrowRight size={16}/></Link>
    </section>
  </main>;
}
