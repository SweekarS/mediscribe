import {
  app,
  BrowserWindow,
  desktopCapturer,
  ipcMain,
  screen,
  session,
  Tray,
  Menu,
  nativeImage,
  globalShortcut,
  systemPreferences,
} from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDev = !app.isPackaged
const assetsPath = isDev
  ? path.join(__dirname, 'assets')
  : path.join(process.resourcesPath, 'assets')

let mainWindow = null
let overlayWindow = null
let tray = null
let overlayVisible = false
let widgetPaused = false
let trayState = 'idle' // idle | live_pending_attention | live
let attentionInterval = null
let unreadBadge = false

const WIDGET_WIDTH = 350
const WIDGET_HEIGHT = 210
const WIDGET_MARGIN = 18

function sendToOverlay(channel, ...args) {
  if (!overlayWindow || overlayWindow.isDestroyed()) return
  overlayWindow.webContents.send(channel, ...args)
}

function applyTrayIcon() {
  if (!tray) return
  if (trayState === 'live_pending_attention') return
  if (trayState === 'live') {
    tray.setImage(getTrayIcon(true))
    return
  }
  tray.setImage(getTrayIcon(unreadBadge))
}

function stopAttentionPulse() {
  if (attentionInterval) {
    clearInterval(attentionInterval)
    attentionInterval = null
  }
  if (trayState === 'live_pending_attention') {
    trayState = 'live'
  }
  applyTrayIcon()
  sendToOverlay('widget:attention-stop')
}

function startAttentionPulse() {
  stopAttentionPulse()
  trayState = 'live_pending_attention'
  sendToOverlay('widget:attention-start')

  let ticks = 0
  let on = false
  attentionInterval = setInterval(() => {
    if (!tray) return
    on = !on
    tray.setImage(getTrayIcon(on))
    ticks += 1
    if (ticks >= 14) {
      // ~5.6s at 400ms pulse interval
      stopAttentionPulse()
      updateTrayMenu()
    }
  }, 400)
}

// -------------------------------------------------------------------------
// Tray
// -------------------------------------------------------------------------

function getTrayIcon(badge = false) {
  const isMac = process.platform === 'darwin'
  const name = badge
    ? (isMac ? 'tray-icon-badgeTemplate.png' : 'tray-icon-badge.png')
    : (isMac ? 'tray-iconTemplate.png' : 'tray-icon.png')
  const primary = nativeImage.createFromPath(path.join(assetsPath, name))
  if (!primary.isEmpty()) return primary

  // Fallback to app icon if tray template asset is unavailable.
  const fallback = nativeImage.createFromPath(path.join(assetsPath, 'icon.png'))
  return fallback.isEmpty() ? nativeImage.createEmpty() : fallback.resize({ width: 18, height: 18 })
}

function updateTrayMenu() {
  if (!tray) return
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Widget',
      enabled: !overlayVisible,
      click: showOverlay,
    },
    {
      label: 'Hide Widget',
      enabled: overlayVisible,
      click: hideOverlay,
    },
    {
      label: 'Toggle Widget',
      click: toggleOverlay,
      accelerator: 'CommandOrControl+Shift+M',
    },
    {
      label: widgetPaused ? 'Resume Capture' : 'Pause Capture',
      click: () => {
        widgetPaused = !widgetPaused
        sendToOverlay(widgetPaused ? 'widget:pause' : 'widget:resume')
        updateTrayMenu()
      },
    },
    { type: 'separator' },
    {
      label: 'Open Dashboard',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        }
      },
    },
    { type: 'separator' },
    { label: 'Quit MediScribe', click: () => app.quit() },
  ])
  tray.setContextMenu(contextMenu)
}

function createTray() {
  tray = new Tray(getTrayIcon())
  tray.setToolTip('MediScribe')
  applyTrayIcon()
  updateTrayMenu()
  tray.on('click', toggleOverlay)
}

// -------------------------------------------------------------------------
// Overlay visibility
// -------------------------------------------------------------------------

function toggleOverlay() {
  if (!overlayWindow) return
  overlayVisible = !overlayVisible
  overlayVisible ? overlayWindow.show() : overlayWindow.hide()
  overlayWindow.webContents.send('overlay:visibility-changed', overlayVisible)
  updateTrayMenu()
}

function showOverlay() {
  if (!overlayWindow || overlayVisible) return
  overlayVisible = true
  overlayWindow.show()
  overlayWindow.webContents.send('overlay:visibility-changed', true)
  updateTrayMenu()
}

function hideOverlay() {
  if (!overlayWindow || !overlayVisible) return
  overlayVisible = false
  overlayWindow.hide()
  overlayWindow.webContents.send('overlay:visibility-changed', false)
  updateTrayMenu()
}

