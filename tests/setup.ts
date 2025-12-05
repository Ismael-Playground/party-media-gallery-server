import { beforeAll, afterAll, beforeEach } from 'vitest';

// Mock environment variables for tests
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-minimum-32-chars';
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/party_gallery_test?schema=public';
process.env.FIREBASE_PROJECT_ID = 'test-project';
process.env.FIREBASE_PRIVATE_KEY = 'test-key';
process.env.FIREBASE_CLIENT_EMAIL = 'test@test.iam.gserviceaccount.com';

beforeAll(async () => {
  // Setup before all tests
});

beforeEach(async () => {
  // Setup before each test
});

afterAll(async () => {
  // Cleanup after all tests
});
