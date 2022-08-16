import { ChildProcessWithoutNullStreams, exec, spawn } from 'child_process';
import { app, BrowserWindow, Menu, nativeImage, screen, Tray } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

const serve = process.argv.some(val => val === '--serve');

function getEntry() {
  if (fs.existsSync(path.join(__dirname, '../dist'))) {
    return path.join(__dirname, '../dist/jasper-ui/index.html');
  }
  return path.join(__dirname, 'jasper-ui/index.html');
}
const serverConfig = path.join(__dirname, 'docker-compose.yaml');
const initPath = path.join(app.getPath('userData'), 'init.json');

let data: any = {};
try {
  data = JSON.parse(fs.readFileSync(initPath, 'utf8'));
}
catch(e) { }
function writeData() {
  fs.writeFileSync(initPath, JSON.stringify(data));
}

function startServer() {
  process.env.JASPER_DATABASE_PASSWORD = 'jasper';
  process.env.JASPER_DATA_DIR = path.join(app.getPath('userData'), 'data');
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
  writeData();
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
  const bounds = data && data.bounds ? data.bounds : {
    width: size.width * 0.8,
    height: size.height * 0.8,
  };

  // Create the browser window.
  win = new BrowserWindow({
    ...bounds,

    webPreferences: {
      allowRunningInsecureContent: serve,
      contextIsolation: !serve,
    },
  });

  if (data.maximized) {
    win.maximize();
  }

  if (serve) {
    require('electron-debug')();
    require('electron-reloader')(module);
    win.loadURL('http://localhost:4200');
  } else {
    win.loadFile(getEntry());
  }

  win.on('resize', () => {
    if (!win) return;
    if (data.maximized) return;
    data.bounds = {
      ...data.bounds,
      ...win.getBounds(),
    };
  });

  win.on('move', () => {
    if (!win) return;
    if (data.maximized) return;
    data.bounds = {
      ...data.bounds,
      ...win.getPosition(),
    };
  });

  win.on('maximize', () => {
    if (!win) return;
    data.maximized = true;
  });

  win.on('unmaximize', () => {
    if (!win) return;
    data.maximized = false;
  });

  win.on('closed', () => {
    if (!win) return;
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
