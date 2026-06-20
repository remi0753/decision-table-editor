// Connector secret storage (WP0). Credentials for live data sources are
// encrypted with AES-256-GCM and stored in connector_secret; the plaintext only
// ever exists server-side, transiently, while a resolver runs. The encryption
// key comes from CONNECTOR_SECRET_KEY (base64, 32 bytes). Web Crypto is used so
// this also runs on the edge runtime.

import { eq } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { connectorSecret } from '../db/schema.js';
import type { ConnectorSecret } from '../resolvers/driver.js';

function toBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

async function importKey(keyB64: string): Promise<CryptoKey> {
  const raw = toBytes(keyB64);
  if (raw.length !== 32) {
    throw new Error('CONNECTOR_SECRET_KEY must be 32 bytes (base64).');
  }
  return crypto.subtle.importKey(
    'raw',
    raw as BufferSource,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  );
}

export interface SecretStoreEnv {
  CONNECTOR_SECRET_KEY?: string;
}

// Encrypt and persist a secret, returning the new connector_secret id used as
// data_source.secret_ref.
export async function putConnectorSecret(input: {
  db: Database;
  env: SecretStoreEnv;
  workspaceId: string;
  actorUserId: string;
  authType: string;
  value: Record<string, string>;
}): Promise<string> {
  if (!input.env.CONNECTOR_SECRET_KEY) {
    throw new Error('CONNECTOR_SECRET_KEY is not configured.');
  }
  const key = await importKey(input.env.CONNECTOR_SECRET_KEY);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(input.value));
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      plaintext as BufferSource,
    ),
  );
  // Web Crypto appends the 16-byte auth tag to the ciphertext; split it out so
  // the column layout matches a classic (ciphertext, iv, tag) split.
  const tag = encrypted.slice(encrypted.length - 16);
  const body = encrypted.slice(0, encrypted.length - 16);

  const [row] = await input.db
    .insert(connectorSecret)
    .values({
      workspaceId: input.workspaceId,
      authType: input.authType,
      ciphertext: toBase64(body),
      iv: toBase64(iv),
      authTag: toBase64(tag),
      createdActorType: 'user',
      createdActorId: input.actorUserId,
    })
    .returning({ id: connectorSecret.id });
  if (!row) throw new Error('Could not store connector secret.');
  return row.id;
}

// Decrypt a stored secret for server-side resolver use. Returns null if missing.
export async function getConnectorSecret(input: {
  db: Database;
  env: SecretStoreEnv;
  secretRef: string;
}): Promise<ConnectorSecret | null> {
  if (!input.env.CONNECTOR_SECRET_KEY) return null;
  const [row] = await input.db
    .select()
    .from(connectorSecret)
    .where(eq(connectorSecret.id, input.secretRef))
    .limit(1);
  if (!row) return null;

  const key = await importKey(input.env.CONNECTOR_SECRET_KEY);
  const iv = toBytes(row.iv);
  const body = toBytes(row.ciphertext);
  const tag = toBytes(row.authTag);
  const combined = new Uint8Array(body.length + tag.length);
  combined.set(body, 0);
  combined.set(tag, body.length);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    combined as BufferSource,
  );
  const value = JSON.parse(new TextDecoder().decode(plaintext)) as Record<
    string,
    string
  >;
  return { authType: row.authType, value };
}
