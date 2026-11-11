const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('stockBridge', {
  platform: 'electron',
  get: (url) => ipcRenderer.invoke('http-get', url),
  version: () => ipcRenderer.invoke('app-version'),
  update: {
    state: () => ipcRenderer.invoke('update-state'),
    check: () => ipcRenderer.invoke('update-check'),
    install: () => ipcRenderer.invoke('update-install'),
    onStatus: (cb) => {
      const f = (_e, s) => cb(s);
      ipcRenderer.on('update-status', f);
      return () => ipcRenderer.removeListener('update-status', f);
    },
  },
});
