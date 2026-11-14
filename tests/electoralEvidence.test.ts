import test from 'node:test';import assert from 'node:assert/strict';
import {parseActaLines,witnessAssignmentId,validateActaEvidence,consolidateReviewedActas} from '../src/lib/electoralEvidence';
test('manual acta lines reject fractions, negatives, repeated labels and extra fields',()=>{
 assert.deepEqual(parseActaLines('Lista A;12\nBlancos;0'),[{label:'Lista A',votes:12},{label:'Blancos',votes:0}]);
 for(const text of ['A;-1','A;1.2','A;1\na;2','A;1;extra'])assert.throws(()=>parseActaLines(text));
 assert.throws(()=>validateActaEvidence({results:parseActaLines('A;1'),photo:'https://example.com/a.png',notes:''}));
});
test('a table and contest have stable scoped assignment identifiers',async()=>{
 const a=await witnessAssignmentId('a','Astrea','Escuela  Uno',1,'Concejo');assert.equal(a,await witnessAssignmentId('a',' ASTREA ','escuela uno',1,'concejo'));assert.notEqual(a,await witnessAssignmentId('b','Astrea','Escuela Uno',1,'Concejo'));assert.notEqual(a,await witnessAssignmentId('a','Astrea','Escuela Uno',1,'Alcaldía'));
});
test('consolidation includes only reviewed valid evidence once per table assignment',()=>{
 const row={id:'1',tenantId:'a',assignmentId:'mesa-1',contest:'Concejo',status:'Revisada',results:parseActaLines('Lista A;12'),photo:'data:image/jpeg;base64,YQ==',notes:''} as any;
 const result=consolidateReviewedActas([row,{...row,id:'duplicate'},{...row,id:'foreign',tenantId:'b'},{...row,id:'draft',assignmentId:'mesa-2',status:'En revisión'}],'a');assert.equal(result.reviewed,1);assert.equal(result.invalid,1);assert.equal(result.totals[0].votes,12);
});

test('canonical evidence retains all rows and rejects malformed stored captures',async()=>{
 const {storedElectoralEvidence,readElectoralEvidence}=await import('../src/lib/electoralEvidence');
 const evidence:any={id:'x',results:Array.from({length:30},(_,i)=>({label:'Lista '+i,votes:i})),photo:'data:image/png;base64,YQ==',notes:''};
 const stored=storedElectoralEvidence(evidence);assert.equal(stored.resultsText.split('\n').length,30);assert.deepEqual(readElectoralEvidence(stored).results,evidence.results);assert.equal('results' in stored,false);
 assert.throws(()=>readElectoralEvidence({...stored,resultsText:stored.resultsText+'\nOtra;-1'}));
});
