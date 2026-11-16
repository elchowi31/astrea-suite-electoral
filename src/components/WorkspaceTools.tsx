import React,{createContext,useContext,useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {MoreHorizontal} from 'lucide-react';

type Area='header'|'page';
type Targets={pageKey:string;header:HTMLElement|null;page:HTMLElement|null;setHeader:(node:HTMLDivElement|null)=>void;setPage:(node:HTMLDivElement|null)=>void};
const Context=createContext<Targets|null>(null);

/** Portals retain the module's permissions and state while sharing the shell's space. */
export function WorkspaceToolsProvider({pageKey,children}:{pageKey:string;children:React.ReactNode}){
 const [header,setHeader]=useState<HTMLElement|null>(null),[page,setPage]=useState<HTMLElement|null>(null);
 const value=useMemo(()=>({pageKey,header,page,setHeader,setPage}),[pageKey,header,page]);
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function WorkspaceToolsOutlet({area}:{area:Area}){
 const context=useContext(Context);if(!context)return null;
 // Replacing the target also removes tools belonging to a suspended previous page.
 return <div key={context.pageKey} className={`workspace-tools-outlet ${area}-tools`} aria-label={area==='header'?'Acciones del tablero':'Herramientas de la página'}><ToolbarGroup label={area==='header'?'Acciones del tablero':'Herramientas'}><div className="toolbar-content" ref={area==='header'?context.setHeader:context.setPage}/></ToolbarGroup></div>;
}
export function WorkspaceTools({area='page',children}:{area?:Area;children:React.ReactNode}){
 const context=useContext(Context),owner=useRef(context?.pageKey.split(':').at(-1));
 if(!context)return <div className="module-actions">{children}</div>;
 if(context.pageKey.split(':').at(-1)!==owner.current||!context[area])return null;
 return createPortal(children,context[area]);
}
export function ToolbarGroup({children,label='Herramientas'}:{children:React.ReactNode;label?:string}){
 const [wide,setWide]=useState(()=>typeof window==='undefined'||window.matchMedia('(min-width:900px)').matches);
 useEffect(()=>{const media=window.matchMedia('(min-width:900px)'),change=()=>setWide(media.matches);change();media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[]);
 return wide?<div className="toolbar-group">{children}</div>:<details className="app-popover toolbar-overflow"><summary aria-label={label} title={label}><MoreHorizontal size={20}/><span className="sr-only">{label}</span></summary><div className="app-popover-panel toolbar-overflow-panel">{children}</div></details>;
}
