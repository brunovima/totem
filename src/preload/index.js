import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  // Quizzes
  getQuizzes: () => ipcRenderer.invoke('get-quizzes'),
  createQuiz: (title) => ipcRenderer.invoke('create-quiz', title),
  toggleQuiz: (data) => ipcRenderer.invoke('toggle-quiz', data),
  deleteQuiz: (id) => ipcRenderer.invoke('delete-quiz', id),

  // Perguntas
  getQuestions: (id) => ipcRenderer.invoke('get-questions', id),
  saveQuestion: (q) => ipcRenderer.invoke('save-question', q),
  deleteQuestion: (id) => ipcRenderer.invoke('delete-question', id),

  // Leads
  getLeads: () => ipcRenderer.invoke('get-leads'),
  saveLead: (lead) => ipcRenderer.invoke('save-lead', lead),
  deleteLeads: (ids) => ipcRenderer.invoke('delete-leads', ids),

  // Settings
  getSetting: (key) => ipcRenderer.invoke('get-setting', key),
  setSetting: (key, value) => ipcRenderer.invoke('set-setting', key, value),

  // Mídia — upload unificado (abre diálogo + copia + retorna filename)
  uploadMedia: (data) => ipcRenderer.invoke('upload-media', data),
  pickLogoFile: () => ipcRenderer.invoke('pick-logo-file'),

  // Mídia — CRUD
  getMedia: () => ipcRenderer.invoke('get-media'),
  saveMedia: (data) => ipcRenderer.invoke('save-media', data),
  deleteMedia: (id) => ipcRenderer.invoke('delete-media', id),

  // Mídia — playlist
  getPlaylist: () => ipcRenderer.invoke('get-playlist'),
  togglePlaylist: (id) => ipcRenderer.invoke('toggle-playlist', id),
  movePlaylistItem: (data) => ipcRenderer.invoke('move-playlist-item', data),
  setMediaDuration: (data) => ipcRenderer.invoke('set-media-duration', data),
  setMediaSchedule: (data) => ipcRenderer.invoke('set-media-schedule', data),

  // Wi-Fi
  wifiScan: () => ipcRenderer.invoke('wifi-scan'),
  wifiConnect: (data) => ipcRenderer.invoke('wifi-connect', data),
  wifiStatus: () => ipcRenderer.invoke('wifi-status'),

  // Hardware / Energia
  displaySleep: () => ipcRenderer.invoke('display-sleep'),
  getApiInfo: () => ipcRenderer.invoke('get-api-info'),

  // yt-dlp
  startYoutubeDownload: (data) => ipcRenderer.invoke('start-ytdlp-download', data),
  processYouTube: (url) => ipcRenderer.invoke('process-youtube', url),

  // Diagnóstico
  debugMedia: () => ipcRenderer.invoke('debug-media'),
  checkFileExists: (filename) => ipcRenderer.invoke('check-file-exists', filename),

  // Eventos main → renderer
  onScreenBlackout: (cb) => {
    ipcRenderer.on('screen:blackout', (_, state) => cb(state))
    return () => ipcRenderer.removeAllListeners('screen:blackout')
  },
  onDownloadProgress: (cb) => {
    ipcRenderer.on('download:progress', (_, data) => cb(data))
    return () => ipcRenderer.removeAllListeners('download:progress')
  }
})
