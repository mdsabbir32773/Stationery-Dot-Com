import {useMemo,useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowRight,BookOpen,MessageCircle,Search,ShieldCheck,PackageCheck,WalletCards} from 'lucide-react';
import useTitle from '../lib/useTitle';
import {waLink} from '../lib/whatsapp';
import './help-center.css';

const groups=[
 {title:'Orders & tracking',icon:PackageCheck,items:[
  ['How do I place an order?','Browse Services, open the service you need, choose an available package and add it to your cart. Complete the checkout details and follow the payment instructions shown there.'],
  ['Can I order without creating an account?','Yes. You can place an order as a guest. Keep your Order ID and the mobile number you entered; you will need both to check its status.'],
  ['How do I track an order?','Open Track Order, enter your Order ID and the mobile number used at checkout, then submit. You can also see orders placed while signed in from My Account.'],
  ['Where can I find my invoice?','Use the invoice link shown after a successful order lookup, or open the order in My Account. The invoice is associated with the order and its verification details.'],
  ['Can I order the same package again?','If you are signed in, open My Account, expand the completed or previous order and choose Order again when that option is available.']
 ]},
 {title:'Payments & wallet',icon:WalletCards,items:[
  ['How do I pay for an order?','Follow the payment method and instructions displayed during checkout. If a payment QR is shown, complete the payment using your payment app and upload the requested proof before submitting.'],
  ['Does uploading a payment screenshot mean my payment is approved?','No. A screenshot is a payment proof for review. The payment remains pending until Stationery Dot Com verifies it. Do not submit another payment just because verification is still pending.'],
  ['How do wallet deposits work?','Sign in, open My Account and use the wallet deposit option. Submit the requested details and proof, then wait for the deposit review. Your balance changes only after approval.'],
  ['What if my payment or deposit is rejected?','Check the note or status shown in your account. If you are unsure what to correct, contact support and include your Order ID or deposit reference.']
 ]},
 {title:'Documents, account & support',icon:ShieldCheck,items:[
  ['Do all services need document uploads?','No. Only services marked as requiring documents need an upload. The service page and checkout will tell you when a file is required.'],
  ['What file types can I upload at checkout?','The current checkout accepts JPG, PNG, WEBP, PDF, DOC and DOCX files. Individual file-size and quantity limits are shown when you upload.'],
  ['Do I need an account?','An account is optional for placing an order. Creating one helps keep your profile, signed-in orders, wallet activity and notifications together.'],
  ['How do I contact a real person?','Use the WhatsApp support link on the website or the Talk to a person option in SDC Assistant. Include your Order ID when asking about an existing order.'],
  ['How do I submit a support ticket?','Sign in and open My Account. Use the Help & Support section to submit a request. You can optionally link it to one of your orders.'],
  ['How do I see the support team’s reply?','Open My Account and return to Help & Support. Your ticket status and the team’s replies appear there.'],
  ['Can the chatbot approve payments or change my order status?','No. SDC Assistant can guide you and check available order information. Payment approvals and order-status changes are handled through the verified store workflow.']
 ]}
];

export default function HelpCenter(){
 const[q,setQ]=useState('');
 useTitle('Help Center | Stationery Dot Com','Find answers about orders, payments, tracking, accounts and support.');
 const filtered=useMemo(()=>groups.map(g=>({...g,items:g.items.filter(([question,answer])=>(question+' '+answer).toLowerCase().includes(q.trim().toLowerCase()))})).filter(g=>g.items.length),[q]);
 const count=filtered.reduce((n,g)=>n+g.items.length,0);
 return <main className="help-page wrap">
  <header className="help-hero"><span className="section-overline">STATIONERY DOT COM SUPPORT</span><h1>How can we help?</h1><p>Quick answers about ordering, payments, tracking and your account.</p>
   <label className="help-search"><Search size={19}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search for an answer…" aria-label="Search help articles"/>{q&&<button type="button" onClick={()=>setQ('')} aria-label="Clear search">Clear</button>}</label>
   <div className="help-quick-links"><Link to="/services">Browse services <ArrowRight size={15}/></Link><Link to="/track-order">Track an order <ArrowRight size={15}/></Link><Link to="/account">My account <ArrowRight size={15}/></Link></div>
  </header>
  <div className="help-groups">{filtered.map(g=>{const Icon=g.icon;return <section className="help-group" key={g.title}><div className="help-group-heading"><span><Icon size={19}/></span><div><h2>{g.title}</h2><p>{g.items.length} {g.items.length===1?'answer':'answers'}</p></div></div><div className="help-questions">{g.items.map(([question,answer])=><details className="help-item" key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div></section>})}
  {!count&&<div className="help-empty"><BookOpen size={24}/><h2>No matching answers</h2><p>Try a different word or contact our team for help.</p><button type="button" className="btn alt" onClick={()=>setQ('')}>Clear search</button></div>}
  </div>
  <section className="help-contact"><div><span className="section-overline">NEED MORE HELP?</span><h2>Talk to our support team.</h2><p>For order-specific questions, include your Order ID so we can find the right details.</p></div><a className="btn" href={waLink('Hello, I need help with Stationery Dot Com.') } target="_blank" rel="noopener noreferrer"><MessageCircle size={17}/> Chat on WhatsApp</a></section>
 </main>;
}
