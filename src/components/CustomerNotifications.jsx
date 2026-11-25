import {useCallback,useEffect,useState} from 'react';
import {Bell,CheckCheck,Clock3} from 'lucide-react';
import {supabase} from '../lib/supabase';

const dateTime=value=>new Intl.DateTimeFormat('en-BD',{timeZone:'Asia/Dhaka',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true}).format(new Date(value));

export default function CustomerNotifications({session}){
  const[rows,setRows]=useState([]);
  const[busy,setBusy]=useState(false);
  const[error,setError]=useState('');
  const[reload,setReload]=useState(0);
  const load=useCallback(async()=>{
    const{data,error}=await supabase.from('customer_notifications').select('id,order_id,deposit_request_id,title,message,type,read_at,created_at').eq('user_id',session.user.id).order('created_at',{ascending:false}).limit(50);
    if(error){setError('Could not load notifications.');return;}
    setRows(data||[]);setError('');
  },[session.user.id]);
  useEffect(()=>{
    load();
    const channel=supabase.channel('customer-notifications-'+session.user.id).on('postgres_changes',{event:'INSERT',schema:'public',table:'customer_notifications',filter:'user_id=eq.'+session.user.id},payload=>setRows(current=>[payload.new,...current.filter(x=>x.id!==payload.new.id)].slice(0,50))).subscribe();
    return()=>{supabase.removeChannel(channel);};
  },[load,session.user.id,reload]);
  const unread=rows.filter(x=>!x.read_at).length;
  async function markRead(id){
    setBusy(true);const{error}=await supabase.rpc('mark_customer_notification_read',{p_notification_id:id});setBusy(false);
    if(error){setError('Could not update this notification.');return;}
    setRows(current=>current.map(x=>x.id===id?{...x,read_at:new Date().toISOString()}:x));
  }
  async function markAll(){
    setBusy(true);const{error}=await supabase.rpc('mark_all_customer_notifications_read');setBusy(false);
    if(error){setError('Could not update notifications.');return;}
    const now=new Date().toISOString();setRows(current=>current.map(x=>({...x,read_at:x.read_at||now})));
  }
  return <section className="account-panel customer-notifications" aria-label="Notifications">
    <div className="panel-title"><span className="account-icon"><Bell size={20}/></span><div><h2>Notifications {unread>0&&<span className="customer-notification-count">{unread}</span>}</h2><p>Order updates and wallet deposit decisions</p></div>{unread>0&&<button type="button" className="btn alt sm" disabled={busy} onClick={markAll}><CheckCheck size={15}/> Mark all read</button>}</div>
    {error&&<p className="err" role="alert">{error}</p>}
    {error?<div className="account-empty"><p>{error}</p><button type="button" className="btn alt sm" onClick={()=>setReload(v=>v+1)}>Try again</button></div>:rows.length?<div className="customer-notification-list">{rows.map(n=><article key={n.id} className={'customer-notification '+(!n.read_at?'unread':'')}><span className="customer-notification-icon"><Bell size={16}/></span><div className="customer-notification-copy"><b>{n.title}</b><p>{n.message}</p><small><Clock3 size={12}/>{dateTime(n.created_at)}</small></div>{!n.read_at&&<button type="button" className="customer-notification-read" disabled={busy} onClick={()=>markRead(n.id)} aria-label="Mark notification as read">Mark read</button>}</article>)}</div>:<div className="account-empty"><Bell size={24}/><b>You’re all caught up</b><span>New order and deposit updates will appear here.</span></div>}
  </section>;
}
