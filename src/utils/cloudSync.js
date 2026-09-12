import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from 'src/lib/supabase'
import { useAuth } from 'src/context/AuthContext'

function lsGet(key, def) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def } catch { return def } }
function lsSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)) } catch {} }

// Estado que vive en localStorage (rápido, funciona offline) y también en
// Supabase (fuente de verdad, sincroniza entre dispositivos). Se usa igual
// que useState: [value, setValue] — setValue acepta un valor o un updater.
//
// Al montar: si Supabase ya tiene datos para esta key los usa (y actualiza
// el caché local); si no, sube lo que había en local (migra datos viejos
// que solo existían en este dispositivo). Además escucha cambios en tiempo
// real vía Supabase Realtime, así que si editás algo en el celular se
// refleja solo en la compu sin recargar.
export function useSyncedState(key, defaultValue) {
  const { user } = useAuth()
  const [value, setValueState] = useState(() => lsGet(key, defaultValue))
  const skipNextRealtime = useRef(false)
  // Si el usuario edita antes de que termine la carga inicial de Supabase,
  // esa edición ya es más nueva que lo que estamos por traer — no la pisemos.
  const editedSinceMount = useRef(false)

  useEffect(() => {
    if (!user?.id) return
    editedSinceMount.current = false
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.from('user_kv').select('value').eq('user_id', user.id).eq('key', key).maybeSingle()
      if (cancelled || editedSinceMount.current) return
      if (data) {
        setValueState(data.value)
        lsSet(key, data.value)
      } else {
        const local = lsGet(key, defaultValue)
        await supabase.from('user_kv').upsert({ user_id: user.id, key, value: local })
      }
    })()
    return () => { cancelled = true }
  }, [user?.id, key]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user?.id) return
    const channel = supabase
      .channel(`user_kv_${key}_${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_kv', filter: `user_id=eq.${user.id}` }, payload => {
        const row = payload.new
        if (!row || row.key !== key) return
        if (skipNextRealtime.current) { skipNextRealtime.current = false; return }
        setValueState(row.value)
        lsSet(key, row.value)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user?.id, key])

  const setValue = useCallback(updater => {
    editedSinceMount.current = true
    setValueState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      if (next === prev) return prev // sin cambios reales — no dispares un guardado de más
      lsSet(key, next)
      if (user?.id) {
        // Este cliente ya se actualizó de forma optimista — ignora el eco
        // que Realtime va a mandar de vuelta por este mismo cambio.
        skipNextRealtime.current = true
        supabase.from('user_kv').upsert({ user_id: user.id, key, value: next, updated_at: new Date().toISOString() }).then(() => {})
      }
      return next
    })
  }, [key, user?.id])

  return [value, setValue]
}
