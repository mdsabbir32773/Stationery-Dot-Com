import {useCallback,useEffect,useMemo,useState} from 'react';
import {Link} from 'react-router-dom';
import {Download,RefreshCw} from 'lucide-react';
import {supabase,taka,ORDER_STATUSES,PAY_STATUSES} from '../../lib/supabase';
import StatusBadge from '../../components/StatusBadge';
const PAGE_SIZE=50;
const dhakaDateTime=value=>value?new Intl.DateTimeFormat('en-BD',{timeZone:'Asia/Dhaka',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true}).format(new Date(value)):'—';
const csvCell=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
export default function Orders(){
 const[rows,setRows]=useState([]),[count,setCount]=useState(0),[page,setPage]=useState(0),[f,setF]=useState(''),[pf,setPf]=useState(''),[q,setQ]=useState(''),[service,setService]=useState(''),[from,setFrom]=useState(''),[to,setTo]=useState(''),[services,setServices]=useState([]),[selected,setSelected]=useState([]),[bulkStatus,setBulkStatus]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const load=useCallback(async()=>{
  setBusy(true);setError('');
  let query=supabase.from('orders').select('*,payments(status,provider)',{count:'exact'}).order('created_at',{ascending:false}).range(page*PAGE_SIZE,(page+1)*PAGE_SIZE-1);
  if(f)query=query.eq('status',f);if(pf)query=query.eq('payments.status',pf);if(service)query=query.eq('service_name',service);
  if(from)query=query.gte('created_at',from+'T00:00:00+06:00');if(to)query=query.lt('created_at',to+'T23:59:59.999+06:00');
  const{data,error:e,count:n}=await query;
  if(e)setError(e.message);else{setRows(data||[]);setCount(n||0);setSelected([]);}
  setBusy(false);
 },[page,f,pf,service,from,to]);
 useEffect(()=>{supabase.from('services').select('name').order('name').then(({data})=>setServices(data||[]));},[]);
 useEffect(()=>{load();},[load]);
 useEffect(()=>{setPage(0);},[f,pf,service,from,to]);
 const visible=useMemo(()=>{const t=q.trim().toLowerCase();return rows.filter(x=>!t||[x.order_code,x.customer_name,x.phone].join(' ').toLowerCase().includes(t));},[rows,q]);
 const toggle=id=>setSelected(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id]);
 const exportCsv=()=>{const header=['Order ID','Date','Customer','Phone','Service','Package','Quantity','Total','Order Status','Payment Status'];const lines=[header,...visible.map(x=>[x.order_code,dhakaDateTime(x.created_at),x.customer_name,x.phone,x.service_name,x.package_name,x.quantity,x.total,x.status,x.payments?.[0]?.status])].map(row=>row.map(csvCell).join(','));const blob=new Blob(['\\uFEFF'+lines.join('\\r\\n')],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='stationery-orders-page-'+(page+1)+'.csv';a.click();URL.revokeObjectURL(url);};
 const applyBulk=async()=>{if(!selected.length||!bulkStatus)return;setBusy(true);const results=await Promise.all(selected.map(id=>supabase.rpc('admin_set_order_status',{p_order_id:id,p_status:bulkStatus})));const failed=results.filter(x=>x.error);setError(failed.length?failed.length+' order(s) could not be updated: '+failed[0].error.message:'');setBusy(false);await load();};
 const totalPages=Math.max(1,Math.ceil(count/PAGE_SIZE));
 return(<><div className="admin-heading"><div><h1>Orders</h1><p className="muted">{count.toLocaleString()} orders · {PAGE_SIZE} per page</p></div><div className="row"><button className="btn alt sm" onClick={exportCsv} disabled={!visible.length}><Download size={15}/>Export CSV</button><button className="btn alt sm" onClick={load} disabled={busy}><RefreshCw size={15}/>Refresh</button></div></div>
 <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(165px,1fr))',marginBottom:12}}>
 <input placeholder="Search current page: ID, name, phone" value={q} onChange={e=>setQ(e.target.value)} aria-label="Search orders"/>
 <select value={f} onChange={e=>setF(e.target.value)} aria-label="Order status"><option value="">All order statuses</option>{ORDER_STATUSES.map(s=><option key={s}>{s}</option>)}</select>
 <select value={pf} onChange={e=>setPf(e.target.value)} aria-label="Payment status"><option value="">All payment statuses</option>{PAY_STATUSES.map(s=><option key={s}>{s}</option>)}</select>
 <select value={service} onChange={e=>setService(e.target.value)} aria-label="Service filter"><option value="">All services</option>{services.map(s=><option key={s.name}>{s.name}</option>)}</select>
 <label className="fld"><span>From date</span><input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
 <label className="fld"><span>To date</span><input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
 </div>
 <div className="row" style={{margin:'10px 0',flexWrap:'wrap'}}><label style={{display:'flex',alignItems:'center',gap:8}}><input type="checkbox" checked={visible.length>0&&visible.every(x=>selected.includes(x.id))} onChange={e=>setSelected(e.target.checked?visible.map(x=>x.id):[])}/>Select visible ({selected.length})</label><select value={bulkStatus} onChange={e=>setBulkStatus(e.target.value)}><option value="">Bulk status…</option>{ORDER_STATUSES.map(s=><option key={s}>{s}</option>)}</select><button className="btn sm" disabled={!selected.length||!bulkStatus||busy} onClick={applyBulk}>Apply to selected</button></div>
 {error&&<p className="err" role="alert">{error}</p>}
 {busy&&<p className="muted">Loading / updating…</p>}
 <div className="scroll"><table><thead><tr><th></th><th>Order</th><th>Order Date &amp; Time</th><th>Customer</th><th>Service</th><th>Total</th><th>Status</th><th>Payment</th></tr></thead><tbody>
 {visible.map(x=><tr key={x.id}><td><input type="checkbox" checked={selected.includes(x.id)} onChange={()=>toggle(x.id)} aria-label={'Select '+x.order_code}/></td><td><Link to={'/admin/orders/'+x.id}><b>{x.order_code}</b></Link></td><td style={{whiteSpace:'nowrap'}}>{dhakaDateTime(x.created_at)}</td><td>{x.customer_name}<br/><span className="muted">{x.phone}</span></td><td><div style={{display:'grid',gap:4}}><b>{x.service_name}</b><Link className="text-link" to={'/services?q='+encodeURIComponent(x.service_name||'')} target="_blank" rel="noreferrer">View service ↗</Link></div></td><td>{taka(x.total)}</td><td><StatusBadge status={x.status}/></td><td>{x.target_link?<StatusBadge status="Wallet charged"/>:<><StatusBadge status={x.payments?.[0]?.status}/><br/><span className="muted">{x.payments?.[0]?.provider||'manual'}</span></>}</td></tr>)}
 {!visible.length&&<tr><td colSpan="8" className="empty">No orders match these filters on this page.</td></tr>}
 </tbody></table></div>
 <div className="row" style={{justifyContent:'space-between',alignItems:'center',marginTop:16}}><span className="muted">Page {page+1} of {totalPages}</span><div className="row"><button className="btn alt sm" disabled={page===0||busy} onClick={()=>setPage(v=>v-1)}>Previous</button><button className="btn alt sm" disabled={page+1>=totalPages||busy} onClick={()=>setPage(v=>v+1)}>Next</button></div></div>
 </>);
}
