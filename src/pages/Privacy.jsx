import useTitle from '../lib/useTitle';

const updated = 'October 5, 2026';

export default function Privacy() {
  useTitle('Privacy Policy', 'How Stationery Dot Com handles account, order, contact, payment reference, and uploaded-file information.');
  return <main className="legal-page wrap">
    <span className="eyebrow">Stationery Dot Com</span>
    <h1>Privacy Policy</h1>
    <p className="legal-updated">Last updated: {updated}</p>
    <p>This notice explains the information this website asks you to provide when you create an account, place an order, or contact us.</p>
    <h2>Information you provide</h2>
    <p>Depending on how you use the website, this can include your name, email address, phone or WhatsApp number, account details, service and package selection, quantity, order notes, files you choose to upload, payment method, and the transaction ID you enter. Google sign-in provides basic account information such as your email address and, when available, your name. This website does not request access to your Gmail inbox.</p>
    <h2>How we use it</h2>
    <p>We use these details to create and manage your account, receive and fulfil orders, review payment references, communicate with you about an order, provide customer support, and protect the service against misuse.</p>
    <h2>Payments</h2>
    <p>For bKash or Nagad Send Money orders, you enter a transaction ID so the store can review the payment. A submitted transaction ID is not itself confirmation that payment has been received. Do not enter or share your mobile-wallet PIN, password, or one-time code on this website.</p>
    <h2>Files and order access</h2>
    <p>Files you attach to an order are stored for the order process and can be accessed by the store administrator for that purpose. Do not upload information that is unrelated to your request. Contact us if you want to ask about correcting or removing information associated with your account or order.</p>
    <h2>Service providers and retention</h2>
    <p>The website uses Supabase for account, database, and file-storage features, Cloudflare to host and deliver the website, and Google when you choose Google sign-in. Information is kept for as long as it is needed to manage your account, orders, support, and business records; some records may need to remain for operational or legal reasons.</p>
    <h2>Your choices and contact</h2>
    <p>You can choose not to create an account and may place an order as a guest. For questions about this notice or a request concerning your information, contact <a href="mailto:sabbirshuvro07@gmail.com">sabbirshuvro07@gmail.com</a> or call <a href="tel:+8801827680520">01827-680520</a>.</p>
  </main>;
}
