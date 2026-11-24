const FRIDAY_OFFER=Object.freeze({
  'FB-FOL-WW':80,
  'FB-FOL-MIX':140,
  'FB-FOL-BD-N':200,
  'FB-FOL-BD-P':290,
  'FB-FOL-BD-LIFE':400
});
export function isDhakaFriday(now=new Date()) {
  return new Date(now.toLocaleString('en-US',{timeZone:'Asia/Dhaka'})).getDay()===5;
}
export function hasFridayOffer(service) {
  return Object.hasOwn(FRIDAY_OFFER,service?.smm_service_code);
}
export function getSmmUnitPrice(service,now=new Date()) {
  return isDhakaFriday(now)&&hasFridayOffer(service)
    ? FRIDAY_OFFER[service.smm_service_code]
    : Number(service?.smm_price_per_1000||0);
}
