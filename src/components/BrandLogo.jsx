export default function BrandLogo({src, name='Stationery Dot Com', className=''}) {
  return src
    ? <img className={className ? `brand-image ${className}` : 'brand-image'} src={src} alt={name} />
    : <span className="logo" aria-hidden="true">SD</span>;
}
