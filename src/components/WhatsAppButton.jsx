import {MessageCircle} from 'lucide-react';import {waLink} from '../lib/whatsapp';
export default function WhatsAppButton(){return <a className="wafab" href={waLink()} target="_blank" rel="noreferrer" aria-label="WhatsApp Us"><MessageCircle size={22}/><span>WhatsApp Us</span></a>;}
