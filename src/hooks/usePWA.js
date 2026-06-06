import { useState, useEffect } from 'react'

export function usePWA() {
  const [installPrompt, setInstallPrompt] = useState(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  )
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    // Detectar iOS
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
    setIsIOS(ios)

    // Detectar si ya está instalada
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setIsInstalled(true)
    }

    // Capturar el prompt de instalación (Android Chrome)
    function handleBeforeInstall(e) {
      e.preventDefault()
      setInstallPrompt(e)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('appinstalled', () => { setIsInstalled(true); setInstallPrompt(null) })

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
    }
  }, [])

  async function promptInstall() {
    if (!installPrompt) return
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') setIsInstalled(true)
    setInstallPrompt(null)
  }

  async function requestNotifPermission() {
    if (typeof Notification === 'undefined') return 'unsupported'
    if (Notification.permission === 'granted') { setNotifPermission('granted'); return 'granted' }
    const result = await Notification.requestPermission()
    setNotifPermission(result)
    return result
  }

  return { installPrompt, isInstalled, isIOS, notifPermission, promptInstall, requestNotifPermission }
}
