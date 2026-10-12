import {useEffect,useState} from 'react';
import {Tag,CheckCircle2,Loader2} from 'lucide-react';
import {supabase,taka} from '../lib/supabase';

export default function CouponBox({subtotal,serviceId,packageId,phone,onApplied}){
  const[code,setCode]=useState('');const[state,setState]=useState(null);const[busy,setBusy]=useState(false);
  useEffect(()=>{setState(null);onApplied?.(null)},[phone,onApplied]);
  async function apply(){
    const value=code.trim().toUpperCase();if(!value)return setState({ok:false,message:'Enter a coupon code.'});
    if(!/^(880|0)?1\\d{9}$/.test(phone.replace(/\\D/g,'')))return setState({ok:false,message:'Enter your valid mobile number before applying this coupon.'});
    setBusy(true);setState(null);
    const{data,error}=await supabase.rpc('validate_coupon',{p_code:value,p_subtotal:Number(subtotal)||0,p_service_id:serviceId,p_package_id:packageId,p_phone:phone});
    setBusy(false);
    if(error||!data?.valid)return setState({ok:false,message:data?.message||error?.message||'Could not validate this coupon.'});
    setState({ok:true,code:data.code,discount:Number(data.discount||0),message:'Coupon applied.'});onApplied?.(data);
  }
  return <div className="coupon-box">
    <div className="coupon-title"><Tag size={16}/><b>Have a coupon?</b></div>
    <div className="coupon-row"><input aria-label="Coupon code" value={code} onChange={e=>{setCode(e.target.value.toUpperCase());setState(null);onApplied?.(null)}} placeholder="Enter coupon code" maxLength={40}/><button type="button" className="btn alt sm" onClick={apply} disabled={busy}>{busy?<Loader2 size={15} className="spin"/>:'Apply'}</button></div>
    {state?.ok?<div className="coupon-success"><CheckCircle2 size={15}/><span>{state.code} applied — save {taka(state.discount)}</span></div>:state?.message&&<div className="coupon-error">{state.message}</div>}
  </div>;
}
