import {app, BrowserWindow, screen} from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';

let win: BrowserWindow | null = null;
const args = process.argv.slice(1),
  serve = args.some(val => val === '--serve');

function startServer() {
  const server = spawn('docker', ['compose', '-f', serve ? 'app/docker-compose.yaml' : '.', 'up']);
  // const server = spawn('ls', ['-al']);
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

function stopServer() {
  const server = spawn('docker', ['compose', '-f', serve ? 'app/docker-compose.yaml' : '.', 'down']);
}

function createWindow(): BrowserWindow {

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
    const debug = require('electron-debug');
    debug();

    require('electron-reloader')(module);
    win.loadURL('http://localhost:4200');
  } else {
    // Path when running electron executable
    let pathIndex = './jasper-ui/index.html';

    if (fs.existsSync(path.join(__dirname, '../dist/jasper-ui/index.html'))) {
      // Path when running electron in local folder
      pathIndex = '../dist/jasper-ui/index.html';
    }

    const url = new URL(path.join('file:', __dirname, pathIndex));
    win.loadURL(url.href);
  }

  // Emitted when the window is closed.
  win.on('closed', () => {
    // Dereference the window object, usually you would store window
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win = null;
  });

  return win;
}

let server: ChildProcessWithoutNullStreams;

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
// Added 400 ms to fix the black background issue while using transparent window. More details at https://github.com/electron/electron/issues/15947
app.on('ready', () => {
  server = startServer();
  setTimeout(createWindow, 400);
});

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    stopServer();
    setTimeout(() => {
      server.kill();
      app.quit();
    }, 10000);
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (win === null) {
    createWindow();
  }
});
