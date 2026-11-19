import test from 'node:test';
import assert from 'node:assert/strict';
import {installPopoverEvents} from '../src/lib/popoverEvents';

// EventTarget exercises registered handlers without depending on React rendering.
class Detail {
 open=true;focused=0;children:Detail[]=[];classList={contains:(name:string)=>name==='app-popover'};
 contains(other:Detail):boolean{return other===this||this.children.some(child=>child.contains(other));}
 querySelector(){return {focus:()=>{this.focused++;}};}
}
function fixture(){
 const previous=globalThis.HTMLDetailsElement;
 globalThis.HTMLDetailsElement=Detail as unknown as typeof HTMLDetailsElement;
 const parent=new Detail(),child=new Detail(),other=new Detail();parent.children=[child];
 const doc=Object.assign(new EventTarget(),{modal:false,querySelectorAll:()=>[parent,child,other].filter(item=>item.open),querySelector:()=>doc.modal?{}:null});
 const dispose=installPopoverEvents(doc as unknown as Document);
 const send=(type:string,props:Record<string,unknown>={})=>{const event=new Event(type,{cancelable:true});for(const [key,value] of Object.entries(props))Object.defineProperty(event,key,{value});doc.dispatchEvent(event);};
 return {parent,child,other,doc,send,close:()=>{dispose();globalThis.HTMLDetailsElement=previous;}};
}
test('scrollbar focus changes do not hide open panels',()=>{const f=fixture();try{f.send('focusin',{target:{}});assert.ok(f.parent.open&&f.child.open&&f.other.open);}finally{f.close();}});
test('pointer inside a nested panel preserves ancestors and closes unrelated menus',()=>{const f=fixture();try{f.send('pointerdown',{composedPath:()=>[{},f.child,f.parent,f.doc]});assert.ok(f.parent.open&&f.child.open);assert.equal(f.other.open,false);f.send('pointerdown',{composedPath:()=>[{},f.doc]});assert.equal(f.parent.open,false);assert.equal(f.child.open,false);}finally{f.close();}});
test('delayed ancestor toggle preserves its child; sibling opening closes the old branch',()=>{const f=fixture();try{f.send('toggle',{target:f.parent});assert.ok(f.parent.open&&f.child.open);assert.equal(f.other.open,false);f.other.open=true;f.send('toggle',{target:f.other});assert.equal(f.parent.open,false);assert.equal(f.child.open,false);assert.ok(f.other.open);}finally{f.close();}});
test('Escape focuses only the innermost summary and leaves modal Escape to the dialog',()=>{const f=fixture();try{f.other.open=false;f.send('keydown',{key:'Escape'});assert.ok(f.parent.open);assert.equal(f.child.open,false);assert.equal(f.child.focused,1);assert.equal(f.parent.focused,0);f.doc.modal=true;f.send('keydown',{key:'Escape'});assert.ok(f.parent.open);}finally{f.close();}});
test('unmount removes listeners',()=>{const f=fixture();f.close();f.send('pointerdown',{composedPath:()=>[f.doc]});assert.ok(f.parent.open&&f.child.open&&f.other.open);});
