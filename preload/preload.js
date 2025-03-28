const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronApi", {
  closePorts: (payload) => ipcRenderer.invoke("closePorts", payload),
  getPorts: (payload) => ipcRenderer.invoke("getPorts", payload)
});
