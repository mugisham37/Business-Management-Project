export interface SecretProvider {
  getSecret(key: string): Promise<string | null>;
  setSecret(key: string, value: string): Promise<void>;
  deleteSecret(key: string): Promise<void>;
  listSecrets(): Promise<string[]>;
}

export interface VaultConfig {
  endpoint: string;
  token: string;
  namespace?: string;
  mountPath?: string;
}

export interface AWSSecretsManagerConfig {
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
}

// HashiCorp Vault integration
export class VaultSecretProvider implements SecretProvider {
  private config: VaultConfig;
  private vaultClient: any;

  constructor(config: VaultConfig) {
    this.config = config;
    this.initializeVaultClient();
  }

  private async initializeVaultClient() {
    try {
      // Dynamic import to avoid bundling node-vault if not used
      const nodeVault = await import('node-vault');

      this.vaultClient = nodeVault.default({
        endpoint: this.config.endpoint,
        token: this.config.token,
        namespace: this.config.namespace,
      });

      // Test connection
      await this.vaultClient.status();
    } catch (error) {
      console.error('Failed to initialize Vault client:', error);
      // Fallback to fetch-based implementation
      this.vaultClient = null;
    }
  }

  async getSecret(key: string): Promise<string | null> {
    try {
      if (this.vaultClient) {
        // Use node-vault client
        const result = await this.vaultClient.read(
          `${this.config.mountPath || 'secret'}/data/${key}`
        );
        return result.data?.data?.value || null;
      } else {
        // Fallback to fetch
        const response = await fetch(
          `${this.config.endpoint}/v1/${this.config.mountPath || 'secret'}/data/${key}`,
          {
            headers: {
              'X-Vault-Token': this.config.token,
              ...(this.config.namespace && { 'X-Vault-Namespace': this.config.namespace }),
            },
          }
        );

        if (!response.ok) {
          if (response.status === 404) {
            return null;
          }
          throw new Error(`Vault API error: ${response.statusText}`);
        }

        const data = await response.json();
        return data.data?.data?.value || null;
      }
    } catch (error) {
      console.error('Error retrieving secret from Vault:', error);
      throw error;
    }
  }

