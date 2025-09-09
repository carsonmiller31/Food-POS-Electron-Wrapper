const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const { autoUpdater } = require('electron-updater');
const SettingsManager = require('./settings');

let mainWindow;
let adminWindow;
let updateWindow;
let settings;
let pendingUpdateInfo;
let isQuitting = false;
let updateReadyToInstall = false;

function createWindow() {
  settings = new SettingsManager();
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    fullscreen: true,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: require('path').join(__dirname, 'preload.js')
    }
  });

  const APP_URL = process.env.APP_URL || settings.get('appUrl');
  mainWindow.loadURL(APP_URL);
  
  // Handle window close event
  mainWindow.on('close', (event) => {
    if (!isQuitting && updateReadyToInstall) {
      event.preventDefault();
      gracefulShutdown();
    }
  });
  
  registerAdminShortcut();
  setupAutoUpdater();
}

function setupAutoUpdater() {
  // Configure auto-updater
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  
  // Check for updates on startup (after 3 seconds)
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 3000);
  
  // Auto-updater events
  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for update...');
  });
  
  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info.version);
    pendingUpdateInfo = info;
    showUpdateWindow();
  });
  
  autoUpdater.on('update-not-available', () => {
    console.log('Update not available');
  });
  
  autoUpdater.on('error', (err) => {
    console.log('Auto-updater error:', err);
  });
  
  autoUpdater.on('download-progress', (progressObj) => {
    console.log(`Download progress: ${progressObj.percent}%`);
    if (updateWindow) {
      updateWindow.webContents.send('download-progress', progressObj);
    }
  });
  
  autoUpdater.on('update-downloaded', () => {
    console.log('Update downloaded');
    updateReadyToInstall = true;
    if (updateWindow) {
      updateWindow.webContents.send('update-downloaded');
    }
  });
}

function gracefulShutdown() {
  console.log('Starting graceful shutdown...');
  isQuitting = true;
  
  // Close all child windows first
  if (adminWindow) {
    adminWindow.close();
  }
  if (updateWindow) {
    updateWindow.close();
  }
  
  // Save any pending data (if needed)
  if (settings) {
    settings.save();
  }
  
  // Force quit handler as backup
  const forceQuitTimer = setTimeout(() => {
    console.log('Force quitting application for update...');
    app.exit(0);
  }, 5000);
  
  // Wait a moment for cleanup, then quit and install
  setTimeout(() => {
    clearTimeout(forceQuitTimer);
    console.log('Performing graceful shutdown and installing update...');
    autoUpdater.quitAndInstall(false, true);
  }, 500);
}

function forceKillProcess() {
  console.log('Force killing any remaining application processes...');
  const { exec } = require('child_process');
  const appName = 'Movie Mill POS Kiosk';
  
  // Windows
  if (process.platform === 'win32') {
    exec(`taskkill /f /im "${appName}.exe"`, (error) => {
      if (error) console.log('Process kill command completed');
    });
  }
  // macOS
  else if (process.platform === 'darwin') {
    exec(`pkill -f "${appName}"`, (error) => {
      if (error) console.log('Process kill command completed');
    });
  }
  // Linux
  else {
    exec(`pkill -f "${appName}"`, (error) => {
      if (error) console.log('Process kill command completed');
    });
  }
}

function registerAdminShortcut() {
  globalShortcut.register('CommandOrControl+Shift+Alt+A', () => {
    if (adminWindow) {
      adminWindow.focus();
      return;
    }
    
    adminWindow = new BrowserWindow({
      width: 600,
      height: 500,
      modal: true,
      parent: mainWindow,
      autoHideMenuBar: true,
      resizable: false,
      alwaysOnTop: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: require('path').join(__dirname, 'preload.js')
      }
    });

    adminWindow.loadFile('admin-panel.html');
    
    adminWindow.on('closed', () => {
      adminWindow = null;
    });
  });
}

