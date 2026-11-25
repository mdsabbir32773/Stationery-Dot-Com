import { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send, Sparkles, Headphones } from 'lucide-react';
import { supabase } from '../lib/supabase';
import '../chatbot.css';
import SdcChatActions from './SdcChatActions';
import SdcInvoiceRequest from './SdcInvoiceRequest';

const greeting = { role: 'assistant', text: "হ্যালো! 😊 কী খুঁজছেন বা কী অর্ডার করতে চান, নিজের মতো করে বলুন। সার্ভিস বা প্যাকেজের নাম বললে আমি মিলিয়ে available package আর দাম জানাব, তারপর একে একে order confirm করব। বাংলা, English বা Banglish—যেভাবে স্বাচ্ছন্দ্য বোধ করেন, সেভাবেই লিখুন।" };

export default function SdcAssistant({ defaultOpen = false } = {}) {
  const [open, setOpen] = useState(defaultOpen);
  const [messages, setMessages] = useState([greeting]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { if (open) { endRef.current?.scrollIntoView({ behavior: 'smooth' }); if (!action) setTimeout(() => inputRef.current?.focus(), 120); } }, [open, messages, busy, action]);
  useEffect(() => { if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function sendMessage(value = input) {
    const text = value.trim();
    if (!text || busy || action) return;
    const invoiceRequestIntent=/\b(invoice|bill)\b.{0,45}\b(request|email|send|mail|download|get|need|want|please|chai|lagbe|daw|den|pathao|pathan)\b|\b(request|email|send|mail|download|get|need|want)\b.{0,40}\b(invoice|bill)\b|invoice request|invoice chai|invoice lagbe|ইনভয়েস.*(চাই|পাঠ|ডাউনলোড|রিকোয়েস্ট)|বিল.*(চাই|পাঠ)/i.test(text);
    if(invoiceRequestIntent){setMessages(prev=>[...prev,{role:'user',text}]);setInput('');setActionMessage(text);setAction('invoice-request');return;}
    const statusIntent = /\b(order|deposit|request|wallet)\b.{0,24}\b(status|track|tracking|update|check)\b|\b(where is|track)\s+(?:my\s+)?order\b|স্ট্যাটাস|ট্র্যাক|অবস্থা/i.test(text);
    const asksForInformation = /\b(how|what|which|where|when|why|process|procedure|requirements?|details?|information|explain|price|cost|charge|fee|know| জানতে)\b|কীভাবে|কিভাবে|কি লাগে|কী লাগে|প্রক্রিয়া|নিয়ম|তথ্য|দাম|কত টাকা|চার্জ|ফি|জানতে চাই/i.test(text);
    const wantsDeposit = !statusIntent && !asksForInformation && /\b(add (?:money|funds)|deposit|top.?up (?:my )?wallet|wallet balance)\b|wallet e taka add|funds add|deposit korte|ওয়ালেট.*(জমা|অ্যাড)|ডিপোজিট|ব্যালেন্স.*(যোগ|জমা)/i.test(text);
    const directBanglishOrder = /\border\s+(?:korte|krte)\s+(?:chai|chay)\b|\border\s+(?:korbo|krbo|dibo|dib|dite)\b/i.test(text);
    const explicitOrderRequest = directBanglishOrder || /\b(place|make|submit|create) (?:an? )?order\b|\b(order (?:korbo|krbo|korte|krte|dibo|dib|di)\b|order korte chai|buy|purchase|i want to (?:order|buy|get)|i would like to (?:order|buy|get)|can i get)\b|অর্ডার (করতে|করবো|করব|দিতে|দিবো)/i.test(text);
    // "chai" alone is not an order signal: "ami jante chai" is an information request.
    // A named service/package followed by a clear need/purchase phrase can start the order flow.
    const namedServiceNeed = /\b(?:canva|capcut|gemini|chatgpt|claude|spotify|youtube|facebook|instagram|telegram|meta|design|logo|poster|video editing|visa|air ticket|passport|followers|reactions|views|comments|shares|website|trade license|nid|tin|subscription|package|service)\b.{0,45}\b(?:lagbe|chai|dorkar|nibo|kinbo)\b|\b(?:lagbe|chai|dorkar|nibo|kinbo)\b.{0,35}\b(?:canva|capcut|gemini|chatgpt|claude|spotify|youtube|facebook|instagram|telegram|design|logo|poster|visa|ticket|passport|followers|website|nid|tin)\b/i.test(text);
    const wantsOrder = !statusIntent && !asksForInformation && (explicitOrderRequest || namedServiceNeed);
    if (wantsDeposit || wantsOrder) {
      setMessages(prev => [...prev, { role: 'user', text }]);
      setInput('');
      setActionMessage(text);
      setAction(wantsDeposit ? 'deposit' : 'order');
      return;
    }
    const prior = messages.filter(m => m.role !== 'assistant' || m !== greeting).slice(-8)
      .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', text: m.text }));
    setMessages(prev => [...prev, { role: 'user', text }]);
    setInput('');
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('sdc-assistant', { body: { message: text, history: prior } });
      if (error) throw error;
      if (!data?.reply) throw new Error(data?.error || 'No response');
      setMessages(prev => [...prev, { role: 'assistant', text: data.reply }]);
    } catch (err) {
      const fallback = 'Sorry, I’m having trouble connecting right now. Please contact our team on WhatsApp: 01827-680520.';
      setMessages(prev => [...prev, { role: 'assistant', text: fallback }]);
    } finally { setBusy(false); }
  }

  return (
    <div className="sdc-chat-root">
      {open && <section className="sdc-chat-panel" aria-label="SDC Assistant chat">
        <header className="sdc-chat-header">
          <div className="sdc-chat-avatar"><Sparkles size={20}/></div>
          <div className="sdc-chat-headcopy"><strong>SDC Assistant</strong><span><i/> Online · Here to help</span></div>
          <button className="sdc-chat-close" onClick={() => setOpen(false)} aria-label="Close chat"><X size={21}/></button>
        </header>
        <div className="sdc-chat-body">
          <div className="sdc-chat-day">TODAY</div>
          {messages.map((m, i) => <div className={'sdc-chat-row ' + (m.role === 'user' ? 'is-user' : 'is-assistant')} key={i}>
            {m.role === 'assistant' && <div className="sdc-chat-mini-avatar"><Sparkles size={13}/></div>}
            <div className="sdc-chat-bubble">{m.text.split('\n').map((line, n) => <span key={n}>{line.split(/(\*\*[^*]+\*\*)/g).map((part, j) => part.startsWith('**') && part.endsWith('**') ? <strong key={j}>{part.slice(2, -2)}</strong> : part)}{n < m.text.split('\n').length - 1 && <br/>}</span>)}</div>
          </div>)}

          {action==='invoice-request'?<SdcInvoiceRequest initialMessage={actionMessage} onCancel={()=>setAction('')} onComplete={message=>setMessages(prev=>[...prev,{role:'assistant',text:message}])}/>:action&&<SdcChatActions mode={action} initialMessage={actionMessage} onCancel={() => setAction('')} onComplete={message => { setMessages(prev => [...prev, { role: 'assistant', text: message }]); if (message.startsWith('Your wallet balance is insufficient.')) setAction('deposit'); else if (/\bOrder ID:/i.test(message)) { /* Keep the success card mounted so the customer can open the invoice. */ } else setAction(''); }} />}
          {busy && <div className="sdc-chat-row is-assistant"><div className="sdc-chat-mini-avatar"><Sparkles size={13}/></div><div className="sdc-chat-bubble sdc-chat-typing"><i/><i/><i/></div></div>}
          <div ref={endRef}/>
        </div>
        {!action && <form className="sdc-chat-compose" onSubmit={e => { e.preventDefault(); sendMessage(); }}>
          <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} placeholder="Type your message..." maxLength={1800} disabled={busy} aria-label="Message"/>
          <button type="submit" disabled={!input.trim() || busy} aria-label="Send message"><Send size={18}/></button>
        </form>}
        <div className="sdc-chat-foot"><Headphones size={12}/> AI support by Stationery Dot Com</div>
      </section>}
      <button className={'sdc-chat-launcher ' + (open ? 'is-open' : '')} onClick={() => setOpen(v => !v)} aria-label={open ? 'Close SDC Assistant' : 'Chat with SDC Assistant'}>
        {open ? <X size={23}/> : <><MessageCircle size={23}/><span>Chat with us</span></>}
        {!open && <b className="sdc-chat-launcher-dot"/>}
      </button>
    </div>
  );
}
