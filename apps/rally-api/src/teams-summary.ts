import type {Page} from 'playwright';
export type ChatResult='sent'|'unavailable'|'unknown'|'failed';
export function summaryURL(origin:string,id:string){const url=new URL(origin);if(url.protocol!=='https:'&&!(['localhost','127.0.0.1'].includes(url.hostname)&&url.protocol==='http:'))throw Error('Invalid summary origin');url.pathname='/';url.search='';url.hash='report/'+encodeURIComponent(id);return url.href;}
// One bounded send attempt. A click with uncertain delivery is never retried.
export async function postTeamsSummary(page:Page,url:string):Promise<ChatResult>{
 let attempted=false,stage="open-chat";
 try{
  const composer=page.locator('[contenteditable="true"][role="textbox"],textarea[placeholder*="message" i],[contenteditable="true"][data-placeholder*="message" i]').filter({visible:true}).first();
  const chat=page.locator('[data-tid="meeting-chat-button"],[data-tid="chat-button"]').or(page.getByRole('button',{name:/^(Chat|Show (meeting )?(chat|conversation)|Open (meeting )?chat)(\b|$)/i})).first();
  if(!await composer.isVisible().catch(()=>false)){
    await chat.waitFor({state:'visible',timeout:8000});
    await chat.click({timeout:1500});
  }
  await composer.waitFor({state:'visible',timeout:2500});
  stage='compose';
  // Use Teams' supported formatted-paste path. The anonymous meeting client
  // exposes a minimal editor without the desktop Insert link dialog.
  const escaped=url.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
  const html='<p>Rally is preparing the meeting notes. Summary: <a href="'+escaped+'">Open meeting summary</a></p><p>Sign in to Rally. The host can grant report access to your Rally account; the link does not make the report public.</p>';
  await page.context().grantPermissions(['microphone','camera','clipboard-read','clipboard-write'],{origin:new URL(page.url()).origin});
  await page.evaluate(async({html,url})=>navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([html],{type:'text/html'}),'text/plain':new Blob(['Rally meeting summary: '+url],{type:'text/plain'})})]),{html,url});
  try{
    await composer.fill('',{timeout:1500});await composer.press('Control+v');
    // Never send an unformatted substitute if Teams strips the rich link.
    await page.waitForFunction(url=>Array.from(document.querySelectorAll<HTMLAnchorElement>('[contenteditable="true"] a[href]')).some(a=>a.href===url),url,{timeout:2000});
  }finally{await page.evaluate(()=>navigator.clipboard.writeText('')).catch(()=>{});}
  stage='find-send';const send=page.getByRole('button',{name:/^Send( message)?( \(.*\))?$/i}).filter({visible:true}).first();
  if(!await send.isEnabled({timeout:1000}).catch(()=>false))return 'unavailable';
  const priorMessages=await page.locator('[data-tid="chat-pane-message"]').filter({hasText:'Rally is preparing the meeting notes. Summary:'}).filter({hasText:url}).count();
  const priorLinks=await page.locator('a[href]').evaluateAll((nodes,url)=>nodes.filter(a=>{
    if(a.closest('[contenteditable="true"]'))return false;
    if((a as HTMLAnchorElement).href===url||a.textContent?.trim()===url)return true;
    try{const safe=new URL((a as HTMLAnchorElement).href);return safe.hostname.endsWith('.safelinks.protection.outlook.com')&&safe.searchParams.get('url')===url;}catch{return false;}
  }).length,url);
  stage='send';attempted=true;await send.click({timeout:1500});
  stage='confirm';await page.waitForFunction(({url,priorMessages,priorLinks})=>{
    const linked=Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]')).filter(a=>{
      if(a.closest('[contenteditable="true"]'))return false;
      if(a.href===url||a.textContent?.trim()===url)return true;
      try{const safe=new URL(a.href);return safe.hostname.endsWith('.safelinks.protection.outlook.com')&&safe.searchParams.get('url')===url;}catch{return false;}
    }).length;
    const posted=Array.from(document.querySelectorAll('[data-tid="chat-pane-message"]')).filter(el=>!el.closest('[contenteditable="true"]')&&el.textContent?.includes('Rally is preparing the meeting notes. Summary:')&&el.textContent.includes(url)).length;
    return linked>priorLinks||posted>priorMessages;
  },{url,priorMessages,priorLinks},{timeout:2500});
  return 'sent';
 }catch(error){if(process.env.RALLY_TEAMS_CHAT_DIAGNOSTIC==='1')console.error('Summary delivery diagnostic:',stage,String(error instanceof Error?error.message:error).replace(/https?:\/\/\S+/g,'[URL]').slice(0,500));return attempted?'unknown':'unavailable';}
}

// Let Teams send its leave signaling before any browser/camera teardown.
export async function leaveTeamsMeeting(page:Page):Promise<boolean>{
 try{
  await page.getByRole('button',{name:/^(Leave|Hang up)(\b|$)/i}).filter({visible:true}).first().click({timeout:2000});
  const confirm=page.getByRole('dialog').getByRole('button',{name:/^(Leave|Leave meeting)$/i}).first();
  if(await confirm.isVisible().catch(()=>false))await confirm.click({timeout:1500});
  await page.waitForFunction(()=>{
    const buttons=Array.from(document.querySelectorAll<HTMLButtonElement>('button'));
    const visibleLeave=buttons.some(b=>b.getClientRects().length&&/^(Leave|Hang up)(\b|$)/i.test(b.getAttribute('aria-label')||b.textContent||''));
    const peers=(window as any).__rallyPeers??[];
    const disconnected=peers.length>0&&peers.every((p:any)=>!['connected','connecting'].includes(p.connectionState));
    const afterCall=/you(?: have|'ve)? left the meeting|rejoin|how was your call quality/i.test(document.body.innerText);
    return !visibleLeave&&(disconnected||afterCall);
  },undefined,{timeout:8000});
  // Allow the normal client to finish outbound signaling and UI cleanup.
  await page.waitForTimeout(750);return true;
 }catch{return false;}
}
