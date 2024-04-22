const { app, dialog, ipcMain, BrowserWindow, Menu } = require('electron');
const { writeFile } = require('fs/promises');
const path = require('path');
const { pathToFileURL } = require('url');
require('node-zigar/cjs');
const { createOutput } = require('../zig/sepia.zig');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = async () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // and load the index.html of the app.
  await mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // load sample image
  mainWindow.webContents.send('load-image', path.resolve(__dirname, '../img/sample.png'));

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();

  const filters = [
    { name: 'Image files', extensions: [ 'gif', 'png', 'jpg', 'jpeg', 'jpe', 'webp' ] },
    { name: 'GIF files', extensions: [ 'gif' ], type: 'image/gif' },
    { name: 'PNG files', extensions: [ 'png' ], type: 'image/png' },
    { name: 'JPEG files', extensions: [ 'jpg', 'jpeg', 'jpe' ], type: 'image/jpeg' },
    { name: 'WebP files', extensions: [ 'webp' ], type: 'image/webp' },
  ];
  const onOpenClick = async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({ filters, properties: [ 'openFile' ] });
    if (!canceled) {
      const [ filePath ] = filePaths;
      const url = pathToFileURL(filePath);
      mainWindow.webContents.send('load-image', url.href);
    }
  };
  const onSaveClick = async () => {
    const { canceled, filePath } = await dialog.showSaveDialog({ filters });
    if (!canceled) {
      const { ext } = path.parse(filePath);
      const filter = filters.find(f => f.type && f.extensions.includes(ext.slice(1).toLowerCase()));
      const type = filter?.type ?? 'image/png';
      mainWindow.webContents.send('save-image', filePath, type);
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
        { label: '&Save', click: onSaveClick },
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
app.whenReady().then(() => {
  ipcMain.handle('write-file', async (_event, path, buf) => writeFile(path, new DataView(buf)));
  ipcMain.handle('filter-image', async (_event, width, height, data, params) => {
    const src = { width, height, data };
    const { dst } = await createOutput(width, height, { src }, params);
    const ta = dst.data.typedArray;
    return new Uint8ClampedArray(ta.buffer, ta.byteOffset, ta.byteLength);
  });

  createWindow();

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
