import {useEffect,useMemo,useState} from 'react';
import {Link,useParams} from 'react-router-dom';
import {ArrowLeft,Wallet,ShoppingBag,ArrowDownToLine,ArrowUpFromLine,RefreshCw,Check,X,RotateCcw,ExternalLink} from 'lucide-react';
import {supabase,taka,ORDER_STATUSES} from '../../lib/supabase';

const dateTime=value=>value?new Intl.DateTimeFormat('en-BD',{timeZone:'Asia/Dhaka',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true}).format(new Date(value)):'—';
const labelType=t=>({deposit:'Deposit',order_charge:'Order Charge',refund:'Refund',adjustment:'Adjustment'}[t]||t);
export default function CustomerDetails(){
 const{id}=useParams();const[data,setData]=useState(null);const[error,setError]=useState('');const[message,setMessage]=useState('');const[busy,setBusy]=useState('');const[refresh,setRefresh]=useState(0);const[proofs,setProofs]=useState({});
 useEffect(()=>{let live=true;(async()=>{setError('');setData(null);
  const [p,w,o,tx,d]=await Promise.all([
   supabase.from('customer_profiles').select('*').eq('id',id).single(),
   supabase.from('wallets').select('balance').eq('user_id',id).maybeSingle(),
   supabase.from('orders').select('id,order_code,service_name,package_name,quantity,total,status,created_at,target_link').eq('customer_id',id).order('created_at',{ascending:false}),
   supabase.from('wallet_transactions').select('*').eq('user_id',id).order('created_at',{ascending:false}),
   supabase.from('deposit_requests').select('id,method,amount,transaction_id,status,admin_note,created_at,reviewed_at,payment_proof_path').eq('user_id',id).order('created_at',{ascending:false})
  ]);
  const err=p.error||w.error||o.error||tx.error||d.error;if(err){if(live){setError(err.message);setData({});}return;}
  if(live)setData({profile:p.data,balance:Number(w.data?.balance||0),orders:o.data||[],transactions:tx.data||[],deposits:d.data||[]});
  const signed={};await Promise.all((d.data||[]).filter(x=>x.payment_proof_path).map(async x=>{const{data:s}=await supabase.storage.from('order-files').createSignedUrl(x.payment_proof_path,300);if(s?.signedUrl)signed[x.id]=s.signedUrl;}));if(live)setProofs(signed);
 })();return()=>{live=false};},[id,refresh]);
 const totals=useMemo(()=>{const t=data?.transactions||[];return{deposited:t.filter(x=>x.transaction_type==='deposit').reduce((s,x)=>s+Number(x.amount||0),0),charged:Math.abs(t.filter(x=>x.transaction_type==='order_charge').reduce((s,x)=>s+Number(x.amount||0),0)),refunds:t.filter(x=>x.transaction_type==='refund').reduce((s,x)=>s+Number(x.amount||0),0)};},[data]);
 const reload=()=>setRefresh(v=>v+1);
 async function reviewDeposit(row,approved){setBusy(row.id);setMessage('');const{error}=await supabase.rpc('review_smm_deposit',{p_request_id:row.id,p_approved:approved,p_note:''});setBusy('');setMessage(error?error.message:`Deposit ${approved?'approved':'rejected'} successfully.`);if(!error)reload();}
 async function reverseDeposit(row){if(!window.confirm('এই approved deposit wallet থেকে কেটে Rejected করা হবে। Continue?'))return;const note=window.prompt('Reversal reason (optional):','');if(note===null)return;setBusy(row.id);setMessage('');const{error}=await supabase.rpc('reverse_smm_deposit',{p_request_id:row.id,p_note:note});setBusy('');setMessage(error?error.message:'Deposit approval revoked and rejected.');if(!error)reload();}
 async function updateOrder(row,status){if(status===row.status)return;setBusy(row.id);setMessage('');let error;if(row.target_link){const result=await supabase.rpc('admin_update_smm_order',{p_order_id:row.id,p_status:status,p_note:''});error=result.error;}else{const result=await supabase.from('orders').update({status,updated_at:new Date().toISOString()}).eq('id',row.id);error=result.error;}setBusy('');setMessage(error?error.message:'Order status updated.');if(!error)reload();}
 if(!data)return <div className="card">Loading customer…</div>;
 if(error)return <><Link to="/admin/customers">← Customers</Link><p className="err">{error}</p></>;
 if(!data.profile)return <p className="err">Customer not found.</p>;
 const p=data.profile;
 return <div>
  <Link to="/admin/customers" className="text-link" style={{display:'inline-flex',alignItems:'center',gap:6,marginBottom:14}}><ArrowLeft size={16}/> Back to Customers</Link>
  <div className="admin-heading"><div><span className="eyebrow">Customer profile</span><h1>{p.full_name||'Customer'}</h1><p className="muted">{p.email||'No email'} · {p.phone||'No phone'} · Joined {dateTime(p.created_at)}</p></div><button className="btn alt sm" onClick={reload}><RefreshCw size={15}/> Refresh</button></div>
  {message&&<p className="callout warn" role="status">{message}</p>}
  <div className="admin-insight-grid" style={{marginBottom:18}}>
   <div className="card"><small><Wallet size={14}/> Available Balance</small><b>{taka(data.balance)}</b></div>
   <div className="card"><small><ArrowDownToLine size={14}/> Total Deposited</small><b>{taka(totals.deposited)}</b></div>
   <div className="card"><small><ArrowUpFromLine size={14}/> Total Wallet Charges</small><b>{taka(totals.charged)}</b></div>
   <div className="card"><small><ShoppingBag size={14}/> Total Orders</small><b>{data.orders.length}</b></div>
  </div>
  <section className="card" style={{marginBottom:18}}><h2>Order History & Control</h2><div className="scroll"><table><thead><tr><th>Order ID</th><th>Service / Package</th><th>Amount</th><th>Status / Update</th><th>Date</th></tr></thead><tbody>
   {data.orders.map(o=><tr key={o.id}><td><Link to={`/admin/orders/${o.id}`}><b>{o.order_code}</b></Link></td><td>{o.service_name}<br/><small>{o.package_name||'—'} × {o.quantity||1}</small></td><td>{taka(o.total)}</td><td><select aria-label={`Status for ${o.order_code}`} value={o.status} disabled={Boolean(busy)} onChange={e=>updateOrder(o,e.target.value)} style={{minWidth:145}}>{(o.target_link?ORDER_STATUSES.filter(s=>['Payment Received','Processing','Completed','Cancelled','Refunded'].includes(s)):ORDER_STATUSES).map(s=><option key={s}>{s}</option>)}</select>{busy===o.id&&<small>Saving…</small>}</td><td>{dateTime(o.created_at)}</td></tr>)}
   {!data.orders.length&&<tr><td colSpan="5" className="empty">No orders found.</td></tr>}
  </tbody></table></div><p className="muted">Order ID-তে ক্লিক করলে সম্পূর্ণ Order Details খুলবে। এখান থেকেই status পরিবর্তন করা যাবে।</p></section>
  <section className="card" style={{marginBottom:18}}><h2>Wallet Transaction History</h2><p className="muted">প্রতিটি deposit, order charge, refund এবং adjustment-এর হিসাব।</p><div className="scroll"><table><thead><tr><th>Type</th><th>Description</th><th>Reference</th><th>Amount</th><th>Date</th></tr></thead><tbody>
   {data.transactions.map(x=><tr key={x.id}><td><b>{labelType(x.transaction_type)}</b></td><td>{x.description||'—'}</td><td>{x.order_id?<Link to={`/admin/orders/${x.order_id}`}>{x.reference||'View order'}</Link>:x.reference||'—'}</td><td style={{fontWeight:800,color:Number(x.amount)<0?'#b42318':'#16804a',whiteSpace:'nowrap'}}>{Number(x.amount)>0?'+':''}{taka(x.amount)}</td><td style={{whiteSpace:'nowrap'}}>{dateTime(x.created_at)}</td></tr>)}
   {!data.transactions.length&&<tr><td colSpan="5" className="empty">No wallet transactions found.</td></tr>}
  </tbody></table></div></section>
  <section className="card"><h2>Deposit Requests & Approval</h2><div className="scroll"><table><thead><tr><th>Method / Proof</th><th>Amount</th><th>Transaction ID</th><th>Status</th><th>Submitted</th><th>Action</th></tr></thead><tbody>
   {data.deposits.map(x=><tr key={x.id}><td>{x.method}{proofs[x.id]&&<><br/><a href={proofs[x.id]} target="_blank" rel="noreferrer" className="text-link"><ExternalLink size={13}/> View payment proof</a></>}</td><td><b>{taka(x.amount)}</b></td><td>{x.transaction_id||'—'}</td><td>{x.status}{x.admin_note&&<><br/><small>{x.admin_note}</small></>}</td><td>{dateTime(x.created_at)}</td><td>{x.status==='Pending'?<div className="row"><button className="btn sm" disabled={Boolean(busy)||!x.payment_proof_path} onClick={()=>reviewDeposit(x,true)}><Check size={14}/>{busy===x.id?'…':'Approve'}</button><button className="btn sm red" disabled={Boolean(busy)} onClick={()=>reviewDeposit(x,false)}><X size={14}/>Reject</button></div>:x.status==='Approved'?<button className="btn sm red" disabled={Boolean(busy)} onClick={()=>reverseDeposit(x)}><RotateCcw size={14}/>{busy===x.id?'…':'Revoke & Reject'}</button>:<span className="muted">Reviewed</span>}</td></tr>)}
   {!data.deposits.length&&<tr><td colSpan="6" className="empty">No deposit requests found.</td></tr>}
  </tbody></table></div><p className="muted">Pending deposit approve/reject এবং approved deposit revoke এখান থেকেই করা যাবে।</p></section>
 </div>;
}
