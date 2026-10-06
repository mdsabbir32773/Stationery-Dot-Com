import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Globe2, Instagram, Phone } from 'lucide-react';
import { categoriesFromServices } from '../data/services';
import { getSettings, supabase } from '../lib/supabase';
import BrandLogo from './BrandLogo';

const socialLinks = [
  {
    name: 'Facebook',
    href: 'https://www.facebook.com/StationeryDotCom2',
    Icon: Facebook,
  },
  {
    name: 'TikTok',
    href: 'https://www.tiktok.com/@stationerydotcom',
    Icon: null,
  },
  {
    name: 'Instagram',
    href: 'https://www.instagram.com/stationerydotcom',
    Icon: Instagram,
  },
];

function TikTokIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-4.05-4.36V2h-3.77v13.67a2.9 2.9 0 1 1-2.9-2.9c.3 0 .6.05.88.14V9.05a6.72 6.72 0 1 0 5.8 6.65V9.18a8.5 8.5 0 0 0 4.97 1.6V7.02c-.31 0-.62-.11-.93-.33Z" />
    </svg>
  );
}

export default function Footer() {
  const [s, setS] = useState({});
  const [cats, setCats] = useState([]);

  useEffect(() => {
    getSettings().then(setS).catch(() => {});
    supabase
      .from('services')
      .select('category,name')
      .eq('is_active', true)
      .then((r) => setCats(categoriesFromServices(r.data || [])));
  }, []);

  const p = s.contact_phone || '01827-680520';
  const p2 = s.contact_phone_2 || '01611-103453';
  const name = s.site_name || 'Stationery Dot Com';

  return (
    <footer>
      <div className="wrap cols">
        <div>
          <b className="footer-brand">
            <BrandLogo src={s.logo_url} name={name} />
            {name}
          </b>
          <p>{s.footer_description || s.site_tagline || 'A fully online service. Place your order and get support from wherever you are.'}</p>
          <p className="online-note"><Globe2 size={15} /> Fully online — no in-person visit needed.</p>
          <p>
            <Phone size={14} /> <a href={'tel:' + p.replace(/\D/g, '')}>{p}</a>
            {p2 && <> · <a href={'tel:' + p2.replace(/\D/g, '')}>{p2}</a></>}
          </p>
          <div aria-label="Social media" className="footer-socials">
            <span className="footer-social-label">Follow us</span>
            {socialLinks.map(({ name: socialName, href, Icon }) => (
              <a
                key={socialName}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={socialName}
                title={socialName}
                className="footer-social-link"
              >
                {Icon ? <Icon size={18} aria-hidden="true" /> : <TikTokIcon />}
              </a>
            ))}
          </div>
        </div>
        <div>
          <h4>Services</h4>
          {cats.length ? (
            <ul>{cats.map((c) => <li key={c.name}><Link to={'/services?category=' + encodeURIComponent(c.name)}>{c.name}</Link></li>)}</ul>
          ) : (
            <p className="footer-empty">New services will appear here soon.</p>
          )}
        </div>
        <div>
          <h4>Help</h4>
          <ul>
            <li><Link to="/services">All services</Link></li>
            <li><Link to="/track-order">Track order</Link></li>
            <li><Link to="/contact">Contact</Link></li>
            <li><Link to="/privacy-policy">Privacy Policy</Link></li>
            <li><Link to="/terms-of-service">Terms of Service</Link></li>
          </ul>
        </div>
      </div>
      <div className="footer-bottom">
        <div className="footer-bottom-inner">
          <span>© {new Date().getFullYear()} {name}. All rights reserved.</span>
          <span className="footer-credit">Built with care by <a href="https://www.facebook.com/share/1DJjJZKWaA/" target="_blank" rel="noopener noreferrer">Crafting Stations</a></span>
        </div>
      </div>
    </footer>
  );
}