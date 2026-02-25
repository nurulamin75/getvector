const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

const css = fs.readFileSync(path.join(root, 'assets/styles.css'), 'utf8');
const logoB64 = fs.readFileSync(path.join(root, 'assets/logo.png')).toString('base64');
const logoLightB64 = fs.readFileSync(path.join(root, 'assets/logo-light.png')).toString('base64');
const iconB64 = fs.readFileSync(path.join(root, 'assets/icon.png')).toString('base64');

let html = fs.readFileSync(path.join(root, 'src/ui.html'), 'utf8');

html = html
  .replace('/* __STYLES__ */', css)
  .replaceAll('__LOGO_BASE64__', `data:image/png;base64,${logoB64}`)
  .replaceAll('__LOGO_LIGHT_BASE64__', `data:image/png;base64,${logoLightB64}`)
  .replaceAll('__ICON_BASE64__', `data:image/png;base64,${iconB64}`);

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/ui.html'), html);

console.log('dist/ui.html built');
