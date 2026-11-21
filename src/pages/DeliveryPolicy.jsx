import useTitle from '../lib/useTitle';

const updated = 'November 21, 2026';

export default function DeliveryPolicy() {
  useTitle('Service Delivery Policy', 'How Stationery Dot Com processes online orders and communicates service delivery timelines.');
  return <main className="legal-page wrap">
    <span className="eyebrow">ORDER FULFILMENT</span>
    <h1>Service Delivery Policy</h1>
    <p className="legal-updated">Last updated: {updated}</p>
    <p>Stationery Dot Com provides online services. Delivery method and processing time depend on the selected service, package, the information supplied by the customer and any third-party platform or authority involved.</p>
    <h2>Order review</h2>
    <p>After an order is submitted, we review the order details and, where applicable, the payment reference. Uploading a payment receipt does not automatically confirm payment. Processing begins after the required information and payment have been reviewed and the order is accepted.</p>
    <h2>Digital subscriptions and online services</h2>
    <p>Digital access or subscription fulfilment is arranged online using the delivery method described for the selected package. Access details are shared after the order and payment checks are complete. Package-specific access limits, duration and conditions take precedence over this general policy.</p>
    <h2>Document and application support</h2>
    <p>We provide assistance with the selected application or document-related request. Where a government office or external authority is involved, its processing, appointment, approval and delivery timelines are outside our control. We cannot guarantee an authority's decision or completion date.</p>
    <h2>Creative and marketing services</h2>
    <p>Work begins after the requirements and necessary materials have been received and the order is accepted. Delivery timing depends on the scope, revisions, customer feedback and any platform review or advertising approval required.</p>
    <h2>Updates and support</h2>
    <p>Use the order tracking page or your customer account to check the latest status. If you need an update, contact us with your order ID at <a href="mailto:metaadsstationery@gmail.com">metaadsstationery@gmail.com</a> or call <a href="tel:+8801827680520">01827-680520</a> / <a href="tel:+8801611103453">01611-103453</a>.</p>
  </main>;
}
