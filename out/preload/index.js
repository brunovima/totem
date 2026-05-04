"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("api", {
  // Quizzes
  getQuizzes: () => electron.ipcRenderer.invoke("get-quizzes"),
  createQuiz: (title) => electron.ipcRenderer.invoke("create-quiz", title),
  toggleQuiz: (data) => electron.ipcRenderer.invoke("toggle-quiz", data),
  deleteQuiz: (id) => electron.ipcRenderer.invoke("delete-quiz", id),
  // Perguntas
  getQuestions: (id) => electron.ipcRenderer.invoke("get-questions", id),
  saveQuestion: (q) => electron.ipcRenderer.invoke("save-question", q),
  deleteQuestion: (id) => electron.ipcRenderer.invoke("delete-question", id),
  // Leads
  getLeads: () => electron.ipcRenderer.invoke("get-leads"),
  saveLead: (lead) => electron.ipcRenderer.invoke("save-lead", lead),
  deleteLeads: (ids) => electron.ipcRenderer.invoke("delete-leads", ids),
  // Settings
  getSetting: (key) => electron.ipcRenderer.invoke("get-setting", key),
  setSetting: (key, value) => electron.ipcRenderer.invoke("set-setting", key, value),
  // Mídia — upload unificado (abre diálogo + copia + retorna filename)
  uploadMedia: (data) => electron.ipcRenderer.invoke("upload-media", data),
  pickLogoFile: () => electron.ipcRenderer.invoke("pick-logo-file"),
  // Mídia — CRUD
  getMedia: () => electron.ipcRenderer.invoke("get-media"),
  saveMedia: (data) => electron.ipcRenderer.invoke("save-media", data),
  deleteMedia: (id) => electron.ipcRenderer.invoke("delete-media", id),
  // Mídia — playlist
  getPlaylist: () => electron.ipcRenderer.invoke("get-playlist"),
  togglePlaylist: (id) => electron.ipcRenderer.invoke("toggle-playlist", id),
  movePlaylistItem: (data) => electron.ipcRenderer.invoke("move-playlist-item", data),
  setMediaDuration: (data) => electron.ipcRenderer.invoke("set-media-duration", data),
  setMediaSchedule: (data) => electron.ipcRenderer.invoke("set-media-schedule", data),
  // Jogo da Memória — Admin
  getJogos: () => electron.ipcRenderer.invoke("get-jogos"),
  createJogo: (nome) => electron.ipcRenderer.invoke("create-jogo", nome),
  toggleJogo: (data) => electron.ipcRenderer.invoke("toggle-jogo", data),
  deleteJogo: (id) => electron.ipcRenderer.invoke("delete-jogo", id),
  getImagensJogo: (jogoId) => electron.ipcRenderer.invoke("get-imagens-jogo", jogoId),
  uploadImagensMemoria: (data) => electron.ipcRenderer.invoke("upload-imagens-memoria", data),
  deleteImagemMemoria: (id) => electron.ipcRenderer.invoke("delete-imagem-memoria", id),
  // Jogo da Memória — Cliente
  getJogoAtivo: () => electron.ipcRenderer.invoke("get-jogo-ativo"),
  // Wi-Fi
  wifiScan: () => electron.ipcRenderer.invoke("wifi-scan"),
  wifiConnect: (data) => electron.ipcRenderer.invoke("wifi-connect", data),
  wifiStatus: () => electron.ipcRenderer.invoke("wifi-status"),
  // Hardware / Energia
  displaySleep: () => electron.ipcRenderer.invoke("display-sleep"),
  getApiInfo: () => electron.ipcRenderer.invoke("get-api-info"),
  exitKiosk: () => electron.ipcRenderer.invoke("exit-kiosk"),
  enterKiosk: () => electron.ipcRenderer.invoke("enter-kiosk"),
  getKioskState: () => electron.ipcRenderer.invoke("get-kiosk-state"),
  openExternal: (url) => electron.ipcRenderer.invoke("open-external", url),
  // yt-dlp
  startYoutubeDownload: (data) => electron.ipcRenderer.invoke("start-ytdlp-download", data),
  processYouTube: (url) => electron.ipcRenderer.invoke("process-youtube", url),
  processSocial: (url) => electron.ipcRenderer.invoke("process-social", url),
  // Diagnóstico
  debugMedia: () => electron.ipcRenderer.invoke("debug-media"),
  checkFileExists: (filename) => electron.ipcRenderer.invoke("check-file-exists", filename),
  // Eventos main → renderer
  onScreenBlackout: (cb) => {
    electron.ipcRenderer.on("screen:blackout", (_, state) => cb(state));
    return () => electron.ipcRenderer.removeAllListeners("screen:blackout");
  },
  onDownloadProgress: (cb) => {
    electron.ipcRenderer.on("download:progress", (_, data) => cb(data));
    return () => electron.ipcRenderer.removeAllListeners("download:progress");
  }
});
