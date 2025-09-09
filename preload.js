const { contextBridge, ipcRenderer } = require('electron');

// Simple API for printing
contextBridge.exposeInMainWorld('electronAPI', {
  print: (text) => ipcRenderer.invoke('print', text)
});

console.log('✅ Simple Electron API ready');