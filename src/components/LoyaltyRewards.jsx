import {useEffect,useState} from 'react';
import {Gift,Copy,Users,Star,Share2} from 'lucide-react';
import {supabase} from '../lib/supabase';

export default function LoyaltyRewards({session}){
  const [summary,setSummary]=useState(null);
  const [history,setHistory]=useState([]);
  const [referralInput,setReferralInput]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const [copied,setCopied]=useState(false);
  const inviteUrl=summary?.referral_code?window.location.origin+'/account?ref='+encodeURIComponent(summary.referral_code):'';

  async function load(){
    const [{data:summaryRows,error:summaryError},{data:rows,error:historyError}]=await Promise.all([
      supabase.rpc('get_my_loyalty_summary'),
      supabase.from('loyalty_transactions').select('id,points,transaction_type,description,created_at').eq('user_id',session.user.id).order('created_at',{ascending:false}).limit(30)
    ]);
    if(summaryError){setError(summaryError.message);return;}
    if(historyError){setError(historyError.message);return;}
    setSummary(summaryRows?.[0]||null);setHistory(rows||[]);
  }
  useEffect(()=>{if(session?.user?.id)load();},[session?.user?.id]);
  useEffect(()=>{
    const code=new URLSearchParams(window.location.search).get('ref')||localStorage.getItem('sdc_pending_referral');
    if(code && session?.user?.id){setReferralInput(code.toUpperCase());}
  },[session?.user?.id]);

  async function applyCode(e){
    e.preventDefault();setBusy(true);setError('');setMessage('');
    const {data,error}=await supabase.rpc('apply_referral_code',{p_code:referralInput.trim()});
    setBusy(false);
    if(error){setError(error.message);return;}
    setMessage(data||'Referral code applied.');setReferralInput('');localStorage.removeItem('sdc_pending_referral');const url=new URL(window.location.href);url.searchParams.delete('ref');window.history.replaceState({},'',url);
  }
  async function copyInvite(){
    try{await navigator.clipboard.writeText(inviteUrl);setCopied(true);setTimeout(()=>setCopied(false),1800);}
    catch{setError('Could not copy automatically. Please copy the invite link manually.');}
  }
  async function copyCode(){try{await navigator.clipboard.writeText(summary.referral_code);setCopied(true);}catch{setError('Could not copy code.');}}
  async function shareInvite(){
    if(navigator.share){try{await navigator.share({title:'Join Stationery Dot Com',text:'Sign up using my invite link and earn rewards on your first completed order.',url:inviteUrl});}catch{}}
    else copyInvite();
  }
  if(!session?.user?.id)return null;
  return <section className="account-panel loyalty-panel">
    <div className="panel-title"><span className="account-icon"><Gift size={20}/></span><div><h2>Rewards & Invite</h2><p>Earn points on completed orders and invite friends.</p></div></div>
    <div className="loyalty-stats">
      <div><span>Available points</span><strong>{Number(summary?.points_balance||0).toLocaleString('en-BD')} pts</strong></div>
      <div><span>Total earned</span><strong>{Number(summary?.lifetime_earned||0).toLocaleString('en-BD')} pts</strong></div>
      <div><span>Successful invites</span><strong>{Number(summary?.successful_referrals||0).toLocaleString('en-BD')}</strong></div>
    </div>
    <div className="loyalty-how"><b><Star size={15}/> Earn & redeem</b><p>Get 1 point for every ৳100 in an eligible completed order. Redeem 100 points for ৳10 off at checkout. When a friend joins with your code and completes their first eligible order, both of you receive 100 bonus points.</p><small>Redeemed points stay reserved while the order is pending and are automatically returned if the order is cancelled or refunded. SMM panel orders do not earn or redeem points.</small></div>
    {summary?.referral_code&&<div className="loyalty-invite"><label>Your personal invite code</label><div className="loyalty-code-row"><strong>{summary.referral_code}</strong><button type="button" className="btn alt sm" onClick={copyCode}><Copy size={14}/> Copy code</button></div><label>Invite link</label><div className="loyalty-code-row"><input readOnly value={inviteUrl}/><button type="button" className="btn sm" onClick={shareInvite}><Share2 size={14}/> {copied?'Copied':'Share'}</button></div></div>}
    <form className="loyalty-apply" onSubmit={applyCode}><label htmlFor="referral-code-input">Have an invite code?</label><div className="loyalty-code-row"><input id="referral-code-input" value={referralInput} onChange={e=>setReferralInput(e.target.value.toUpperCase())} placeholder="Enter invite code" maxLength={16}/><button className="btn sm" disabled={busy||!referralInput.trim()}>{busy?'Applying…':'Apply code'}</button></div><small>Apply before placing your first order. A code can only be applied once.</small></form>
    {message&&<p className="ok" role="status">{message}</p>}{error&&<p className="err" role="alert">{error}</p>}
    <div className="loyalty-history"><b><Users size={15}/> Points activity</b>{history.length?history.map(item=><div className="loyalty-history-row" key={item.id}><span><b>{item.description}</b><small>{new Date(item.created_at).toLocaleDateString('en-BD')}</small></span><strong className={item.points>0?'positive':'negative'}>{item.points>0?'+':''}{item.points} pts</strong></div>):<p className="muted">Your points activity will appear here after you earn rewards.</p>}</div>
  </section>;
}
