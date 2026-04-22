import { useEffect } from 'react'

export function useIdleTimer(onIdle, idleTime = 30000) {
  useEffect(() => {
    let timeoutId

    const resetTimer = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(onIdle, idleTime)
    }

    const events = ['mousedown', 'touchstart', 'keydown']

    events.forEach((event) => document.addEventListener(event, resetTimer))

    resetTimer()

    return () => {
      clearTimeout(timeoutId)
      events.forEach((event) => document.removeEventListener(event, resetTimer))
    }
  }, [onIdle, idleTime])
}
