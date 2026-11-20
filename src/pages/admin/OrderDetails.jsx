import {useEffect,useState} from 'react';
import {useParams,Link} from 'react-router-dom';
import {supabase,taka,ORDER_STATUSES,PAY_STATUSES} from '../../lib/supabase';

const dhakaDateTime = value => value
  ? new Intl.DateTimeFormat('en-BD', {timeZone:'Asia/Dhaka',day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true}).format(new Date(value))
  : '—';

export default function OrderDetails(){
  const{id}=useParams();const[o,setO]=useState(null);const[service,setService]=useState(null);const[urls,setUrls]=useState([]);const[m,setM]=useState('');const[providerId,setProviderId]=useState('');const[adminNotes,setAdminNotes]=useState([]);const[note,setNote]=useState('');
  const load=async()=>{
    const{data}=await supabase.from('orders').select('*,payments(*),order_files(*)').eq('id',id).single();
    setO(data);setProviderId(data?.provider_order_id||'');const{data:notes}=await supabase.from('admin_order_notes').select('id,note,created_at').eq('order_id',id).order('created_at',{ascending:false});setAdminNotes(notes||[]);if(data?.service_name){const{data:sv}=await supabase.from('services').select('id,name,slug,category,is_active,description').eq('name',data.service_name).limit(1).maybeSingle();setService(sv||null);}
    const files=[];for(const f of data?.order_files||[]){const{data:s}=await supabase.storage.from('order-files').createSignedUrl(f.file_path,300);files.push({name:f.file_name,url:s?.signedUrl});}setUrls(files);
    if(data?.payments?.[0]?.payment_proof_path){const{data:s}=await supabase.storage.from('order-files').createSignedUrl(data.payments[0].payment_proof_path,300);setO(current=>current?({...current,payment_proof_url:s?.signedUrl}):current);}
  };
  useEffect(()=>{load();},[id]);if(!o)return 'Loading…';const pay=o.payments?.[0];
  const setStatus=async v=>{if(o.target_link){const{error}=await supabase.rpc('admin_update_smm_order',{p_order_id:id,p_status:v,p_note:''});setM(error?error.message:'SMM order status and wallet refund saved');}else{const{error}=await supabase.rpc('admin_set_order_status',{p_order_id:id,p_status:v});setM(error?error.message:'Order status saved');}load();};
  const setPay=async v=>{const{error}=await supabase.rpc('admin_set_order_payment',{p_order_id:id,p_status:v});setM(error?error.message:'Payment and order status saved.');if(!error)load();};const saveNote=async e=>{e.preventDefault();const clean=note.trim();if(!clean)return;const{error}=await supabase.from('admin_order_notes').insert({order_id:id,note:clean});setM(error?error.message:'Internal note added.');if(!error){setNote('');load();}};
  return <><h1>{o.order_code}</h1><div className="card"><p><b>{o.customer_name}</b><br/>Order placed: <b>{dhakaDateTime(o.created_at)}</b><br/>Phone: <a href={`tel:${o.phone}`}>{o.phone}</a> · WhatsApp: {o.whatsapp||'—'} · Email: {o.email||'—'}</p>
    <p><b>Service:</b> {o.service_name}{service?.slug&&service.is_active?<><br/><Link className="text-link" to={`/services/${service.slug}`} target="_blank" rel="noreferrer">View full service page ↗</Link></>:<><br/><Link className="text-link" to={`/services?q=${encodeURIComponent(o.service_name||'')}`} target="_blank" rel="noreferrer">Search this service ↗</Link></>}<br/><b>Package:</b> {o.package_name} × {o.quantity} = <b>{taka(o.total)}</b>{Number(o.discount_amount)>0&&<> <span className="muted">(Discount {taka(o.discount_amount)}{o.coupon_code?' · '+o.coupon_code:''})</span></>}</p>
    {o.target_link&&<p>Target link: <a href={o.target_link} target="_blank" rel="noreferrer" style={{textDecoration:'underline',overflowWrap:'anywhere'}}>{o.target_link}</a></p>}
    {o.provider_order_id&&<p>Provider order ID: <b>{o.provider_order_id}</b></p>}<p>Notes: {o.notes||'—'}</p>
    {o.target_link?<p>Payment: Charged from customer wallet · {taka(o.total)}</p>:<><p>Payment: {pay?.method} · via {pay?.provider||'manual'}{pay?.provider_ref?` · Ref ${pay.provider_ref}`:''}{pay?.paid_at?` · auto-paid ${new Date(pay.paid_at).toLocaleString()}`:''}{pay?.transaction_id?<> · Txn ID: <b>{pay.transaction_id}</b></>:null} · Amount {taka(pay?.amount)}</p>{o.payment_proof_url&&<p>Payment screenshot: <a href={o.payment_proof_url} target="_blank" rel="noreferrer" style={{textDecoration:'underline'}}>View customer receipt</a></p>}</>}
    <div className="card" style={{marginTop:12,marginBottom:12,padding:14}}>
      <h2 style={{margin:"0 0 12px",fontSize:18}}>Order & Payment Approval</h2>
          {o.target_link&&<><label>Provider order ID</label><div className="row"><input value={providerId} onChange={e=>setProviderId(e.target.value)} placeholder="Provider order ID, if assigned"/><button className="btn alt" onClick={async()=>{const{error}=await supabase.from('orders').update({provider_order_id:providerId.trim()||null,updated_at:new Date().toISOString()}).eq('id',id);setM(error?error.message:'Provider order ID saved');load();}}>Save ID</button></div></>}
          <label>Order status</label><select value={o.status} onChange={e=>setStatus(e.target.value)}>{(o.target_link?ORDER_STATUSES.filter(s=>['Payment Received','Processing','Completed','Cancelled','Refunded'].includes(s)):ORDER_STATUSES).map(s=><option key={s}>{s}</option>)}</select>
          {!o.target_link&&<><label>Payment status</label><select value={pay?.status} onChange={e=>setPay(e.target.value)}>{PAY_STATUSES.map(s=><option key={s}>{s}</option>)}</select></>}{m&&<p className="ok">{m}</p>}
    </div>
    <section className="card" style={{marginTop:14,padding:14}}><h2 style={{fontSize:18}}>Internal admin notes</h2><p className="muted">Only admins can see these notes. Customers cannot access them.</p><form onSubmit={saveNote}><textarea rows={3} maxLength={2000} value={note} onChange={e=>setNote(e.target.value)} placeholder="Add an internal note about this order…"/><button className="btn sm" disabled={!note.trim()}>Add note</button></form><div style={{marginTop:12}}>{adminNotes.map(n=><article key={n.id} style={{padding:'10px 0',borderTop:'1px solid var(--line,#ddd)'}}><p style={{whiteSpace:'pre-wrap'}}>{n.note}</p><small className="muted">{dhakaDateTime(n.created_at)}</small></article>)}{!adminNotes.length&&<p className="muted">No internal notes yet.</p>}</div></section><p>Files: {urls.length?urls.map((u,i)=><a key={i} href={u.url} target="_blank" rel="noreferrer" style={{marginRight:8,textDecoration:'underline'}}>{u.name}</a>):'none'}</p></div>
  </>;
}
