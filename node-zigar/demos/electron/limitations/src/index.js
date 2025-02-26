const { app, BrowserWindow } = require('electron');
const path = require('node:path');

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
  mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
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
require('node-zigar/cjs');
const test1 = require('../zig/test1.zig');
console.log(`number = ${test1.number} (JavaScript)`);
console.log('setting variable to 8888 in JavaScript');
test1.number = 8888;
test1.printVariable();
console.log('setting variable to 1999 in Zig');
test1.changeVariable(1999);
test1.printVariable();
console.log(`number = ${test1.number} (JavaScript)`);
console.log(``);

const test2 = require('../zig/test2.zig');
console.log(`array = ${test2.array.typedArray.toString()}`);
console.log('setting array[0] to 8888 in JavaScript');
test2.array[0] = 8888;
test2.printArray();
console.log('setting array[1] to 1999 in Zig');
test2.changeArray(1, 1999);
test2.printArray();
console.log(`array = ${test2.array.typedArray.toString()} (JavaScript)`);
const { typedArray } = test2.array;
console.log('setting array[2] to 777 in Zig');
test2.changeArray(2, 777);
console.log(`array = ${typedArray.toString()} (JavaScript, standalone variable)`);
console.log(`array = ${test2.array.typedArray.toString()} (JavaScript)`);
console.log(`array = ${typedArray.toString()} (JavaScript, standalone variable)`);
test2.array.typedArray[0] = 0;
test2.printArray();
test2.array.typedArray = new Int32Array([ 1, 2, 3, 4 ]);
test2.printArray();
console.log(``);

const test3 = require('../zig/test3.zig');
const array = test3.floatToString(Math.PI);
console.log(array.string);
test3.freeString(array);
