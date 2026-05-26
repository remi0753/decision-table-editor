import { scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';

const PASSWORD_SALT_LENGTH = 16;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_OPTIONS = {
  N: 16_384,
  r: 16,
  p: 1,
  maxmem: 128 * 16_384 * 16 * 2,
} as const;

export async function hashPassword(password: string) {
  const salt = toHex(
    crypto.getRandomValues(new Uint8Array(PASSWORD_SALT_LENGTH)),
  );
  const derivedKey = await deriveScryptKey(password, salt);

  return `${salt}:${toHex(derivedKey)}`;
}

export async function verifyPassword(input: {
  hash: string;
  password: string;
}) {
  const [salt, hash] = input.hash.split(':');
  if (!salt || !hash) return false;

  const expectedKey = fromHex(hash);
  const actualKey = await deriveScryptKey(input.password, salt);

  if (actualKey.byteLength !== expectedKey.byteLength) return false;
  return timingSafeEqual(actualKey, expectedKey);
}

async function deriveScryptKey(password: string, salt: string) {
  return new Promise<Uint8Array>((resolve, reject) => {
    scryptCallback(
      password.normalize('NFKC'),
      salt,
      SCRYPT_KEY_LENGTH,
      SCRYPT_OPTIONS,
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(new Uint8Array(derivedKey));
      },
    );
  });
}

function toHex(value: Uint8Array) {
  return Array.from(value, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
}

function fromHex(value: string) {
  if (value.length % 2 !== 0 || /[^0-9a-f]/i.test(value)) {
    return new Uint8Array();
  }

  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}
