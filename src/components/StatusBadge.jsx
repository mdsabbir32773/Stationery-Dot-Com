const C={Completed:'b-ok',Paid:'b-ok','Payment Received':'b-ok','Wallet charged':'b-ok',Processing:'b-run',Cancelled:'b-bad',Refunded:'b-bad',Failed:'b-bad'};
export default function StatusBadge({status}){return <span className={'badge '+(C[status]||'b-wait')}>{status||'—'}</span>;}
