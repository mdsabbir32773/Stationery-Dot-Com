import { useEffect, useState } from 'react';
import { Check, Clock3, Star, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function Reviews() {
  const [rows, setRows] = useState(null); const [filter, setFilter] = useState('pending'); const [busy, setBusy] = useState('');
  async function load() { const { data } = await supabase.from('service_reviews').select('*,orders(order_code,customer_name),services(name)').order('created_at', { ascending: false }); setRows(data || []); }
  useEffect(() => { load(); }, []);
  async function moderate(row, status) { setBusy(row.id); await supabase.from('service_reviews').update({ status, reviewed_at: new Date().toISOString() }).eq('id', row.id); await load(); setBusy(''); }
  const list = (rows || []).filter(r => filter === 'all' || r.status === filter);
  return <><div className="admin-heading"><div><span className="eyebrow">Customer voice</span><h1>Reviews</h1><p className="muted">Approve feedback before it appears publicly.</p></div><select className="admin-review-filter" value={filter} onChange={e => setFilter(e.target.value)}><option value="pending">Awaiting approval</option><option value="approved">Published</option><option value="rejected">Hidden</option><option value="all">All reviews</option></select></div>
    {rows === null ? <div className="sk" /> : <div className="admin-review-list">{list.map(r => <article className="card admin-review" key={r.id}><div className="admin-review-header"><div><b>{r.services?.name || 'Service'}</b><span>{r.orders?.customer_name || 'Customer'} · {r.orders?.order_code || 'Order'} · {new Date(r.created_at).toLocaleDateString()}</span></div><span className={`review-status ${r.status}`}><Clock3 size={14}/>{r.status}</span></div><div className="review-stars"><span className="filled">{Array.from({length:r.rating},(_,i)=><Star key={i} size={16} fill="currentColor"/>)}</span></div><p className="admin-review-text">{r.review}</p>{r.status !== 'approved' && <button className="btn sm" disabled={!!busy} onClick={() => moderate(r, 'approved')}><Check size={15}/>{busy === r.id ? 'Saving…' : 'Approve'}</button>}{r.status !== 'rejected' && <button className="btn sm alt review-hide" disabled={!!busy} onClick={() => moderate(r, 'rejected')}><X size={15}/>Hide</button>}</article>)}{!list.length && <div className="card empty">No reviews in this view.</div>}</div>}</>;
}
