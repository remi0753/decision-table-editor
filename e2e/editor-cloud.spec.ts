import { expect, test } from '@playwright/test';
import { apiBaseUrl, makeUser } from './fixtures';

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
    await expect(page.getByRole('button', { name: 'Cloud saved' })).toBeVisible(
      {
        timeout: 30_000,
      },
    );

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

    await page.getByRole('button', { name: 'Cloud saved' }).click();
    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page.getByText('Published v1.')).toBeVisible();

    const logicId = logics.logics[0]?.id;
    expect(logicId).toBeTruthy();
    const versions = await apiFromPage<{
      versions: { versionNumber: number; logicId: string }[];
    }>(page, `/api/logics/${logicId}/versions`);
    expect(versions.versions).toMatchObject([{ versionNumber: 1, logicId }]);
  });
});
