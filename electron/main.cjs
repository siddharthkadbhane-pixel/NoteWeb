const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

// Disable only the GPU sandbox and system sandbox to fix STATUS_BREAKPOINT crashes while keeping FULL GPU Hardware Acceleration speed!
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('no-sandbox');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "NoteWeb Campus Portal",
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  // Load the live GitHub Pages version in production for instant auto-updates on Git push,
  // falling back to local static files if offline. In development, load local dist files.
  const liveUrl = 'https://siddharthkadbhane-pixel.github.io/NoteWeb/';
  
  if (app.isPackaged) {
    win.loadURL(liveUrl).catch(() => {
      win.loadFile(path.join(__dirname, '../dist/index.html'));
    });
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Open external links (e.g. Supabase auth, PDF downloads) in the user's default browser
  win.webContents.on('will-navigate', (event, url) => {
    if (app.isPackaged && !url.startsWith(liveUrl) && !url.startsWith('file://')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(liveUrl) && !url.startsWith('file://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
