import {useEffect,useState} from 'react';
import {useSearchParams,Link} from 'react-router-dom';
import {supabase,getSettings} from '../lib/supabase';
import OrderForm from '../components/OrderForm';
import useTitle from '../lib/useTitle';

export default function Order(){
  useTitle('Checkout');
  const[sp]=useSearchParams();
  const[data,setData]=useState(null);
  const[status,setStatus]=useState('loading');
  const[retry,setRetry]=useState(0);
  const packageId=sp.get('package');
  useEffect(()=>{
    let cancelled=false;
    const load=async()=>{
      setStatus('loading');setData(null);
      if(!packageId){setStatus('missing');return;}
      try{
        const{data:pkg,error:packageError}=await supabase.from('packages').select('*').eq('id',packageId).eq('is_active',true).maybeSingle();
        if(packageError)throw packageError;
        if(!pkg){if(!cancelled)setStatus('missing');return;}
        const{data:service,error:serviceError}=await supabase.from('services').select('*').eq('id',pkg.service_id).eq('is_active',true).maybeSingle();
        if(serviceError)throw serviceError;
        if(!service){if(!cancelled)setStatus('missing');return;}
        const settings=await getSettings();
        if(!cancelled){setData({pkg,service,settings});setStatus('ready');}
      }catch{if(!cancelled)setStatus('error');}
    };
    load();
    return()=>{cancelled=true;};
  },[packageId,retry]);
  if(status==='missing')return <main className="wrap"><div className="card empty"><p>Please select an available service and package first.</p><Link className="btn" to="/services">View Services</Link></div></main>;
  if(status==='error')return <main className="wrap"><section className="card checkout-error" role="alert"><span className="section-overline">CHECKOUT</span><h1>We couldn’t load this package.</h1><p className="muted">Your order hasn’t been placed. Check your connection and try again, or return to services to choose a package.</p><div className="row checkout-error-actions"><button type="button" className="btn" onClick={()=>setRetry(value=>value+1)}>Try again</button><Link className="btn alt" to="/services">Browse services</Link></div></section></main>;
  if(status==='loading'||!data)return <main className="wrap" aria-busy="true" aria-label="Loading checkout"><div className="sk"/></main>;
  return <main className="wrap"><nav className="crumbs" aria-label="Breadcrumb"><Link to="/services">Services</Link> / <Link to={'/services/'+data.service.slug}>{data.service.name}</Link> / Checkout</nav><h1>Checkout</h1><OrderForm service={data.service} pkg={data.pkg} settings={data.settings}/></main>;
}
