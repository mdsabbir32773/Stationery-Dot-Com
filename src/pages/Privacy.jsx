import useTitle from '../lib/useTitle';

const updated = 'November 25, 2026';

export default function Privacy() {
  useTitle('Privacy Policy', 'How Stationery Dot Com handles account, order, contact, payment reference, and uploaded-file information.');
  return <main className="legal-page wrap">
    <span className="eyebrow">Stationery Dot Com</span>
    <h1>Privacy Policy</h1>
    <p className="legal-updated">Last updated: {updated}</p>
    <p>This notice explains the information this website asks you to provide when you create an account, place an order, or contact us.</p>
    <h2>Information you provide</h2>
    <p>Depending on how you use the website, this can include your name, email address, phone or WhatsApp number, account details, service and package selection, quantity, order notes, files you choose to upload, payment method, and the payment receipt screenshot you submit. Google sign-in provides basic account information such as your email address and, when available, your name. This website does not request access to your Gmail inbox.</p>
    <h2>How we use it</h2>
    <p>We use these details to create and manage your account, receive and fulfil orders, review payment references, communicate with you about an order, provide customer support, and protect the service against misuse.</p>
    <h2>Payments</h2>
    <p>For mobile wallet or bank payments, you may upload a receipt screenshot so the store can review the payment manually. Receipt images are stored privately and are available to authorized store administrators for payment verification. Do not enter or share your mobile-wallet PIN, password, or one-time code on this website.</p>
    <h2>Files and order access</h2>
    <p>Files you attach to an order are stored for the order process and can be accessed by the store administrator for that purpose. Do not upload information that is unrelated to your request. Contact us if you want to ask about correcting or removing information associated with your account or order.</p>
    <h2>Advertising measurement</h2>
    <p>The website uses Meta Pixel to measure page views, service interest, add-to-cart actions, checkout starts, order enquiries, and completed wallet-funded purchases. These events may include service or package identifiers, order value in BDT, and browser/device or cookie information made available by your browser. The website does not intentionally send your name, phone number, email address, uploaded files, or payment receipt images to Meta through these events. Meta may use information it receives under its own privacy terms to provide measurement and advertising services. You can manage cookies and advertising preferences through your browser and Meta account settings.</p>
    <h2>Website analytics</h2>
    <p>Google Analytics 4 may be enabled to measure website visits and service-related interactions, such as page views, contact clicks, add-to-cart actions, checkout starts, and order enquiries. It receives limited event information such as a sanitized page path, event type, service or item name, item/package identifier, item count, order value in BDT where relevant, and a random analytics transaction reference for completed SMM wallet orders (not the customer Order ID), along with browser/device and cookie information provided by your browser. Page paths are stripped of query strings and order or invoice identifiers before being sent. Analytics is disabled unless a valid Google Analytics Measurement ID is configured. We do not intentionally send your name, phone number, email address, uploaded files, or payment receipt images through these analytics events. Google processes analytics information under its own privacy terms. You can manage cookies through your browser settings.</p>
    <h2>Service providers and retention</h2>
    <p>The website uses Supabase for account, database, and file-storage features, Cloudflare to host and deliver the website, Google when you choose Google sign-in and when Google Analytics 4 is enabled, and Meta Pixel for advertising measurement. Information is kept for as long as it is needed to manage your account, orders, support, and business records; some records may need to remain for operational or legal reasons.</p>
    <h2>Your choices and contact</h2>
    <p>You can choose not to create an account and may place an order as a guest. For questions about this notice or a request concerning your information, contact <a href="mailto:metaadsstationery@gmail.com">metaadsstationery@gmail.com</a> or call <a href="tel:+8801827680520">01827-680520</a>.</p>
  </main>;
}
