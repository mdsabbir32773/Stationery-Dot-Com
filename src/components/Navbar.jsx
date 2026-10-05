import {useEffect,useState} from 'react';
import {Link,NavLink} from 'react-router-dom';
import {Menu,UserRound,X} from 'lucide-react';
import {getSettings,supabase} from '../lib/supabase';

export default function Navbar(){
  const[open,setOpen]=useState(false);
  const[name,setName]=useState('');
  const[logged,setLogged]=useState(false);
  const close=()=>setOpen(false);
  useEffect(()=>{
    getSettings().then(s=>setName(s.site_name||'')).catch(()=>{});
    supabase.auth.getSession().then(({data})=>setLogged(Boolean(data.session))).catch(()=>{});
    const{data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>setLogged(Boolean(session)));
    return()=>subscription.unsubscribe();
  },[]);
  useEffect(()=>{
    if(!open)return;
    const onKeyDown=event=>{if(event.key==='Escape')close();};
    window.addEventListener('keydown',onKeyDown);
    return()=>window.removeEventListener('keydown',onKeyDown);
  },[open]);
  return(
    <header><nav className="nav" aria-label="Main navigation"><div className="wrap">
      <Link to="/" className="brand" onClick={close}><span className="logo">SD</span>{name||'Stationery Dot Com'}</Link>
      <button type="button" className="burger" aria-label={open?'Close navigation menu':'Open navigation menu'} aria-controls="site-navigation" aria-expanded={open} onClick={()=>setOpen(value=>!value)}>{open?<X size={22}/>:<Menu size={22}/>}</button>
      <div id="site-navigation" className={'links menu'+(open?' open':'')}>
        <NavLink to="/services" onClick={close}>Services</NavLink><NavLink to="/track-order" onClick={close}>Track Order</NavLink><NavLink to="/contact" onClick={close}>Contact</NavLink>
        <Link className="account-nav" to="/account" onClick={close}><UserRound size={16}/>{logged?'My account':'Sign in'}</Link><Link className="btn sm" to="/services" onClick={close}>Explore services</Link>
      </div></div></nav></header>
  );
}
