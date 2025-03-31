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
function getNetstatData (portValue) {
  return new Promise((resolve) => {
    const command = `netstat -ano ${portValue ? `| findstr \"${portValue}\"` : ""}`;

    exec(command, async (err, stdout) => {
      if (err) {
        console.error(`执行 netstat 命令时出错: ${err}`);
        resolve([]);
        return;
      }

      const lines = stdout.trim().split("\n");
      const netstatData = [];
      const pidSet = new Set();

      for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith("Active") || line.startsWith("Proto")) {
          continue;
        }

        const parts = line.split(/\s+/);
        if (parts.length >= 5) {
          const proto = parts[0];
          const localAddress = parts[1];
          const remoteAddress = parts[2];
          const state = parts[3];
          const pid = parseInt(parts[parts.length - 1], 10);

          netstatData.push({
            proto, localAddress, remoteAddress, state, pid, processName: "Unknown"
          });

          pidSet.add(pid);
        }
      }

      // 获取所有进程名称
      const processMap = await getProcessNames(Array.from(pidSet));

      // 更新 netstatData 中的 processName
      netstatData.forEach((item) => {
        item.processName = processMap[item.pid] || "Unknown";
      });

      resolve(netstatData);
    });
  });
}

// 获取进程名称（逐个查询）
function getProcessNames(pids) {
  return new Promise(async (resolve) => {
    if (pids.length === 0) {
      resolve({});
      return;
    }

    const processMap = {};
    const promises = pids.map((pid) => {
      return new Promise((res) => {
        const command = `tasklist /FI "PID eq ${pid}" /FO CSV /NH`;
        exec(command, (err, stdout) => {
          if (!err && stdout.trim()) {
            const lines = stdout.trim().split("\n");
            for (let line of lines) {
              line = line.replace(/"/g, "").trim(); // 去除引号
              const parts = line.split(",");
              if (parts.length >= 2) {
                processMap[parseInt(parts[1], 10)] = parts[0];
              }
            }
          }
          res();
        });
      });
    });

    await Promise.all(promises);
    resolve(processMap);
  });
}

// 使用 Promise 封装 exec 以支持 async/await
function execCommand (command) {
  return new Promise((resolve, reject) => {
    exec(command, (err, stdout, stderr) => {
      if (err) {
        reject(err);
      } else {
        resolve(stdout);
      }
    });
  });
}

// 关闭端口
function closePort (pid) {
  return new Promise((resolve) => {
    exec(`taskkill /f /pid ${pid}`, (err) => {
      resolve(err ? -1 : 1);
    });
  });
}

app.on("ready", () => {
  createWindow();

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  ipcMain.handle("closePorts", (event, payload) => closePort(payload));
  ipcMain.handle("getPorts", (event, payload) => getNetstatData(payload));
});
