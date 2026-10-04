import {useEffect,useState} from 'react';import {supabase,taka} from '../../lib/supabase';
export default function Dashboard(){const[o,setO]=useState([]);useEffect(()=>{supabase.from('orders').select('status,total,payments(status)').then(r=>setO(r.data||[]));},[]);
const n=s=>o.filter(x=>x.status===s).length;const rev=o.filter(x=>x.payments?.some(p=>p.status==='Paid')&&!['Cancelled','Refunded'].includes(x.status)).reduce((a,x)=>a+Number(x.total),0);
const T=[['Total orders',o.length],['Pending',n('Pending')],['Payment pending',n('Payment Pending')],['Processing',n('Processing')],['Completed',n('Completed')],['Revenue (paid)',taka(rev)],['Order value (all)',taka(o.reduce((a,x)=>a+Number(x.total),0))]];
return(<><h1>Dashboard</h1><div className="stats">{T.map(([k,v])=><div className="card" key={k}><span className="muted">{k}</span><b>{v}</b></div>)}</div></>);}
