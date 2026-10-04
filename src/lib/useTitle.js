import {useEffect} from 'react';
const setMeta=(sel,v)=>{const m=document.querySelector(sel);if(m&&v)m.content=v;};
export default function useTitle(t,d){useEffect(()=>{const title=t+' | Stationery Dot Com';document.title=title;setMeta('meta[name=description]',d);setMeta('meta[property="og:title"]',title);setMeta('meta[property="og:description"]',d);},[t,d]);}
