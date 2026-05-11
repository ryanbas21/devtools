import { createMockOidcServer } from './server.js';

const { baseUrl } = await createMockOidcServer(3000);
console.log(`Mock OIDC server running at ${baseUrl}`);
console.log(`Test app: ${baseUrl}/test-app`);
console.log('Press Ctrl+C to stop.');
