import {useEffect,useState} from 'react';
import {useParams} from 'react-router-dom';
import {supabase,taka,ORDER_STATUSES,PAY_STATUSES} from '../../lib/supabase';

export default function OrderDetails(){
  const{id}=useParams();const[o,setO]=useState(null);const[urls,setUrls]=useState([]);const[m,setM]=useState('');const[providerId,setProviderId]=useState('');
  const load=async()=>{
    const{data}=await supabase.from('orders').select('*,payments(*),order_files(*)').eq('id',id).single();
    setO(data);setProviderId(data?.provider_order_id||'');
    const files=[];for(const f of data?.order_files||[]){const{data:s}=await supabase.storage.from('order-files').createSignedUrl(f.file_path,300);files.push({name:f.file_name,url:s?.signedUrl});}setUrls(files);
    if(data?.payments?.[0]?.payment_proof_path){const{data:s}=await supabase.storage.from('order-files').createSignedUrl(data.payments[0].payment_proof_path,300);setO(current=>current?({...current,payment_proof_url:s?.signedUrl}):current);}
  };
  useEffect(()=>{load();},[id]);if(!o)return 'Loading…';const pay=o.payments?.[0];
  const setStatus=async v=>{if(o.target_link){const{error}=await supabase.rpc('admin_update_smm_order',{p_order_id:id,p_status:v,p_note:''});setM(error?error.message:'SMM order status and wallet refund saved');}else{const{error}=await supabase.from('orders').update({status:v,updated_at:new Date().toISOString()}).eq('id',id);setM(error?error.message:'Order status saved');}load();};
  const setPay=async v=>{const{error}=await supabase.from('payments').update({status:v}).eq('id',pay.id);if(!error&&v==='Paid'&&['Pending','Payment Pending'].includes(o.status))await supabase.from('orders').update({status:'Payment Received',updated_at:new Date().toISOString()}).eq('id',id);setM(error?error.message:'Payment status saved');load();};
  return <><h1>{o.order_code}</h1><div className="card"><p><b>{o.customer_name}</b><br/>Phone: <a href={`tel:${o.phone}`}>{o.phone}</a> · WhatsApp: {o.whatsapp||'—'} · Email: {o.email||'—'}</p>
    <p>{o.service_name} — {o.package_name} × {o.quantity} = <b>{taka(o.total)}</b></p>
    {o.target_link&&<p>Target link: <a href={o.target_link} target="_blank" rel="noreferrer" style={{textDecoration:'underline',overflowWrap:'anywhere'}}>{o.target_link}</a></p>}
    {o.provider_order_id&&<p>Provider order ID: <b>{o.provider_order_id}</b></p>}<p>Notes: {o.notes||'—'}</p>
    {o.target_link?<p>Payment: Charged from customer wallet · {taka(o.total)}</p>:<><p>Payment: {pay?.method} · via {pay?.provider||'manual'}{pay?.provider_ref?` · Ref ${pay.provider_ref}`:''}{pay?.paid_at?` · auto-paid ${new Date(pay.paid_at).toLocaleString()}`:''}{pay?.transaction_id?<> · Txn ID: <b>{pay.transaction_id}</b></>:null} · Amount {taka(pay?.amount)}</p>{o.payment_proof_url&&<p>Payment screenshot: <a href={o.payment_proof_url} target="_blank" rel="noreferrer" style={{textDecoration:'underline'}}>View customer receipt</a></p>}</>}
    <p>Files: {urls.length?urls.map((u,i)=><a key={i} href={u.url} target="_blank" rel="noreferrer" style={{marginRight:8,textDecoration:'underline'}}>{u.name}</a>):'none'}</p></div>
    {o.target_link&&<><label>Provider order ID</label><div className="row"><input value={providerId} onChange={e=>setProviderId(e.target.value)} placeholder="Provider order ID, if assigned"/><button className="btn alt" onClick={async()=>{const{error}=await supabase.from('orders').update({provider_order_id:providerId.trim()||null,updated_at:new Date().toISOString()}).eq('id',id);setM(error?error.message:'Provider order ID saved');load();}}>Save ID</button></div></>}
    <label>Order status</label><select value={o.status} onChange={e=>setStatus(e.target.value)}>{(o.target_link?ORDER_STATUSES.filter(s=>['Payment Received','Processing','Completed','Cancelled','Refunded'].includes(s)):ORDER_STATUSES).map(s=><option key={s}>{s}</option>)}</select>
    {!o.target_link&&<><label>Payment status</label><select value={pay?.status} onChange={e=>setPay(e.target.value)}>{PAY_STATUSES.map(s=><option key={s}>{s}</option>)}</select></>}{m&&<p className="ok">{m}</p>}
  </>;
}
