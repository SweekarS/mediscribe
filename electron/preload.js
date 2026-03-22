const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // --- Overlay ---
  toggleOverlay: (show) => ipcRenderer.send('overlay:toggle', show),
  resizeOverlay: (width, height) => ipcRenderer.send('overlay:resize', { width, height }),
  setOverlayOpacity: (opacity) => ipcRenderer.send('overlay:set-opacity', opacity),
  pauseWidget: () => ipcRenderer.send('widget:pause'),
  resumeWidget: () => ipcRenderer.send('widget:resume'),

  onOverlayVisibilityChanged: (callback) => {
    const handler = (_event, visible) => callback(visible)
    ipcRenderer.on('overlay:visibility-changed', handler)
    return () => ipcRenderer.removeListener('overlay:visibility-changed', handler)
  },
  onWidgetPause: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('widget:pause', handler)
    return () => ipcRenderer.removeListener('widget:pause', handler)
  },
  onWidgetResume: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('widget:resume', handler)
    return () => ipcRenderer.removeListener('widget:resume', handler)
  },
  onWidgetAttentionStart: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('widget:attention-start', handler)
    return () => ipcRenderer.removeListener('widget:attention-start', handler)
  },
  onWidgetAttentionStop: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('widget:attention-stop', handler)
    return () => ipcRenderer.removeListener('widget:attention-stop', handler)
  },

  // --- Session lifecycle ---
  startSession: () => ipcRenderer.send('session:start'),
  endSession: () => ipcRenderer.send('session:end'),

  onSessionStarted: (callback) => {
    ipcRenderer.on('session:started', callback)
    return () => ipcRenderer.removeListener('session:started', callback)
  },
  onSessionEnded: (callback) => {
    ipcRenderer.on('session:ended', callback)
    return () => ipcRenderer.removeListener('session:ended', callback)
  },

  // --- Tray badge ---
  setTrayBadge: (hasBadge) => ipcRenderer.send('tray:set-badge', hasBadge),

  // --- Permissions ---
  checkPermissions: () => ipcRenderer.invoke('permissions:check'),

  // --- Platform info ---
  isElectron: true,
})
