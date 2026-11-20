import fs from 'fs';
import path from 'path';
import { AppRegistry } from 'react-native';
import { displayName } from '../app.json';

jest.mock('react-native-gesture-handler', () => ({}));
jest.mock('../src/app/App', () => () => null);

test('la entrada JS registra exactamente el componente solicitado por MainActivity', () => {
  const activity = fs.readFileSync(path.join(
    __dirname, '../android/app/src/main/java/com/erpsystem/MainActivity.java',
  ), 'utf8');
  const nativeComponent = activity.match(/getMainComponentName\s*\(\s*\)\s*\{\s*return\s+"([^"]+)"\s*;/)?.[1];
  expect(nativeComponent).toBeDefined();

  const register = jest.spyOn(AppRegistry, 'registerComponent');
  try {
    require('../index');
    expect(register).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledWith(nativeComponent, expect.any(Function));
    expect(displayName).toBe('YJ Nexo');
  } finally {
    register.mockRestore();
  }
});
