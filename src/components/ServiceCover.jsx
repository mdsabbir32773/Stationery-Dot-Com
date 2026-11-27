import {FileText,Megaphone,TrendingUp,Sparkles,Palette,Share2} from 'lucide-react';
export const CAT={'Document & Government Services':{I:FileText,bg:'#edf3ff',fg:'#31569b',tag:'Documents'},'Meta & Social Media Services':{I:Megaphone,bg:'#edf3ff',fg:'#31569b',tag:'Meta'},'Social Media Growth':{I:TrendingUp,bg:'#edf3ff',fg:'#31569b',tag:'Growth'},'SMM Panel Services':{I:Share2,bg:'#e5edfc',fg:'#24447f',tag:'SMM'},'Digital Subscriptions':{I:Sparkles,bg:'#edf3ff',fg:'#31569b',tag:'Digital'},'Creative Services':{I:Palette,bg:'#edf3ff',fg:'#31569b',tag:'Creative'}};
export const catStyle=c=>CAT[c]||{I:Sparkles,bg:'#e2e8f0',fg:'#334155',tag:'Service'};
// Serve resized WebP for Supabase/Unsplash images where supported. If a remote
// image optimizer is unavailable, the component safely falls back to the source.
function optimizedImageUrl(source,large){
  if(!source)return source;
  try{
    const url=new URL(source,window.location.origin);
    const width=large?1280:640;
    if(url.hostname.endsWith('.supabase.co')&&url.pathname.includes('/storage/v1/object/public/')){
      url.pathname=url.pathname.replace('/storage/v1/object/public/','/storage/v1/render/image/public/');
      url.search='';
      url.searchParams.set('width',String(width));
      url.searchParams.set('quality','75');
      url.searchParams.set('format','webp');
      url.searchParams.set('resize','cover');
      return url.toString();
    }
    if(url.hostname==='images.unsplash.com'){
      url.searchParams.set('w',String(width));
      url.searchParams.set('q','75');
      url.searchParams.set('fm','webp');
      url.searchParams.set('fit','crop');
      return url.toString();
    }
  }catch{}
  return source;
}
// 16:9 cover. Uses a responsive, compressed remote image when available.
export default function ServiceCover({s,large,priority=false}){
  const c=catStyle(s.category);const I=c.I;const source=s.image_url;
  const src=optimizedImageUrl(source,large);
  const fallback=e=>{const img=e.currentTarget;if(img.dataset.originalFallback==='1')return;img.dataset.originalFallback='1';img.src=source;};
  return(<div className={'cover'+(large?' large':'')} style={{background:c.bg}}>{source?<img src={src} onError={fallback} alt={s.name} width={large?1280:640} height={large?720:360} loading={large||priority?'eager':'lazy'} fetchPriority={large||priority?'high':'auto'} decoding="async"/>:<div className="fb" style={{color:c.fg}}><span className="fbi"><I size={large?44:34}/></span><span className="fbt">{s.name}</span></div>}<span className="tag" style={{color:c.fg}}>{c.tag}</span></div>);
}
