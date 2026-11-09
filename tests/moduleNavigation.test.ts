import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MODULE_LABELS,MAX_PREVIOUS_PAGES,initialModuleTrail,openModule,previousModule,resetModuleScope,type ActiveTab} from '../src/lib/moduleNavigation';
import {PageNavigationBar} from '../src/components/PageNavigation';

test('dashboard cards and cross-module links return through the actual trail with their reading positions',()=>{
  let trail=openModule(initialModuleTrail(),'leaders',740);
  trail=openModule(trail,'finances',215);
  trail=openModule(trail,'transport',980);
  trail=previousModule(trail);assert.deepEqual(trail.current,{tab:'finances',scrollY:980});
  trail=previousModule(trail);assert.deepEqual(trail.current,{tab:'leaders',scrollY:215});
  trail=previousModule(trail);assert.deepEqual(trail.current,{tab:'dashboard',scrollY:740});
});
test('home resets the trail, repeated links do not create loops and an isolated module always has a way home',()=>{
  const trail=openModule(initialModuleTrail(),'leaders',320);
  assert.equal(openModule(trail,'leaders',500),trail);
  assert.deepEqual(openModule(trail,'dashboard',500),initialModuleTrail());
  assert.deepEqual(openModule({current:{tab:'dashboard',scrollY:740},previous:[]},'dashboard',740),initialModuleTrail());
  assert.deepEqual(previousModule(initialModuleTrail('map')),initialModuleTrail());
  assert.deepEqual(previousModule(initialModuleTrail()),initialModuleTrail());
});
test('another viewer or role starts at the dashboard; organization changes retain the module without the previous trail',()=>{
  const trail=openModule(openModule(initialModuleTrail(),'leaders',300),'map',100);
  assert.deepEqual(resetModuleScope(trail,false,true),initialModuleTrail());
  assert.deepEqual(resetModuleScope(trail,true,true),initialModuleTrail('map'));
  assert.deepEqual(resetModuleScope(trail,false,false),initialModuleTrail('login'));
});
test('navigation memory is bounded and bad scroll readings never propagate',()=>{
  let trail=initialModuleTrail();
  for(let i=0;i<MAX_PREVIOUS_PAGES+20;i++)trail=openModule(trail,i%2?'map':'leaders',i);
  assert.equal(trail.previous.length,MAX_PREVIOUS_PAGES);
  assert.equal(openModule(initialModuleTrail(),'map',NaN).previous[0].scrollY,0);
  assert.equal(openModule(initialModuleTrail(),'map',-12).previous[0].scrollY,0);
});
test('every registered module inherits accessible back and dashboard actions automatically',()=>{
  for(const tab of Object.keys(MODULE_LABELS) as ActiveTab[]){
    const markup=renderToStaticMarkup(React.createElement(PageNavigationBar,{current:tab,previous:'finances',onBack:()=>{},onHome:()=>{}}));
    if(tab==='dashboard'){assert.equal(markup,'');continue;}
    assert.match(markup,/aria-label="Volver a Finanzas y aportes"/,tab);
    assert.match(markup,/aria-label="Ir al tablero principal"/,tab);
    assert.match(markup,/min-h-12/,tab);
  }
});
