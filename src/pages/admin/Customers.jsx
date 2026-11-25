import {useEffect,useState} from 'react';
import {Search,UsersRound,RefreshCw,Download} from 'lucide-react';
import {Link} from 'react-router-dom';
import {supabase,taka} from '../../lib/supabase';

const SIZE=50;
const csv=v=>'"'+String(v??'').replace(/"/g,'""')+'"';

export default function Customers(){
 const[list,setList]=useState(null);
 const[q,setQ]=useState('');
 const[error,setError]=useState('');
 const[refresh,setRefresh]=useState(0);
 const[page,setPage]=useState(0);
 const[count,setCount]=useState(0);
 const[totalWallet,setTotalWallet]=useState(0);

 useEffect(()=>{
  let live=true;
  (async()=>{
   setError('');
   setList(null);
   const{data,error}=await supabase.rpc('admin_customer_directory',{
    p_limit:SIZE,
    p_offset:page*SIZE,
    p_search:q.trim()||null
   });
   if(!live)return;
   if(error){setError(error.message);setList([]);setCount(0);setTotalWallet(0);return;}
   const rows=data||[];
   setList(rows);
   setCount(Number(rows[0]?.total_count||0));
   setTotalWallet(Number(rows[0]?.total_wallet_balance||0));
  })().catch(e=>{
   if(live){setError(e.message||'Could not load customers.');setList([]);}
  });
  return()=>{live=false;};
 },[page,q,refresh]);

 const pages=Math.max(1,Math.ceil(count/SIZE));
 const exportCsv=()=>{
  const data=[['Name','Email','Phone','Wallet Balance','Orders','Joined'],...(list||[]).map(x=>[x.full_name,x.email,x.phone,x.wallet_balance,x.order_count,new Date(x.created_at).toISOString()])].map(r=>r.map(csv).join(','));
  const blob=new Blob(['\uFEFF'+data.join('\r\n')],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='stationery-customers-page-'+(page+1)+'.csv';a.click();URL.revokeObjectURL(url);
 };

 return <><div className="admin-heading"><div><span className="eyebrow">Customer directory</span><h1>Customers</h1><p className="muted">Customer accounts, order count and available wallet balance.</p></div><div className="admin-total"><UsersRound size={20}/><b>{count.toLocaleString()}</b><span>matching accounts</span></div></div>
  <div className="row admin-filter"><Search size={18}/><input value={q} onChange={e=>{setQ(e.target.value);setPage(0)}} placeholder="Search name, email or phone" aria-label="Search customers"/><button className="btn alt sm" onClick={()=>setRefresh(v=>v+1)} aria-label="Refresh customers"><RefreshCw size={15}/></button><button className="btn alt sm" onClick={exportCsv} disabled={!list?.length}><Download size={15}/>Export page</button></div>
  {list!==null&&<p className="muted" style={{margin:'8px 0 14px'}}>Total wallet balance for matching accounts: <b>{taka(totalWallet)}</b> · Showing {list.length} of {count} accounts</p>}
  {error&&<p className="err" role="alert">{error} <button className="btn alt sm" onClick={()=>setRefresh(v=>v+1)}>Retry</button></p>}
  {list===null?<div className="sk"/>:<><div className="scroll"><table><thead><tr><th>Customer</th><th>Email</th><th>Phone</th><th>Wallet Balance</th><th>Orders</th><th>Joined</th></tr></thead><tbody>{list.map(x=><tr key={x.id}><td><Link to={`/admin/customers/${x.id}`}><b>{x.full_name||'Customer'}</b></Link></td><td>{x.email||'—'}</td><td>{x.phone||'—'}</td><td><b style={{color:x.wallet_balance>0?'#047857':'inherit'}}>{taka(x.wallet_balance)}</b></td><td>{Number(x.order_count||0)}</td><td>{new Intl.DateTimeFormat('en-BD',{timeZone:'Asia/Dhaka',dateStyle:'medium'}).format(new Date(x.created_at))}</td></tr>)}{!list.length&&<tr><td className="empty" colSpan="6">{error?'Customer list could not be loaded.':'No customer accounts found.'}</td></tr>}</tbody></table></div><div className="row" style={{justifyContent:'space-between',marginTop:14}}><span className="muted">Page {page+1} of {pages}</span><div className="row"><button className="btn alt sm" disabled={!page||list===null} onClick={()=>setPage(v=>v-1)}>Previous</button><button className="btn alt sm" disabled={page+1>=pages||list===null} onClick={()=>setPage(v=>v+1)}>Next</button></div></div></>}
 </>;
}
