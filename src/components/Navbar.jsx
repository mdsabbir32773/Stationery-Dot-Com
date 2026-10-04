import {useState} from 'react';import {Link,NavLink} from 'react-router-dom';import {Menu,X} from 'lucide-react';
export default function Navbar(){const[o,setO]=useState(false);const c=()=>setO(false);
return(<header><nav className="nav" aria-label="Main"><div className="wrap"><Link to="/" className="brand" onClick={c}><span className="logo">SD</span>Stationery Dot Com</Link>
<button className="burger" aria-label="Menu" aria-expanded={o} onClick={()=>setO(!o)}>{o?<X size={22}/>:<Menu size={22}/>}</button>
<div className={'links menu'+(o?' open':'')}><NavLink to="/services" onClick={c}>Services</NavLink><NavLink to="/track-order" onClick={c}>Track Order</NavLink><NavLink to="/contact" onClick={c}>Contact</NavLink><Link className="btn sm" to="/services" onClick={c}>Order Now</Link></div></div></nav></header>);}
