import {FileText,Megaphone,TrendingUp,Sparkles,Palette} from 'lucide-react';
export const CAT={'Document & Government Services':{I:FileText,bg:'#dbeafe',fg:'#1d4ed8',tag:'Documents'},'Meta & Social Media Services':{I:Megaphone,bg:'#ede9fe',fg:'#6d28d9',tag:'Meta'},'Social Media Growth':{I:TrendingUp,bg:'#fce7f3',fg:'#be185d',tag:'Growth'},'Digital Subscriptions':{I:Sparkles,bg:'#fef3c7',fg:'#b45309',tag:'Digital'},'Creative Services':{I:Palette,bg:'#dcfce7',fg:'#15803d',tag:'Creative'}};
export const catStyle=c=>CAT[c]||{I:Sparkles,bg:'#e2e8f0',fg:'#334155',tag:'Service'};
// 16:9 cover. Uses the service image when set (object-fit: cover, never stretched); otherwise a category-coloured fallback.
export default function ServiceCover({s,large}){const c=catStyle(s.category);const I=c.I;
return(<div className={'cover'+(large?' large':'')} style={{background:c.bg}}>{s.image_url?<img src={s.image_url} alt={s.name} loading="lazy"/>:<div className="fb" style={{color:c.fg}}><span className="fbi"><I size={large?44:34}/></span><span className="fbt">{s.name}</span></div>}<span className="tag" style={{color:c.fg}}>{c.tag}</span></div>);}
