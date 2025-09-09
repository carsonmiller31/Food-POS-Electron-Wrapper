const { app, BrowserWindow, ipcMain } = require('electron');

let mainWindow;

function createWindow() {
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

  const APP_URL = process.env.APP_URL || 'http://192.168.1.186:3000';
  mainWindow.loadURL(APP_URL);
  
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

app.on('window-all-closed', () => app.quit());