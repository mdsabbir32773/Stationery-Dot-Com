import React from 'react';

export default function ServiceFaqs({service,packages=[]}) {
  if (!service) return null;
  const category=service.category||'';
  const isSmm=category==='SMM Panel Services'||Boolean(service.smm_platform);
  const isDigital=category==='Digital Subscriptions';
  const isDocuments=category==='Document & Government Services';
  const isCreative=category==='Creative Services';
  let items=[];
  if(isSmm){
    items=[
      ['How is the SMM service price calculated?','The service page shows the listed rate per 1,000 units. Your order total is calculated from the quantity you select and the current displayed rate.'],
      ['Do I need to share my Facebook, Instagram or Telegram password?','No. The order form asks for the relevant public profile, post or channel link. Do not send your account password.'],
      ['What does refill mean?','A refill is available only when the selected service explicitly lists a refill period or refill terms. Check the service details before ordering.'],
      ['How long does delivery take?','Start and delivery times vary by service and order size. Review the estimate shown on this page; it is an estimate, not a guaranteed completion time.']
    ];
  } else if(isDigital){
    items=[
      ['Which subscription durations are available?','Available durations and prices are shown on the package cards. Compare the exact package description before choosing.'],
      ['How will the subscription be activated?','The access or activation method can differ by product and package. Review the package details or contact our team before payment if anything is unclear.'],
      ['Will I receive a personal or shared plan?','The package card describes the access type where it is specified. Please check that information carefully before ordering.'],
      ['What should I do if I need help after ordering?','You can track the order from your account or with your Order ID, and contact our support team if you need assistance.']
    ];
  } else if(isDocuments){
    items=[
      ['Is Stationery Dot Com a government office?','No. Stationery Dot Com is an independent online service provider that offers application and document-support assistance. We are not a government authority.'],
      ['Can you guarantee that an application will be approved?','No. Approval and final decisions are made by the relevant government authority. We can assist with the service request, but cannot guarantee an outcome.'],
      ['Which documents do I need to provide?','Requirements depend on the specific application and the applicant’s situation. Review the service instructions and confirm the required documents with our team before ordering.'],
      ['Are official government fees included?','Check the package description and confirm any official fee separately with our team before making a payment.']
    ];
  } else if(isCreative){
    items=[
      ['What information should I prepare before ordering?','Prepare the project goal, target audience, required text, preferred size or platform, brand assets, visual references and expected deadline.'],
      ['Can I request a custom project?','Yes. If your requirements do not match a listed package, contact our team first so the scope and price can be confirmed.'],
      ['Are delivery time and revisions fixed?','Delivery estimates and revision terms depend on the selected package. Confirm the details shown on the package or ask our team before ordering.'],
      ['How do I share my project files?','Use the upload option at checkout when it is available, or follow the instructions provided by our team for your specific order.']
    ];
  } else {
    items=[
      ['How do I place an order?','Choose the package that matches your requirements, provide the requested information and follow the checkout instructions.'],
      ['How can I check my order status?','Use your account order history or the Track Order page with your Order ID and phone number.'],
      ['When will my service be delivered?','Delivery depends on the selected service and the information required. Check the estimate on this page or ask our team before ordering.'],
      ['How can I contact support?','Use the WhatsApp or phone contact details on the Contact page if you need help with a service or order.']
    ];
  }
  return <section className="service-faqs" aria-labelledby="service-faqs-title">
    <div className="service-faqs-heading"><span className="section-overline">HELP BEFORE YOU ORDER</span><h2 id="service-faqs-title">Frequently asked questions about {service.name}</h2><p>Review these answers before choosing a package. If your situation is different, contact our team for confirmation.</p></div>
    <div className="service-faqs-list">{items.map(([question,answer],i)=><details className="service-faq-item" key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div>
  </section>;
}
