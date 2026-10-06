import {useEffect,useState} from 'react';
import {ArrowDownLeft,ArrowUpRight,RefreshCw,WalletCards} from 'lucide-react';
import {supabase,taka,getSettings} from '../lib/supabase';
import PaymentQR from './PaymentQR';
import '../wallet.css';

export default function WalletPanel({session}){
  const[balance,setBalance]=useState(null),[transactions,setTransactions]=useState([]),[requests,setRequests]=useState([]),[settings,setSettings]=useState({}),[method,setMethod]=useState(''),[amount,setAmount]=useState(''),[proof,setProof]=useState(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  async function load(){
    const{data,error}=await supabase.rpc('get_smm_wallet');
    if(!error)setBalance(Number(data||0));else setMessage('Wallet setup is not available yet. Please contact support.');
    const[{data:tx},{data:dr}]=await Promise.all([supabase.from('wallet_transactions').select('*').eq('user_id',session.user.id).order('created_at',{ascending:false}).limit(12),supabase.from('deposit_requests').select('*').eq('user_id',session.user.id).order('created_at',{ascending:false}).limit(12)]);
    setTransactions(tx||[]);setRequests(dr||[]);getSettings().then(setSettings);
  }
  useEffect(()=>{if(session)load();},[session?.user?.id]);
  const channels=settings.payment_qr_url?[{name:'Bangla QR',number:'Scan the QR to pay',qr:settings.payment_qr_url}]:[];
  const selected=channels.find(x=>x.name===method);
  function pick(e){const f=e.target.files?.[0];if(!f){setProof(null);return;}if(!['image/jpeg','image/png','image/webp'].includes(f.type)){setMessage('Screenshot must be JPG, PNG or WEBP.');return;}if(f.size>5*1024*1024){setMessage('Screenshot must be 5MB or smaller.');return;}setMessage('');setProof(f);}
  async function submit(e){
    e.preventDefault();if(!proof)return setMessage('Upload a screenshot of your successful payment.');
    setBusy(true);setMessage('');let path='';
    try{
      const ext=proof.name.split('.').pop().toLowerCase();path=`uploads/payproof-${crypto.randomUUID()}.${ext}`;
      const{error:uploadError}=await supabase.storage.from('order-files').upload(path,proof,{contentType:proof.type});if(uploadError)throw uploadError;
      const{error}=await supabase.rpc('request_smm_deposit_with_proof',{p_method:method,p_amount:Number(amount),p_proof_path:path});if(error)throw error;
      setAmount('');setProof(null);e.target.reset();setMethod('');setMessage('Deposit submitted. Admin will review your payment screenshot.');await load();
    }catch(error){if(path)await supabase.storage.from('order-files').remove([path]);setMessage(error.message||'Could not submit deposit. Please try again.');}
    finally{setBusy(false);}
  }
  return <section className="wallet-panel" id="wallet">
    <div className="wallet-panel-head"><div><span className="account-icon"><WalletCards size={20}/></span><div><h2>Wallet</h2><p>Use your balance for SMM service orders.</p></div></div><button className="wallet-refresh" onClick={load} aria-label="Refresh wallet"><RefreshCw size={15}/></button></div>
    <div className="wallet-balance"><small>AVAILABLE BALANCE</small><b>{balance===null?'—':taka(balance)}</b><span>Deposits are added after admin verifies your payment screenshot.</span></div>
    <div className="wallet-deposit-grid"><div className="wallet-deposit-form"><h3>Add funds</h3>
      {channels.length?<form onSubmit={submit}>
        <label>Payment method<select required value={method} onChange={e=>setMethod(e.target.value)}><option value="">Choose method…</option>{channels.map(x=><option key={x.name}>{x.name}</option>)}</select></label>
        <label>Amount (minimum ৳50)<input type="number" min="50" max="1000000" step="0.01" required value={amount} onChange={e=>setAmount(e.target.value)}/></label>
        {selected&&Number(amount)>=50&&<PaymentQR settings={settings} total={Number(amount)} method={selected}/>}
        <label>Payment screenshot *<input type="file" accept="image/jpeg,image/png,image/webp" required onChange={pick}/><small className="muted">JPG, PNG or WEBP · max 5MB{proof?` · Selected: ${proof.name}`:''}</small></label>
        <button className="btn sm" disabled={busy||!channels.length}>{busy?'Submitting…':'Request deposit'}</button>
      </form>:<div className="callout warn">Bangla QR payment is not configured yet. Please contact support.</div>}
      {message&&<p role="status" className={message.startsWith('Deposit submitted')?'ok':'err'}>{message}</p>}
    </div><div className="wallet-recent"><h3>Recent activity</h3>{transactions.length?transactions.map(t=><div className="wallet-transaction" key={t.id}><span className={t.amount>0?'wallet-in':'wallet-out'}>{t.amount>0?<ArrowDownLeft size={15}/>:<ArrowUpRight size={15}/>}</span><div><b>{t.description||t.transaction_type}</b><small>{new Date(t.created_at).toLocaleString()}</small></div><strong className={t.amount>0?'wallet-positive':''}>{t.amount>0?'+':''}{taka(t.amount)}</strong></div>):<div className="wallet-no-activity">No wallet activity yet.</div>}</div></div>
    <div className="wallet-deposits"><h3>Deposit requests</h3>{requests.length?requests.map(d=><div className="wallet-deposit-row" key={d.id}><span>{d.method} · screenshot submitted</span><b>{taka(d.amount)}</b><em className={`deposit-${d.status.toLowerCase()}`}>{d.status}</em></div>):<p>No deposit requests yet.</p>}</div>
  </section>;
}
