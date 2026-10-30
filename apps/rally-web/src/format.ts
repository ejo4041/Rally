export function formatMoney(value:number|null|undefined):string {
 if(value==null||!Number.isFinite(value))return 'Unknown';
 if(value>0&&value<0.01)return '<$0.01';
 return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(value);
}
