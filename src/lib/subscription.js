export const SUBSCRIPTION_DURATIONS=[
  {months:1,label:'1 Month'},
  {months:6,label:'6 Months'},
  {months:12,label:'1 Year'},
  {months:24,label:'2 Years'},
  {months:36,label:'3 Years'},
  {months:48,label:'4 Years'},
  {months:60,label:'5 Years'},
  {months:0,label:'Lifetime'},
];

export function subscriptionDurationLabel(months){
  return SUBSCRIPTION_DURATIONS.find(option=>option.months===Number(months))?.label||'';
}
