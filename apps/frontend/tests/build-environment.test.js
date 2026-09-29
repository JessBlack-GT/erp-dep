const { apiBaseUrl } = require('../scripts/build-environment.cjs');
describe('Production API build configuration', () => {
  test('development keeps local fallback', () =>
    expect(apiBaseUrl({}, false)).toContain('localhost'));
  test('production embeds explicit HTTPS API', () =>
    expect(apiBaseUrl({ PUBLIC_API_BASE_URL: 'https://api.example.invalid/api/v1' }, true)).toBe(
      'https://api.example.invalid/api/v1',
    ));
  test.each([
    undefined,
    'http://localhost:3000/api/v1',
    'https://localhost/api/v1',
    'https://api.example.invalid',
    'https://api.example.invalid/api/v1?token=invalid',
  ])('production rejects invalid API configuration %s', (value) =>
    expect(() => apiBaseUrl({ PUBLIC_API_BASE_URL: value }, true)).toThrow('PUBLIC_API_BASE_URL'),
  );
});
