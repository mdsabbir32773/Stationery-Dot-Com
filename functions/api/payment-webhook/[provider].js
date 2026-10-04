import {adapters} from '../../_lib/providers.js';
const json=(o,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{'Content-Type':'application/json'}});
// Server-side only. Browser can never mark an order paid: only this function (service-role key) can call apply_payment_event.
export async function onRequestPost({request,env,params}){
 const a=adapters[params.provider];if(!a)return json({error:'Provider not configured'},501);
 if(!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY)return json({error:'Server not configured'},500);
 let ev;try{ev=await a.verify(await request.text(),request.headers,env);}catch(e){return json({error:'Verification failed'},401);}
 const r=await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/apply_payment_event`,{method:'POST',headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,'Content-Type':'application/json'},
  body:JSON.stringify({p_order_code:ev.orderCode,p_provider:params.provider,p_event_id:ev.eventId,p_provider_ref:ev.providerRef,p_amount:ev.amount,p_paid:ev.paid,p_payload:ev})});
 return r.ok?json({result:await r.json()}):json({error:'Database error'},502);
}
