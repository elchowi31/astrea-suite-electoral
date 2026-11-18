import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  workspaceApi,
  FormSetupError,
  googleFormLink,
} from '../src/lib/workspaceApi';
import {
  defaultFormDesign,
  validateFormDesign,
  parseSuggestedForm,
} from '../src/lib/formDesign';
import { workspaceTokenCache } from '../src/lib/workspaceSession';
const ok = (data: unknown, status = 200) =>
  new Response(status === 204 ? null : JSON.stringify(data), { status });
test('Google account binding expires and is discarded on organization or owner changes', () => {
  let time = 0;
  const cache = workspaceTokenCache(() => time);
  cache.setScope('a');
  cache.save('token', 'owner', 'a', {
    email: 'different@example.invalid',
    googleUid: 'google-account',
  });
  assert.equal(cache.account('owner')?.googleUid, 'google-account');
  assert.equal(cache.get('other'), null);
  assert.equal(cache.account('owner'), null);
  cache.save('token', 'owner', 'a');
  cache.setScope('b');
  assert.equal(cache.get('owner'), null);
  assert.throws(() => cache.save('stale', 'owner', 'a'));
  cache.save('new', 'owner', 'b', { email: 'account', googleUid: 'id' });
  time = 46 * 60000;
  assert.equal(cache.account('owner'), null);
});
test('Forms validate editable questions, options and JSON suggestions before Google receives data', () => {
  const design = defaultFormDesign();
  assert.ok(validateFormDesign(design).questions.length);
  assert.deepEqual(
    parseSuggestedForm('```json\n' + JSON.stringify(design) + '\n```'),
    validateFormDesign(design),
  );
  assert.throws(() => validateFormDesign({ ...design, questions: [] }));
  assert.throws(() =>
    validateFormDesign({
      ...design,
      questions: [
        { ...design.questions[0], type: 'single', options: ['A', 'A'] },
      ],
    }),
  );
  assert.equal(googleFormLink('javascript:alert(1)'), '');
  assert.equal(
    googleFormLink('https://docs.google.com.attacker.invalid/forms'),
    '',
  );
  assert.equal(
    googleFormLink('https://docs.google.com/forms/d/id/edit'),
    'https://docs.google.com/forms/d/id/edit',
  );
});
test('Forms are explicitly published and verified after questions are created; partial errors retain the same remote ID', async () => {
  const calls: { url: string; body: any }[] = [];
  let callback = '';
  const api = workspaceApi(
    'secret',
    () => {},
    async (input, init) => {
      const url = String(input),
        body = init?.body ? JSON.parse(String(init.body)) : null;
      calls.push({ url, body });
      if (url.endsWith('/forms')) return ok({ formId: 'new_form' });
      if (url.endsWith(':batchUpdate') || url.endsWith(':setPublishSettings'))
        return ok({});
      return ok({
        formId: 'new_form',
        responderUri: 'https://docs.google.com/forms/d/e/public/viewform',
        publishSettings: {
          publishState: { isPublished: true, isAcceptingResponses: true },
        },
      });
    },
  );
  const result = await api.createForm(
    defaultFormDesign(),
    true,
    undefined,
    async (form) => {
      callback = form.formId;
    },
  );
  assert.equal(result.published, true);
  assert.equal(callback, 'new_form');
  assert.equal(
    calls[2].body.publishSettings.publishState.isAcceptingResponses,
    true,
  );
  assert.ok(calls[1].body.requests.some((r: any) => r.createItem));
  let posts = 0;
  const broken = workspaceApi(
    'secret',
    () => {},
    async (input, init) => {
      if (String(input).endsWith('/forms')) {
        posts++;
        return ok({ formId: 'known_form' });
      }
      return ok({ error: { message: 'quota' } }, 429);
    },
  );
  await assert.rejects(
    broken.createForm(defaultFormDesign(), true),
    (error) =>
      error instanceof FormSetupError && error.form.formId === 'known_form',
  );
  assert.equal(posts, 1);
});
test('Retrying a published form preserves its questions and never creates a duplicate', async () => {
  const calls: string[] = [];
  const api = workspaceApi(
    'token',
    () => {},
    async (input, init) => {
      calls.push(String(init?.method || 'GET'));
      return ok({
        formId: 'existing',
        publishSettings: { publishState: { isPublished: true } },
      });
    },
  );
  await assert.rejects(
    api.createForm(defaultFormDesign(), true, 'existing'),
    FormSetupError,
  );
  assert.deepEqual(calls, ['GET']);
});
test('Calendar selection and events paginate, keep all-day dates and expose permission errors', async () => {
  let pages = 0;
  const api = workspaceApi(
    'token',
    () => {},
    async (input) => {
      const url = String(input);
      if (url.includes('calendarList'))
        return ok({
          items: [
            {
              id: url.includes('pageToken') ? 'secondary' : 'primary',
              summary: 'Calendar',
              accessRole: 'reader',
            },
          ],
          nextPageToken: url.includes('pageToken') ? undefined : 'next',
        });
      pages++;
      return ok({
        items: [
          {
            id: String(pages),
            summary: 'All day',
            start: { date: '2026-11-17' },
            end: { date: '2026-11-18' },
          },
        ],
        nextPageToken: pages === 1 ? 'next' : undefined,
      });
    },
  );
  assert.equal((await api.calendars()).length, 2);
  const events = await api.events('someone+calendar@example.invalid');
  assert.equal(events.events.length, 2);
  assert.equal(events.events[0].start.date, '2026-11-17');
  assert.equal(events.limited, false);
  const denied = workspaceApi(
    'token',
    () => {},
    async () => ok({ error: { message: 'scope' } }, 403),
  );
  await assert.rejects(denied.calendars(), /no autorizó/);
});
test('Calendar creation validates dates and recovers an uncertain create only for the same tenant and owner', async () => {
  const event = {
    id: 'abcde12345',
    summary: 'Administrative meeting',
    description: '',
    location: '',
    startIso: '2026-11-17T10:00:00Z',
    endIso: '2026-11-17T11:00:00Z',
    tenantId: 'a',
    ownerId: 'owner',
  };
  let writes = 0;
  const api = workspaceApi(
    'token',
    () => {},
    async (input, init) => {
      if (init?.method === 'POST') {
        writes++;
        return ok({}, 409);
      }
      return ok({
        id: event.id,
        extendedProperties: {
          private: { astreaTenant: 'a', astreaOwner: 'owner' },
        },
      });
    },
  );
  assert.equal((await api.createEvent('calendar', event)).id, event.id);
  assert.equal(writes, 1);
  await assert.rejects(
    api.createEvent('calendar', { ...event, endIso: 'invalid' }),
    /Revise/,
  );
  await assert.rejects(
    api.createEvent('calendar', { ...event, ownerId: 'other' }),
    /otra operación/,
  );
});
test('Google responses cannot update an account after the active binding changes', async () => {
  let active = true;
  const api = workspaceApi(
    'token',
    () => {
      if (!active) throw Error('binding changed');
    },
    async () => {
      active = false;
      return ok({ items: [] });
    },
  );
  await assert.rejects(api.calendars(), /binding changed/);
});
