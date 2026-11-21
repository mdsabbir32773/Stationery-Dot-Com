import { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send, Sparkles, Headphones, ArrowUpRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import '../chatbot.css';
import SdcChatActions from './SdcChatActions';

const greeting = { role: 'assistant', text: "Hi there! 👋 I'm SDC Assistant. Tell me what you need help with — services, packages, payments or orders. Ami Bangla, English, Banglish — jevabe bolben, shevabei reply korbo." };

export default function SdcAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([greeting]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState('');
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { if (open) { endRef.current?.scrollIntoView({ behavior: 'smooth' }); setTimeout(() => inputRef.current?.focus(), 120); } }, [open, messages, busy]);
  useEffect(() => { if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function sendMessage(value = input) {
    const text = value.trim();
    if (!text || busy) return;
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
            <div className="sdc-chat-bubble">{m.text.split('\n').map((line, n) => <span key={n}>{line}{n < m.text.split('\n').length - 1 && <br/>}</span>)}</div>
          </div>)}
          <div className="sdc-chat-starters">
            <button onClick={() => setAction('order')}>Place an order here <ArrowUpRight size={13}/></button>
            <button onClick={() => setAction('deposit')}>Add wallet funds here <ArrowUpRight size={13}/></button>
            <button onClick={() => sendMessage('Check my order status')}>Check my order status <ArrowUpRight size={13}/></button>
          </div>
          {action && <SdcChatActions mode={action} onCancel={() => setAction('')} onComplete={message => { setMessages(prev => [...prev, { role: 'assistant', text: message }]); if (message.startsWith('Your wallet balance is insufficient.')) setAction('deposit'); }} />}
          {busy && <div className="sdc-chat-row is-assistant"><div className="sdc-chat-mini-avatar"><Sparkles size={13}/></div><div className="sdc-chat-bubble sdc-chat-typing"><i/><i/><i/></div></div>}
          <div ref={endRef}/>
        </div>
        <form className="sdc-chat-compose" onSubmit={e => { e.preventDefault(); sendMessage(); }}>
          <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} placeholder="Type your message..." maxLength={1800} disabled={busy} aria-label="Message"/>
          <button type="submit" disabled={!input.trim() || busy} aria-label="Send message"><Send size={18}/></button>
        </form>
        <div className="sdc-chat-foot"><Headphones size={12}/> AI support by Stationery Dot Com</div>
      </section>}
      <button className={'sdc-chat-launcher ' + (open ? 'is-open' : '')} onClick={() => setOpen(v => !v)} aria-label={open ? 'Close SDC Assistant' : 'Chat with SDC Assistant'}>
        {open ? <X size={23}/> : <><MessageCircle size={23}/><span>Chat with us</span></>}
        {!open && <b className="sdc-chat-launcher-dot"/>}
      </button>
    </div>
  );
}
