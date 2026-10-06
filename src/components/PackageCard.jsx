import {Link} from 'react-router-dom';
import {taka} from '../lib/supabase';
import {waLink} from '../lib/whatsapp';
import {subscriptionDurationLabel} from '../lib/subscription';
export default function PackageCard({p,service}){
  const quoted=Number(p.price)<=0;
  const image=p.image_url||service?.image_url;
  return <article className="card package-card">
    {image&&<img className="package-card-image" src={image} alt={p.name}/>} 
    <div className="package-card-heading"><h3>{p.name}</h3>{p.access_type&&<span className="package-plan-badge">{p.access_type==='shared'?'Shared':'Personal'}</span>}</div>
    <p className="muted package-card-description">{p.description||'A clear, convenient option for this service.'}</p>
    {p.access_type&&<div className="package-plan-details"><span>{p.access_type==='shared'?'Shared access':'Personal access'}</span><span>{subscriptionDurationLabel(p.duration_months)}</span></div>}
    <div className="package-card-price">{quoted?<><span className="price">Price on request</span><span className="muted">Final price agreed with our team</span></>:<><span className="price">{taka(p.price)}</span>{!p.access_type&&<span className="muted">{p.unit}</span>}</>}</div>
    {service.requires_file&&<p className="muted package-document-note">Documents required at checkout</p>}
    {quoted?<a className="btn wa block" href={waLink('Hello, I want to order '+service.name+' - '+p.name+'. Please confirm the requirements and final price.')} target="_blank" rel="noreferrer">Discuss &amp; order on WhatsApp</a>:<Link className="btn block" to={'/order?service='+service.slug+'&package='+p.id}>Choose this option</Link>}
  </article>;
}