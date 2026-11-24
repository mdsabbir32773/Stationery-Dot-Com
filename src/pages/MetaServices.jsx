import ServiceCategoryLanding from './ServiceCategoryLanding';

export default function MetaServices(){
  return <ServiceCategoryLanding
    category="Meta & Social Media Services"
    title="Meta Ads & Social Media Services in Bangladesh"
    intro="Explore Facebook page setup, Facebook and Instagram advertising support, and social media page management from Stationery Dot Com. Review the campaign scope, access requirements and package terms before ordering."
    guideTitle="What to prepare before starting a Meta campaign"
    guideItems={[
      {label:"Campaign goal:",text:"decide whether you want awareness, website visits, messages, leads or another measurable outcome."},
      {label:"Advertising budget:",text:"check whether ad spend is separate from the service or management fee; do not assume it is included unless the package says so."},
      {label:"Account access:",text:"use appropriate access through Meta Business Suite or Business Manager. Never share personal passwords, OTPs or recovery codes."},
      {label:"Creative and audience:",text:"prepare accurate product details, suitable images or videos, target locations and the audience you want to reach."},
      {label:"Performance expectations:",text:"reach, enquiries and sales depend on budget, audience, creative, offer, market conditions and Meta review."}
    ]}
    guideNote="Meta reviews advertising content and may reject or restrict ads. No provider can guarantee ad approval, reach, leads, sales or return on ad spend."
    faqs={[
      {question:"Does the service fee include Facebook or Instagram ad spend?",answer:"It depends on the selected package. Review the service page and confirm whether the advertising budget is included or paid separately before checkout."},
      {question:"Can you guarantee sales or messages from an ad campaign?",answer:"No. Campaign outcomes depend on the offer, creative, audience, budget, landing page and platform delivery. Results are not guaranteed."},
      {question:"Do I need to share my Facebook password?",answer:"Do not share your personal password or OTP. Where account access is needed, use official Meta role or partner access and grant only the permissions required."},
      {question:"Can you help set up or manage a Facebook page?",answer:"Available page setup, optimization and management options are listed in the catalogue. Open the relevant service to review its exact scope and package."}
    ]}
  />;
}
