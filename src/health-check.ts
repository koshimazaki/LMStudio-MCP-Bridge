#!/usr/bin/env node

import { config } from './config.js';

/**
 * Standalone health check script for monitoring
 * Can be used by Docker, Kubernetes, or monitoring systems
 */

async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${config.lmStudio.baseUrl}/v1/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.lmStudio.apiKey}`
      },
      signal: AbortSignal.timeout(5000)
    });

    if (response.ok) {
      const data = await response.json() as any;
      console.log('✓ LM Studio is healthy');
      console.log(`  Models available: ${data.data?.length || 0}`);
      return true;
    } else {
      console.error('✗ LM Studio returned error:', response.status);
      return false;
    }
  } catch (error) {
    console.error('✗ Failed to connect to LM Studio:', error);
    return false;
  }
}

// Run health check
checkHealth().then(healthy => {
  process.exit(healthy ? 0 : 1);
}).catch(error => {
  console.error('Health check failed:', error);
  process.exit(1);
});