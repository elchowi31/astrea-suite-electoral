import React,{useEffect,useId,useRef} from 'react';
import {createPortal} from 'react-dom';
import {X} from 'lucide-react';
import {usePageBack} from '../PageNavigation';

/** Outside the toolbar portal: scrolling, focus and toolbar resizing cannot dismiss it. */
export function ChannelsDialog({open,onClose,children}:{open:boolean;onClose:()=>void;children:React.ReactNode}){
 const dialog=useRef<HTMLDialogElement>(null),heading=useId(),close=useRef(onClose);
 close.current=onClose;
 usePageBack('Solicitudes y jornadas',()=>close.current(),open,30);
 useEffect(()=>{
  const node=dialog.current;if(!node)return;
  if(!open){if(node.open)node.close();return;}
  const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const overflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  if(!node.open)node.showModal();
  return()=>{
   if(node.open)node.close();
   document.body.style.overflow=overflow;
   if(previous?.isConnected&&previous.getClientRects().length)previous.focus({preventScroll:true});
  };
 },[open]);
 if(typeof document==='undefined')return null;
 return createPortal(<dialog ref={dialog} className="channels-dialog" aria-labelledby={heading} onCancel={event=>{event.preventDefault();close.current();}}>
  <header className="channels-dialog-header"><div><h2 id={heading}>Canales y vinculación de WhatsApp</h2><p>Configure el receptor y consulte su conexión.</p></div><button type="button" className="compact-button" autoFocus aria-label="Cerrar canales" onClick={()=>close.current()}><X size={18}/><span>Cerrar</span></button></header>
  <div className="channels-dialog-body">{children}</div>
 </dialog>,document.body);
}
