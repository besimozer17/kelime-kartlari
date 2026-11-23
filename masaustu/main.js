// Kelime Kartı – Windows masaüstü sarmalayıcısı.
// site/ klasörünü app://kelime/ adresinden sunar (IndexedDB ve fetch çalışsın diye file:// yerine özel şema).
const { app, BrowserWindow, protocol, net, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

const SITE = app.isPackaged
  ? path.join(process.resourcesPath, 'site')
  : path.join(__dirname, '..', 'site');
const KOK = 'app://kelime/';

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let pencere = null;

  app.on('second-instance', () => {
    if (!pencere) return;
    if (pencere.isMinimized()) pencere.restore();
    pencere.focus();
  });

  function pencereAc() {
    pencere = new BrowserWindow({
      width: 1180,
      height: 800,
      minWidth: 360,
      minHeight: 560,
      backgroundColor: '#0f1115',
      autoHideMenuBar: true,
      title: 'Kelime Kartı',
      icon: path.join(SITE, 'simge', 'simge-512.png'),
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    pencere.removeMenu();
    pencere.loadURL(KOK + 'index.html');
    // Dış bağlantılar (kaynak / lisans sayfaları) varsayılan tarayıcıda açılır.
    pencere.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:/i.test(url)) shell.openExternal(url);
      return { action: 'deny' };
    });
    pencere.webContents.on('will-navigate', (olay, url) => {
      if (!url.startsWith(KOK)) {
        olay.preventDefault();
        if (/^https?:/i.test(url)) shell.openExternal(url);
      }
    });
    pencere.on('closed', () => { pencere = null; });
  }

  app.whenReady().then(() => {
    protocol.handle('app', (istek) => {
      const u = new URL(istek.url);
      let goreli = decodeURIComponent(u.pathname);
      if (goreli.endsWith('/')) goreli += 'index.html';
      const dosya = path.normalize(path.join(SITE, goreli));
      // site/ dışına çıkış yok
      if (dosya !== SITE && !dosya.startsWith(SITE + path.sep)) {
        return new Response('Yasak', { status: 403 });
      }
      if (!fs.existsSync(dosya) || fs.statSync(dosya).isDirectory()) {
        return new Response('Bulunamadı', { status: 404 });
      }
      return net.fetch(pathToFileURL(dosya).toString());
    });
    pencereAc();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) pencereAc(); });
  });

  app.on('window-all-closed', () => app.quit());
}
