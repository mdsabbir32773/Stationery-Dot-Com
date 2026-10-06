import {useEffect,useMemo,useState} from 'react';
import {Search,Plus,PackageOpen,Eye,EyeOff,Trash2,PenLine} from 'lucide-react';
import {supabase,taka} from '../../lib/supabase';

const fresh=()=>({service_id:'',name:'',description:'',price:'',unit:'per order',is_active:true,sort_order:0,access_type:null,duration_months:null});
const SUBSCRIPTION_DURATIONS=[{months:1,label:'1 Month'},{months:6,label:'6 Months'},{months:12,label:'1 Year'},{months:24,label:'2 Years'},{months:36,label:'3 Years'},{months:48,label:'4 Years'},{months:60,label:'5 Years'},{months:0,label:'Lifetime'}];
const durationLabel=n=>SUBSCRIPTION_DURATIONS.find(d=>d.months===Number(n))?.label||'';
const isSubscription=s=>s?.category?.trim().toLowerCase()==='digital subscriptions';

export default function Packages(){
  const [services,setServices]=useState([]);
  const [packages,setPackages]=useState([]);
  const [form,setForm]=useState(fresh);
  const [message,setMessage]=useState('');
  const [query,setQuery]=useState('');
  const [category,setCategory]=useState('all');
  const [visibility,setVisibility]=useState('all');
  const [busy,setBusy]=useState(false);

  const load=async()=>{
    const [serviceResult,packageResult]=await Promise.all([
      supabase.from('services').select('id,name,category,is_active').order('category').order('name'),
      supabase.from('packages').select('*,services(id,name,category,is_active)').order('sort_order').order('name')
    ]);
    if(serviceResult.error||packageResult.error){setMessage(serviceResult.error?.message||packageResult.error?.message||'Could not load packages.');return;}
    setServices(serviceResult.data||[]);
    setPackages(packageResult.data||[]);
  };
  useEffect(()=>{load();},[]);

  const selectedService=services.find(s=>s.id===form.service_id);
  const subscription=isSubscription(selectedService);
  const categories=[...new Set(services.map(s=>s.category).filter(Boolean))];
  const summary=useMemo(()=>{
    const available=packages.filter(p=>p.is_active&&p.services?.is_active).length;
    return {total:packages.length,available,hidden:packages.length-available};
  },[packages]);
  const visible=useMemo(()=>{
    const term=query.trim().toLowerCase();
    return packages.filter(p=>{
      const service=p.services||{};
      const matchesCategory=category==='all'||service.category===category;
      const isAvailable=Boolean(p.is_active&&service.is_active);
      const matchesVisibility=visibility==='all'||(visibility==='available'?isAvailable:!isAvailable);
      const text=[service.name,service.category,p.name,p.description].filter(Boolean).join(' ').toLowerCase();
      return matchesCategory&&matchesVisibility&&(!term||text.includes(term));
    });
  },[packages,query,category,visibility]);
  const groups=useMemo(()=>{
    const map=new Map();
    visible.forEach(p=>{const key=p.service_id;const current=map.get(key)||{service:p.services||{name:'Unknown service'},packages:[]};current.packages.push(p);map.set(key,current);});
    return [...map.values()].sort((a,b)=>(a.service.category||'').localeCompare(b.service.category||'')||(a.service.name||'').localeCompare(b.service.name||''));
  },[visible]);

  const update=(key,value)=>setForm(current=>({...current,[key]:value}));
  const chooseService=id=>setForm(current=>({...current,service_id:id,access_type:null,duration_months:null}));
  const edit=p=>{
    setForm({...fresh(),...p,service_id:p.service_id,price:String(p.price),unit:p.unit||'per order'});
    setMessage('');
    window.scrollTo({top:0,behavior:'smooth'});
  };
  const save=async e=>{
    e.preventDefault();
    setMessage('');
    if(!form.service_id)return setMessage('Choose a service first.');
    if(subscription&&(!form.access_type||form.duration_months===null||!SUBSCRIPTION_DURATIONS.some(d=>d.months===Number(form.duration_months))))return setMessage('Choose both access type and a valid subscription duration.');
    setBusy(true);
    const row={...form,price:Number(form.price),access_type:subscription?form.access_type:null,duration_months:subscription?Number(form.duration_months):null};
    delete row.services;
    const {error}=await supabase.from('packages').upsert(row);
    setBusy(false);
    if(error){setMessage(error.message);return;}
    setMessage(form.id?'Package updated.':'Package added.');
    setForm(fresh());
    await load();
  };
  const toggle=async p=>{
    const {error}=await supabase.from('packages').update({is_active:!p.is_active}).eq('id',p.id);
    setMessage(error?error.message:(p.is_active?'Package hidden.':'Package activated.'));
    await load();
  };
  const remove=async p=>{
    if(!window.confirm('Delete this package permanently? Existing orders may prevent deletion.'))return;
    const {error}=await supabase.from('packages').delete().eq('id',p.id);
    setMessage(error?error.message:'Package deleted.');
    await load();
  };

  return <div className="package-admin">
    <header className="admin-heading">
      <div><span className="eyebrow">Keep your catalogue clear</span><h1>Packages &amp; pricing</h1><p className="muted">Create, group and update the options customers can order.</p></div>
      <a className="btn alt" href="/services" target="_blank" rel="noreferrer">View customer catalogue</a>
    </header>

    <div className="package-stats" aria-label="Package summary">
      <div><span>All packages</span><b>{summary.total}</b></div>
      <div><span>Available to customers</span><b>{summary.available}</b></div>
      <div><span>Hidden</span><b>{summary.hidden}</b></div>
    </div>

    {message&&<p className="ok" role="status">{message}</p>}
    <form onSubmit={save} className="card package-editor">
      <div className="package-editor-heading"><div><h2>{form.id?'Edit package':'Add a package'}</h2><p>Packages appear on the matching service page when both are active.</p></div>{form.id&&<button type="button" className="btn sm alt" onClick={()=>setForm(fresh())}>Cancel edit</button>}</div>
      <div className="content-fields">
        <label className="form-wide">Service
          <select value={form.service_id} onChange={e=>chooseService(e.target.value)} required>
            <option value="">Select a service…</option>
            {categories.map(c=><optgroup key={c} label={c}>{services.filter(s=>s.category===c).map(s=><option key={s.id} value={s.id}>{s.name}{s.is_active?'':' (hidden)'}</option>)}</optgroup>)}
            {services.filter(s=>!s.category).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label>Package or plan name<input value={form.name} onChange={e=>update('name',e.target.value)} placeholder="e.g. Canva Pro" required maxLength={120}/></label>
        <label>Price (৳)<input type="number" min="0" step="0.01" value={form.price} onChange={e=>update('price',e.target.value)} required/></label>
        <label className="form-wide">Description <span className="muted">(optional)</span><textarea rows="3" value={form.description||''} onChange={e=>update('description',e.target.value)} placeholder="What is included in this option?"/></label>
        {subscription?<><label>Access type<select value={form.access_type||''} onChange={e=>update('access_type',e.target.value||null)} required><option value="">Choose access…</option><option value="shared">Shared</option><option value="personal">Personal</option></select></label><label>Subscription duration<select value={form.duration_months||''} onChange={e=>update('duration_months',e.target.value||null)} required><option value="">Choose duration…</option>{SUBSCRIPTION_DURATIONS.map(d=><option key={d.months} value={d.months}>{d.label}</option>)}</select></label></>:<label>Price unit<input value={form.unit||''} onChange={e=>update('unit',e.target.value)} placeholder="e.g. per order, per month"/></label>}
        <label>Display order<input type="number" value={form.sort_order??0} onChange={e=>update('sort_order',Number(e.target.value))}/></label>
        <label className="check-label"><input type="checkbox" checked={Boolean(form.is_active)} onChange={e=>update('is_active',e.target.checked)}/> Make this package available</label>
      </div>
      {subscription&&<p className="package-tip">Each access type and duration is saved as a separate option. Add another package to offer a different combination.</p>}
      <button className="btn" disabled={busy}><Plus size={16}/>{busy?'Saving…':form.id?'Save changes':'Add package'}</button>
    </form>

    <section className="package-list-panel">
      <div className="package-list-heading"><div><h2>Your packages</h2><p>{visible.length} option{visible.length===1?'':'s'} shown, organized by service</p></div><label className="search"><Search size={17}/><input aria-label="Search packages" placeholder="Search packages or services" value={query} onChange={e=>setQuery(e.target.value)}/></label></div>
      <div className="package-filters">
        <label>Category<select value={category} onChange={e=>setCategory(e.target.value)}><option value="all">All categories</option>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
        <label>Show<select value={visibility} onChange={e=>setVisibility(e.target.value)}><option value="all">All packages</option><option value="available">Available</option><option value="hidden">Hidden</option></select></label>
      </div>
      {groups.length?<div className="package-groups">{groups.map(({service,packages:items})=><article className="package-group" key={service.id||service.name}>
        <header><div><span className="eyebrow">{service.category||'Uncategorized'}</span><h3>{service.name}</h3></div><span className={service.is_active?'service-status visible':'service-status'}>{service.is_active?'Service visible':'Service hidden'}</span></header>
        <div className="package-options">{items.map(p=>{const available=Boolean(p.is_active&&service.is_active);return <div className="package-option" key={p.id}>
          <div className="package-option-main"><div><b>{p.name}</b>{p.description&&<p>{p.description}</p>}{p.access_type&&<div className="package-tags"><span>{p.access_type==='shared'?'Shared access':'Personal access'}</span><span>{durationLabel(p.duration_months)}</span></div>}</div><div className="package-price">{taka(p.price)} <small>{p.access_type?'':'/ '+(p.unit||'per order')}</small></div></div>
          <div className="package-option-actions"><span className={available?'service-status visible':'service-status'}>{available?'Available':'Hidden'}</span><button type="button" className="btn sm alt" onClick={()=>edit(p)}><PenLine size={14}/>Edit</button><button type="button" className="btn sm alt" onClick={()=>toggle(p)}>{p.is_active?<><EyeOff size={14}/>Hide</>:<><Eye size={14}/>Activate</>}</button><button type="button" className="btn sm red" aria-label={'Delete '+p.name} onClick={()=>remove(p)}><Trash2 size={14}/></button></div>
        </div>;})}</div>
      </article>)}</div>:<div className="card empty"><PackageOpen size={24}/><p>No matching packages. Change the filters or add a package above.</p></div>}
    </section>
  </div>;
}