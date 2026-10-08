import {useEffect,useState} from 'react';
import {Link,useLocation} from 'react-router-dom';
import {ShoppingCart,ArrowUpRight} from 'lucide-react';
import {cartCount} from '../pages/Cart';

function MotionReveal(){
  useEffect(()=>{
    const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const nodes=[...document.querySelectorAll('.scard,.catcard,.home-section,.home-benefits,.home-steps,.home-cta,.catalog-category-card,.package-card')];
    if(reduce){nodes.forEach(x=>x.classList.add('sdc-reveal-ready','sdc-reveal-in'));return;}
    const io=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting){entry.target.classList.add('sdc-reveal-in');io.unobserve(entry.target);}
      });
    },{threshold:.08,rootMargin:'0px 0px -40px'});
    nodes.forEach((node,i)=>{
      node.classList.add('sdc-reveal-ready');
      node.style.setProperty('--sdc-delay',Math.min(i%6,5)*45+'ms');
      io.observe(node);
    });
    return()=>io.disconnect();
  });
  return null;
}

function CustomCursor(){
  useEffect(()=>{
    const canHover=window.matchMedia?.('(hover:hover) and (pointer:fine)').matches;
    const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if(!canHover||reduce)return;
    document.documentElement.classList.add('sdc-custom-cursor');
    const move=e=>{
      document.documentElement.style.setProperty('--cursor-x',e.clientX+'px');
      document.documentElement.style.setProperty('--cursor-y',e.clientY+'px');
    };
    const down=()=>document.documentElement.classList.add('sdc-cursor-down');
    const up=()=>document.documentElement.classList.remove('sdc-cursor-down');
    document.addEventListener('pointermove',move,{passive:true});
    document.addEventListener('pointerdown',down,{passive:true});
    document.addEventListener('pointerup',up,{passive:true});
    return()=>{
      document.documentElement.classList.remove('sdc-custom-cursor','sdc-cursor-down');
      document.removeEventListener('pointermove',move);
      document.removeEventListener('pointerdown',down);
      document.removeEventListener('pointerup',up);
    };
  },[]);
  return <span className="sdc-cursor" aria-hidden="true"/>;
}

function FloatingCart(){
  const location=useLocation();
  const[count,setCount]=useState(cartCount());
  useEffect(()=>{
    const sync=()=>setCount(cartCount());
    window.addEventListener('stationery-cart-change',sync);
    return()=>window.removeEventListener('stationery-cart-change',sync);
  },[]);
  if(!count||location.pathname==='/cart')return null;
  return <Link className="sdc-floating-cart" to="/cart" aria-label={`Open cart with ${count} item`}>
    <span className="sdc-floating-cart-icon"><ShoppingCart size={18}/><b>{count}</b></span>
    <span><strong>Cart</strong><small>{count} {count===1?'item':'items'} ready</small></span>
    <ArrowUpRight size={17}/>
  </Link>;
}

export default function ExperienceLayer(){
  return <><MotionReveal/><CustomCursor/><FloatingCart/></>;
}