  async setSecret(key: string, value: string): Promise<void> {
    try {
      const response = await fetch(
        `${this.config.endpoint}/v1/${this.config.mountPath || 'secret'}/data/${key}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Vault-Token': this.config.token,
            'X-Vault-Namespace': this.config.namespace || '',
          },
          body: JSON.stringify({
            data: { value },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Vault API error: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error storing secret in Vault:', error);
      throw error;
    }
  }

  async deleteSecret(key: string): Promise<void> {
    try {
      const response = await fetch(
        `${this.config.endpoint}/v1/${this.config.mountPath || 'secret'}/metadata/${key}`,
        {
          method: 'DELETE',
          headers: {
            'X-Vault-Token': this.config.token,
            'X-Vault-Namespace': this.config.namespace || '',
          },
        }
      );

      if (!response.ok && response.status !== 404) {
        throw new Error(`Vault API error: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error deleting secret from Vault:', error);
      throw error;
    }
  }

  async listSecrets(): Promise<string[]> {
    try {
      const response = await fetch(
        `${this.config.endpoint}/v1/${this.config.mountPath || 'secret'}/metadata?list=true`,
        {
          headers: {
            'X-Vault-Token': this.config.token,
            'X-Vault-Namespace': this.config.namespace || '',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Vault API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data?.keys || [];
    } catch (error) {
      console.error('Error listing secrets from Vault:', error);
      throw error;
    }
  }
}

// AWS Secrets Manager integration
export class AWSSecretsManagerProvider implements SecretProvider {
  private config: AWSSecretsManagerConfig;
  private client: any; // SecretsManagerClient

  constructor(config: AWSSecretsManagerConfig) {
    this.config = config;
    this.initializeClient();
  }

  private async initializeClient() {
    try {
      // Dynamic import to avoid bundling AWS SDK if not used
      const { SecretsManagerClient } = await import('@aws-sdk/client-secrets-manager');
      const { fromEnv, fromIni } = await import('@aws-sdk/credential-providers');

      let credentials;
      if (this.config.accessKeyId && this.config.secretAccessKey) {
        credentials = {
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey,
          ...(this.config.sessionToken && { sessionToken: this.config.sessionToken }),
        };
      } else {
        // Use default credential chain (environment, IAM role, etc.)
        credentials = fromEnv() || fromIni();
      }

      this.client = new SecretsManagerClient({
        region: this.config.region,
        credentials,
      });
    } catch (error) {
      console.error('Failed to initialize AWS Secrets Manager client:', error);
      throw new Error('AWS Secrets Manager client initialization failed');
    }
  }

  async getSecret(key: string): Promise<string | null> {
    try {
      if (!this.client) {
        await this.initializeClient();
      }

      const { GetSecretValueCommand } = await import('@aws-sdk/client-secrets-manager');
      const command = new GetSecretValueCommand({
        SecretId: key,
      });

      const response = await this.client.send(command);
      return response.SecretString || null;
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException') {
        return null;
      }
      console.error('Error retrieving secret from AWS Secrets Manager:', error);
      throw error;
    }
  }

  async setSecret(key: string, value: string): Promise<void> {
    try {
      if (!this.client) {
        await this.initializeClient();
      }

      const { CreateSecretCommand, UpdateSecretCommand } = await import(
        '@aws-sdk/client-secrets-manager'
      );

      // Try to update first, create if it doesn't exist
      try {
        const updateCommand = new UpdateSecretCommand({
          SecretId: key,
          SecretString: value,
        });
        await this.client.send(updateCommand);
      } catch (error: any) {
        if (error.name === 'ResourceNotFoundException') {
          // Secret doesn't exist, create it
          const createCommand = new CreateSecretCommand({
            Name: key,
            SecretString: value,
            Description: `Secret managed by application: ${key}`,
          });
          await this.client.send(createCommand);
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error('Error storing secret in AWS Secrets Manager:', error);
      throw error;
    }
  }

  async deleteSecret(key: string): Promise<void> {
    try {
      if (!this.client) {
        await this.initializeClient();
      }

      const { DeleteSecretCommand } = await import('@aws-sdk/client-secrets-manager');
      const command = new DeleteSecretCommand({
        SecretId: key,
        ForceDeleteWithoutRecovery: true,
      });

      await this.client.send(command);
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException') {
        // Secret doesn't exist, consider it deleted
        return;
      }
      console.error('Error deleting secret from AWS Secrets Manager:', error);
      throw error;
    }
  }

  async listSecrets(): Promise<string[]> {
    try {
      if (!this.client) {
        await this.initializeClient();
      }

      const { ListSecretsCommand } = await import('@aws-sdk/client-secrets-manager');
      const command = new ListSecretsCommand({});

      const response = await this.client.send(command);
      return response.SecretList?.map(secret => secret.Name || '') || [];
    } catch (error) {
      console.error('Error listing secrets from AWS Secrets Manager:', error);
      throw error;
    }
  }

  async rotateSecret(key: string): Promise<void> {
    try {
      if (!this.client) {
        await this.initializeClient();
      }

      const { RotateSecretCommand } = await import('@aws-sdk/client-secrets-manager');
      const command = new RotateSecretCommand({
        SecretId: key,
      });

      await this.client.send(command);
    } catch (error) {
      console.error('Error rotating secret in AWS Secrets Manager:', error);
      throw error;
    }
  }
}

// Environment-based secret provider (fallback)
export class EnvironmentSecretProvider implements SecretProvider {
  async getSecret(key: string): Promise<string | null> {
    return process.env[key] || null;
  }

  async setSecret(key: string, value: string): Promise<void> {
    process.env[key] = value;
  }

  async deleteSecret(key: string): Promise<void> {
    delete process.env[key];
  }

  async listSecrets(): Promise<string[]> {
    return Object.keys(process.env);
  }
}

// Secret manager factory
export class SecretManager {
  private provider: SecretProvider;

  constructor(provider?: SecretProvider) {
    this.provider = provider || this.createDefaultProvider();
  }

  private createDefaultProvider(): SecretProvider {
    // Determine provider based on environment configuration
    const vaultEndpoint = process.env.VAULT_ENDPOINT;
    const vaultToken = process.env.VAULT_TOKEN;

    if (vaultEndpoint && vaultToken) {
      return new VaultSecretProvider({
        endpoint: vaultEndpoint,
        token: vaultToken,
        namespace: process.env.VAULT_NAMESPACE,
        mountPath: process.env.VAULT_MOUNT_PATH,
      });
    }

    const awsRegion = process.env.AWS_REGION;
    if (awsRegion) {
      return new AWSSecretsManagerProvider({
        region: awsRegion,
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        sessionToken: process.env.AWS_SESSION_TOKEN,
      });
    }

    // Fallback to environment variables
    return new EnvironmentSecretProvider();
  }

  async getSecret(key: string): Promise<string | null> {
    return this.provider.getSecret(key);
  }

  async setSecret(key: string, value: string): Promise<void> {
    return this.provider.setSecret(key, value);
  }

  async deleteSecret(key: string): Promise<void> {
    return this.provider.deleteSecret(key);
  }

  async listSecrets(): Promise<string[]> {
    return this.provider.listSecrets();
  }

  // Utility methods for common secrets
  async getDatabasePassword(): Promise<string | null> {
    return this.getSecret('DATABASE_PASSWORD');
  }

  async getJwtSecret(): Promise<string | null> {
    return this.getSecret('JWT_SECRET');
  }

  async getRedisPassword(): Promise<string | null> {
    return this.getSecret('REDIS_PASSWORD');
  }

  async getSmtpPassword(): Promise<string | null> {
    return this.getSecret('SMTP_PASSWORD');
  }

  async getOAuthClientSecret(provider: string): Promise<string | null> {
    return this.getSecret(`${provider.toUpperCase()}_CLIENT_SECRET`);
  }
}

// Export singleton instance
export const secretManager = new SecretManager();
