process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'isolated-test-secret-not-for-deployment';
process.env.JWT_REFRESH_SECRET = 'isolated-refresh-secret-not-for-deployment';
require('mongoose').set('bufferCommands', false);
