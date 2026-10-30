import type {Page} from 'playwright';
export type ChatResult='sent'|'unavailable'|'unknown'|'failed';
export function summaryURL(origin:string,id:string){const url=new URL(origin);if(url.protocol!=='https:'&&!(['localhost','127.0.0.1'].includes(url.hostname)&&url.protocol==='http:'))throw Error('Invalid summary origin');url.pathname='/';url.search='';url.hash='report/'+encodeURIComponent(id);return url.href;}
// One bounded send attempt. A click with uncertain delivery is never retried.
export async function postTeamsSummary(page:Page,url:string):Promise<ChatResult>{
 let attempted=false;
 try{
  const chat=page.locator('[data-tid="meeting-chat-button"],[data-tid="chat-button"]').or(page.getByRole('button',{name:/^(Chat|Show (meeting )?(chat|conversation)|Open (meeting )?chat)(\b|$)/i})).first();
  if(!await chat.isVisible().catch(()=>false))return 'unavailable';
  await chat.click({timeout:1500});
  const composer=page.locator('[contenteditable="true"][role="textbox"],textarea[placeholder*="message" i],[contenteditable="true"][data-placeholder*="message" i]').filter({visible:true}).first();
  await composer.waitFor({state:'visible',timeout:2500});
  const message='Rally is preparing the meeting notes. Summary: '+url+'\nSign in to Rally. The host can grant report access to your Rally account; the link does not make the report public.';
  await composer.fill(message,{timeout:1500});
  const send=page.getByRole('button',{name:/^Send( message)?( \(.*\))?$/i}).filter({visible:true}).first();
  if(!await send.isEnabled({timeout:1000}).catch(()=>false))return 'unavailable';
  attempted=true;await send.click({timeout:1500});
  await page.waitForFunction(url=>Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]')).some(a=>a.href===url&&!a.closest('[contenteditable="true"]')) ,url,{timeout:2500});
  return 'sent';
 }catch{return attempted?'unknown':'unavailable';}
}
