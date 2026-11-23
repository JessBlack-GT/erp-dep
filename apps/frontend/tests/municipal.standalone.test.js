/** Paridad mínima de identidad y aislamiento del cliente MuniERP IA. */
const fs = require('fs');
const path = require('path');
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

test('el cliente MuniERP usa un navegador exclusivo, sin pantallas comerciales', () => {
  expect(read('src/app/App.js')).toContain('MunicipalStandaloneApp');
  const nav = read('src/app/navigation/MunicipalStandaloneNavigator.js');
  expect(nav).toContain('name="Municipal"');
  expect(nav).not.toMatch(/WebAppShell|Customers|Suppliers|Sales|Inventory/);
  expect(read('src/app/municipal/MunicipalStandaloneShell.js')).toContain('Cerrar sesión');
});

test('la compilación Android es otra aplicación y mantiene la raíz de React Native', () => {
  const gradle = read('android/app/build.gradle');
  expect(gradle).toContain('applicationId "com.munierp.ia.qa"');
  expect(read('app.json')).toContain('"name": "ERPSystem"');
  expect(read('android/app/src/main/AndroidManifest.xml')).toContain('com.erpsystem.MainApplication');
});

test('web y Android usan API municipal QA y nunca muestran banda de infraestructura', () => {
  const target = read('src/constants/api-target.js');
  expect(target).toContain("Platform.OS === 'web' ? '/api/v1'");
  expect(target).toContain('https://yj-nexo-munierp-qa.onrender.com/api/v1');
  expect(read('src/features/municipal/MunicipalScreen.js')).not.toMatch(/modeLabel=\{/);
});

test('el branding utiliza el logo aprobado de Figma en web y Android, sin dibujar uno alternativo', () => {
  expect(read('src/app/municipal/MunicipalStandaloneLogin.js')).toContain('munierp-horizontal-approved.png');
  expect(read('src/app/municipal/MunicipalStandaloneShell.js')).toContain('munierp-horizontal-approved.png');
  expect(read('android/app/src/main/AndroidManifest.xml')).toContain('${yjNexoAppLabel}');
  expect(require('fs').existsSync(require('path').join(__dirname, '..', 'src/assets/munierp-isotipo-approved.png'))).toBe(true);
});
