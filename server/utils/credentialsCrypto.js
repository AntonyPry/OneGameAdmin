'use strict';

const crypto = require('crypto');

const ENCRYPTION_KEY_ENV = 'CREDENTIALS_ENCRYPTION_KEY';
const CIPHER_ALGORITHM = 'aes-256-gcm';
const AAD = Buffer.from('onegameadmin:smartshell-manager', 'utf8');

class CredentialsEncryptionError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'CredentialsEncryptionError';
    this.code = code;
  }
}

const isPlaceholder = (value) =>
  /^CHANGE_ME/i.test(value) || /PLACEHOLDER/i.test(value);

const getEncryptionKey = () => {
  const rawKey = String(process.env[ENCRYPTION_KEY_ENV] || '').trim();

  if (!rawKey || isPlaceholder(rawKey)) {
    throw new CredentialsEncryptionError(
      'CREDENTIALS_ENCRYPTION_KEY_MISSING',
      `${ENCRYPTION_KEY_ENV} не настроен`,
    );
  }

  if (/^[a-f0-9]{64}$/i.test(rawKey)) {
    return Buffer.from(rawKey, 'hex');
  }

  if (/^[A-Za-z0-9+/]+={0,2}$/.test(rawKey)) {
    const base64Key = Buffer.from(rawKey, 'base64');
    if (base64Key.length === 32) return base64Key;
  }

  if (rawKey.length < 32) {
    throw new CredentialsEncryptionError(
      'CREDENTIALS_ENCRYPTION_KEY_TOO_SHORT',
      `${ENCRYPTION_KEY_ENV} должен быть длинной случайной строкой не короче 32 символов`,
    );
  }

  return crypto.createHash('sha256').update(rawKey).digest();
};

const encryptCredential = (plainText) => {
  const credential = String(plainText || '');

  if (!credential) {
    throw new CredentialsEncryptionError(
      'EMPTY_CREDENTIAL',
      'Передан пустой credential',
    );
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(CIPHER_ALGORITHM, getEncryptionKey(), iv);
  cipher.setAAD(AAD);

  const encrypted = Buffer.concat([
    cipher.update(credential, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    'v1',
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
};

const decryptCredential = (encryptedPayload) => {
  if (!encryptedPayload) {
    throw new CredentialsEncryptionError(
      'CREDENTIAL_PAYLOAD_MISSING',
      'Credential payload отсутствует',
    );
  }

  const [version, ivBase64, authTagBase64, encryptedBase64] =
    String(encryptedPayload).split(':');

  if (version !== 'v1' || !ivBase64 || !authTagBase64 || !encryptedBase64) {
    throw new CredentialsEncryptionError(
      'CREDENTIAL_PAYLOAD_INVALID',
      'Credential payload имеет неподдерживаемый формат',
    );
  }

  try {
    const decipher = crypto.createDecipheriv(
      CIPHER_ALGORITHM,
      getEncryptionKey(),
      Buffer.from(ivBase64, 'base64'),
    );
    decipher.setAAD(AAD);
    decipher.setAuthTag(Buffer.from(authTagBase64, 'base64'));

    return Buffer.concat([
      decipher.update(Buffer.from(encryptedBase64, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch (error) {
    if (error instanceof CredentialsEncryptionError) throw error;

    throw new CredentialsEncryptionError(
      'CREDENTIAL_DECRYPT_FAILED',
      'Не удалось расшифровать credential',
    );
  }
};

module.exports = {
  ENCRYPTION_KEY_ENV,
  CredentialsEncryptionError,
  encryptCredential,
  decryptCredential,
};
