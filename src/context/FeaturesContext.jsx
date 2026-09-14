import { createContext, useContext, useEffect, useState, useMemo } from 'react'
import { supabase } from 'src/lib/supabase'
import { useAuth } from './AuthContext'

export const ADMIN_EMAIL = 'danieeelr10@gmail.com'

const GUIA_PASOS_LS = 'dani_fin_guia_pasos'

export const ALL_FEATURES = {
  inicio:      { label: 'Inicio',       default: true },
  finanzas:    { label: 'Finanzas',     default: true },
  registro:    { label: 'Registrar',    default: true },
  historial:   { label: 'Historial',    default: true },
  presupuesto: { label: 'Presupuesto',  default: true },
  tc:          { label: 'T.C',          default: true },
  deudas:      { label: 'Deudas',       default: true },
  ahorro:      { label: 'Ahorro',       default: true },
  analisis:    { label: 'Análisis',     default: false },
  ia:          { label: 'IA',           default: false },
  config:      { label: 'Config',       default: true },
  apuntes:     { label: 'Apuntes',      default: true },
  habitos:     { label: 'Hábitos',      default: true },
  ritual:      { label: 'Ritual Matutino', default: true },
  planificador:{ label: 'Planificador', default: true },
  metasVida:   { label: 'Metas de Vida', default: true },
  ruedaVida:   { label: 'Rueda de la Vida', default: true },
  notas:       { label: 'Notas',         default: true },
}

export const DEFAULT_FEATURES = Object.fromEntries(
  Object.entries(ALL_FEATURES).map(([k, v]) => [k, v.default])
)

const FeaturesContext = createContext(null)

export function FeaturesProvider({ children }) {
  const { user } = useAuth()
  const [features, setFeatures] = useState(null)
  const [loading,  setLoading]  = useState(true)

  const isAdmin = user?.email === ADMIN_EMAIL

  useEffect(() => {
    if (!user) { setFeatures(null); setLoading(false); return }

    if (isAdmin) {
      setFeatures(Object.fromEntries(Object.keys(ALL_FEATURES).map(k => [k, true])))
      setLoading(false)
      return
    }

    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('user_features')
        .select('features')
        .eq('user_id', user.id)
        .single()

      // Migrate localStorage guia_pasos into Supabase on first load
      let lsPasos = []
      try { lsPasos = JSON.parse(localStorage.getItem(GUIA_PASOS_LS) || '[]') } catch {}

      if (!data?.features) {
        // Primera vez: crear fila con defaults + pasos de localStorage
        const initial = lsPasos.length > 0
          ? { ...DEFAULT_FEATURES, guia_pasos: [...new Set(['cuenta', ...lsPasos])] }
          : DEFAULT_FEATURES
        await supabase.from('user_features').upsert({
          user_id: user.id,
          email:   user.email,
          features: initial,
        })
        setFeatures(initial)
      } else {
        let merged = { ...DEFAULT_FEATURES, ...data.features }
        // Merge localStorage pasos with what's in Supabase
        if (lsPasos.length > 0) {
          const dbPasos  = data.features.guia_pasos || ['cuenta']
          const union    = [...new Set(['cuenta', ...dbPasos, ...lsPasos])]
          if (union.length > dbPasos.length) {
            merged = { ...merged, guia_pasos: union }
            await supabase.from('user_features')
              .update({ features: { ...data.features, guia_pasos: union } })
              .eq('user_id', user.id)
          }
        }
        setFeatures(merged)
      }
      setLoading(false)
    }
    load()
  }, [user?.id])

  const guiaPasos = useMemo(() => {
    const arr = features?.guia_pasos || ['cuenta']
    return new Set(arr)
  }, [features])

  async function markGuiaPaso(id) {
    if (!user || isAdmin) return
    const current = features?.guia_pasos || ['cuenta']
    if (current.includes(id)) return
    const updated = [...current, id]
    setFeatures(prev => ({ ...prev, guia_pasos: updated }))
    localStorage.setItem(GUIA_PASOS_LS, JSON.stringify(updated))
    const { data: row } = await supabase.from('user_features').select('features').eq('user_id', user.id).single()
    const newFeatures = { ...(row?.features || {}), guia_pasos: updated }
    await supabase.from('user_features').update({ features: newFeatures }).eq('user_id', user.id)
  }

  function hasFeature(key) {
    if (isAdmin) return true
    return features?.[key] !== false
  }

  return (
    <FeaturesContext.Provider value={{ features, hasFeature, isAdmin, loading, guiaPasos, markGuiaPaso }}>
      {children}
    </FeaturesContext.Provider>
  )
}

export const useFeatures = () => useContext(FeaturesContext)
