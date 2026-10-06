import {useState} from 'react';

const DEFAULT_LOGO='/stationery-dot-com-logo.webp';

export default function BrandLogo({src, name='Stationery Dot Com', className=''}) {
  const [failed,setFailed]=useState(false);
  const logo=src||DEFAULT_LOGO;
  return !failed
    ? <img className={className ? `brand-image ${className}` : 'brand-image'} src={logo} alt={name} onError={()=>setFailed(true)} />
    : <span className="logo" aria-hidden="true">SD</span>;
}
