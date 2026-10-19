const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  toggleFullscreen: () => ipcRenderer.send('toggle-fullscreen'),
});
