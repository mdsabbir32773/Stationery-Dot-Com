import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquareText, Star } from 'lucide-react';
import { supabase } from '../lib/supabase';

function Stars({ value = 0, interactive = false, onChange }) {
  return <div className={`review-stars${interactive ? ' is-interactive' : ''}`} role={interactive ? 'radiogroup' : 'img'} aria-label={`${value} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map(n => <button key={n} type="button" aria-label={`${n} star${n === 1 ? '' : 's'}`} aria-checked={interactive ? value === n : undefined} role={interactive ? 'radio' : undefined} className={n <= value ? 'filled' : ''} disabled={!interactive} onClick={() => onChange?.(n)}><Star size={19} fill={n <= value ? 'currentColor' : 'none'} /></button>)}
  </div>;
}

export function OrderReviewForm({ order, existing, onSubmitted }) {
  const [rating, setRating] = useState(existing?.rating || 0);
  const [review, setReview] = useState(existing?.review || '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  if (existing) return <div className="review-submitted"><Stars value={existing.rating} /><span>{existing.status === 'approved' ? 'Your review is published.' : existing.status === 'rejected' ? 'This review is not published.' : 'Your review is waiting for approval.'}</span></div>;
  async function submit(e) {
    e.preventDefault(); if (!rating) return setMessage('Choose a star rating first.'); if (!review.trim()) return setMessage('Please write a short review.');
    setBusy(true); setMessage('');
    const { error } = await supabase.from('service_reviews').insert({ order_id: order.id, service_id: order.service_id, rating, review: review.trim() });
    setBusy(false);
    if (error) return setMessage(error.code === '23505' ? 'A review has already been sent for this order.' : 'Could not submit your review. Please try again.');
    setMessage('Thanks! Your review will appear after a quick review.'); onSubmitted?.();
  }
  return <form className="order-review-form" onSubmit={submit}>
    <div className="review-form-top"><div><b>How was this service?</b><span>Order {order.order_code}</span></div><Stars value={rating} interactive onChange={setRating} /></div>
    <label className="sr-only" htmlFor={`review-${order.id}`}>Write a review</label>
    <textarea id={`review-${order.id}`} rows="3" minLength="1" maxLength="1200" required value={review} onChange={e => setReview(e.target.value)} placeholder="Share a little about your experience…" />
    <div className="review-form-actions"><span>{message}</span><button className="btn sm" disabled={busy || !rating}>{busy ? 'Sending…' : 'Submit review'}</button></div>
  </form>;
}

export function OrderReviews({ orders, reviews, onSubmitted }) {
  const completed = orders.filter(o => o.status === 'Completed' && o.service_id);
  if (!completed.length) return null;
  return <section className="account-panel account-reviews"><div className="panel-title"><span className="account-icon"><MessageSquareText size={20}/></span><div><h2>Rate and review</h2><p>Share feedback on your completed services.</p></div></div><div className="account-review-list">{completed.map(o => <div className="account-review-row" key={o.id}><div className="account-review-title"><b>{o.service_name}</b><span>{o.order_code}</span></div><OrderReviewForm order={o} existing={reviews[o.id]} onSubmitted={onSubmitted}/></div>)}</div></section>;
}

export function ServiceReviews({ serviceId }) {
  const [reviews, setReviews] = useState([]);
  const [user, setUser] = useState(null);
  const [eligible, setEligible] = useState([]);
  const [mine, setMine] = useState({});
  const [selected, setSelected] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let alive = true;
    (async () => {
      const [{ data }, { data: auth }] = await Promise.all([
        supabase.from('service_reviews').select('id,rating,review,created_at').eq('service_id', serviceId).eq('status', 'approved').order('created_at', { ascending: false }),
        supabase.auth.getUser()
      ]);
      if (!alive) return; setReviews(data || []); setUser(auth?.user || null);
      if (auth?.user) {
        const { data: orders } = await supabase.from('orders').select('id,order_code,service_id,service_name,status').eq('customer_id', auth.user.id).eq('service_id', serviceId).eq('status', 'Completed').order('created_at', { ascending: false });
        const { data: mineRows } = await supabase.from('service_reviews').select('order_id,rating,review,status').eq('user_id', auth.user.id);
        if (!alive) return;
        setEligible(orders || []); setMine(Object.fromEntries((mineRows || []).map(x => [x.order_id, x])));
        const candidate = (orders || []).find(x => !(mineRows || []).some(r => r.order_id === x.id));
        setSelected(candidate?.id || '');
      }
    })(); return () => { alive = false; };
  }, [serviceId, refresh]);
  const average = reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : 0;
  const candidate = eligible.find(o => !mine[o.id]);
  return <section className="service-reviews" id="reviews">
    <div className="reviews-heading"><div><span className="eyebrow">Customer feedback</span><h2>Reviews</h2><p>Real feedback from customers who completed an order.</p></div><div className="reviews-score"><b>{reviews.length ? average.toFixed(1) : '—'}</b><Stars value={Math.round(average)} /><span>{reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}</span></div></div>
    {candidate && <div className="review-compose"><div className="review-compose-icon"><MessageSquareText size={19} /></div><div className="review-compose-body"><label htmlFor="review-order">Your completed order</label><select id="review-order" value={selected} onChange={e => setSelected(e.target.value)}>{eligible.filter(o => !mine[o.id]).map(o => <option key={o.id} value={o.id}>{o.order_code}</option>)}</select><OrderReviewForm key={selected} order={eligible.find(o => o.id === selected) || candidate} onSubmitted={() => setRefresh(x => x + 1)} /></div></div>}
    {user && eligible.length > 0 && !candidate && <p className="review-thanks">You’ve reviewed all your completed orders for this service. Thank you!</p>}
    {!user && <p className="review-signin"><Link to={`/account?next=${encodeURIComponent(`${window.location.pathname}#reviews`)}`}>Sign in</Link> with the account used for your completed order to leave a review.</p>}
    {reviews.length ? <div className="review-list">{reviews.map(r => <article className="review-item" key={r.id}><div className="review-item-top"><Stars value={r.rating} /><time>{new Date(r.created_at).toLocaleDateString()}</time></div><p>{r.review}</p></article>)}</div> : <div className="reviews-empty"><MessageSquareText size={20} /><span>No reviews yet. Completed customers can be the first to share feedback.</span></div>}
  </section>;
}
