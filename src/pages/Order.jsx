import {useEffect,useState} from 'react';
import {useSearchParams,Link,useNavigate} from 'react-router-dom';
import {supabase,getSettings} from '../lib/supabase';
import {waLink} from '../lib/whatsapp';
import OrderForm from '../components/OrderForm';
import useTitle from '../lib/useTitle';

function QuoteForm({service,pkg}){
  const nav=useNavigate();
  const[f,setF]=useState({customer_name:'',phone:'',whatsapp:'',email:'',notes:''});
  const[busy,setBusy]=useState(false);const[err,setErr]=useState('');
  const set=k=>e=>setF(v=>({...v,[k]:e.target.value}));
  async function submit(e){
    e.preventDefault();setErr('');
    const ph=f.phone.replace(/\D/g,'');
    if(f.customer_name.trim().length<2)return setErr('Enter your name');
    if(!/^(880|0)?1\d{9}$/.test(ph))return setErr('Enter a valid Bangladeshi mobile number (e.g. 01XXXXXXXXX)');
    if(f.email&&!/^\S+@\S+\.\S+$/.test(f.email))return setErr('Email is not valid');
    setBusy(true);
    try{
      const{data,error}=await supabase.rpc('create_order',{p:{...f,quantity:1,package_id:pkg.id,files:[],quote:true}});
      if(error)throw error;
      const msg='Hello, I have submitted a price-on-request order. Order ID: '+data+'. Service: '+service.name+' — '+pkg.name+'. Please confirm the requirements and final price.';
      window.open(waLink(msg),'_blank','noopener,noreferrer');
      nav('/order-success/'+data+'?quote=1');
    }catch(x){setErr(x.message||'Something went wrong. Please try again.');setBusy(false);}
  }
  return <form className="checkout" onSubmit={submit} noValidate>
    <section className="card sec"><h2 className="sech"><span className="num">1</span>Your details</h2>
      <div className="two">
        <label className="fld"><span>Full name *</span><input autoComplete="name" value={f.customer_name} onChange={set('customer_name')}/></label>
        <label className="fld"><span>Mobile number *</span><input autoComplete="tel" inputMode="tel" placeholder="01XXXXXXXXX" value={f.phone} onChange={set('phone')}/></label>
        <label className="fld"><span>WhatsApp number</span><input inputMode="tel" value={f.whatsapp} onChange={set('whatsapp')}/></label>
        <label className="fld"><span>Email (optional)</span><input type="email" autoComplete="email" value={f.email} onChange={set('email')}/></label>
      </div>
    </section>
    <section className="card sec" style={{marginTop:16}}><h2 className="sech"><span className="num">2</span>Requirements</h2>
      <label className="fld"><span>What do you need?</span><textarea rows="5" value={f.notes} onChange={set('notes')} placeholder="Describe your requirements, quantity, deadline, or any important details."/></label>
    </section>
    <aside className="card summary"><h3>Price on request</h3><p className="muted">Submit this request first. We will discuss the requirements on WhatsApp, agree the final price, then collect payment through the website using Bangla QR / bKash / Nagad / bank payment.</p>
      {err&&<p className="err" role="alert">{err}</p>}
      <button className="btn lg block" disabled={busy}>{busy?'Creating order…':'Create order & discuss on WhatsApp'}</button>
      <p className="muted" style={{marginTop:10}}>An Order ID is created immediately so this request is counted on the website.</p>
    </aside>
  </form>;
}

export default function Order(){
  useTitle('Checkout');const[sp]=useSearchParams();const[data,setData]=useState(null);const[status,setStatus]=useState('loading');const[retry,setRetry]=useState(0);const packageId=sp.get('package');
  useEffect(()=>{let cancelled=false;const load=async()=>{setStatus('loading');setData(null);if(!packageId){setStatus('missing');return;}try{const{data:pkg,error:packageError}=await supabase.from('packages').select('*').eq('id',packageId).eq('is_active',true).maybeSingle();if(packageError)throw packageError;if(!pkg){if(!cancelled)setStatus('missing');return;}const{data:service,error:serviceError}=await supabase.from('services').select('*').eq('id',pkg.service_id).eq('is_active',true).maybeSingle();if(serviceError)throw serviceError;if(!service){if(!cancelled)setStatus('missing');return;}const settings=await getSettings();if(!cancelled){setData({pkg,service,settings});setStatus('ready');}}catch{if(!cancelled)setStatus('error');}};load();return()=>{cancelled=true;};},[packageId,retry]);
  if(status==='missing')return <main className="wrap"><div className="card empty"><p>Please select an available service and package first.</p><Link className="btn" to="/services">View Services</Link></div></main>;
  if(status==='error')return <main className="wrap"><section className="card checkout-error" role="alert"><span className="section-overline">CHECKOUT</span><h1>We couldn’t load this package.</h1><p className="muted">Your order hasn’t been placed. Check your connection and try again, or return to services to choose a package.</p><div className="row checkout-error-actions"><button type="button" className="btn" onClick={()=>setRetry(value=>value+1)}>Try again</button><Link className="btn alt" to="/services">Browse services</Link></div></section></main>;
  if(status==='loading'||!data)return <main className="wrap" aria-busy="true" aria-label="Loading checkout"><div className="sk"/></main>;
  if(Number(data.pkg.price)<=0)return <main className="wrap"><nav className="crumbs" aria-label="Breadcrumb"><Link to="/services">Services</Link> / <Link to={'/services/'+data.service.slug}>{data.service.name}</Link> / Order</nav><h1>Request a quote</h1><p className="muted" style={{maxWidth:760}}>No fixed price is published for this package. Submit your details below so we can create an order ID, then continue the price discussion on WhatsApp.</p><QuoteForm service={data.service} pkg={data.pkg}/></main>;
  return <main className="wrap"><nav className="crumbs" aria-label="Breadcrumb"><Link to="/services">Services</Link> / <Link to={'/services/'+data.service.slug}>{data.service.name}</Link> / Checkout</nav><h1>Checkout</h1><OrderForm service={data.service} pkg={data.pkg} settings={data.settings}/></main>;
}
