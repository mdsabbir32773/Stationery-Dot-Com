const KEY='stationery_cart_v1';
export function readCart(){try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return[]}}
export function saveCart(items){localStorage.setItem(KEY,JSON.stringify(items));window.dispatchEvent(new Event('stationery-cart-change'));return items;}
export function addToCart(item){const c=readCart();const i=c.findIndex(x=>x.id===item.id);if(i>=0)c[i]={...c[i],quantity:Math.min(100000,(c[i].quantity||1)+1)};else c.push({...item,quantity:1});saveCart(c);}
export function removeFromCart(id){saveCart(readCart().filter(x=>x.id!==id));}
export function cartCount(){return readCart().reduce((n,x)=>n+(Number(x.quantity)||1),0);}