// -------------------------------------------------------------------------
// Windows
// -------------------------------------------------------------------------

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

function createOverlayWindow() {
  const { width: screenW } = screen.getPrimaryDisplay().workAreaSize

  overlayWindow = new BrowserWindow({
    width: WIDGET_WIDTH,
    height: WIDGET_HEIGHT,
    x: screenW - WIDGET_WIDTH - WIDGET_MARGIN,
    y: WIDGET_MARGIN,
    show: false,
    frame: process.platform === 'darwin',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : undefined,
    trafficLightPosition: process.platform === 'darwin' ? { x: 12, y: 12 } : undefined,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: true,
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  overlayWindow.setContentProtection(true)
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  if (isDev) {
    overlayWindow.loadURL('http://localhost:5173/overlay.html')
  } else {
    overlayWindow.loadFile(path.join(__dirname, '..', 'dist', 'overlay.html'))
  }

  overlayWindow.once('ready-to-show', () => {
    overlayWindow.show()
    overlayVisible = true
    updateTrayMenu()
  })
}

// -------------------------------------------------------------------------
// System audio capture — auto-grant getDisplayMedia with loopback audio.
// This is the key to Cluely-style call listening: we capture whatever
// audio is playing through the system (Zoom, Meet, FaceTime, etc.) and
// route it to our WebSocket as the doctor's voice.
// -------------------------------------------------------------------------

function setupDisplayMediaHandler() {
  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
      if (sources.length > 0) {
        callback({ video: sources[0], audio: 'loopback' })
      } else {
        callback(null)
      }
    }).catch(() => callback(null))
  })
}

// -------------------------------------------------------------------------
// macOS permissions
// -------------------------------------------------------------------------

function checkPermissions() {
  if (process.platform !== 'darwin') return

  const micStatus = systemPreferences.getMediaAccessStatus('microphone')
  if (micStatus !== 'granted') {
    systemPreferences.askForMediaAccess('microphone')
  }

  const screenStatus = systemPreferences.getMediaAccessStatus('screen')
  if (screenStatus !== 'granted') {
    // Screen capture permission can't be requested programmatically on macOS,
    // but the OS will prompt when getDisplayMedia is called.
    console.log('[MediScribe] Screen recording permission not yet granted — OS will prompt on first capture.')
  }
}

// -------------------------------------------------------------------------
// Boot
// -------------------------------------------------------------------------

app.whenReady().then(() => {
  setupDisplayMediaHandler()
  checkPermissions()

  createTray()
  createMainWindow()
  createOverlayWindow()

  globalShortcut.register('CommandOrControl+Shift+M', toggleOverlay)

  // --- Overlay lifecycle IPC ---

  ipcMain.on('overlay:toggle', (_event, show) => {
    if (show) showOverlay()
    else hideOverlay()
  })

  ipcMain.on('widget:pause', () => {
    widgetPaused = true
    sendToOverlay('widget:pause')
    updateTrayMenu()
  })

  ipcMain.on('widget:resume', () => {
    widgetPaused = false
    sendToOverlay('widget:resume')
    updateTrayMenu()
  })

  ipcMain.on('overlay:resize', (_event, { width, height }) => {
    if (!overlayWindow) return
    overlayWindow.setSize(width, height)
  })

  ipcMain.on('overlay:set-opacity', (_event, opacity) => {
    if (!overlayWindow) return
    overlayWindow.setOpacity(Math.max(0.2, Math.min(1, opacity)))
  })

  // --- Session lifecycle IPC (broadcast between main ↔ overlay windows) ---

  ipcMain.on('session:start', () => {
    trayState = 'live'
    startAttentionPulse()
    overlayWindow?.webContents.send('session:started')
    mainWindow?.webContents.send('session:started')
    showOverlay()
  })

  ipcMain.on('session:end', () => {
    trayState = 'idle'
    stopAttentionPulse()
    overlayWindow?.webContents.send('session:ended')
    mainWindow?.webContents.send('session:ended')
    hideOverlay()
    applyTrayIcon()
    updateTrayMenu()
  })

  // --- Tray badge IPC ---

  ipcMain.on('tray:set-badge', (_event, hasBadge) => {
    unreadBadge = hasBadge
    applyTrayIcon()
  })

  // --- Permission status check ---

  ipcMain.handle('permissions:check', () => {
    if (process.platform !== 'darwin') {
      return { microphone: 'granted', screen: 'granted' }
    }
    return {
      microphone: systemPreferences.getMediaAccessStatus('microphone'),
      screen: systemPreferences.getMediaAccessStatus('screen'),
    }
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow()
    createOverlayWindow()
  }
})
