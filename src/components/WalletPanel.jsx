import {useEffect,useState} from 'react';
import {ArrowDownLeft,ArrowUpRight,RefreshCw,WalletCards} from 'lucide-react';
import {supabase,taka,getSettings} from '../lib/supabase';
import PaymentQR from './PaymentQR';
import {getWalletPaymentMethods} from '../lib/paymentMethods';
import {getPaymentProofMime} from '../lib/fileValidation';
import '../wallet.css';

export default function WalletPanel({session}){
  const[balance,setBalance]=useState(null),[transactions,setTransactions]=useState([]),[requests,setRequests]=useState([]),[hasMoreTx,setHasMoreTx]=useState(false),[hasMoreRequests,setHasMoreRequests]=useState(false),[loadingMore,setLoadingMore]=useState(''),[settings,setSettings]=useState({}),[method,setMethod]=useState(''),[amount,setAmount]=useState(''),[proof,setProof]=useState(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  async function load(){
    const{data,error}=await supabase.rpc('get_smm_wallet');
    if(!error)setBalance(Number(data||0));else setMessage('Wallet setup is not available yet. Please contact support.');
    const[{data:tx},{data:dr}]=await Promise.all([supabase.from('wallet_transactions').select('*').eq('user_id',session.user.id).order('created_at',{ascending:false}).range(0,11),supabase.from('deposit_requests').select('*').eq('user_id',session.user.id).order('created_at',{ascending:false}).range(0,11)]);
    setTransactions(tx||[]);setRequests(dr||[]);setHasMoreTx((tx||[]).length===12);setHasMoreRequests((dr||[]).length===12);getSettings().then(setSettings);
  }
  useEffect(()=>{if(session)load();},[session?.user?.id]);
  async function loadMore(kind){const isTx=kind==='tx';const current=isTx?transactions:requests;setLoadingMore(kind);const table=isTx?'wallet_transactions':'deposit_requests';const{data,error}=await supabase.from(table).select('*').eq('user_id',session.user.id).order('created_at',{ascending:false}).range(current.length,current.length+11);if(!error){if(isTx){setTransactions(v=>[...v,...(data||[])]);setHasMoreTx((data||[]).length===12);}else{setRequests(v=>[...v,...(data||[])]);setHasMoreRequests((data||[]).length===12);}}setLoadingMore('');}
  const channels=getWalletPaymentMethods(settings);
  const selected=channels.find(x=>x.name===method);
  function pick(e){const f=e.target.files?.[0];if(!f){setProof(null);return;}if(!getPaymentProofMime(f)){setProof(null);setMessage('Screenshot must be JPG, PNG or WEBP.');return;}if(f.size>5*1024*1024){setProof(null);setMessage('Screenshot must be 5MB or smaller.');return;}setMessage('');setProof(f);}
  async function submit(e){
    e.preventDefault();if(!proof)return setMessage('Upload a screenshot of your successful payment.');
    setBusy(true);setMessage('');let path='';
    try{
      const ext=proof.name.split('.').pop().toLowerCase();path=`uploads/payproof-${crypto.randomUUID()}.${ext}`;
      const{error:uploadError}=await supabase.storage.from('order-files').upload(path,proof,{contentType:getPaymentProofMime(proof)});if(uploadError)throw uploadError;
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
        {selected&&<PaymentQR settings={settings} total={Number(amount||0)} method={selected}/>}
        <label>Payment screenshot *<input type="file" accept="image/*,.jpg,.jpeg,.png,.webp" required onChange={pick}/><small className="muted">JPG, PNG or WEBP · max 5MB{proof?` · Selected: ${proof.name}`:''}</small></label>
        <button className="btn sm" disabled={busy||!channels.length}>{busy?'Submitting…':'Request deposit'}</button>
      </form>:<div className="callout warn">Mobile banking or bank transfer payment is not configured yet. Please contact support.</div>}
      {message&&<p role="status" className={message.startsWith('Deposit submitted')?'ok':'err'}>{message}</p>}
    </div><div className="wallet-recent"><h3>Recent activity</h3>{transactions.length?transactions.map(t=><div className="wallet-transaction" key={t.id}><span className={t.amount>0?'wallet-in':'wallet-out'}>{t.amount>0?<ArrowDownLeft size={15}/>:<ArrowUpRight size={15}/>}</span><div><b>{t.description||t.transaction_type}</b><small>{new Intl.DateTimeFormat('en-BD',{timeZone:'Asia/Dhaka',dateStyle:'medium',timeStyle:'short'}).format(new Date(t.created_at))}</small></div><strong className={t.amount>0?'wallet-positive':''}>{t.amount>0?'+':''}{taka(t.amount)}</strong></div>):<div className="wallet-no-activity">No wallet activity yet.</div>}{hasMoreTx&&<button type="button" className="wallet-refresh" disabled={Boolean(loadingMore)} onClick={()=>loadMore('tx')}>{loadingMore==='tx'?'Loading…':'Load older transactions'}</button>}</div></div>
    <div className="wallet-deposits"><h3>Deposit requests</h3>{requests.length?requests.map(d=><div className="wallet-deposit-row" key={d.id}><span>{d.method} · screenshot submitted<small className="wallet-deposit-note">Request ID: {d.id}</small><small className="wallet-deposit-note">{new Intl.DateTimeFormat('en-BD',{timeZone:'Asia/Dhaka',dateStyle:'medium',timeStyle:'short'}).format(new Date(d.created_at))}</small>{d.admin_note&&<small className="wallet-deposit-note">Admin note: {d.admin_note}</small>}</span><b>{taka(d.amount)}</b><em className={`deposit-${d.status.toLowerCase()}`}>{d.status}</em></div>):<p>No deposit requests yet.</p>}{hasMoreRequests&&<button type="button" className="wallet-refresh" disabled={Boolean(loadingMore)} onClick={()=>loadMore('requests')}>{loadingMore==='requests'?'Loading…':'Load older deposits'}</button>}</div>
  </section>;
}
