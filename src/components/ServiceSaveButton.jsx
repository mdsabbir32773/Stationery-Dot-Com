import {useEffect,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {Heart} from 'lucide-react';
import {supabase} from '../lib/supabase';

export default function ServiceSaveButton({service}){
  const [userId,setUserId]=useState(null);
  const [saved,setSaved]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const navigate=useNavigate();
  useEffect(()=>{let live=true;(async()=>{const{data:{user}}=await supabase.auth.getUser();if(!live||!user)return;setUserId(user.id);const{data}=await supabase.from('customer_saved_services').select('id').eq('user_id',user.id).eq('service_id',service.id).maybeSingle();if(live)setSaved(Boolean(data));})();return()=>{live=false};},[service.id]);
  async function toggle(){setError('');if(!userId){navigate('/account?next='+encodeURIComponent(window.location.pathname));return;}setBusy(true);if(saved){const{error}=await supabase.from('customer_saved_services').delete().eq('user_id',userId).eq('service_id',service.id);if(error)setError(error.message);else setSaved(false);}else{const{error}=await supabase.from('customer_saved_services').insert({user_id:userId,service_id:service.id});if(error)setError(error.message);else setSaved(true);}setBusy(false);}
  return <div className="service-save-wrap"><button type="button" className={'service-save-button'+(saved?' is-saved':'')} onClick={toggle} disabled={busy} aria-pressed={saved} aria-label={busy?'Saving…':saved?'Saved':'Save service'}><Heart size={17} fill={saved?'currentColor':'none'}/>{busy?'Saving…':saved?'Saved':'Save service'}</button>{error&&<small role="alert" className="err">{error}</small>}</div>;
}