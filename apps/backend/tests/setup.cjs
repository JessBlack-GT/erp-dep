process.env.NODE_ENV = 'test';
// Authorization matrix exercises >100 HTTP requests in one isolated process.
process.env.RATE_LIMIT_MAX = '1000';
process.env.JWT_SECRET = 'isolated-test-secret-not-for-deployment';
process.env.JWT_REFRESH_SECRET = 'isolated-refresh-secret-not-for-deployment';
require('mongoose').set('bufferCommands', false);
