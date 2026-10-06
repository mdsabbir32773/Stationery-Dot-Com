import {useCallback,useEffect,useState} from 'react';
import {Check,ExternalLink,RefreshCw,X} from 'lucide-react';
import {supabase,taka} from '../../lib/supabase';
import '../../wallet.css';

export default function Deposits(){
  const[list,setList]=useState(null),[profiles,setProfiles]=useState({}),[proofs,setProofs]=useState({}),[message,setMessage]=useState(''),[busy,setBusy]=useState('');
  const load=useCallback(async()=>{
    const{data,error}=await supabase.from('deposit_requests').select('*').order('created_at',{ascending:false});
    if(error){setMessage('Wallet migration is not installed yet. Run supabase/smm-panel.sql.');setList([]);return;}
    const rows=data||[];setList(rows);const ids=[...new Set(rows.map(d=>d.user_id))];
    if(ids.length){const{data:p}=await supabase.from('customer_profiles').select('id,full_name,email').in('id',ids);setProfiles(Object.fromEntries((p||[]).map(x=>[x.id,x])));}
    const next={};await Promise.all(rows.filter(d=>d.payment_proof_path).map(async d=>{const{data:s}=await supabase.storage.from('order-files').createSignedUrl(d.payment_proof_path,300);if(s?.signedUrl)next[d.id]=s.signedUrl;}));setProofs(next);
  },[]);
  useEffect(()=>{load();},[load]);
  async function review(row,approved){setBusy(row.id);setMessage('');const{error}=await supabase.rpc('review_smm_deposit',{p_request_id:row.id,p_approved:approved,p_note:''});setBusy('');setMessage(error?error.message:`Deposit ${approved?'approved':'rejected'}.`);if(!error)load();}
  const pending=(list||[]).filter(d=>d.status==='Pending').length;
  return <div className="smm-admin"><div className="admin-heading smm-admin-heading"><div><span className="eyebrow">CUSTOMER WALLETS</span><h1>Deposit requests</h1><p className="muted">Review each payment screenshot before approving a wallet credit.</p></div><div className="smm-admin-total"><b>{pending}</b><span>awaiting review</span></div></div>
    {message&&<p className="callout warn" role="status">{message}</p>}
    <div className="smm-admin-list-head"><div><h2>All requests</h2><p>Approved deposits are credited to the customer wallet through the database.</p></div><button className="btn alt sm" onClick={load}><RefreshCw size={15}/> Refresh</button></div>
    {list===null?<div className="sk"/>:!list.length?<div className="smm-empty"><div><Check size={21}/></div><b>No deposit requests</b><p>Customer requests will appear here after the wallet migration is installed.</p></div>:<div className="scroll"><table><thead><tr><th>Customer</th><th>Method</th><th>Amount</th><th>Payment proof</th><th>Submitted</th><th>Status</th><th>Review</th></tr></thead><tbody>{list.map(d=>{const p=profiles[d.user_id]||{};return <tr key={d.id}><td>{p.full_name||'Customer'}<small className="muted">{p.email||d.user_id}</small></td><td>{d.method}</td><td><b>{taka(d.amount)}</b></td><td>{proofs[d.id]?<a className="btn alt sm" href={proofs[d.id]} target="_blank" rel="noreferrer"><ExternalLink size={14}/> View screenshot</a>:'Not uploaded'}</td><td>{new Date(d.created_at).toLocaleString()}</td><td><span className={`smm-status ${d.status==='Approved'?'is-on':''}`}>{d.status}</span></td><td>{d.status==='Pending'?<div className="row"><button className="btn sm" disabled={Boolean(busy)||!d.payment_proof_path} onClick={()=>review(d,true)}><Check size={14}/>{busy===d.id?'…':'Approve'}</button><button className="btn sm red" disabled={Boolean(busy)} onClick={()=>review(d,false)}><X size={14}/>Reject</button></div>:d.admin_note||'Reviewed'}</td></tr>})}</tbody></table></div>}
  </div>;
}
