import useTitle from '../lib/useTitle';

const updated = 'October 5, 2026';

export default function Terms() {
  useTitle('Terms of Service', 'Terms for using Stationery Dot Com and placing service orders.');
  return <main className="legal-page wrap">
    <span className="eyebrow">Stationery Dot Com</span>
    <h1>Terms of Service</h1>
    <p className="legal-updated">Last updated: {updated}</p>
    <p>By using this website or submitting an order, you agree to provide accurate information and use the service lawfully.</p>
    <h2>Services and orders</h2>
    <p>Available services, packages, prices, and requirements are shown on the website and may be updated. An order request is subject to review and acceptance by the store. Please check the selected service, package, quantity, contact details, and any instructions before submitting.</p>
    <h2>Your information and files</h2>
    <p>You are responsible for the accuracy of the details and for having permission to provide any documents, images, or other materials you upload. Do not submit another person's sensitive information unless you are authorized to do so.</p>
    <h2>Payment references</h2>
    <p>Where bKash, Nagad or bank payment is offered, follow the payment instructions shown at checkout and upload a clear screenshot of the successful receipt. The store reviews the screenshot manually; submitting a receipt does not automatically confirm payment or guarantee that an order has been accepted. Never share your wallet PIN, password, or one-time code.</p>
    <h2>Order status and support</h2>
    <p>Use the order tracking page or contact the store for status questions. If you need to change or cancel a request, contact us as soon as possible. Whether a change, cancellation, or refund can be made depends on the order status and work already started; contact the store to discuss your specific order.</p>
    <h2>Accounts and website use</h2>
    <p>Keep your sign-in details private and use only accounts you are authorized to access. We may restrict access where needed to protect customers, orders, or the website.</p>
    <h2>Contact</h2>
    <p>For order or terms questions, email <a href="mailto:sabbirshuvro07@gmail.com">sabbirshuvro07@gmail.com</a> or call <a href="tel:+8801827680520">01827-680520</a> / <a href="tel:+8801611103453">01611-103453</a>.</p>
  </main>;
}
