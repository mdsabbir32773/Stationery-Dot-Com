import {Link} from 'react-router-dom';
import {ArrowRight,Globe2} from 'lucide-react';
import {taka} from '../lib/supabase';
import ServiceCover from './ServiceCover';

export default function ServiceCard({s}){
  const ps=(s.packages||[]).filter(p=>p.is_active).map(p=>Number(p.price));
  const min=ps.length?Math.min(...ps):null;
  const isSmm=Boolean(s.smm_platform||s.category==='SMM Panel Services');
  const perThousand=Number(s.smm_price_per_1000||0);
  const orderPath=isSmm?`/smm?service=${encodeURIComponent(s.id)}`:`/services/${s.slug}`;
  return <article className={`scard${isSmm?' scard-smm':''}`}>
    <Link to={`/services/${s.slug}`} aria-label={s.name}><ServiceCover s={s}/></Link>
    <div className="sbody">
      <div className="service-card-kicker">{isSmm?s.smm_platform:s.category}</div>
      <h3><Link to={`/services/${s.slug}`}>{s.name}</Link></h3>
      {isSmm&&<div className="service-card-tags"><span>{s.smm_category||'Social service'}</span><span><Globe2 size={12}/>{s.smm_country||'Worldwide'}</span></div>}
      <p className="muted sdesc">{s.description||'Choose a package and order online.'}</p>
      <div className="sfoot"><div>{isSmm&&perThousand>0?<><div className="muted service-price-caption">Price per 1,000</div><b className="price">{taka(perThousand)}</b><div className="muted service-price-caption">Min. {Number(s.smm_min_quantity||0).toLocaleString()} · Max. {Number(s.smm_max_quantity||0).toLocaleString()}</div></>:min!==null?<><div className="muted service-price-caption">Starting from</div><b className="price">{taka(min)}</b><div className="muted service-price-caption">{ps.length?`${ps.length} package${ps.length>1?'s':''}`:''}</div></>:<span className="muted">Price on request</span>}</div><Link className="btn sm" to={orderPath}>{isSmm?'Order now':'View service'} <ArrowRight size={15}/></Link></div>
    </div>
  </article>;
}
