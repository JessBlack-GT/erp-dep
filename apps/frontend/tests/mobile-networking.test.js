import { resolveApiBase } from '../src/services/apiBase';
describe('Mobile API configuration', () => {
  test('Android debug reaches Windows host through emulator bridge', () =>
    expect(resolveApiBase(undefined, 'android', true)).toBe('http://10.0.2.2:3000/api/v1'));
  test('web local keeps localhost', () =>
    expect(resolveApiBase(undefined, 'web', true)).toBe('http://localhost:3000/api/v1'));
  test('explicit local port overrides default', () =>
    expect(resolveApiBase('http://10.0.2.2:3100/api/v1', 'android', true)).toBe(
      'http://10.0.2.2:3100/api/v1',
    ));
  test('production uses public HTTPS on Android', () =>
    expect(resolveApiBase('https://api.example.invalid/api/v1', 'android', false)).toBe(
      'https://api.example.invalid/api/v1',
    ));
  test.each([undefined, 'http://10.0.2.2:3000/api/v1', 'https://localhost/api/v1'])(
    'release rejects missing or local address %s',
    (value) => expect(() => resolveApiBase(value, 'android', false)).toThrow('PUBLIC_API_BASE_URL'),
  );
});
