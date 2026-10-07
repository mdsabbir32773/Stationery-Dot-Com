import {useEffect,useState} from 'react';import {Bell,CheckCheck,X} from 'lucide-react';import {supabase} from '../lib/supabase';

export default function AdminNotifications(){
 const[list,setList]=useState([]);const[open,setOpen]=useState(false);const[permission,setPermission]=useState(typeof Notification==='undefined'?'unsupported':Notification.permission);
 useEffect(()=>{let alive=true;
  const load=async()=>{const{data}=await supabase.from('admin_notifications').select('id,order_id,title,message,read_at,created_at').order('created_at',{ascending:false}).limit(30);if(alive)setList(data||[]);};
  load();
  const ch=supabase.channel('admin-order-notifications').on('postgres_changes',{event:'INSERT',schema:'public',table:'admin_notifications'},payload=>{const n=payload.new;if(!alive)return;setList(v=>[n,...v].slice(0,30));if(typeof Notification!=='undefined'&&Notification.permission==='granted'){try{new Notification(n.title,{body:n.message,tag:n.id});}catch{}}}).subscribe();
  return()=>{alive=false;supabase.removeChannel(ch);};
 },[]);
 const unread=list.filter(x=>!x.read_at).length;
 const requestPush=async()=>{if(typeof Notification==='undefined')return;const p=await Notification.requestPermission();setPermission(p);if(p==='granted')new Notification('Stationery Dot Com notifications enabled',{body:'You will be notified when a new order arrives.'});};
 const markRead=async id=>{await supabase.from('admin_notifications').update({read_at:new Date().toISOString()}).eq('id',id);setList(v=>v.map(x=>x.id===id?{...x,read_at:new Date().toISOString()}:x));};
 const markAll=async()=>{const ids=list.filter(x=>!x.read_at).map(x=>x.id);if(ids.length)await supabase.from('admin_notifications').update({read_at:new Date().toISOString()}).in('id',ids);setList(v=>v.map(x=>({...x,read_at:x.read_at||new Date().toISOString()})));};
 return <div style={{position:'relative',marginLeft:'auto'}}>
  <button type="button" aria-label="Notifications" onClick={()=>setOpen(v=>!v)} style={{position:'relative',display:'inline-flex',alignItems:'center',justifyContent:'center',width:42,height:42,borderRadius:12,border:'1px solid var(--border,#ddd)',background:'var(--card,#fff)',cursor:'pointer'}}><Bell size={19}/>{unread>0&&<span style={{position:'absolute',top:-4,right:-4,minWidth:20,height:20,padding:'0 5px',borderRadius:999,background:'#dc2626',color:'#fff',fontSize:11,fontWeight:800,display:'grid',placeItems:'center'}}>{unread>99?'99+':unread}</span>}</button>
  {open&&<div style={{position:'absolute',right:0,top:48,width:'min(360px,calc(100vw - 28px))',background:'var(--card,#fff)',border:'1px solid var(--border,#ddd)',borderRadius:16,boxShadow:'0 18px 45px rgba(0,0,0,.15)',zIndex:50,overflow:'hidden'}}>
   <div style={{padding:'12px 14px',display:'flex',alignItems:'center',gap:8,borderBottom:'1px solid var(--border,#eee)'}}><b style={{flex:1}}>Notifications</b>{unread>0&&<button onClick={markAll} title="Mark all as read" style={{border:0,background:'none',cursor:'pointer'}}><CheckCheck size={18}/></button>}<button onClick={()=>setOpen(false)} style={{border:0,background:'none',cursor:'pointer'}}><X size={18}/></button></div>
   {permission!=='granted'&&permission!=='unsupported'&&<button onClick={requestPush} style={{width:'100%',padding:10,border:0,borderBottom:'1px solid var(--border,#eee)',background:'transparent',cursor:'pointer',textAlign:'left'}}>🔔 Enable browser notifications</button>}
   {permission==='unsupported'&&<div style={{padding:10,fontSize:13,opacity:.7}}>Browser notifications are not supported here.</div>}
   <div style={{maxHeight:360,overflowY:'auto'}}>{!list.length?<div style={{padding:22,textAlign:'center',opacity:.65}}>No notifications yet.</div>:list.map(n=><button key={n.id} onClick={()=>markRead(n.id)} style={{width:'100%',textAlign:'left',padding:'12px 14px',border:0,borderBottom:'1px solid var(--border,#eee)',background:n.read_at?'transparent':'rgba(220,38,38,.06)',cursor:'pointer'}}><b style={{display:'block'}}>{n.title}</b><span style={{display:'block',fontSize:13,marginTop:3}}>{n.message}</span><small style={{display:'block',marginTop:5,opacity:.55}}>{new Date(n.created_at).toLocaleString()}</small></button>)}</div>
  </div>}
 </div>;
}