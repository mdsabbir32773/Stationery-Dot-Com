import {useEffect,useState} from 'react';
import {Search,Plus,Eye,EyeOff} from 'lucide-react';
import {supabase} from '../../lib/supabase';

const blank={category:'',name:'',slug:'',description:'',requires_file:false,is_popular:false,is_active:true,sort_order:0};
const slugify=value=>value.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

export default function Services(){
  const [services,setServices]=useState([]);
  const [form,setForm]=useState(blank);
  const [message,setMessage]=useState('');
  const [query,setQuery]=useState('');
  const [filter,setFilter]=useState('all');
  const [busy,setBusy]=useState(false);

  const load=async()=>{
    const {data,error}=await supabase.from('services').select('*').order('sort_order');
    if(error){setMessage(error.message);return [];}
    const rows=data||[];
    setServices(rows);
    return rows;
  };
  useEffect(()=>{load();},[]);

  const update=(key,value)=>setForm(current=>({...current,[key]:value}));
  const edit=service=>{
    setForm({...service});
    setMessage('');
    window.scrollTo({top:0,behavior:'smooth'});
  };
  const save=async event=>{
    event.preventDefault();
    setMessage('');

    const sameService=services.find(service=>
      service.id!==form.id
      &&service.name.trim().toLowerCase()===form.name.trim().toLowerCase()
      &&service.category.trim().toLowerCase()===form.category.trim().toLowerCase()
    );
    if(sameService){
      setForm({...sameService});
      setMessage(`“${sameService.name}” is already in ${sameService.category} and is currently ${sameService.is_active?'visible':'hidden'}. I opened it so you can edit it or change its visibility.`);
      window.scrollTo({top:0,behavior:'smooth'});
      return;
    }

    const baseSlug=slugify(form.name)||'service';
    let slug=form.slug||baseSlug;
    if(!form.id){
      let suffix=2;
      while(services.some(service=>service.slug===slug)){
        slug=`${baseSlug}-${suffix++}`;
      }
    }
    const row={...form,category:form.category.trim(),name:form.name.trim(),slug};
    setBusy(true);
    const {error}=await supabase.from('services').upsert(row);
    setBusy(false);
    if(error){
      if(error.code==='23505'&&error.message?.includes('services_slug_key')){
        const fresh=await load();
        const existing=fresh.find(service=>service.slug===slug);
        if(existing){
          setForm({...existing});
          setMessage(`That service link is already used by “${existing.name}” (${existing.is_active?'visible':'hidden'}). I opened the existing service for you.`);
        }else{
          setMessage('That service link is already in use. Refresh the list and edit the existing service.');
        }
      }else{
        setMessage(error.message);
      }
      return;
    }
    setMessage(form.id?'Service updated.':'Service added and visible.');
    setForm(blank);
    await load();
  };

  const toggle=async service=>{
    const {error}=await supabase.from('services').update({is_active:!service.is_active}).eq('id',service.id);
    setMessage(error?error.message:(service.is_active?'Service hidden. You can turn it back on anytime.':'Service is now visible.'));
    await load();
  };

  const uploadImage=async event=>{
    const file=event.target.files?.[0];
    if(!file)return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>2*1024*1024){
      setMessage('Image must be JPG, PNG or WEBP and 2MB or smaller.');
      return;
    }
    const path='services/'+crypto.randomUUID()+'-'+file.name.replace(/[^\w.\-]/g,'_');
    const {error}=await supabase.storage.from('site-assets').upload(path,file);
    if(error){setMessage(error.message);return;}
    setForm(current=>({...current,image_url:supabase.storage.from('site-assets').getPublicUrl(path).data.publicUrl}));
    setMessage('Image uploaded. Save the service to apply it.');
  };

  const categories=[...new Set(services.map(service=>service.category).filter(Boolean))];
  const shown=services.filter(service=>
    (filter==='all'||(filter==='active'?service.is_active:!service.is_active))
    &&(!query||(service.name+' '+service.category).toLowerCase().includes(query.toLowerCase()))
  );

  return <div className="service-admin">
    <div className="admin-heading"><div>
      <span className="eyebrow">Your online catalogue</span>
      <h1>Services</h1>
      <p className="muted">Add only the services you want customers to see. Hidden services stay here and can be restored anytime.</p>
    </div></div>
    {message&&<p className="ok" role="status">{message}</p>}

    <form onSubmit={save} className="card service-editor">
      <div className="service-editor-heading">
        <div><h2>{form.id?'Edit service':'Add a service'}</h2><p>Choose a category or type a new one. Services are visible as soon as they are saved active.</p></div>
        {form.id&&<button type="button" className="btn sm alt" onClick={()=>{setForm(blank);setMessage('');}}>Cancel edit</button>}
      </div>
      <div className="content-fields">
        <label>Category<input value={form.category} onChange={event=>update('category',event.target.value)} list="service-categories" placeholder="e.g. Design" required/><datalist id="service-categories">{categories.map(category=><option key={category} value={category}/>)}</datalist></label>
        <label>Service name<input value={form.name} onChange={event=>update('name',event.target.value)} placeholder="e.g. Custom invitation design" required/></label>
        <label className="form-wide">Description<textarea rows={3} value={form.description||''} onChange={event=>update('description',event.target.value)} placeholder="Briefly describe what customers receive."/></label>
        <label>Display order<input type="number" value={form.sort_order??0} onChange={event=>update('sort_order',Number(event.target.value))}/></label>
        <label>Cover image (optional)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadImage}/></label>
        {form.image_url&&<img src={form.image_url} alt="Service cover preview" className="service-image-preview form-wide"/>}
        <label className="check-label"><input type="checkbox" checked={Boolean(form.requires_file)} onChange={event=>update('requires_file',event.target.checked)}/> Customer uploads a file</label>
        <label className="check-label"><input type="checkbox" checked={Boolean(form.is_popular)} onChange={event=>update('is_popular',event.target.checked)}/> Feature as popular</label>
        <label className="check-label"><input type="checkbox" checked={Boolean(form.is_active)} onChange={event=>update('is_active',event.target.checked)}/> Show this service to customers</label>
      </div>
      <button className="btn" disabled={busy}><Plus size={16}/>{busy?'Saving…':form.id?'Save changes':'Add service'}</button>
    </form>

    <section className="service-list-panel">
      <div className="service-list-heading">
        <div><h2>Service list</h2><p>{services.filter(service=>service.is_active).length} visible · {services.filter(service=>!service.is_active).length} hidden</p></div>
        <label className="search"><Search size={17}/><input aria-label="Search services" placeholder="Find a service" value={query} onChange={event=>setQuery(event.target.value)}/></label>
      </div>
      <div className="chips" role="group" aria-label="Filter services">
        <button type="button" className="chip" aria-pressed={filter==='all'} onClick={()=>setFilter('all')}>All ({services.length})</button>
        <button type="button" className="chip" aria-pressed={filter==='active'} onClick={()=>setFilter('active')}>Visible ({services.filter(service=>service.is_active).length})</button>
        <button type="button" className="chip" aria-pressed={filter==='hidden'} onClick={()=>setFilter('hidden')}>Hidden ({services.filter(service=>!service.is_active).length})</button>
      </div>
      {shown.length?<div className="service-admin-list">{shown.map(service=>
        <article className="service-admin-row" key={service.id}>
          <div>{service.image_url&&<img className="thumb" src={service.image_url} alt=""/>}<div><b>{service.name}</b><small>{service.category}</small></div></div>
          <span className={service.is_active?'service-status visible':'service-status'}>{service.is_active?'Visible':'Hidden'}</span>
          <div className="service-row-actions">
            <button type="button" className="btn sm alt" onClick={()=>edit(service)}>Edit</button>
            <button type="button" className="btn sm alt" onClick={()=>toggle(service)}>{service.is_active?<><EyeOff size={15}/>Hide</>:<><Eye size={15}/>Show</>}</button>
          </div>
        </article>
      )}</div>:<div className="card empty"><p>No services in this view. Add the service you want to offer above.</p></div>}
    </section>
  </div>;
}
