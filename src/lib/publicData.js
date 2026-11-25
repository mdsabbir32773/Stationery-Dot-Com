const SUPABASE_URL=(import.meta.env.VITE_SUPABASE_URL||'https://efrqreeyuopdvmghfedx.supabase.co').replace(/\/$/,'');
const SUPABASE_KEY=import.meta.env.VITE_SUPABASE_ANON_KEY||'sb_publishable_rm7JnsRmVtjYm5oQCq4rjg_N645UVEl';
const REST=SUPABASE_URL+'/rest/v1';
const headers={apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY,Accept:'application/json'};
async function request(url,options={}){
  try{
    const response=await fetch(url,{...options,headers:{...headers,...options.headers}});
    const body=await response.text();
    if(!response.ok)return {data:null,error:new Error(body||('Request failed: '+response.status))};
    return {data:body?JSON.parse(body):[],error:null};
  }catch(error){return {data:null,error};}
}
export async function publicRows(table,filters={}){
  const url=new URL(REST+'/'+encodeURIComponent(table));
  for(const [key,value] of Object.entries(filters)){
    if(Array.isArray(value))value.forEach(item=>url.searchParams.append(key,String(item)));
    else if(value!==undefined&&value!==null)url.searchParams.set(key,String(value));
  }
  return request(url.toString());
}
export async function publicRpc(name,body={}){
  return request(REST+'/rpc/'+encodeURIComponent(name),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
}
