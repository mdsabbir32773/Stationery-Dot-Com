const KEY='stationery-dot-com-cart-v1';

export function getCart(){try{return JSON.parse(localStorage.getItem(KEY)||'[]');}catch{return[];}}
function save(items){localStorage.setItem(KEY,JSON.stringify(items));window.dispatchEvent(new Event('cartchange'));return items;}
export function addToCart(item){const items=getCart();const i=items.findIndex(x=>x.package_id===item.package_id);if(i>=0)items[i]={...items[i],quantity:Math.min(100000,(Number(items[i].quantity)||1)+(Number(item.quantity)||1))};else items.push({...item,quantity:Number(item.quantity)||1});return save(items);}
export function updateCartQty(package_id,quantity){const q=Math.max(1,Math.min(100000,Number(quantity)||1));return save(getCart().map(x=>x.package_id===package_id?{...x,quantity:q}:x));}
export function removeFromCart(package_id){return save(getCart().filter(x=>x.package_id!==package_id));}
export function clearCart(){return save([]);}
export function cartCount(){return getCart().reduce((n,x)=>n+(Number(x.quantity)||1),0);}
