const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('postcardPrinter',{
  list:()=>ipcRenderer.invoke('postcard-print:list'),
  print:job=>ipcRenderer.invoke('postcard-print:start',job)
});
// Only this fixed address book is exposed; renderer code cannot choose a path.
contextBridge.exposeInMainWorld('addressBookStorage', {
  load: (legacyText, legacyUnavailable) => ipcRenderer.sendSync('address-book:load', {legacyText, legacyUnavailable}),
  save: state => ipcRenderer.sendSync('address-book:save', state),
  restore: state => ipcRenderer.sendSync('address-book:restore', state),
  openFolder: () => ipcRenderer.invoke('address-book:open-folder')
});
contextBridge.exposeInMainWorld('postcardDesigns', {
  list: () => ipcRenderer.sendSync('nenga-design:list'),
  loadProject: () => ipcRenderer.sendSync('nenga-design:load-project'),
  saveProject: project => ipcRenderer.sendSync('nenga-design:save-project',project),
  saveImage: (dataUrl,designId) => ipcRenderer.sendSync('nenga-design:save-image',{dataUrl,designId}),
  openFolder: () => ipcRenderer.invoke('nenga-design:open-folder')
});
