import { expect, test } from '@playwright/test';
import { apiBaseUrl, makeLogic, makeUser, uniqueName } from './fixtures';

async function apiFromPage<T>(
  page: import('@playwright/test').Page,
  path: string,
) {
  return page.evaluate(
    async ({ baseUrl, requestPath }) => {
      const response = await fetch(`${baseUrl}${requestPath}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`${requestPath} failed with ${response.status}`);
      }
      return response.json();
    },
    { baseUrl: apiBaseUrl, requestPath: path },
  ) as Promise<T>;
}

test.describe('Editor cloud E2E with API and local Postgres', () => {
  test('creates an account, connects the editor to cloud storage, and publishes', async ({
    page,
  }) => {
    const user = makeUser('editor');

    await page.goto('/auth');
    await page.getByRole('button', { name: 'Create a new account' }).click();
    await page.getByLabel('Name').fill(user.name);
    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Password').fill(user.password);
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page).toHaveURL(/\/edit$/);
    await expect(page.getByText('Cloud saved')).toBeVisible({
      timeout: 30_000,
    });

    const me = await apiFromPage<{
      user: { email: string };
      orgs: { org: { id: string } }[];
    }>(page, '/api/me');
    expect(me.user.email).toBe(user.email);
    expect(me.orgs).toHaveLength(1);

    const orgId = me.orgs[0]?.org.id;
    expect(orgId).toBeTruthy();
    const workspaces = await apiFromPage<{
      workspaces: { id: string; name: string }[];
    }>(page, `/api/orgs/${orgId}/workspaces`);
    expect(workspaces.workspaces).toHaveLength(1);

    const workspaceId = workspaces.workspaces[0]?.id;
    expect(workspaceId).toBeTruthy();
    const logics = await apiFromPage<{
      logics: { id: string; name: string; draftRevision: number }[];
    }>(page, `/api/workspaces/${workspaceId}/logics`);
    expect(logics.logics).toHaveLength(1);
    expect(logics.logics[0]?.draftRevision).toBe(1);

    await page.getByRole('button', { name: 'Account and workspace' }).click();
    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page.getByText('Published v1.')).toBeVisible();

    const logicId = logics.logics[0]?.id;
    expect(logicId).toBeTruthy();
    const versions = await apiFromPage<{
      versions: { versionNumber: number; logicId: string }[];
    }>(page, `/api/logics/${logicId}/versions`);
    expect(versions.versions).toMatchObject([{ versionNumber: 1, logicId }]);
  });

  test('moves a browser draft to cloud during sign-up', async ({ page }) => {
    const user = makeUser('editor-migrate');
    const localLogic = makeLogic(uniqueName('Migrated browser draft'));

    await page.goto('/');
    await page.evaluate((logic) => {
      localStorage.setItem('decision-table-editor-v2', JSON.stringify(logic));
    }, localLogic);

    await page.goto('/auth');
    await expect(
      page.getByRole('button', { name: /Move browser draft to cloud/ }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Create a new account' }).click();
    await page.getByLabel('Name').fill(user.name);
    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Password').fill(user.password);
    await page
      .getByRole('button', { name: 'Create account and move draft' })
      .click();

    await expect(page).toHaveURL(/\/edit$/);
    await expect(page.getByText('Cloud saved')).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page.getByRole('button', { name: localLogic.name }),
    ).toBeVisible();

    const me = await apiFromPage<{
      orgs: { org: { id: string } }[];
    }>(page, '/api/me');
    const orgId = me.orgs[0]?.org.id;
    expect(orgId).toBeTruthy();

    const workspaces = await apiFromPage<{
      workspaces: { id: string }[];
    }>(page, `/api/orgs/${orgId}/workspaces`);
    const workspaceId = workspaces.workspaces[0]?.id;
    expect(workspaceId).toBeTruthy();

    const logics = await apiFromPage<{
      logics: { name: string; draftRevision: number }[];
    }>(page, `/api/workspaces/${workspaceId}/logics`);
    expect(logics.logics).toMatchObject([
      { name: localLogic.name, draftRevision: 1 },
    ]);
  });

  test('lets an unregistered invitee create an account without a personal default org', async ({
    page,
    request,
  }) => {
    const owner = makeUser('invite-owner');
    const invitee = makeUser('invitee');
    const orgName = uniqueName('Invited Org');

    const signUp = await request.post(`${apiBaseUrl}/api/auth/sign-up/email`, {
      data: owner,
    });
    expect(signUp.ok()).toBeTruthy();

    const orgResponse = await request.post(`${apiBaseUrl}/api/orgs`, {
      data: { name: orgName },
    });
    expect(orgResponse.status()).toBe(201);
    const { org } = await orgResponse.json();

    const inviteResponse = await request.post(
      `${apiBaseUrl}/api/orgs/${org.id}/invitations`,
      { data: { email: invitee.email, role: 'editor' } },
    );
    expect(inviteResponse.status()).toBe(201);
    const { acceptUrl } = await inviteResponse.json();
    const token = new URL(acceptUrl).searchParams.get('token');
    expect(token).toBeTruthy();

    await page.goto(`/invite?token=${token}`);
    await expect(page.getByText(orgName)).toBeVisible();
    await page.getByLabel('Name').fill(invitee.name);
    await page.getByLabel('Password').fill(invitee.password);
    await page.getByRole('button', { name: 'Create account and join' }).click();

    await expect(page).toHaveURL(/\/edit$/, { timeout: 30_000 });
    await expect(page.getByText('Cloud saved')).toBeVisible({
      timeout: 30_000,
    });

    const me = await apiFromPage<{
      user: { email: string };
      orgs: { role: string; org: { id: string; name: string } }[];
    }>(page, '/api/me');
    expect(me.user.email).toBe(invitee.email);
    expect(me.orgs).toHaveLength(1);
    expect(me.orgs[0]).toMatchObject({
      role: 'editor',
      org: { id: org.id, name: orgName },
    });
  });

  test('loads a published runner URL and keeps runner role out of the editor', async ({
    page,
    request,
  }) => {
    const owner = makeUser('runner-owner');
    const runner = makeUser('runner-member');
    const initialLogic = makeLogic(uniqueName('Runner review logic'));

    const signUp = await request.post(`${apiBaseUrl}/api/auth/sign-up/email`, {
      data: owner,
    });
    expect(signUp.ok()).toBeTruthy();

    const orgResponse = await request.post(`${apiBaseUrl}/api/orgs`, {
      data: { name: uniqueName('Runner Org') },
    });
    expect(orgResponse.status()).toBe(201);
    const { org, defaultWorkspace } = await orgResponse.json();

    const createLogicResponse = await request.post(
      `${apiBaseUrl}/api/workspaces/${defaultWorkspace.id}/logics`,
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

    const publishResponse = await request.post(
      `${apiBaseUrl}/api/logics/${logic.id}/publish`,
      { data: { pinProduction: true } },
    );
    expect(publishResponse.status()).toBe(201);
    const { version } = await publishResponse.json();

    const inviteResponse = await request.post(
      `${apiBaseUrl}/api/orgs/${org.id}/invitations`,
      { data: { email: runner.email, role: 'runner' } },
    );
    expect(inviteResponse.status()).toBe(201);
    const { acceptUrl } = await inviteResponse.json();
    const token = new URL(acceptUrl).searchParams.get('token');
    expect(token).toBeTruthy();

    await page.goto('/');
    await page.evaluate(
      async ({ baseUrl, user, invitationToken }) => {
        const signUpResponse = await fetch(
          `${baseUrl}/api/auth/sign-up/email`,
          {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(user),
          },
        );
        if (!signUpResponse.ok) {
          throw new Error(`runner sign-up failed: ${signUpResponse.status}`);
        }

        const acceptResponse = await fetch(
          `${baseUrl}/api/invitations/accept`,
          {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: invitationToken }),
          },
        );
        if (!acceptResponse.ok) {
          throw new Error(`invite accept failed: ${acceptResponse.status}`);
        }
      },
      { baseUrl: apiBaseUrl, user: runner, invitationToken: token },
    );

    await page.goto(
      `/run/${defaultWorkspace.id}/${logic.id}@v${version.versionNumber}`,
    );
    await expect(
      page.getByRole('heading', { name: initialLogic.name }),
    ).toBeVisible();
    await page.getByLabel('Amount').fill('900');
    await page.getByLabel('Tier').selectOption('standard');
    await page.getByRole('button', { name: 'Run review' }).click();
    await expect(page.getByText('Decision:')).toBeVisible();
    await expect(page.getByText('approve')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Edit' })).toHaveCount(0);

    await page.goto('/edit');
    await expect(page).toHaveURL(
      new RegExp(
        `/run/${defaultWorkspace.id}/${logic.id}@v${version.versionNumber}$`,
      ),
      { timeout: 30_000 },
    );
  });
});
