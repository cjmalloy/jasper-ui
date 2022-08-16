import { ChildProcessWithoutNullStreams, exec, spawn } from 'child_process';
import { app, BrowserWindow, Menu, nativeImage, screen, Tray } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

const args = process.argv.slice(1),
  serve = args.some(val => val === '--serve');

function getEntry() {
  if (fs.existsSync(path.join(__dirname, '../dist'))) {
    return path.join(__dirname, '../dist/jasper-ui/index.html');
  }
  return path.join(__dirname, 'jasper-ui/index.html');
}
const serverConfig = path.join(__dirname, 'docker-compose.yaml');

function startServer() {
  const server = spawn('docker', ['compose', '-f', serverConfig, 'up']);
  server.stdout.on('data', (data: string) => {
    console.log(`${data}`);
  });
  server.stderr.on('data', (data: string) => {
    console.log(`${data}`);
  });
  server.on('close', (code: any) => {
    console.log(`child process exited with code ${code}`);
  });
  return server;
}

function shutdown() {
  if (win) {
    win.close()
    win = null;
  }
  if (tray) {
    tray.setContextMenu(Menu.buildFromTemplate([{ label: 'Shutting down...' }]));
  }
  exec('docker compose -f app/docker-compose.yaml down', () => app.quit());
}

function createWindow() {
  if (win) {
    win.show();
    return;
  }

  const size = screen.getPrimaryDisplay().workAreaSize;

  // Create the browser window.
  win = new BrowserWindow({
    x: 0,
    y: 0,
    width: size.width,
    height: size.height,
    webPreferences: {
      nodeIntegration: true,
      allowRunningInsecureContent: (serve),
      contextIsolation: false,  // false if you want to run e2e test with Spectron
    },
  });

  if (serve) {
    require('electron-debug')();
    require('electron-reloader')(module);
    win.loadURL('http://localhost:4200');
  } else {
    win.loadFile(getEntry());
  }

  win.on('closed', () => {
    win = null;
  });
}

function createTray() {
  const icon = path.join(__dirname, serve ? 'app.png' : 'app.png');
  const trayIcon = nativeImage.createFromPath(icon);
  const tray = new Tray(trayIcon.resize({width: 16}));
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show Window', click: createWindow },
    { label: 'Quit', click: shutdown },
  ]);
  tray.setTitle('Jasper');
  tray.setToolTip('Jasper');
  tray.setContextMenu(contextMenu);
  return tray;
}

let tray: Tray | null;
let win: BrowserWindow | null;
let server: ChildProcessWithoutNullStreams;

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
// Added 400 ms to fix the black background issue while using transparent window. More details at https://github.com/electron/electron/issues/15947
app.on('ready', () => {
  tray = createTray();
  server = startServer();
  setTimeout(createWindow, 400);
});

app.on('window-all-closed', () => {
  if (process.platform === 'darwin') {
    app.dock.hide();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (win === null) {
    createWindow();
  }
});
