import { expect, test } from '@playwright/test';
import { apiBaseUrl, makeLogic, makeUser, uniqueName } from './fixtures';

test.describe('API cloud flow with local Postgres', () => {
  test('signs up, creates tenant resources, saves a draft, and publishes a version', async ({
    request,
  }) => {
    const user = makeUser('api');

    const signUp = await request.post(`${apiBaseUrl}/api/auth/sign-up/email`, {
      data: user,
    });
    expect(signUp.ok()).toBeTruthy();

    const me = await request.get(`${apiBaseUrl}/api/me`);
    expect(me.status()).toBe(200);
    await expect(me.json()).resolves.toMatchObject({
      user: { email: user.email },
      orgs: [],
    });

    const orgName = uniqueName('Acme E2E');
    const orgResponse = await request.post(`${apiBaseUrl}/api/orgs`, {
      data: { name: orgName },
    });
    expect(orgResponse.status()).toBe(201);
    const { org, defaultWorkspace } = await orgResponse.json();
    expect(org).toMatchObject({ name: orgName });
    expect(defaultWorkspace).toMatchObject({
      orgId: org.id,
      slug: 'default',
      name: 'Default workspace',
    });

    const workspaceResponse = await request.post(
      `${apiBaseUrl}/api/orgs/${org.id}/workspaces`,
      { data: { name: uniqueName('Claims Review') } },
    );
    expect(workspaceResponse.status()).toBe(201);
    const { workspace } = await workspaceResponse.json();
    expect(workspace.orgId).toBe(org.id);

    const initialLogic = makeLogic(uniqueName('Approval'));
    const createLogicResponse = await request.post(
      `${apiBaseUrl}/api/workspaces/${workspace.id}/logics`,
      {
        data: {
          name: initialLogic.name,
          description: initialLogic.description,
          data: initialLogic,
        },
      },
    );
    expect(createLogicResponse.status()).toBe(201);
    const { logic } = await createLogicResponse.json();
    expect(logic).toMatchObject({
      workspaceId: workspace.id,
      draftData: initialLogic,
      draftRevision: 1,
    });

    const updatedLogic = {
      ...initialLogic,
      description: 'Saved by E2E draft update',
    };
    const saveDraftResponse = await request.patch(
      `${apiBaseUrl}/api/logics/${logic.id}`,
      {
        data: {
          description: updatedLogic.description,
          data: updatedLogic,
          draftRevision: logic.draftRevision,
        },
      },
    );
    expect(saveDraftResponse.status()).toBe(200);
    const saved = await saveDraftResponse.json();
    expect(saved.logic).toMatchObject({
      description: updatedLogic.description,
      draftData: updatedLogic,
      draftRevision: 2,
    });

    const publishResponse = await request.post(
      `${apiBaseUrl}/api/logics/${logic.id}/publish`,
      { data: { releaseNotes: 'Local E2E publish', pinProduction: true } },
    );
    expect(publishResponse.status()).toBe(201);
    const published = await publishResponse.json();
    expect(published.version).toMatchObject({
      logicId: logic.id,
      versionNumber: 1,
      releaseNotes: 'Local E2E publish',
    });
    expect(published.logic.productionVersionId).toBe(published.version.id);

    const versionsResponse = await request.get(
      `${apiBaseUrl}/api/logics/${logic.id}/versions`,
    );
    expect(versionsResponse.status()).toBe(200);
    const versions = await versionsResponse.json();
    expect(versions.versions).toHaveLength(1);
    expect(versions.versions[0]).toMatchObject({
      id: published.version.id,
      versionNumber: 1,
    });

    const diffResponse = await request.get(
      `${apiBaseUrl}/api/logics/${logic.id}/diff?from=production&to=draft`,
    );
    expect(diffResponse.status()).toBe(200);
    await expect(diffResponse.json()).resolves.toMatchObject({
      from: { label: 'production' },
      to: { label: 'draft' },
    });
  });
});
