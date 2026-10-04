import {createClient} from '@supabase/supabase-js';
export const supabase=createClient(import.meta.env.VITE_SUPABASE_URL||'http://localhost',import.meta.env.VITE_SUPABASE_ANON_KEY||'missing');
export const taka=n=>'৳'+Number(n||0).toLocaleString('en-US');
export async function getSettings(){const{data}=await supabase.from('site_settings').select('*');return Object.fromEntries((data||[]).map(r=>[r.key,r.value]));}
export const ORDER_STATUSES=['Pending','Payment Pending','Payment Received','Processing','Completed','Cancelled','Refunded'];
export const PAY_STATUSES=['Pending','Verification Pending','Paid','Failed','Refunded'];
export const isPdf=u=>/\.pdf(\?|#|$)/i.test(u||'');
