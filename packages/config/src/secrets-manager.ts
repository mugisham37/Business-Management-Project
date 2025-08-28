import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface SecretMetadata {
  name: string;
  version: number;
  description: string | undefined;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SecretOptions {
  description?: string;
  tags?: string[];
}

export class SecretsManager {
  private secretsPath: string;
  private masterKey: Buffer | null = null;
  private cache = new Map<string, { value: string; expiry: number }>();
  private readonly cacheTimeout = 5 * 60 * 1000; // 5 minutes

  constructor(secretsPath?: string, masterPassword?: string) {
    this.secretsPath = secretsPath || path.join(process.cwd(), '.secrets');

    if (masterPassword) {
      this.masterKey = this.deriveKey(masterPassword);
    }
  }

  private deriveKey(password: string): Buffer {
    const salt = Buffer.from('enterprise-auth-salt', 'utf8');
    return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha512');
  }

  private encrypt(text: string): string {
    if (!this.masterKey) {
      return text; // Store as plaintext if no master key
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-cbc', this.masterKey);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return iv.toString('hex') + ':' + encrypted;
  }

  private decrypt(encryptedText: string): string {
    if (!this.masterKey) {
      return encryptedText; // Return as-is if no master key
    }

    const parts = encryptedText.split(':');
    if (parts.length !== 2) {
      return encryptedText; // Assume plaintext if format doesn't match
    }

    try {
      const [ivHex, encrypted] = parts;
      const decipher = crypto.createDecipher('aes-256-cbc', this.masterKey);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.warn('Failed to decrypt secret, returning as plaintext:', error);
      return encryptedText;
    }
  }

  async storeSecret(name: string, value: string, options: SecretOptions = {}): Promise<string> {
    try {
      await fs.mkdir(this.secretsPath, { recursive: true });

      const secretId = crypto.randomUUID();
      const encryptedValue = this.encrypt(value);

      const metadata: SecretMetadata = {
        name,
        version: 1,
        description: options.description,
        tags: options.tags || [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const secretData = {
        id: secretId,
        metadata,
        value: encryptedValue,
      };

      const secretFile = path.join(this.secretsPath, `${name}.json`);
      await fs.writeFile(secretFile, JSON.stringify(secretData, null, 2));

      // Clear cache for this secret
      this.cache.delete(name);

      return secretId;
    } catch (error) {
      console.error('Failed to store secret:', error);
      throw error;
    }
  }

  async getSecret(name: string): Promise<string | null> {
    try {
      // Check cache first
      const cached = this.cache.get(name);
      if (cached && Date.now() < cached.expiry) {
        return cached.value;
      }

      const secretFile = path.join(this.secretsPath, `${name}.json`);

      try {
        const secretData = JSON.parse(await fs.readFile(secretFile, 'utf8'));
        const decryptedValue = this.decrypt(secretData.value);

        // Cache the result
        this.cache.set(name, {
          value: decryptedValue,
          expiry: Date.now() + this.cacheTimeout,
        });

        return decryptedValue;
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          return null; // Secret doesn't exist
        }
        throw error;
      }
    } catch (error) {
      console.error('Failed to retrieve secret:', error);
      throw error;
    }
  }

  async deleteSecret(name: string): Promise<boolean> {
    try {
      const secretFile = path.join(this.secretsPath, `${name}.json`);
      await fs.unlink(secretFile);

      // Clear cache
      this.cache.delete(name);

      return true;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return false; // Secret doesn't exist
      }
      console.error('Failed to delete secret:', error);
      throw error;
    }
  }

  async listSecrets(): Promise<SecretMetadata[]> {
    try {
      await fs.mkdir(this.secretsPath, { recursive: true });
      const files = await fs.readdir(this.secretsPath);

      const secrets: SecretMetadata[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const secretData = JSON.parse(
              await fs.readFile(path.join(this.secretsPath, file), 'utf8')
            );

            if (secretData.metadata) {
              secrets.push({
                ...secretData.metadata,
                createdAt: new Date(secretData.metadata.createdAt),
                updatedAt: new Date(secretData.metadata.updatedAt),
              });
            }
          } catch (error) {
            console.warn(`Failed to read secret file ${file}:`, error);
          }
        }
      }

      return secrets.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error('Failed to list secrets:', error);
      throw error;
    }
  }

  async getConfigValue(key: string, defaultValue: string = ''): Promise<string> {
    // First try to get from secrets
    const secretValue = await this.getSecret(key);
    if (secretValue !== null) {
      return secretValue;
    }

    // Fallback to environment variable
    const envValue = process.env[key];
    if (envValue !== undefined) {
      return envValue;
    }

    return defaultValue;
  }

  clearCache(): void {
    this.cache.clear();
  }

  async rotateSecret(name: string, newValue: string): Promise<string> {
    const existingSecret = await this.getSecret(name);
    if (!existingSecret) {
      throw new Error(`Secret ${name} does not exist`);
    }

    // Store the new value
    return this.storeSecret(name, newValue, {
      description: `Rotated secret for ${name}`,
      tags: ['rotated'],
    });
  }

  async backupSecrets(backupPath: string): Promise<void> {
    try {
      const secrets = await this.listSecrets();
      const backup = {
        timestamp: new Date().toISOString(),
        secrets: [] as any[],
      };

      for (const secret of secrets) {
        const value = await this.getSecret(secret.name);
        if (value) {
          backup.secrets.push({
            metadata: secret,
            value: this.encrypt(value), // Re-encrypt for backup
          });
        }
      }

      await fs.writeFile(backupPath, JSON.stringify(backup, null, 2));
    } catch (error) {
      console.error('Failed to backup secrets:', error);
      throw error;
    }
  }

  async restoreSecrets(backupPath: string): Promise<void> {
    try {
      const backupData = JSON.parse(await fs.readFile(backupPath, 'utf8'));

      for (const secretData of backupData.secrets) {
        const decryptedValue = this.decrypt(secretData.value);
        await this.storeSecret(secretData.metadata.name, decryptedValue, {
          description: secretData.metadata.description,
          tags: [...(secretData.metadata.tags || []), 'restored'],
        });
      }
    } catch (error) {
      console.error('Failed to restore secrets:', error);
      throw error;
    }
  }
}
