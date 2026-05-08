import { app, BrowserWindow, shell } from 'electron';
import { SERVER_URL } from './config';

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'LiveStudio',
    // Match the app's dark background so there's no white flash on load.
    backgroundColor: '#08080f',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Remove the default menu bar (not needed for this app).
  win.setMenuBarVisibility(false);

  win.loadURL(SERVER_URL).catch(() => {
    void win.loadURL(
      `data:text/html,<!DOCTYPE html><html><body style="margin:0;background:%2308080f;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:%23f0f0f8"><div style="text-align:center"><h2>Could not connect to LiveStudio</h2><p style="color:%238b8ba8;margin-top:8px">${SERVER_URL}</p><p style="color:%2350506e;margin-top:4px;font-size:13px">Make sure the server is running and try relaunching.</p></div></body></html>`
    );
  });

  // Open external links (e.g. the BlackHole download link in the DAW guide)
  // in the system browser, not inside Electron.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(SERVER_URL)) {
      void shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  return win;
}

app.whenReady().then(() => {
  createWindow();

  // macOS: re-create the window when the dock icon is clicked and no windows
  // are open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit on all windows closed (except macOS, where apps stay active).
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
