import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {Clock3,ArrowRight} from 'lucide-react';
import {publicRows} from '../lib/publicData';
import {getRecentServiceIds} from '../lib/recentServices';
import ServiceCard from './ServiceCard';

export default function RecentlyViewed(){
 const[rows,setRows]=useState([]);
 useEffect(()=>{let live=true;(async()=>{const ids=getRecentServiceIds();if(!ids.length)return;const{data}=await publicRows('services',{select:'*,packages(price,is_active)',id:'in.('+ids.join(',')+')',is_active:'eq.true'});if(live){const byId=Object.fromEntries((data||[]).map(x=>[x.id,x]));setRows(ids.map(id=>byId[id]).filter(Boolean));}})();return()=>{live=false};},[]);
 if(!rows.length)return null;
 return <section className="home-section recently-viewed-section"><div className="section-heading"><div><span className="section-overline"><Clock3 size={13}/> PICK UP WHERE YOU LEFT OFF</span><h2>Recently viewed</h2><p>Services you looked at on this device.</p></div><Link className="text-link" to="/services">All services <ArrowRight size={15}/></Link></div><div className="grid">{rows.map(s=><ServiceCard key={s.id} s={s}/>)}</div></section>;
}