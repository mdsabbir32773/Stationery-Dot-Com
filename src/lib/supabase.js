import {createClient} from '@supabase/supabase-js';

// These are Supabase browser credentials. The publishable/anon key is designed to
// be exposed to the browser and is protected by Supabase RLS policies.
// Environment variables still take precedence for local/custom deployments.
const DEFAULT_SUPABASE_URL='https://efrqreeyuopdvmghfedx.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY='sb_publishable_rm7JnsRmVtjYm5oQCq4rjg_N645UVEl';

export const SUPABASE_URL=import.meta.env.VITE_SUPABASE_URL||DEFAULT_SUPABASE_URL;
export const SUPABASE_ANON_KEY=import.meta.env.VITE_SUPABASE_ANON_KEY||DEFAULT_SUPABASE_ANON_KEY;
export const isSupabaseConfigured=Boolean(SUPABASE_URL&&SUPABASE_ANON_KEY);
export const supabase=createClient(SUPABASE_URL,SUPABASE_ANON_KEY);

export const taka=n=>'৳'+Number(n||0).toLocaleString('en-US');
export async function getSettings(){const{data}=await supabase.from('site_settings').select('*');return Object.fromEntries((data||[]).map(r=>[r.key,r.value]));}
export const ORDER_STATUSES=['Pending','Payment Pending','Payment Received','Processing','Completed','Cancelled','Refunded'];
export const PAY_STATUSES=['Pending','Verification Pending','Paid','Failed','Refunded'];
export const isPdf=u=>/\.pdf(\?|#|$)/i.test(u||'');
