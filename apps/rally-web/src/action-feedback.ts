// Decorate existing promise-returning actions without coupling feedback to API calls.
const labels:Record<string,string>={
 'create-submit':'Preparing your plan…',prepare:'Preparing your plan…',start:'Connecting audio…',end:'Ending Rally’s capture…',
 'request-guidance':'Asking Muse Spark…','retry-report':'Starting report analysis…','export-pdf':'Generating PDF…',
 'auth-submit':'Signing in…','activate-submit':'Checking activation…','mfa-submit':'Verifying…',
 'usage-button':'Loading usage…','confirm-delete':'Deleting meeting…','test-voice':'Preparing voice…',
 'check-audio':'Opening audio check…','teams-join':'Inviting Rally…','teams-leave':'Leaving Teams…','teams-save':'Saving transcript…',
 'teams-refresh':'Refreshing…','admin-open':'Loading administration…','admin-refresh':'Refreshing activity…',
 'plan-form':'Saving plan…','speaker-form':'Saving speaker…','correction-form':'Saving note…','report-share-form':'Granting access…',
 'admin-reauth':'Verifying admin…','admin-create':'Creating invitation…',logout:'Signing out…',pause:'Updating Rally…',dismiss:'Dismissing…',
};
export function setupActionFeedback(root:Document=document) {
 for(const element of root.querySelectorAll<HTMLElement>('*')) {
  const key=element instanceof HTMLFormElement?'onsubmit':'onclick';
  const handler=element[key];if(!handler)continue;
  element[key]=function(event:Event) {
   if(element.dataset.actionPending==='true'){event.preventDefault();return;}
   const target=element instanceof HTMLFormElement
    ? (event as SubmitEvent).submitter??element.querySelector<HTMLElement>('button[type=submit],button:not([type])')
    : element instanceof HTMLButtonElement?element:(event.target as HTMLElement).closest<HTMLElement>('button');
   const original=target?.textContent??'';
   const result=(handler as unknown as (this:HTMLElement,e:Event)=>unknown).call(element,event);
   if(!result||typeof (result as PromiseLike<unknown>).then!=='function')return result;
   const busyLabel=labels[target?.id??'']??labels[element.id]??'Working…';
   element.dataset.actionPending='true';element.setAttribute('aria-busy','true');
   const oldDisabled=target?.getAttribute('aria-disabled');
   if(target){target.classList.add('is-loading');target.setAttribute('aria-busy','true');target.setAttribute('aria-disabled','true');target.textContent=busyLabel;}
   return Promise.resolve(result).finally(()=>{
    delete element.dataset.actionPending;element.removeAttribute('aria-busy');
    if(target){target.classList.remove('is-loading');target.removeAttribute('aria-busy');
     if(oldDisabled===null||oldDisabled===undefined)target.removeAttribute('aria-disabled');else target.setAttribute('aria-disabled',oldDisabled);
     // Polling may have already replaced a phase-dependent label.
     if(target.textContent===busyLabel)target.textContent=original;
    }
   });
  } as never;
 }
}
