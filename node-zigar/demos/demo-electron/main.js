const { app, dialog, BrowserWindow, Menu } = require('electron');
const { readFile } = require('fs/promises');
const { join } = require('path');

// use node-zigar
require('node-zigar/cjs');
const { sha1 } = require('lib/sha1.zigar');

const isMac = process.platform === 'darwin'

// create browser window
let mainWindow;
const createWindow = () => {
  mainWindow = new BrowserWindow({ 
    width: 800, 
    height: 600,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
    },
  });
  mainWindow.loadFile('index.html');
};
app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// create app menu
const openMenuClick = async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({ properties: [ 'openFile' ]});
  if (!canceled) {
    const [ path ] = filePaths;
    const data = await readFile(path);
    const hash = sha1(data).string;
    mainWindow.webContents.send('show-hash', hash);
  }
};
const menuTemplate = [
  (isMac) ? {
    label: app.name,
    submenu: [
      { role: 'quit' }
    ]
  } : null,
  {
    label: '&File',
    submenu: [
      { label: '&Open', click: openMenuClick },
      { type: 'separator' },
      isMac ? { role: 'close' } : { role: 'quit' }
    ]
  },
].filter(Boolean);
const menu = Menu.buildFromTemplate(menuTemplate)
Menu.setApplicationMenu(menu)

