import { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send, Sparkles, Headphones } from 'lucide-react';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase';
import '../chatbot.css';
import SdcChatActions from './SdcChatActions';
import SdcInvoiceRequest from './SdcInvoiceRequest';

const greeting = { role: 'assistant', text: "আসসালামু আলাইকুম! 😊 কী খুঁজছেন? সার্ভিস বা প্যাকেজের নাম বলুন—দাম ও অর্ডারে সাহায্য করছি।" };

function quickChatReply(text) {
  const normalized = text.toLowerCase().replace(/[.!?…،,]+$/g, '').trim();
  if (/^(?:assalamu?\s*alaikum|assalamualaikum|as-salamu\s*alaykum|salam|সালাম|আসসালামু আলাইকুম)$/.test(normalized)) return 'ওয়ালাইকুম আসসালাম! 😊 কীভাবে সাহায্য করতে পারি?';
  if (/^(?:hi|hello|hey|hiya|good morning|good afternoon|good evening|হাই|হ্যালো|হেই)$/.test(normalized)) return /[\u0980-\u09ff]/.test(text) ? 'হ্যালো! 😊 কীভাবে সাহায্য করতে পারি?' : 'Hello! 😊 Welcome to Stationery Dot Com. How can I help you today?';
  if (/^(?:thanks?|thank you|thank you so much|thx|ধন্যবাদ|অনেক ধন্যবাদ)$/.test(normalized)) return /[\u0980-\u09ff]/.test(text) ? 'আপনাকে স্বাগতম! 😊' : 'You’re welcome! 😊';
  return '';
}

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
  useEffect(() => {
    if (!open || action || typeof window === 'undefined') return;
    try {
      const raw = window.sessionStorage.getItem('sdc_chat_pending_smm_order');
      if (!raw) return;
      const pending = JSON.parse(raw);
      if (!pending?.message || Date.now() - Number(pending.createdAt || 0) > 30 * 60 * 1000) {
        window.sessionStorage.removeItem('sdc_chat_pending_smm_order');
        return;
      }
      window.sessionStorage.removeItem('sdc_chat_pending_smm_order');
      setActionMessage(String(pending.message).slice(0, 1800));
      setAction('order');
    } catch {
      window.sessionStorage.removeItem('sdc_chat_pending_smm_order');
    }
  }, [open, action]);


  async function sendMessage(value = input) {
    const text = value.trim();
    if (!text || busy || action) return;
    const quickReply = quickChatReply(text);
    if (quickReply) {
      setMessages(prev => [...prev, { role: 'user', text }, { role: 'assistant', text: quickReply }]);
      setInput('');
      return;
    }
    const invoiceRequestIntent=/\b(invoice|bill)\b.{0,45}\b(request|email|send|mail|download|get|need|want|please|chai|lagbe|daw|den|pathao|pathan)\b|\b(request|email|send|mail|download|get|need|want)\b.{0,40}\b(invoice|bill)\b|invoice request|invoice chai|invoice lagbe|ইনভয়েস.*(চাই|পাঠ|ডাউনলোড|রিকোয়েস্ট)|বিল.*(চাই|পাঠ)/i.test(text);
    if(invoiceRequestIntent){setMessages(prev=>[...prev,{role:'user',text}]);setInput('');setActionMessage(text);setAction('invoice-request');return;}
    const statusIntent = /\b(order|deposit|request|wallet)\b.{0,24}\b(status|track|tracking|update|check)\b|\b(where is|track)\s+(?:my\s+)?order\b|স্ট্যাটাস|ট্র্যাক|অবস্থা/i.test(text);
    const asksForInformation = /\b(how|what|which|where|when|why|process|procedure|requirements?|details?|information|explain|price|cost|charge|fee|know| জানতে)\b|কীভাবে|কিভাবে|কি লাগে|কী লাগে|প্রক্রিয়া|নিয়ম|তথ্য|দাম|কত টাকা|চার্জ|ফি|জানতে চাই/i.test(text);
    const wantsDeposit = !statusIntent && !asksForInformation && /\b(add (?:money|funds)|deposit|top.?up (?:my )?wallet|wallet balance)\b|wallet e taka add|funds add|deposit korte|ওয়ালেট.*(জমা|অ্যাড)|ডিপোজিট|ব্যালেন্স.*(যোগ|জমা)/i.test(text);
    const directBanglishOrder = /\border\s+(?:korte|krte)\s+(?:chai|chay)\b|\border\s+(?:korbo|krbo|dibo|dib|dite)\b/i.test(text);
    const explicitOrderRequest = directBanglishOrder || /\b(place|make|submit|create) (?:an? )?order\b|\b(order (?:korbo|krbo|korte|krte|dibo|dib|di)\b|order korte chai|buy|purchase|i want to (?:order|buy|get)|i would like to (?:order|buy|get)|can i get)\b|অর্ডার (করতে|করবো|করব|দিতে|দিবো)/i.test(text);
    // Customers describe SMM work by the outcome, not the exact service title.
    const smmNeed = /\b(?:followers?|likes?|reactions?|views?|viewers?|subscribers?|comments?|shares?|saves?|watch ?time|reach|engagement|impressions?|boost(?:ing)?|promot(?:e|ion|ing)|social media growth|smm|instagram|insta|ig|facebook|fb|youtube|yt|tiktok|telegram|channel members?)\b.{0,70}\b(?:need|want|order|buy|get|increase|grow|boost|lagbe|chai|dorkar|nibo|kinbo|barate|barabo)\b|\b(?:need|want|order|buy|get|increase|grow|boost|lagbe|chai|dorkar|nibo|kinbo|barate|barabo)\b.{0,70}\b(?:followers?|likes?|reactions?|views?|viewers?|subscribers?|comments?|shares?|saves?|watch ?time|reach|engagement|impressions?|boost(?:ing)?|social media growth|smm|instagram|insta|ig|facebook|fb|youtube|yt|tiktok|telegram|channel members?)\b|\b(?:ig|insta|fb|yt)\s*(?:followers?|likes?|views?|subscribers?)\b/i.test(text);
    // Service names, tasks and purchase signals may be phrased in Banglish or English.
    const namedServiceNeed = /\b(?:canva|capcut|gemini|chatgpt|claude|spotify|youtube|facebook|instagram|telegram|meta|design|logo|poster|video editing|visa|air ticket|passport|followers?|reactions?|views?|comments?|shares?|likes?|subscribers?|watch ?time|boost|website|trade license|nid|tin|subscription|package|service|smm|social media|page setup|verification|review|engagement)\b.{0,70}\b(?:lagbe|chai|dorkar|nibo|kinbo|need|want|order|buy|get|korbo|krbo|barate|barabo)\b|\b(?:lagbe|chai|dorkar|nibo|kinbo|need|want|order|buy|get|korbo|krbo|barate|barabo)\b.{0,70}\b(?:canva|capcut|gemini|chatgpt|claude|spotify|youtube|facebook|instagram|telegram|design|logo|poster|visa|ticket|passport|followers?|website|nid|tin|likes?|views?|subscribers?|smm|social media)\b/i.test(text);
    const smmQuantityRequest = /\b\d+\s*(?:k|m)?\s*(?:followers?|likes?|views?|subscribers?|comments?|shares?|members?)\b/i.test(text);
    const smmPageRequest = /\b(?:boost|promote|increase|grow|add)\b.{0,50}\b(?:my|page|followers?|engagement|reach|views?|likes?)\b/i.test(text);
    const wantsOrder = !statusIntent && !asksForInformation && (explicitOrderRequest || smmNeed || namedServiceNeed || smmQuantityRequest || smmPageRequest);
    if (wantsDeposit || wantsOrder) {
      setMessages(prev => [...prev, { role: 'user', text }]);
      setInput('');
      setActionMessage(text);
      setAction(wantsDeposit ? 'deposit' : 'order');
      return;
    }
    // Keep the request well below the Edge Function's 24 KB limit, even after long replies.
    const prior = messages.filter(m => m.role !== 'assistant' || m !== greeting).slice(-6)
      .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', text: m.text.slice(-1400) }));
    setMessages(prev => [...prev, { role: 'user', text }]);
    setInput('');
    setBusy(true);
    let streamedText = '';
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = {
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream, application/json'
      };
      if (session?.access_token) headers.Authorization = 'Bearer ' + session.access_token;
      const response = await fetch(SUPABASE_URL + '/functions/v1/sdc-assistant', {
        method: 'POST',
        headers,
        body: JSON.stringify({ message: text, history: prior, stream: true })
      });
      const contentType = response.headers.get('content-type') || '';
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || 'Chat request failed');
      }
      if (!contentType.includes('text/event-stream')) {
        const data = await response.json();
        if (!data?.reply) throw new Error(data?.error || 'No response');
        setMessages(prev => [...prev, { role: 'assistant', text: data.reply }]);
        return;
      }
      if (!response.body) throw new Error('Streaming response unavailable');
      setMessages(prev => [...prev, { role: 'assistant', text: '' }]);
      const appendChunk = chunk => {
        if (!chunk) return;
        streamedText += chunk;
        setMessages(prev => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === 'assistant') next[next.length - 1] = { ...last, text: last.text + chunk };
          return next;
        });
      };
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const processEvent = event => {
        const data = event.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).join('\n');
        if (!data || data === '[DONE]') return;
        try {
          const chunkData = JSON.parse(data);
          const chunk = chunkData?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('');
          appendChunk(chunk);
        } catch { /* Ignore non-JSON keepalive events. */ }
      };
      while (true) {
        const { value: chunk, done } = await reader.read();
        buffer += decoder.decode(chunk || new Uint8Array(), { stream: !done });
        buffer = buffer.replace(/\r\n/g, '\n');
        let boundary = buffer.indexOf('\n\n');
        while (boundary >= 0) {
          processEvent(buffer.slice(0, boundary));
          buffer = buffer.slice(boundary + 2);
          boundary = buffer.indexOf('\n\n');
        }
        if (done) {
          if (buffer.trim()) processEvent(buffer);
          break;
        }
      }
      if (!streamedText.trim()) throw new Error('No streamed reply received');
    } catch (err) {
      const fallback = 'Sorry, I’m having trouble connecting right now. Please contact our team on WhatsApp: 01827-680520.';
      setMessages(prev => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === 'assistant' && !last.text) next[next.length - 1] = { ...last, text: fallback };
        else next.push({ role: 'assistant', text: fallback });
        return next;
      });
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

          {action==='invoice-request'?<SdcInvoiceRequest initialMessage={actionMessage} onCancel={()=>setAction('')} onComplete={message=>setMessages(prev=>[...prev,{role:'assistant',text:message}])}/>:action&&<SdcChatActions mode={action} initialMessage={actionMessage} onCancel={() => setAction('')} onComplete={message => { setMessages(prev => [...prev, { role: 'assistant', text: message }]); if (message.startsWith('Your wallet balance is insufficient.')) setAction('deposit'); else if (/\bOrder ID:/i.test(message)) { /* Keep the success card mounted so the customer can open the invoice. */ } else setAction(''); }} onInvoiceClick={() => { setAction(''); setOpen(false); }} />}
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
        {open ? <X size={23}/> : <><MessageCircle size={22} strokeWidth={2}/><span>Chat with us</span></>}
        {!open && <b className="sdc-chat-launcher-dot"/>}
      </button>
    </div>
  );
}