function showUpdateWindow() {
  if (updateWindow) {
    updateWindow.focus();
    return;
  }
  
  updateWindow = new BrowserWindow({
    width: 500,
    height: 400,
    modal: true,
    parent: mainWindow,
    autoHideMenuBar: true,
    resizable: false,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: require('path').join(__dirname, 'preload.js')
    }
  });

  updateWindow.loadFile('update-notification.html');
  
  updateWindow.on('closed', () => {
    updateWindow = null;
  });
}

app.whenReady().then(createWindow);

// SIMPLE PRINT HANDLER
ipcMain.handle('print', async (event, htmlContent) => {
  console.log('PRINT REQUEST received');
  
  try {
    // Create simple print window
    const printWin = new BrowserWindow({ 
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });
    
    // Create proper HTML with styling for printing
    const printHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { 
            font-family: 'Courier New', monospace; 
            font-size: 12px; 
            margin: 10px; 
            padding: 0;
          }
          @media print {
            body { margin: 0; }
          }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
      </html>
    `;
    
    // Load the HTML content
    await printWin.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(printHTML)}`);
    
    // Wait for content to load
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Print to default printer, silent
    return new Promise((resolve, reject) => {
      printWin.webContents.print({ silent: true }, (success, errorType) => {
        printWin.close();
        if (success) {
          console.log('✅ PRINT SUCCESS');
          resolve(true);
        } else {
          console.log('❌ PRINT FAILED:', errorType);
          reject(new Error(errorType || 'Print failed'));
        }
      });
    });
  } catch (error) {
    console.log('❌ PRINT ERROR:', error);
    throw error;
  }
});

// ADMIN HANDLERS
ipcMain.handle('validate-password', async (_, password) => {
  if (settings.validatePassword(password)) {
    return {
      valid: true,
      settings: {
        appUrl: settings.get('appUrl')
      }
    };
  }
  return { valid: false };
});

ipcMain.handle('save-settings', async (_, newSettings) => {
  return settings.updateSettings(newSettings);
});

ipcMain.handle('close-admin', async () => {
  if (adminWindow) {
    adminWindow.close();
  }
});

// AUTO-UPDATER HANDLERS
ipcMain.handle('download-update', async () => {
  try {
    await autoUpdater.downloadUpdate();
    return true;
  } catch (error) {
    console.log('Download update error:', error);
    return false;
  }
});

ipcMain.handle('install-update', async () => {
  if (updateReadyToInstall) {
    gracefulShutdown();
  } else {
    console.log('Update not ready to install');
    return false;
  }
});

ipcMain.handle('check-for-updates', async () => {
  try {
    const result = await autoUpdater.checkForUpdates();
    return result ? true : false;
  } catch (error) {
    console.log('Check for updates error:', error);
    return false;
  }
});

ipcMain.handle('get-update-info', async () => {
  return pendingUpdateInfo;
});

ipcMain.handle('close-update', async () => {
  if (updateWindow) {
    updateWindow.close();
  }
});

ipcMain.handle('force-kill-app', async () => {
  console.log('Force kill requested via IPC');
  forceKillProcess();
  setTimeout(() => app.exit(0), 1000);
});

// Open admin panel from web POS
ipcMain.handle('open-admin-panel', async () => {
  if (adminWindow) {
    adminWindow.focus();
    return;
  }
  
  adminWindow = new BrowserWindow({
    width: 600,
    height: 500,
    modal: true,
    parent: mainWindow,
    autoHideMenuBar: true,
    resizable: false,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: require('path').join(__dirname, 'preload.js')
    }
  });

  adminWindow.loadFile('admin-panel.html');
  
  adminWindow.on('closed', () => {
    adminWindow = null;
  });
});

app.on('window-all-closed', () => {
  if (!isQuitting) {
    app.quit();
  }
});

app.on('before-quit', (event) => {
  if (updateReadyToInstall && !isQuitting) {
    event.preventDefault();
    gracefulShutdown();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// Handle app activation (macOS)
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});