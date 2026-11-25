import {useEffect,useState} from 'react';
import {LifeBuoy,Send,RefreshCw} from 'lucide-react';
import {Link} from 'react-router-dom';
import {supabase} from '../../lib/supabase';

const labels={open:'Open',in_progress:'In progress',waiting_customer:'Waiting for customer',resolved:'Resolved',closed:'Closed'};
const dhakaDateTime=value=>value?new Intl.DateTimeFormat('en-BD',{timeZone:'Asia/Dhaka',dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'—';

export default function SupportTickets(){
 const[rows,setRows]=useState(null);
 const[filter,setFilter]=useState('open');
 const[drafts,setDrafts]=useState({});
 const[busy,setBusy]=useState('');
 const[message,setMessage]=useState('');
 const[loadError,setLoadError]=useState('');

 async function load(){
  setLoadError('');
  setMessage('');
  try{
   const{data,error}=await supabase.from('support_tickets').select('*,orders(order_code,customer_name,phone)').order('created_at',{ascending:false});
   if(error)throw error;
   setRows(data||[]);
   setDrafts(Object.fromEntries((data||[]).map(t=>[t.id,{response:t.admin_response||'',status:t.status}])));
  }catch(error){
   setLoadError(error?.message||'Support tickets could not be loaded.');
   setRows([]);
  }
 }
 useEffect(()=>{load();},[]);

 async function save(t){
  const draft=drafts[t.id]||{response:t.admin_response||'',status:t.status};
  setBusy(t.id);
  setMessage('');
  try{
   const{data:{user},error:userError}=await supabase.auth.getUser();
   if(userError)throw userError;
   const response=draft.response.trim();
   const{error}=await supabase.from('support_tickets').update({
    admin_response:response||null,
    status:draft.status,
    admin_id:user?.id||null,
    responded_at:response?new Date().toISOString():null,
    updated_at:new Date().toISOString()
   }).eq('id',t.id);
   if(error)throw error;
   setMessage('Ticket updated.');
   await load();
  }catch(error){
   setMessage(error?.message||'Ticket could not be updated. Please try again.');
  }finally{
   setBusy('');
  }
 }
 const list=(rows||[]).filter(t=>filter==='all'||t.status===filter);
 return <><div className="admin-heading"><div><span className="eyebrow"><LifeBuoy size={14}/> CUSTOMER CARE</span><h1>Support tickets</h1><p className="muted">Review customer requests, reply, and update ticket status.</p></div><button type="button" className="btn alt sm" onClick={load} disabled={rows===null}><RefreshCw size={15}/>Refresh</button></div>
 <div className="support-admin-filters">{['open','in_progress','waiting_customer','resolved','closed','all'].map(v=><button key={v} type="button" className="chip" aria-pressed={filter===v} onClick={()=>setFilter(v)}>{v==='all'?'All tickets':labels[v]}</button>)}</div>
 {message&&<p className={message==='Ticket updated.'?'ok':'err'} role="status">{message}</p>}
 {loadError?<div className="card empty" role="alert"><h2>Could not load support tickets</h2><p>{loadError}</p><button type="button" className="btn" onClick={load}>Try again</button></div>
 :rows===null?<div className="sk" aria-label="Loading support tickets"/>
 :list.length?<div className="support-admin-list">{list.map(t=>{const draft=drafts[t.id]||{response:t.admin_response||'',status:t.status};return <article className="card support-admin-ticket" key={t.id}><header><div><span className="support-ticket-code">{t.ticket_code}</span><h2>{t.subject}</h2><p>{t.orders?.customer_name||'Customer'} · {t.orders?.phone||'No order phone'} · {dhakaDateTime(t.created_at)}</p><small>Customer ID: {t.user_id}{t.orders?.order_code?' · Order: '+t.orders.order_code:''}</small></div><span className={'support-status '+t.status}>{labels[t.status]||t.status}</span></header><div className="support-admin-message"><b>Customer message</b><p>{t.message}</p></div><label>Reply to customer<textarea rows={4} maxLength={5000} value={draft.response} onChange={e=>setDrafts(v=>({...v,[t.id]:{...draft,response:e.target.value}}))} placeholder="Write a clear response…"/></label><label>Ticket status<select value={draft.status} onChange={e=>setDrafts(v=>({...v,[t.id]:{...draft,status:e.target.value}}))}>{Object.entries(labels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><div className="support-admin-actions"><Link className="text-link" to={'/admin/customers/'+t.user_id}>Open customer profile</Link><button type="button" className="btn sm" disabled={busy===t.id} onClick={()=>save(t)}><Send size={14}/>{busy===t.id?'Saving…':'Save reply & status'}</button></div>{t.admin_response&&<small className="muted">Last reply: {dhakaDateTime(t.responded_at)}</small>}</article>;})}</div>:<div className="card empty">No tickets in this view.</div>}
 </>;
}
