import {Link} from 'react-router-dom';import {Phone,MapPin} from 'lucide-react';import {CATEGORIES} from '../data/services';
export default function Footer(){return(<footer><div className="wrap cols"><div><b style={{color:'#fff',fontSize:18}}>Stationery Dot Com</b><p>Your Digital, Travel &amp; Meta Solution Hub</p><p><MapPin size={14}/> 116,117 G-Nat Tower (2nd Floor), Fakirapool, VIP Road, Dhaka-1000</p>
<p><Phone size={14}/> <a href="tel:01827680520">01827-680520</a> · <a href="tel:01611103453">01611-103453</a></p></div>
<div><h4>Categories</h4><ul>{CATEGORIES.map(c=><li key={c.name}><Link to={`/services?category=${encodeURIComponent(c.name)}`}>{c.name}</Link></li>)}</ul></div>
<div><h4>Help</h4><ul><li><Link to="/services">All services</Link></li><li><Link to="/track-order">Track order</Link></li><li><Link to="/contact">Contact</Link></li></ul></div></div></footer>);}
