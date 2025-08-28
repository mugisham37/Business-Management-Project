// Simple test to verify configuration works
import { configManager } from './src/config-manager';
import { env } from './src/env';

async function testConfig() {
  try {
    console.log('Testing configuration...');

    // Test environment variables
    console.log('Environment:', env.NODE_ENV);
    console.log('Server:', env.SERVER_HOST, env.SERVER_PORT);

    // Test config manager initialization
    await configManager.initialize({
      enableDynamicConfig: false, // Disable for simple test
    });

    const config = configManager.getConfig();
    console.log('Config loaded successfully');
    console.log('Server config:', config.server);

    console.log('✅ Configuration test passed!');
  } catch (error) {
    console.error('❌ Configuration test failed:', error);
    process.exit(1);
  }
}

testConfig();
