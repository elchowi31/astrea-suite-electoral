import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AuthDeadlineError,authWithDeadline,authErrorMessage} from '../src/lib/authFeedback';

test('Invalid login credentials have a clear Spanish message without exposing whether the email exists',()=>{
  const message=authErrorMessage({code:'auth/invalid-credential'});
  assert.match(message,/correo o la contraseña son incorrectos/);
  assert.equal(authErrorMessage({code:'auth/user-not-found'}),message);
  assert.equal(authErrorMessage({code:'auth/wrong-password'}),message);
  assert.match(message,/Mostrar/);
});

test('A network failure or timeout is not presented as an incorrect password',()=>{
  assert.match(authErrorMessage({code:'auth/network-request-failed'}),/internet/);
  assert.doesNotMatch(authErrorMessage(new AuthDeadlineError()),/contraseña.*incorrect/);
  assert.match(authErrorMessage(new AuthDeadlineError()),/tardando demasiado/);
});

test('A stalled authentication request returns an actionable timeout instead of waiting forever',async()=>{
  let complete!: (value:string)=>void;
  const request=new Promise<string>(resolve=>{complete=resolve;});
  await assert.rejects(authWithDeadline(request,5),AuthDeadlineError);
  complete('late-result');
  assert.equal(await request,'late-result');
});

test('A prompt result or provider error is preserved and does not wait for the deadline',async()=>{
  assert.equal(await authWithDeadline(Promise.resolve('verified'),10000),'verified');
  const denied=Object.assign(new Error('provider-error'),{code:'auth/invalid-credential'});
  await assert.rejects(authWithDeadline(Promise.reject(denied),10000),error=>error===denied);
});
