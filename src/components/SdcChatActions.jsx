import {useEffect,useMemo,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowRight,CheckCircle2,Loader2,WalletCards,Sparkles} from 'lucide-react';
import {supabase,taka} from '../lib/supabase';
import PaymentQR from './PaymentQR';

const PHONE=/^(880|0)?1[0-9]{9}$/;
const proofTypes=['image/jpeg','image/png','image/webp'];
const docTypes=['image/jpeg','image/png','image/webp','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const extOf=f=>f.name.split('.').pop().toLowerCase();
const STOPWORDS=new Set(['i','me','my','we','want','need','looking','for','to','a','an','the','some','please','order','buy','purchase','get','give','show','find','related','recommend','recommendation','package','packages','service','services','price','cost','of','and','with','have','you','can','could','do','on','from','amar','amr','ami','amake','ekta','ta','lagbe','chai','dorkar','nibo','kinbo','den','dao','daw','koro','korbo','korte','dibo','jonno','কি','কী','আমার','আমি','আমাকে','একটা','লাগবে','চাই','দরকার','নেব','কিনব','দেন','দাও','করতে','অর্ডার','প্যাকেজ','সার্ভিস','দাম','কত','আছে','দেখান','দেখাও']);
function normalized(value){return String(value||'').toLowerCase().normalize('NFKC').replace(/(\d+)(year|yr|month|mo)\b/g,'$1 $2').replace(/[^a-z0-9\u0980-\u09ff]+/g,' ').trim();}
function tokens(value){return normalized(value).split(/\s+/).filter(word=>word.length>1&&!STOPWORDS.has(word));}
function catalogScore(query,label){const q=normalized(query),c=normalized(label);if(!q||!c)return 0;if(q===c)return 100;const qt=tokens(query),ct=tokens(label);if(!qt.length||!ct.length)return 0;const overlap=ct.filter(word=>qt.includes(word)).length;if(!overlap)return 0;return Math.round((overlap/ct.length*.72+overlap/qt.length*.28)*100);}
function rankCatalog(query,items,labelOf){return items.map(item=>({item,score:catalogScore(query,labelOf(item))})).filter(row=>row.score>=42).sort((a,b)=>b.score-a.score);}
function asksForSuggestions(text){return /\b(related|recommend|suggest|options?|list|show me|what do you have|which packages?)\b|ki ki ache|aro package|related package|option gula|প্যাকেজ.*(দেখা|আছে|কোন)|কোন কোন|কি কি আছে|আরো.*প্যাকেজ/i.test(text);}


export default function SdcChatActions({mode,initialMessage='',onCancel,onComplete}){
 const initialProcessed=useRef(false);
 const actionEndRef=useRef(null);
 const hasBangla=/[\u0980-\u09ff]/.test(initialMessage);
 const isBanglish=/\b(amar|amr|ami|lagbe|chai|dorkar|nibo|kinbo|koro|korbo|daw|den|dibo)\b/i.test(initialMessage);
 const language=hasBangla?'bn':isBanglish?'bn':'en';
 const[services,setServices]=useState([]),[packages,setPackages]=useState([]),[settings,setSettings]=useState({});
 const[session,setSession]=useState(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState(''),[successLink,setSuccessLink]=useState(null);
 const[step,setStep]=useState(mode==='deposit'?'amount':'service'),[messages,setMessages]=useState([]),[reply,setReply]=useState('');
 const[serviceId,setServiceId]=useState(''),[packageId,setPackageId]=useState(''),[name,setName]=useState(''),[phone,setPhone]=useState(''),[whatsapp,setWhatsapp]=useState(''),[email,setEmail]=useState(''),[target,setTarget]=useState(''),[quantity,setQuantity]=useState(''),[notes,setNotes]=useState('');
 const[proof,setProof]=useState(null),[docs,setDocs]=useState([]),[amount,setAmount]=useState(''),[balance,setBalance]=useState(null);
 const service=services.find(x=>x.id===serviceId);
 const servicePackages=useMemo(()=>packages.filter(x=>x.service_id===serviceId),[packages,serviceId]);
 const pack=servicePackages.find(x=>x.id===packageId);
 const isSmm=Boolean(service?.smm_platform||service?.category==='SMM Panel Services');
 const total=pack?Number(pack.price||0):0;
 const smmTotal=service?Math.round((Number(service.smm_price_per_1000||0)*Number(quantity||0)/1000)*100)/100:0;
 const qrMethod={name:'Bangla QR',number:'Scan the QR to pay',qr:settings.payment_qr_url};
 const promptSets={
  en:{service:'What service do you need? Tell me its name or what you need it for.',package:'I found these packages for this service. Tell me a package name, or say “related” and I’ll find matching ones.',target:'What profile, post or channel should the service apply to? Please send its link.',quantity:'How many would you like?',name:'What name should I put on the order?',phone:'What is your Bangladeshi mobile number?',whatsapp:'Is your WhatsApp number different from your mobile? If not, say “same”.',email:'What email should we use for this order? This is optional; say “skip” to leave it blank.',notes:'Any instructions for the team? If not, say “skip”.',docs:'This service needs a supporting file. Upload it here, then reply “continue”.',review:'Let me read your order back. Please check the details and confirm or ask me to change something.',amount:'How much would you like to add to your wallet? The minimum is ৳50.',proof:'Please upload a clear screenshot of your successful payment (JPG, PNG or WEBP, up to 5 MB). Then reply “paid” to submit.',paid:'Reply “paid” to submit. Our team will review the screenshot before approving it.'},
  bnlish:{service:'Kon service lagbe? Naam ba ki kajer jonno lagbe nijer moto kore bolun.',package:'Ei service-er package-gulor naam ar price dilam. Package-er naam bolun, ba “related” bolle mil ache emon package dekhabo.',target:'Kon profile, post ba channel-er jonno? Link-ta din.',quantity:'Koyta lagbe bolun.',name:'Order-ta kon naam-e korbo?',phone:'Apnar Bangladesh mobile number-ta bolun.',whatsapp:'WhatsApp number ki mobile-er theke alada? Same hole “same” bolun.',email:'Order-er jonno email deben? Eta optional—na dile “skip” bolun.',notes:'Team-er jonno extra instruction ache? Na thakle “skip” bolun.',docs:'Ei service-er jonno file dorkar. Upload kore “continue” likhun.',review:'Order-ta ekbar pore shonai—details thik ache? Thik hole confirm bolun, change chaile bolun.',amount:'Wallet-e koto taka add korte chan? Minimum ৳50.',proof:'Payment successful hole screenshot upload kore “paid” likhun (JPG/PNG/WEBP, max 5 MB).',paid:'“Paid” likhle request submit hobe; team screenshot check kore approve korbe.'},
  bn:{service:'কোন সার্ভিসটা লাগবে? নাম বা কী কাজে লাগবে নিজের মতো করে বলুন।',package:'এই সার্ভিসের package-এর নাম আর দাম দিলাম। package-এর নাম বলুন, বা “related” বললে কাছাকাছি package খুঁজে দেখাব।',target:'কোন profile, post বা channel-এর জন্য? Link-টা দিন।',quantity:'কতটা লাগবে বলুন।',name:'Order-টা কোন নামে করব?',phone:'আপনার Bangladesh mobile number-টা বলুন।',whatsapp:'WhatsApp number কি mobile-এর থেকে আলাদা? একই হলে “same” বলুন।',email:'Order-এর জন্য email দেবেন? না দিলে “skip” বলুন—এটা optional।',notes:'Team-এর জন্য extra instruction আছে? না থাকলে “skip” বলুন।',docs:'এই service-এর জন্য file দরকার। Upload করে “continue” লিখুন।',review:'Order-টা একবার পড়ে শোনাই—details ঠিক আছে? ঠিক হলে confirm বলুন, change চাইলে বলুন।',amount:'Wallet-এ কত টাকা add করতে চান? Minimum ৳50.',proof:'Payment successful হলে screenshot upload করে “paid” লিখুন (JPG/PNG/WEBP, max 5 MB).',paid:'“Paid” লিখলে request submit হবে; team screenshot দেখে approve করবে.'}
 };
 const prompts=promptSets[language];
 const packageCatalog=(svc,list=packages.filter(p=>p.service_id===svc?.id))=>{
  if(!list.length)return language==='bn'?'এই service-এ এখন active package নেই। অন্য service-এর নাম বলুন।':'There are no active packages for this service right now. Tell me another service name.';
  const rows=list.slice(0,10).map(p=>'• '+p.name+(p.access_type?' · '+p.access_type:'')+(p.duration_months===0?' · Lifetime':p.duration_months?' · '+p.duration_months+' months':'')+' — '+(Number(p.price)>0?taka(p.price):'Price on request')).join('\n');
  const more=list.length>10?'\n…and '+(list.length-10)+' more.':'';
  return (language==='bn'?'এই service-এর available package:\n':'Available packages for '+(svc?.name||'this service')+':\n')+rows+more;
 };
 const serviceCatalog=()=>services.slice(0,12).map(x=>x.name).join(', ')+(services.length>12?'…':'');

 useEffect(()=>{initialProcessed.current=false;setMessages([{role:'assistant',text:mode==='deposit'?(language==='bn'?'Wallet deposit-টা এখানেই একে একে করব।':'I’ll help with the wallet deposit right here, one step at a time.'):initialMessage?'':(language==='bn'?'বেশ, কী service লাগবে বলুন—নাম বা কী দরকার লিখলেই মিলিয়ে দেখছি।':'Sure—tell me what service you need, and I’ll find the matching package.') }]);},[mode,initialMessage,language]);
 useEffect(()=>{(async()=>{try{const [{data:sv,error:se},{data:pk,error:pe},{data:{session:ss}},{data:st}]=await Promise.all([supabase.from('services').select('*').eq('is_active',true).order('sort_order'),supabase.from('packages').select('*').eq('is_active',true).order('sort_order'),supabase.auth.getSession(),supabase.from('site_settings').select('key,value')]);if(se)throw se;if(pe)throw pe;setServices(sv||[]);setPackages(pk||[]);setSession(ss);setSettings(Object.fromEntries((st||[]).map(x=>[x.key,x.value])));if(ss?.user){const{data:p}=await supabase.from('customer_profiles').select('full_name,phone').eq('id',ss.user.id).maybeSingle();setName(p?.full_name||ss.user.user_metadata?.full_name||'');setPhone(p?.phone||ss.user.user_metadata?.phone||'');setEmail(ss.user.email||'');}}catch(e){setError(e.message||'Could not load secure order options.');}finally{setLoading(false)}})();},[]);
 useEffect(()=>{if(isSmm&&session)supabase.rpc('get_smm_wallet').then(({data,error:e})=>{if(!e)setBalance(Number(data||0));});},[isSmm,session?.user?.id]);
 useEffect(()=>{if(!loading&&mode==='order'&&step==='service'&&services.length===0)setError('No active services are available right now.');},[loading,mode,step,services.length]);
 function bot(text){setMessages(v=>[...v,{role:'assistant',text}]);}
 function user(text){setMessages(v=>[...v,{role:'user',text}]);}
 function go(next,prompt){setStep(next);setError('');if(prompt)bot(prompt);}
 function chooseService(id,matchedPackageId=''){
  const s=services.find(x=>x.id===id);if(!s)return;
  setServiceId(id);setPackageId('');
  const smm=Boolean(s.smm_platform||s.category==='SMM Panel Services');
  if(smm){if(!session){go('signin',language==='bn'?'এই service order করতে account-এ sign in করতে হবে।':'Please sign in to order this service.');return;}go('target',prompts.target);return;}
  const matched=matchedPackageId?packages.find(x=>x.id===matchedPackageId):null;
  if(matched){setPackageId(matched.id);go('name',(language==='bn'?'ঠিক আছে—':'Got it—')+s.name+', '+matched.name+' ('+(Number(matched.price)>0?taka(matched.price):'Price on request')+'). '+(language==='bn'?'এখন order-এর নামটা বলুন।':'What name should I put on the order?'));return;}
  go('package',prompts.package+'\n\n'+packageCatalog(s,packages.filter(x=>x.service_id===id)));
 }
 function choosePackage(id){const p=servicePackages.find(x=>x.id===id);if(!p)return;setPackageId(id);if(isSmm){go('target',prompts.target);}else go('name',(language==='bn'?'বুঝেছি—':'Got it—')+p.name+' ('+(Number(p.price)>0?taka(p.price):'Price on request')+'). '+(language==='bn'?'Order-টা কোন নামে করব?':'What name should I put on the order?'));}
 function currentPrompt(){return prompts[step]||'';}
 useEffect(()=>{actionEndRef.current?.scrollIntoView({behavior:'smooth'});},[messages,step,error,loading,result]);
 function handleServiceQuery(query){
  const serviceMatches=rankCatalog(query,services,x=>(x.name||'')+' '+(x.category||''));
  const packageMatches=rankCatalog(query,packages,x=>{const d=x.duration_months===0?'lifetime':x.duration_months%12===0?(x.duration_months/12)+' year':x.duration_months+' months';return (x.name||'')+' '+(x.access_type||'')+' '+d+' '+x.duration_months+' '+(services.find(y=>y.id===x.service_id)?.name||'');});
  const best=serviceMatches[0],next=serviceMatches[1];
  const exactNamed=services.filter(s=>normalized(query).includes(normalized(s.name))).sort((a,b)=>normalized(b.name).length-normalized(a.name).length)[0];
  if(exactNamed||(best&&best.score>=74&&(!next||best.score-next.score>=10))){
   const svc=exactNamed||best.item;
   const within=rankCatalog(query,packages.filter(x=>x.service_id===svc.id),x=>{const duration=x.duration_months===0?'lifetime':x.duration_months%12===0?(x.duration_months/12)+' year':x.duration_months+' months';return (x.name||'')+' '+(x.access_type||'')+' '+duration+' '+(x.duration_months||'')+' '+(x.price||'')+' '+svc.name;});
   const match=within[0]&&within[0].score>=54&&(!within[1]||within[0].score-within[1].score>=8)?within[0].item:null;
   chooseService(svc.id,match?.id||'');return;
  }
  const pb=packageMatches[0],pn=packageMatches[1];
  if(pb&&pb.score>=82&&(!pn||pb.score-pn.score>=12)){const svc=services.find(x=>x.id===pb.item.service_id);if(svc){chooseService(svc.id,pb.item.id);return;}}
  if(asksForSuggestions(query)){bot((language==='bn'?'অবশ্যই। Available service-গুলো হলো:\n• ':'Here are the available services:\n• ')+services.slice(0,12).map(x=>x.name).join('\n• ')+'\n'+(language==='bn'?'যেটা দরকার, নামটা বলুন।':'Tell me the one you need.'));return;}
  const close=serviceMatches.filter(x=>x.score>=50).slice(0,5).map(x=>x.item.name);
  if(close.length){bot((language==='bn'?'এই service-গুলোর সাথে মিল পেয়েছি: ':'I found a few related services: ')+close.join(', ')+(language==='bn'?'। কোনটার কথা বলছেন, নামটা একটু পরিষ্কার করে বলবেন?':'. Which one did you mean?'));return;}
  bot((language==='bn'?'নামটা ঠিক মেলাতে পারিনি। service বা কাজের নাম আরেকটু বলবেন? Available: ':'I could not match that yet. Tell me the service name or what you need it for. Available: ')+serviceCatalog());
 }
 function handlePackageQuery(query){
  const matches=rankCatalog(query,servicePackages,x=>(x.name||'')+' '+(x.access_type||'')+' '+(x.duration_months||'')+' '+(x.price||''));
  if(asksForSuggestions(query)){const related=matches.filter(x=>x.score>=50).map(x=>x.item);bot(packageCatalog(service,related.length?related:servicePackages));return;}
  const best=matches[0],next=matches[1];
  if(best&&best.score>=76&&(!next||best.score-next.score>=10)){choosePackage(best.item.id);return;}
  const close=matches.filter(x=>x.score>=48).slice(0,6).map(x=>'• '+x.item.name+' — '+(Number(x.item.price)>0?taka(x.item.price):'Price on request'));
  if(close.length)bot((language==='bn'?'এই package-গুলো আপনার কথার সাথে মিলে:\n':'These packages seem related:\n')+close.join('\n')+'\n'+(language==='bn'?'যেটা চান, নামটা বলুন।':'Tell me which package name you want.'));
  else bot((language==='bn'?'এই নামে package পেলাম না। ':'I could not find that package name. ')+packageCatalog(service));
 }
 useEffect(()=>{if(loading||mode!=='order'||!initialMessage||initialProcessed.current||!services.length)return;initialProcessed.current=true;handleServiceQuery(initialMessage);},[loading,mode,initialMessage,services,packages]);
 async function submitText(e){e.preventDefault();const v=reply.trim();if(!v||busy)return;setReply('');user(v);
  if(step==='service'){handleServiceQuery(v);}
  else if(step==='package'){handlePackageQuery(v);}
  else if(step==='amount'){const n=Number(v);if(!Number.isFinite(n)||n<50||n>1000000){setError('Deposit amount must be between ৳50 and ৳1,000,000.');return;}setAmount(String(n));go('review',language==='bn'?'Wallet deposit-এর details দেখে নিন। ঠিক থাকলে “confirm” লিখুন।':'Review your wallet deposit details. Reply “confirm” when they look right.');}
  else if(step==='target'){if(!/^https?:\/\//i.test(v)){setError('Please enter a complete URL beginning with https://');return;}setTarget(v);go('quantity',prompts.quantity);}
  else if(step==='quantity'){const q=Number(v);if(!Number.isInteger(q)||q<Number(service.smm_min_quantity)||q>Number(service.smm_max_quantity)){setError('Quantity must be between '+service.smm_min_quantity+' and '+service.smm_max_quantity+'.');return;}setQuantity(String(q));go('name',prompts.name);}
  else if(step==='name'){if(v.length<2||v.length>120){setError('Please enter your full name (2–120 characters).');return;}setName(v);go('phone',prompts.phone);}
  else if(step==='phone'){if(!PHONE.test(v.replace(/\D/g,''))){setError('Please enter a valid Bangladeshi mobile number.');return;}setPhone(v);go('whatsapp',prompts.whatsapp);}
  else if(step==='whatsapp'){setWhatsapp(/^(same|same as (mobile|phone)|একই)$/i.test(v)?phone:v);go('email',prompts.email);}
  else if(step==='email'){if(v&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)){setError('Please enter a valid email address or skip.');return;}setEmail(/^(skip|no|none|না)$/i.test(v)?'':v);go('notes',prompts.notes);}
  else if(step==='notes'){setNotes(/^(skip|no|none|না)$/i.test(v)?'':v);if(service?.requires_file)go('docs',prompts.docs);else go('review',prompts.review);}
  else if(step==='docs'){if(!docs.length){setError(language==='bn'?'আগে supporting file upload করুন।':'Please upload the required supporting file first.');return;}go('review',prompts.review);}
  else if(step==='review'){
   if(/\b(change|edit|different|package|service|পরিবর্তন|বদল|অন্য)\b/i.test(v)){setError('');if(/\b(package|প্যাকেজ)\b/i.test(v)&&service)go('package',prompts.package+'\n\n'+packageCatalog(service));else go('service',language==='bn'?'কোন service চান, নামটা বলুন।':'Which service would you like instead?');return;}
   if(/\b(yes|confirm|confirmed|correct|looks good|proceed|place order|ok|okay|ji|thik|thik ache|ha|hmm)\b|হ্যাঁ|ঠিক আছে|নিশ্চিত|জি/i.test(v)){await confirmDetails();return;}
   bot(language==='bn'?'Details ঠিক থাকলে “confirm” লিখুন। কিছু বদলাতে চাইলে কী বদলাবেন বলুন।':'If the details look right, reply “confirm”. Tell me what you want to change otherwise.');
  }
  else if(step==='payment'){if(/\\b(qr|code|qrcode)\\b|কিউআর/i.test(v)){bot(language==='bn'?'QR code-টা এই chat-এই payment section-এ দেখাচ্ছে। উপরের QR scan করে exact amount pay করুন, তারপর screenshot upload করুন।':'The QR code is shown here in the payment section above. Scan it, pay the exact amount, then upload the receipt screenshot.');return;}if(!proof){setError(language==='bn'?'আগে payment screenshot upload করুন।':'Upload the payment screenshot first.');return;}if(/\b(paid|done|yes|submit|confirm|complete|completed|হয়েছে|হয়েছে|দিয়েছি|পেইড)\b/i.test(v)){await submit(true);return;}bot(language==='bn'?'Screenshot upload হলে “paid” লিখুন, তাহলে order জমা হবে।':'Once the screenshot is uploaded, reply “paid” and I’ll submit the order.');}
 }
 function skip(){user('Skip');if(step==='whatsapp')go('email',prompts.email);else if(step==='email')go('notes',prompts.notes);else if(step==='notes'){if(service?.requires_file)go('docs',prompts.docs);else go('review',prompts.review);}else if(step==='amount')setError('Please enter a deposit amount to continue.');}
 function chooseDocs(e){const fs=[...(e.target.files||[])];if(fs.length>5){setError('Maximum 5 supporting files.');return;}for(const f of fs){if(!docTypes.includes(f.type)||f.size>10*1024*1024){setError('Supporting files: JPG, PNG, WEBP, PDF or DOC/DOCX; max 10MB each.');return;}}setError('');setDocs(fs);}
 function chooseProof(e){const f=e.target.files?.[0]||null;if(f&&!proofTypes.includes(f.type)){setError('Payment screenshot must be JPG, PNG or WEBP.');return;}if(f&&f.size>5*1024*1024){setError('Payment screenshot must be 5MB or smaller.');return;}setError('');setProof(f);}
 async function uploadFile(file,prefix){const path='uploads/'+prefix+crypto.randomUUID()+'.'+extOf(file);const{error:e}=await supabase.storage.from('order-files').upload(path,file,{contentType:file.type});if(e)throw e;return path;}
 async function submitQuote(){setBusy(true);let uploaded=[];try{const uploadedDocs=[];for(const f of docs){const path=await uploadFile(f,'chat-order-');uploaded.push(path);uploadedDocs.push({path,name:f.name});}const{data,error:e}=await supabase.rpc('create_order',{p:{customer_name:name.trim(),phone:phone.trim(),whatsapp:whatsapp.trim(),email:email.trim(),quantity:1,package_id:pack.id,quote:true,files:uploadedDocs,notes:notes.trim()}});if(e)throw e;if(!data)throw new Error('The server did not return a request ID.');setResult('Quote request submitted. Request ID: '+data);setSuccessLink({code:data,phone:phone.trim()});onComplete?.('Your price-quote request has been submitted. Request ID: '+data+'. Our team will confirm the price before payment.');}catch(e){if(uploaded.length)await supabase.storage.from('order-files').remove(uploaded);setError(e.message||'Could not submit quote request.');}finally{setBusy(false);}}
 async function submitSmm(){if(!session){setError('Please sign in before placing an SMM order.');return;}setBusy(true);try{const{data,error:e}=await supabase.rpc('create_smm_order',{p:{service_id:service.id,customer_name:name.trim(),phone:phone.trim(),email:email.trim(),target_link:target.trim(),quantity:Number(quantity),notes:notes.trim()}});if(e)throw e;if(!data)throw new Error('No Order ID was returned.');setResult('SMM order placed. Order ID: '+data);setSuccessLink({code:data,phone:phone.trim()});onComplete?.('Your SMM order has been placed. Order ID: '+data+'. The order charge was processed by your wallet.');}catch(e){setError(e.message||'Could not place SMM order.');}finally{setBusy(false);}}
 async function submitPaidOrder(){setBusy(true);let uploaded=[];try{const uploadedDocs=[];for(const f of docs){const path=await uploadFile(f,'chat-order-');uploaded.push(path);uploadedDocs.push({path,name:f.name});}const proofPath=await uploadFile(proof,'cart-payproof-');uploaded.push(proofPath);const{data,error:e}=await supabase.rpc('create_cart_orders',{p:{customer_name:name.trim(),phone:phone.trim(),whatsapp:whatsapp.trim(),email:email.trim(),method:'Bangla QR',payment_proof_path:proofPath,items:[{package_id:pack.id,quantity:1,files:uploadedDocs,notes:notes.trim()}]}});if(e)throw e;const code=Array.isArray(data)?data[0]:data;if(!code)throw new Error('The server did not return an Order ID.');setResult('Order submitted. Order ID: '+code);setSuccessLink({code,phone:phone.trim()});onComplete?.('Your order has been submitted. Order ID: '+code+'. Payment is pending admin verification.');}catch(e){if(uploaded.length)await supabase.storage.from('order-files').remove(uploaded);setError(e.message||'Could not submit the order.');}finally{setBusy(false);}}
 async function submitDeposit(){if(!session){setError('Please sign in before requesting a wallet deposit.');return;}setBusy(true);let path='';try{path=await uploadFile(proof,'payproof-');const{data,error:e}=await supabase.rpc('request_smm_deposit_with_proof',{p_method:'Bangla QR',p_amount:Number(amount),p_proof_path:path});if(e)throw e;if(!data)throw new Error('No deposit request ID was returned.');setResult('Deposit request submitted. Request ID: '+data);onComplete?.('Your deposit request has been submitted. Request ID: '+data+'. Wallet balance updates only after admin verification.');}catch(e){if(path)await supabase.storage.from('order-files').remove([path]);setError(e.message||'Could not submit deposit request.');}finally{setBusy(false);}}
 async function confirmDetails(){if(mode==='deposit'){if(!session){setError('Please sign in to your account first.');return;}go('payment',(language==='bn'?'Details confirm হয়েছে। নিচে payment QR দিলাম। ':'Details confirmed; here is the payment QR. ')+prompts.proof);return;}if(!service||(!isSmm&&!pack)){setError('Select a service and package first.');return;}if(!name.trim()||!PHONE.test(phone.replace(/\D/g,''))){setError('Please check your name and mobile number.');return;}if(service.requires_file&&!docs.length){setError('This service requires supporting documents.');return;}if(isSmm){await submitSmm();return;}if(Number(pack.price)<=0){await submitQuote();return;}go('payment',(language==='bn'?'Order details confirm হয়েছে। নিচে payment QR দিলাম। ':'Order details confirmed; here is the payment QR. ')+prompts.proof);}
 async function submit(confirmed=false){setError('');if(!proof)return setError('Please upload the payment screenshot.');if(!confirmed)return setError('Please confirm the payment in your reply.');if(mode==='deposit')await submitDeposit();else await submitPaidOrder();}
 if(loading)return <div className="sdc-action-card"><Loader2 className="sdc-spin" size={18}/> Loading live services and secure payment options…</div>;
 if(result)return <div className="sdc-action-card"><div className="sdc-action-success"><CheckCircle2 size={20}/><b>Submitted successfully</b></div><p>{result}</p>{successLink&&<Link className="sdc-action-primary" to={'/invoice/'+encodeURIComponent(successLink.code)} state={{phone:successLink.phone}}>View invoice <ArrowRight size={15}/></Link>}<button type="button" className="sdc-action-secondary" onClick={onCancel}>Close</button></div>;
 if(mode==='deposit'&&!session)return <div className="sdc-action-card"><p>Wallet deposits are linked to your signed-in account. Please sign in, then start this chat flow again.</p><Link className="sdc-action-primary" to="/account">Sign in / Create account <ArrowRight size={15}/></Link><button className="sdc-action-secondary" onClick={onCancel}>Close</button></div>;
 return <section className="sdc-convo-card" aria-label={mode==='deposit'?'Wallet deposit conversation':'Order conversation'}>
  <div className="sdc-convo-thread" aria-live="polite">{messages.map((m,i)=><div key={i} className={'sdc-chat-row '+(m.role==='user'?'is-user':'is-assistant')}>{m.role==='assistant'&&<div className="sdc-chat-mini-avatar"><Sparkles size={13}/></div>}<div className="sdc-chat-bubble">{m.text}</div></div>)}</div>
  {error&&<div className="sdc-action-error" role="alert">{error}</div>}
  {step==='signin'&&<div className="sdc-convo-control"><Link className="sdc-action-primary" to="/account">Sign in / Create account <ArrowRight size={15}/></Link></div>}


  {['service','package','amount','target','quantity','name','phone','whatsapp','email','notes','docs','review','payment'].includes(step)&&<form className="sdc-convo-reply" onSubmit={submitText}><input autoFocus value={reply} onChange={e=>setReply(e.target.value)} disabled={busy} placeholder={step==='service'?(language==='bn'?'Service-er naam ba ki lagbe likhun…':'Tell me what service you need…'):step==='package'?(language==='bn'?'Package-er naam bolun, related chaile likhun…':'Tell me a package name or ask for related ones…'):step==='phone'?'01XXXXXXXXX':step==='amount'?'Enter amount in BDT':step==='target'?'https://…':step==='review'?(language==='bn'?'ঠিক থাকলে confirm লিখুন…':'Reply confirm or tell me what to change…'):step==='payment'?(language==='bn'?'Screenshot upload করে paid লিখুন…':'Upload screenshot, then reply paid…'):step==='docs'?(language==='bn'?'File upload করে continue লিখুন…':'Upload the file, then reply continue…'):language==='bn'?'এখানে লিখুন…':'Type your answer…'} aria-label="Your message"/><button disabled={!reply.trim()||busy}>{busy?<Loader2 className="sdc-spin" size={15}/>: 'Send'}</button>{['whatsapp','email','notes'].includes(step)&&<button type="button" className="sdc-convo-skip" onClick={skip}>Skip</button>}</form>}
  {step==='docs'&&<div className="sdc-convo-control"><label>Upload supporting files<input type="file" multiple accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx" onChange={chooseDocs}/></label>{docs.length>0&&<small>{docs.map(f=>f.name).join(', ')}</small>}</div>}
  {step==='review'&&<div className="sdc-convo-review">{mode==='deposit'?<><b>Deposit amount: {taka(amount)}</b><p>Account: signed-in customer</p></>:<><b>{service?.name}</b><p>Package: {pack?.name}</p>{isSmm&&<p>Target: {target}<br/>Quantity: {Number(quantity).toLocaleString()}<br/>Estimated total: {taka(smmTotal)}<br/>Wallet balance: {balance===null?'Loading…':taka(balance)}</p>}{!isSmm&&<p>Total: {Number(pack?.price)>0?taka(total):'Price on request'}</p>}<p>Name: {name}<br/>Mobile: {phone}{whatsapp&&<><br/>WhatsApp: {whatsapp}</>}{email&&<><br/>Email: {email}</>}{notes&&<><br/>Note: {notes}</>}</p>{docs.length>0&&<p>Files: {docs.map(f=>f.name).join(', ')}</p>}</>}</div>}
  {step==='payment'&&<div className="sdc-convo-payment"><PaymentQR settings={settings} total={mode==='deposit'?Number(amount):total} method={qrMethod}/><label className="sdc-convo-control">Payment screenshot (JPG / PNG / WEBP, max 5MB)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseProof}/></label>{proof&&<small>{proof.name}</small>}</div>}
  
  <p className="sdc-convo-foot"><WalletCards size={13}/> Payment proof is reviewed by our team. No automatic payment approval or wallet credit.</p><div ref={actionEndRef}/>
 </section>;
}
