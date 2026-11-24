import ServiceCategoryLanding from './ServiceCategoryLanding';

export default function CreativeServices(){
  return <ServiceCategoryLanding
    category="Creative Services"
    title="Graphic Design, Video Editing & Web Design in Bangladesh"
    intro="Explore graphic design, video editing and website design or development services from Stationery Dot Com. Review each package's deliverables, requirements and revision terms before placing an order."
    guideTitle="How to prepare a clear creative project brief"
    guideItems={[
      {label:"Project objective:",text:"explain where the design, video or website will be used and what outcome you need."},
      {label:"Content and assets:",text:"provide final text, brand colours, logos, product details, images and other materials that you have permission to use."},
      {label:"Reference examples:",text:"share visual references and explain what you like about them; references guide the direction but do not mean an exact copy."},
      {label:"Deliverables:",text:"confirm dimensions, file formats, page count, video length, website features and whether editable source files are included."},
      {label:"Revisions and timeline:",text:"review the package's revision allowance and delivery estimate. Extra scope may require a separate quote."}
    ]}
    guideNote="Final scope, delivery time and included files vary by package and project brief. Confirm the service details before payment."
    faqs={[
      {question:"What should I send before ordering a design?",answer:"Share the purpose, final text, dimensions, brand assets, preferred style and any reference examples. The exact requirements depend on the selected design package."},
      {question:"Are revisions included?",answer:"Revision terms vary by package. Check the service description and confirm the included revision allowance before checkout."},
      {question:"Will I receive editable source files?",answer:"Source-file delivery depends on the package. Confirm the included file formats and editable assets with the service details before ordering."},
      {question:"Can you create or edit social media videos?",answer:"Video editing and AI video creation options are listed in the catalogue. Review each service page for supported formats, duration and deliverables."}
    ]}
  />;
}
