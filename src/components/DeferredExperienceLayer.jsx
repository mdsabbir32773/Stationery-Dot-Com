import {useEffect,useState,Suspense,lazy} from 'react';
const ExperienceLayer=lazy(()=>import('./ExperienceLayer.jsx'));
export default function DeferredExperienceLayer(){
  const [ready,setReady]=useState(false);
  useEffect(()=>{
    const activate=()=>setReady(true);
    window.addEventListener('pointerdown',activate,{once:true,passive:true});
    window.addEventListener('keydown',activate,{once:true});
    window.addEventListener('scroll',activate,{once:true,passive:true});
    return()=>{
      window.removeEventListener('pointerdown',activate);
      window.removeEventListener('keydown',activate);
      window.removeEventListener('scroll',activate);
    };
  },[]);
  return ready?<Suspense fallback={null}><ExperienceLayer/></Suspense>:null;
}
