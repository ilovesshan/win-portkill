const { app, BrowserWindow, ipcMain } = require("electron/main");
const path = require("node:path");
const { exec } = require("child_process");

process.env["ELECTRON_DISABLE_SECURITY_WARNINGS"] = "true";

function createWindow () {
  const win = new BrowserWindow({
    width: 1060, height: 640, webPreferences: {
      preload: path.join(__dirname, "preload/preload.js")
    }
  });
  win.loadFile("./pages/index.html");
}

// 获取端口列表信息
function getNetstatData () {
  return new Promise((resolve, reject) => {
    exec("netstat -ano", (err, stdout, stderr) => {
      if (err) {
        console.error(`执行 netstat 命令时出错: ${err}`);
        resolve([]);
      }
      const lines = stdout.trim().split("\n");
      const netstatData = [];
      for (let i = 4; i < lines.length; i++) {
        const parts = lines[i].trim().split(/\s+/);
        if (parts.length >= 5) {
          const [proto, localAddress, remoteAddress, state, pid] = parts;
          netstatData.push({
            proto, localAddress, remoteAddress, state, pid: parseInt(pid, 10)
          });
        }
      }
      resolve(netstatData);
    });
  });
}

// 关闭端口
function closePort (pid) {
  return new Promise((resolve, reject) => {
    exec(`taskkill /f /pid ${pid}`, (err, stdout, stderr) => {
      if (err) {
        resolve(-1);
      } else {
        resolve(1);
      }
    });
  });
}

app.on("ready", () => {
  createWindow();

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  ipcMain.handle("closePorts", (event, payload) => closePort(payload));

  ipcMain.handle("getPorts", (event, payload) => getNetstatData());
});

