import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {Heart,Trash2,ArrowRight} from 'lucide-react';
import {supabase} from '../lib/supabase';

export default function SavedServices({session}){
 const[rows,setRows]=useState([]);const[loading,setLoading]=useState(true);const[error,setError]=useState('');
 async function load(){if(!session?.user?.id)return;setLoading(true);const{data,error}=await supabase.from('customer_saved_services').select('id,service_id,created_at,services(id,name,slug,category,image_url)').eq('user_id',session.user.id).order('created_at',{ascending:false});if(error)setError(error.message);setRows((data||[]).filter(x=>x.services));setLoading(false);}
 useEffect(()=>{load();},[session?.user?.id]);
 async function remove(id){const{error}=await supabase.from('customer_saved_services').delete().eq('id',id).eq('user_id',session.user.id);if(error)setError(error.message);else setRows(v=>v.filter(x=>x.id!==id));}
 return <section className="account-panel saved-services-panel"><div className="panel-title"><span className="account-icon"><Heart size={20}/></span><div><h2>Saved services</h2><p>Your personal service wishlist</p></div></div>{error&&<p className="err" role="alert">{error}</p>}{loading?<p className="muted">Loading saved services…</p>:rows.length?<div className="saved-service-list">{rows.map(x=><article className="saved-service-row" key={x.id}>{x.services.image_url&&<img src={x.services.image_url} alt="" loading="lazy"/>}<div><b>{x.services.name}</b><small>{x.services.category}</small><Link to={'/services/'+x.services.slug}>View service <ArrowRight size={13}/></Link></div><button type="button" aria-label={'Remove '+x.services.name+' from saved services'} onClick={()=>remove(x.id)}><Trash2 size={16}/></button></article>)}</div>:<p className="muted">No saved services yet. Open a service and tap “Save service” to keep it here.</p>}</section>;
}