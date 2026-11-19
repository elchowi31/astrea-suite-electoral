/** Pointer dismissal only: a scrollbar can move focus to body while still inside a panel. */
export function installPopoverEvents(doc:Document){
 const opened=()=>Array.from(doc.querySelectorAll<HTMLDetailsElement>('details.app-popover[open]'));
 const outside=(event:Event)=>{const path=event.composedPath();for(const element of opened())if(!path.includes(element))element.open=false;};
 const escape=(event:KeyboardEvent)=>{
  if(event.key!=='Escape'||event.defaultPrevented||doc.querySelector('dialog[open]'))return;
  const last=opened().at(-1);if(!last)return;
  last.open=false;last.querySelector<HTMLElement>('summary')?.focus({preventScroll:true});
 };
 const single=(event:Event)=>{
  const target=event.target;if(!(target instanceof HTMLDetailsElement)||!target.open||!target.classList.contains('app-popover'))return;
  // Queued toggle events for an ancestor must not close its already-open child.
  for(const element of opened())if(element!==target&&!element.contains(target)&&!target.contains(element))element.open=false;
 };
 doc.addEventListener('pointerdown',outside);doc.addEventListener('keydown',escape);doc.addEventListener('toggle',single,true);
 return()=>{doc.removeEventListener('pointerdown',outside);doc.removeEventListener('keydown',escape);doc.removeEventListener('toggle',single,true);};
}
