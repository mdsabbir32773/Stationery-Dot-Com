export function getPaymentMethods(settings={}) {
  const methods=[];
  if(settings.payment_bkash_number||settings.payment_bkash_qr_url) {
    methods.push({name:'bKash',number:settings.payment_bkash_number||settings.payment_number,qr:settings.payment_bkash_qr_url});
  }
  if(settings.payment_nagad_number||settings.payment_nagad_qr_url) {
    methods.push({name:'Nagad',number:settings.payment_nagad_number||settings.payment_number,qr:settings.payment_nagad_qr_url});
  }
  if(settings.payment_rocket_number) {
    methods.push({name:'Rocket',number:settings.payment_rocket_number});
  }
  if(settings.payment_bank_details) {
    methods.push({name:'Bank transfer',number:settings.payment_bank_details});
  }
  if(settings.payment_qr_url) {
    methods.push({name:'Bangla QR',number:settings.payment_number||'Scan the QR to pay',qr:settings.payment_qr_url});
  }
  if(!methods.length&&(settings.payment_number||settings.payment_method_name)) {
    methods.push({name:settings.payment_method_name||'Mobile banking',number:settings.payment_number,qr:settings.payment_qr_url});
  }
  return methods;
}

export function getWalletPaymentMethods(settings={}) {
  return getPaymentMethods(settings).filter(method => ['bKash','Nagad','Rocket','Bank transfer','Bangla QR'].includes(method.name));
}
