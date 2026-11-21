import useTitle from '../lib/useTitle';

export default function About() {
  useTitle('About Us', 'Learn about Stationery Dot Com and the online services available through our team.');
  return <main className="legal-page wrap">
    <span className="eyebrow">GET TO KNOW US</span>
    <h1>About Stationery Dot Com</h1>
    <p>Stationery Dot Com is a Bangladesh-based online service platform. We bring a range of digital, creative, social media and document-support services together so customers can explore available options, review package details and place requests online.</p>
    <h2>What we help with</h2>
    <ul>
      <li><strong>Document and application support:</strong> assistance with birth certificate, NID, passport and trade-license related requests.</li>
      <li><strong>Meta and social media services:</strong> page setup, social media management, campaign support and listed growth services.</li>
      <li><strong>Digital subscriptions:</strong> selected software and online subscription packages shown in our catalogue.</li>
      <li><strong>Creative services:</strong> graphic design, web design and development, and video editing.</li>
    </ul>
    <h2>How our service works</h2>
    <p>Browse the current catalogue, review the package and its requirements, then submit an order or request a quotation. Where payment is required, use the instructions shown at checkout. Payments and submitted order details are reviewed before an order is confirmed or work begins.</p>
    <h2>Independent service provider</h2>
    <p>Stationery Dot Com is an independent service provider. Document-support services do not make us a government office or government authority. Brand names and platforms mentioned on this website belong to their respective owners; their mention does not by itself imply sponsorship, endorsement or affiliation.</p>
    <h2>Contact our online team</h2>
    <p>For service questions or order support, contact us at <a href="tel:+8801827680520">01827-680520</a> or <a href="tel:+8801611103453">01611-103453</a>, or email <a href="mailto:metaadsstationery@gmail.com">metaadsstationery@gmail.com</a>.</p>
  </main>;
}
