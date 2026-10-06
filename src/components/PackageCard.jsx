import {Link} from 'react-router-dom';
import {taka} from '../lib/supabase';

import {subscriptionDurationLabel} from '../lib/subscription';
export default function PackageCard({p,service}){
  return <article className="card package-card">
    <div className="package-card-heading"><h3>{p.name}</h3>{p.access_type&&<span className="package-plan-badge">{p.access_type==='shared'?'Shared':'Personal'}</span>}</div>
    <p className="muted package-card-description">{p.description||'A clear, convenient option for this service.'}</p>
    {p.access_type&&<div className="package-plan-details"><span>{p.access_type==='shared'?'Shared access':'Personal access'}</span><span>{subscriptionDurationLabel(p.duration_months)}</span></div>}
    <div className="package-card-price"><span className="price">{taka(p.price)}</span>{!p.access_type&&<span className="muted">{p.unit}</span>}</div>
    {service.requires_file&&<p className="muted package-document-note">Documents required at checkout</p>}
    <Link className="btn block" to={`/order?service=${service.slug}&package=${p.id}`}>Choose this option</Link>
  </article>;
}