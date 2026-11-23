'use strict';
// Comprobaciones estáticas para una compilación independiente de QA.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const rootApp = read('src/app/App.js');
const nav = read('src/app/navigation/MunicipalStandaloneNavigator.js');
const shell = read('src/app/municipal/MunicipalStandaloneShell.js');
const api = read('src/constants/api-target.js');
const gradle = read('android/app/build.gradle');
const manifest = read('android/app/src/main/AndroidManifest.xml');
const html = read('scripts/web.cjs');
const app = JSON.parse(read('app.json').replace(/^\uFEFF/, ''));
assert.match(rootApp, /MunicipalStandaloneApp/);
assert.doesNotMatch(nav, /Customers|Suppliers|Inventory|Sales|RolesScreen|WebAppShell/);
assert.match(nav, /name="Municipal"/);
assert.match(nav, /name="Login"/);
assert.match(shell, /MunicipalScreen/);
assert.match(shell, /Cerrar sesi[oó]n/);
assert.match(api, /https:\/\/yj-nexo-munierp-qa\.onrender\.com\/api\/v1/);
assert.match(api, /Platform\.OS === 'web' \? '\/api\/v1'/);
assert.match(gradle, /applicationId "com\.munierp\.ia\.qa"/);
assert.match(gradle, /namespace "com\.erpsystem"/);
assert.match(manifest, /com\.erpsystem\.MainApplication/);
assert.match(manifest, /munierp_brand/);
assert.equal(app.name, 'ERPSystem', 'MainActivity usa ERPSystem, debe coincidir con AppRegistry');
assert.equal(app.displayName, 'MuniERP IA');
for (const rel of ['src/assets/munierp-horizontal-approved.png', 'src/assets/munierp-isotipo-approved.png', 'android/app/src/main/res/drawable-nodpi/munierp_brand.png', 'assets/munierp-favicon.svg']) {
  assert.ok(fs.statSync(path.join(root, rel)).size > 100, 'Recurso de marca no válido: ' + rel);
}
assert.match(read('src/app/municipal/MunicipalStandaloneLogin.js'), /munierp-horizontal-approved\.png/);
assert.match(read('src/app/municipal/MunicipalStandaloneShell.js'), /munierp-horizontal-approved\.png/);
assert.match(html, /MuniERP IA · Gestión municipal/);
assert.doesNotMatch(read('src/features/municipal/MunicipalScreen.js'), /modeLabel=\{/);
console.log('MuniERP standalone: 22 comprobaciones estáticas correctas.');
