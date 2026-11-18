import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc, getDocFromServer, terminate } from 'firebase/firestore';
import { app, auth, db } from '../src/lib/firebase';
import { saveTerritorialGoal } from '../src/lib/territorialGoals';
import {
  saveFormDesign,
  type SavedFormDesign,
} from '../src/lib/workspaceDrafts';
import {
  readWorkspaceCalendar,
  saveWorkspaceCalendar,
} from '../src/lib/workspaceCalendarConfig';
import { defaultFormDesign } from '../src/lib/formDesign';
import {
  sampleRewardConfig,
  calculateRewards,
  manualRewardHours,
} from '../src/lib/rewards';
import { saveRewardPlan } from '../src/lib/rewardStore';
const enabled = process.env.ASTREA_FIREBASE_TEST_EMULATORS === 'true';
test(
  'Territorial goals, reviewed form designs, Google account preferences and reward samples survive fresh server reads',
  { skip: !enabled, timeout: 180000 },
  async () => {
    assert.equal(app.options.projectId, 'demo-astrea');
    const env = await initializeTestEnvironment({
      projectId: 'demo-astrea',
      firestore: {
        host: '127.0.0.1',
        port: 8088,
        rules: readFileSync('firestore.rules', 'utf8'),
      },
    });
    const { user } = await createUserWithEmailAndPassword(
        auth,
        `workspace-${Date.now()}@test.invalid`,
        'Emulator-only-workspace-481!',
      ),
      tenantId = `workspace-${user.uid}`;
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'organizaciones', tenantId), {
        tenantId,
        active: true,
      });
      await setDoc(doc(context.firestore(), 'usuarios', user.uid), {
        uid: user.uid,
        email: user.email,
        tenantId,
        department: 'Cesar',
        municipality: 'Astrea',
        role: 'AdminTenant',
        active: true,
        accessVersion: 2,
      });
    });
    try {
      const real = await saveTerritorialGoal({
        tenantId,
        department: 'Cesar',
        municipality: 'Astrea',
        demo: false,
        targetVotes: 750,
        revision: 0,
      });
      const demo = await saveTerritorialGoal({
        tenantId,
        department: 'Cesar',
        municipality: 'Astrea',
        demo: true,
        targetVotes: 53,
        revision: 0,
      });
      assert.notEqual(real.id, demo.id);
      assert.equal(
        (await getDocFromServer(doc(db, 'metas_territoriales', real.id))).data()
          ?.targetVotes,
        750,
      );
      assert.equal(
        (await getDocFromServer(doc(db, 'metas_territoriales', demo.id))).data()
          ?.targetVotes,
        53,
      );
      await assert.rejects(
        saveTerritorialGoal({
          tenantId,
          department: 'Cesar',
          municipality: 'Astrea',
          demo: false,
          targetVotes: 1,
          revision: 0,
        }),
        /otra sesión/i,
      );
      const design: SavedFormDesign = {
        id: `${tenantId}--form`,
        tenantId,
        ownerId: user.uid,
        kind: 'form-design',
        name: 'Draft',
        mimeType: 'application/vnd.astrea.form-design',
        category: 'Diseño de formulario',
        summary: 'Draft',
        syncedAt: '',
        revision: 0,
        design: defaultFormDesign(),
        reviewed: true,
      };
      design.design.questions[0].title = 'Pregunta editada';
      const saved = await saveFormDesign(design);
      assert.equal(
        (await getDocFromServer(doc(db, 'formularios_diseno', saved.id))).data()
          ?.design.questions[0].title,
        'Pregunta editada',
      );
      await assert.rejects(saveFormDesign(design), /otra sesión/i);
      await saveWorkspaceCalendar(
        tenantId,
        user.uid,
        'google-account-a',
        'secondary-a',
      );
      await saveWorkspaceCalendar(
        tenantId,
        user.uid,
        'google-account-b',
        'secondary-b',
      );
      assert.equal(
        await readWorkspaceCalendar(tenantId, user.uid, 'google-account-a'),
        'secondary-a',
      );
      assert.equal(
        await readWorkspaceCalendar(tenantId, user.uid, 'google-account-b'),
        'secondary-b',
      );
      const plan = {
        ...sampleRewardConfig(),
        id: `${tenantId}--sample`,
        tenantId,
        ownerId: user.uid,
        name: 'Ejemplo editable',
        revision: 0,
        updatedAt: '',
      };
      const stored = await saveRewardPlan(plan);
      const fresh = (
        await getDocFromServer(doc(db, 'planes_recompensas', stored.plan.id))
      ).data() as typeof plan;
      assert.deepEqual(fresh.farms[0].manualHours.slice(0, 3), [300, 400, 250]);
      assert.deepEqual(
        calculateRewards(fresh, manualRewardHours(fresh)).rows[0].teams.map(
          (row) => row.earnedFruits,
        ),
        [6, 9, 5],
      );
      fresh.farms[0].manualHours[0] = 500;
      await saveRewardPlan(fresh);
      assert.equal(
        (await getDocFromServer(doc(db, 'planes_recompensas', fresh.id))).data()
          ?.farms[0].manualHours[0],
        500,
      );
    } finally {
      await signOut(auth);
      await terminate(db);
      await env.cleanup();
    }
  },
);
