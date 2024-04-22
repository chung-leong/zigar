const { app, dialog, BrowserWindow, Menu } = require('electron');
const path = require('path');
require('node-zigar/cjs');
const { sha1 } = require('../lib/sha1.zigar');
const { readFile } = require('fs/promises');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();

  const onOpenClick = async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({ properties: [ 'openFile' ]});
    if (!canceled) {
      const [ path ] = filePaths;
      const data = await readFile(path);
      const hash = sha1(data).string;
      mainWindow.webContents.send('show-hash', hash);
    }
  };
  const isMac = process.platform === 'darwin'
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
        { label: '&Open', click: onOpenClick },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
  ].filter(Boolean);
  const menu = Menu.buildFromTemplate(menuTemplate)
  Menu.setApplicationMenu(menu);
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
