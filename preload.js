const { contextBridge, ipcRenderer } = require('electron');

// Simple API for printing and admin functions
contextBridge.exposeInMainWorld('electronAPI', {
  print: (text) => ipcRenderer.invoke('print', text),
  openAdminPanel: () => ipcRenderer.invoke('open-admin-panel'),
  validatePassword: (password) => ipcRenderer.invoke('validate-password', password),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  closeAdmin: () => ipcRenderer.invoke('close-admin'),
  // Update functions
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  getUpdateInfo: () => ipcRenderer.invoke('get-update-info'),
  closeUpdate: () => ipcRenderer.invoke('close-update'),
  // Update event listeners
  onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (_, progress) => callback(progress)),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', () => callback())
});

console.log('✅ Simple Electron API ready');