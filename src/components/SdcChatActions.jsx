import {useEffect,useMemo,useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowRight,CheckCircle2,Loader2,WalletCards} from 'lucide-react';
import {supabase,taka} from '../lib/supabase';
import PaymentQR from './PaymentQR';

const PHONE=/^(880|0)?1[0-9]{9}$/;
const proofTypes=['image/jpeg','image/png','image/webp'];
const docTypes=['image/jpeg','image/png','image/webp','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const extOf=f=>f.name.split('.').pop().toLowerCase();

export default function SdcChatActions({mode,onCancel,onComplete}){
 const[services,setServices]=useState([]),[packages,setPackages]=useState([]),[settings,setSettings]=useState({});
 const[session,setSession]=useState(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState(''),[successLink,setSuccessLink]=useState(null);
 const[serviceId,setServiceId]=useState(''),[packageId,setPackageId]=useState(''),[name,setName]=useState(''),[phone,setPhone]=useState(''),[whatsapp,setWhatsapp]=useState(''),[email,setEmail]=useState(''),[target,setTarget]=useState(''),[quantity,setQuantity]=useState(''),[notes,setNotes]=useState('');
 const[proof,setProof]=useState(null),[docs,setDocs]=useState([]),[paid,setPaid]=useState(false),[amount,setAmount]=useState('');
 const[balance,setBalance]=useState(null);
 useEffect(()=>{(async()=>{try{const [{data:sv,error:se},{data:pk,error:pe},{data:{session:ss}},{data:st}]=await Promise.all([supabase.from('services').select('*').eq('is_active',true).order('sort_order'),supabase.from('packages').select('*').eq('is_active',true).order('sort_order'),supabase.auth.getSession(),supabase.from('site_settings').select('key,value')]);if(se)throw se;if(pe)throw pe;setServices(sv||[]);setPackages(pk||[]);setSession(ss);setSettings(Object.fromEntries((st||[]).map(x=>[x.key,x.value])));if(ss?.user){const{data:p}=await supabase.from('customer_profiles').select('full_name,phone').eq('id',ss.user.id).maybeSingle();setName(p?.full_name||ss.user.user_metadata?.full_name||'');setPhone(p?.phone||ss.user.user_metadata?.phone||'');setEmail(ss.user.email||'');}}catch(e){setError(e.message||'Could not load the order options.');}finally{setLoading(false)}})();},[]);
 const service=services.find(x=>x.id===serviceId);
 const servicePackages=useMemo(()=>packages.filter(x=>x.service_id===serviceId),[packages,serviceId]);
 const pack=servicePackages.find(x=>x.id===packageId);
 const isSmm=Boolean(service?.smm_platform||service?.category==='SMM Panel Services');
 const total=pack?Number(pack.price||0):0;
 const smmTotal=service?Math.round((Number(service.smm_price_per_1000||0)*Number(quantity||0)/1000)*100)/100:0;
 useEffect(()=>{if(serviceId){setPackageId('');setError('');}},[serviceId]);
 useEffect(()=>{if(isSmm&&session){supabase.rpc('get_smm_wallet').then(({data,error:e})=>{if(!e)setBalance(Number(data||0));});}},[isSmm,session?.user?.id]);
 function chooseProof(e){const f=e.target.files?.[0]||null;if(f&&!proofTypes.includes(f.type)){setError('Payment screenshot must be JPG, PNG or WEBP.');return;}if(f&&f.size>5*1024*1024){setError('Payment screenshot must be 5MB or smaller.');return;}setError('');setProof(f);}
 function chooseDocs(e){const fs=[...(e.target.files||[])];if(fs.length>5){setError('Maximum 5 supporting files.');return;}for(const f of fs){if(!docTypes.includes(f.type)||f.size>10*1024*1024){setError('Supporting files: JPG, PNG, WEBP, PDF, DOC or DOCX; max 10MB each.');return;}}setError('');setDocs(fs);}
 async function uploadFile(file,prefix){const ext=extOf(file);const path='uploads/'+prefix+crypto.randomUUID()+'.'+ext;const{error:e}=await supabase.storage.from('order-files').upload(path,file,{contentType:file.type});if(e)throw e;return path;}
 async function submitOrder(e){e.preventDefault();setError('');if(!service||!pack)return setError('Choose a service and package.');if(!name.trim()||name.trim().length<2)return setError('Enter your full name.');if(!PHONE.test(phone.replace(/\D/g,'')))return setError('Enter a valid Bangladeshi mobile number.');if(!pack.price||Number(pack.price)<=0)return setError('This package needs a price quote. Please ask our team.');if(service.requires_file&&!docs.length)return setError('This service requires supporting documents. Please attach them.');if(!proof)return setError('Upload your successful payment screenshot.');if(!paid)return setError('Confirm that you have completed the payment first.');
 setBusy(true);let uploaded=[];try{const proofPath=await uploadFile(proof,'cart-payproof-');uploaded.push(proofPath);const uploadedDocs=[];for(const f of docs){const path=await uploadFile(f,'chat-order-');uploaded.push(path);uploadedDocs.push({path,name:f.name});}
 const{data,error:e2}=await supabase.rpc('create_cart_orders',{p:{customer_name:name.trim(),phone:phone.trim(),whatsapp:whatsapp.trim(),email:email.trim(),method:'Bangla QR',payment_proof_path:proofPath,items:[{package_id:pack.id,quantity:1,files:uploadedDocs,notes:notes.trim()}]}});
 if(e2)throw e2;const code=Array.isArray(data)?data[0]:data;if(!code)throw new Error('The server did not return an Order ID.');setResult('Order request submitted successfully. Order ID: '+code);setSuccessLink({code,phone:phone.trim()});onComplete?.('Your order request has been submitted. Order ID: '+code+'. Payment is pending admin verification.');}
 catch(e2){if(uploaded.length)await supabase.storage.from('order-files').remove(uploaded);setError(e2.message||'Could not submit the order. Please try again.');}finally{setBusy(false);}}
 async function submitSmm(e){e.preventDefault();setError('');if(!session)return setError('Please sign in to place an SMM order.');if(!name.trim()||name.trim().length<2)return setError('Enter your full name.');if(!PHONE.test(phone.replace(/\D/g,'')))return setError('Enter a valid Bangladeshi mobile number.');if(!/^https?:\/\//i.test(target.trim()))return setError('Enter a valid public profile, post or channel URL.');const q=Number(quantity);if(!Number.isInteger(q)||q<Number(service.smm_min_quantity)||q>Number(service.smm_max_quantity))return setError('Quantity must be between '+service.smm_min_quantity+' and '+service.smm_max_quantity+'.');
 setBusy(true);try{const{data,error:e}=await supabase.rpc('create_smm_order',{p:{service_id:service.id,customer_name:name.trim(),phone:phone.trim(),email:email.trim(),target_link:target.trim(),quantity:q,notes:notes.trim()}});if(e)throw e;setResult('SMM order placed. Order ID: '+data);setSuccessLink({code:data,phone:phone.trim()});onComplete?.('Your SMM order has been placed. Order ID: '+data+'. The order charge was processed by the wallet system.');}
 catch(e){setError(e.message||'Could not place the SMM order.');}finally{setBusy(false);}}
 async function submitDeposit(e){e.preventDefault();setError('');if(!session)return setError('Sign in to your account before requesting a wallet deposit.');const a=Number(amount);if(!Number.isFinite(a)||a<50||a>1000000)return setError('Deposit amount must be between ৳50 and ৳1,000,000.');if(!proof)return setError('Upload your successful payment screenshot.');if(!paid)return setError('Confirm that you have completed the payment first.');
 setBusy(true);let path='';try{path=await uploadFile(proof,'payproof-');const{data,error:e2}=await supabase.rpc('request_smm_deposit_with_proof',{p_method:'Bangla QR',p_amount:a,p_proof_path:path});if(e2)throw e2;setResult('Deposit request submitted. Request ID: '+data);onComplete?.('Your deposit request has been submitted. Request ID: '+data+'. Wallet balance will update after admin verification.');}
 catch(e2){if(path)await supabase.storage.from('order-files').remove([path]);setError(e2.message||'Could not submit the deposit request.');}finally{setBusy(false);}}
 if(loading)return <div className="sdc-action-card"><Loader2 className="sdc-spin" size={18}/> Loading secure options…</div>;
 if(result)return <div className="sdc-action-card"><div className="sdc-action-success"><CheckCircle2 size={20}/><b>Submitted</b></div><p>{result}</p>{successLink&&<Link className="sdc-action-primary" to={'/invoice/'+encodeURIComponent(successLink.code)} state={{phone:successLink.phone}}>View invoice <ArrowRight size={15}/></Link>}<button type="button" className="sdc-action-secondary" onClick={onCancel}>Close</button></div>;
 const qrMethod={name:'Bangla QR',number:'Scan the QR to pay',qr:settings.payment_qr_url};
 return <section className="sdc-action-card">
  <div className="sdc-action-top"><b>{mode==='deposit'?'Add wallet funds': 'Place an order'}</b><button type="button" onClick={onCancel} aria-label="Close">×</button></div>
  {error&&<div className="sdc-action-error" role="alert">{error}</div>}
  {mode==='deposit'?<form onSubmit={submitDeposit} className="sdc-action-form">
    {!session?<><p>Wallet deposits are linked to your account. Please sign in first, then reopen this chat.</p><Link className="sdc-action-primary" to="/account">Sign in / Create account <ArrowRight size={15}/></Link></>:<>
      <p className="sdc-action-note"><WalletCards size={15}/> Deposit requests are reviewed by our team before wallet credit is added.</p>
      <label>Amount (minimum ৳50)<input type="number" min="50" max="1000000" step="1" required value={amount} onChange={e=>setAmount(e.target.value)}/></label>
      {Number(amount)>=50&&<PaymentQR settings={settings} total={Number(amount)} method={qrMethod}/>}
      <label>Payment screenshot (JPG / PNG / WEBP, max 5MB)<input type="file" accept="image/jpeg,image/png,image/webp" required onChange={chooseProof}/></label>
      {proof&&<small>{proof.name}</small>}
      <label className="sdc-action-check"><input type="checkbox" checked={paid} onChange={e=>setPaid(e.target.checked)}/> I have completed this payment.</label>
      <button className="sdc-action-primary" disabled={busy||!proof||!paid}>{busy?<><Loader2 size={16}/>Submitting…</>:<>Submit deposit request <ArrowRight size={15}/></>}</button>
    </>}
  </form>:<form onSubmit={isSmm?submitSmm:submitOrder} className="sdc-action-form">
    <label>Choose service<select required value={serviceId} onChange={e=>{setServiceId(e.target.value);setPackageId('')}}><option value="">Select a service…</option>{services.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    {service&&<>{isSmm?<><div className="sdc-action-note">SMM orders use your signed-in account wallet. Available balance: {balance===null?'Loading…':taka(balance)}.</div>{!session&&<div className="sdc-action-error">Please <Link to="/account">sign in</Link> before placing an SMM order.</div>}
      <label>Target link<input type="url" required placeholder="https://…" value={target} onChange={e=>setTarget(e.target.value)}/></label>
      <label>Quantity ({Number(service.smm_min_quantity).toLocaleString()}–{Number(service.smm_max_quantity).toLocaleString()})<input type="number" required min={service.smm_min_quantity} max={service.smm_max_quantity} step="1" value={quantity} onChange={e=>setQuantity(e.target.value)}/></label>
      <div className="sdc-action-total"><span>Estimated total (server-calculated at submission)</span><b>{taka(smmTotal)}</b></div>
      {balance!==null&&smmTotal>balance&&<div className="sdc-action-error">Insufficient wallet balance. <button type="button" onClick={()=>onComplete?.('Your wallet balance is insufficient. Use “Add wallet funds” in this chat to submit a deposit request.')}>Add funds in chat</button></div>}
    </>:<>
      <label>Choose package<select required value={packageId} onChange={e=>setPackageId(e.target.value)}><option value="">Select a package…</option>{servicePackages.map(p=><option key={p.id} value={p.id}>{p.name}{p.access_type?' · '+p.access_type:''}{p.duration_months===0?' · Lifetime':p.duration_months?' · '+p.duration_months+' months':''} — {Number(p.price)>0?taka(p.price):'Price on request'}</option>)}</select></label>
      {pack&&Number(pack.price)>0&&<div className="sdc-action-total"><span>Package total</span><b>{taka(total)}</b></div>}
      {pack&&Number(pack.price)<=0&&<div className="sdc-action-note">This package requires a custom price quote, so it cannot be paid and submitted from chat yet. Please contact our team.</div>}
      {service.requires_file&&<label>Required documents (up to 5 files, max 10MB each)<input type="file" multiple accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx" required onChange={chooseDocs}/></label>}
      {docs.length>0&&<small>{docs.length} supporting file(s) selected.</small>}
    </>}
    <label>Full name<input required minLength="2" maxLength="120" value={name} onChange={e=>setName(e.target.value)}/></label>
    <label>Mobile number<input required inputMode="tel" placeholder="01XXXXXXXXX" value={phone} onChange={e=>setPhone(e.target.value)}/></label>
    <label>WhatsApp number (optional)<input inputMode="tel" value={whatsapp} onChange={e=>setWhatsapp(e.target.value)}/></label>
    <label>Email (optional)<input type="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>
    <label>Additional instructions (optional)<textarea rows="2" maxLength="1000" value={notes} onChange={e=>setNotes(e.target.value)}/></label>
    {!isSmm&&pack&&Number(pack.price)>0&&<>
      <PaymentQR settings={settings} total={total} method={qrMethod}/>
      <label>Payment screenshot (JPG / PNG / WEBP, max 5MB)<input type="file" accept="image/jpeg,image/png,image/webp" required onChange={chooseProof}/></label>
      {proof&&<small>{proof.name}</small>}
      <label className="sdc-action-check"><input type="checkbox" checked={paid} onChange={e=>setPaid(e.target.checked)}/> I have completed this payment.</label>
    </>}
    <button className="sdc-action-primary" disabled={busy||!service||(isSmm?(!session||!target||!quantity):(!pack||Number(pack.price)<=0||!proof||!paid))}>{busy?<><Loader2 size={16}/>Submitting…</>:<>{isSmm?'Confirm & place SMM order':'Confirm & place order'} <ArrowRight size={15}/></>}</button>
  </>}
  </form>}
 </section>;
}
