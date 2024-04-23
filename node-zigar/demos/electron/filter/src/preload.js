const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  onLoadImage: (callback) => ipcRenderer.on('load-image', (_event, url) => callback(url)),
  onSaveImage: (callback) => ipcRenderer.on('save-image', (_event, path, type) => callback(path, type)),
  writeFile: (path, data) => ipcRenderer.invoke('write-file', path, data),
  filterImage: (width, height, data, params) => ipcRenderer.invoke('filter-image', width, height, data, params),
});
