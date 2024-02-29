const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  onShowHash: (callback) => ipcRenderer.on('show-hash', (_event, value) => callback(value)),
});
