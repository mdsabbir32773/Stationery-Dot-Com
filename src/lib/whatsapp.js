export const WA_NUMBER='8801827680520';
export const waLink=(text='Hello Stationery Dot Com',number='')=>`https://wa.me/${(number||WA_NUMBER).replace(/\D/g,'')}?text=${encodeURIComponent(text)}`;
