import useTitle from '../lib/useTitle';

const updated = 'November 21, 2026';

export default function RefundPolicy() {
  useTitle('Refund Policy', 'How Stationery Dot Com reviews cancellation and refund requests for online service orders.');
  return <main className="legal-page wrap">
    <span className="eyebrow">CUSTOMER SUPPORT</span>
    <h1>Refund & Cancellation Policy</h1>
    <p className="legal-updated">Last updated: {updated}</p>
    <p>We want customers to understand how a cancellation or refund request is reviewed. Because our catalogue includes digital subscriptions, third-party services and work performed specifically for a customer, the outcome depends on the order and the stage of fulfilment.</p>
    <h2>Before work begins</h2>
    <p>If you need to cancel an order before work or fulfilment has started, contact us as soon as possible with your order ID. We will check the order and confirm whether cancellation and a refund are possible.</p>
    <h2>After work or fulfilment begins</h2>
    <p>Once a service has been started, a subscription or digital item has been activated or delivered, or a third-party provider has processed the request, a full refund may not be possible. Any request will be reviewed against the work completed, third-party costs and the specific service terms shown at the time of order.</p>
    <h2>Failed or incorrect fulfilment</h2>
    <p>If you believe an order was not delivered as described, contact us with the order ID and relevant details. We will investigate and, where appropriate, discuss a correction, replacement, alternative resolution or refund.</p>
    <h2>Customer-provided information</h2>
    <p>Please check names, contact details, links, documents and package selections before submitting. Delays or failed processing caused by incomplete, inaccurate or unauthorized information may affect whether a cancellation or refund can be approved.</p>
    <h2>How to request help</h2>
    <p>Contact us with your order ID at <a href="mailto:metaadsstationery@gmail.com">metaadsstationery@gmail.com</a>, call <a href="tel:+8801827680520">01827-680520</a>, or message us through WhatsApp. We will review the order and explain the available next steps. A payment receipt upload alone does not mean payment has been verified or that a refund has been approved.</p>
  </main>;
}
