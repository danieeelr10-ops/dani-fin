import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from 'src/lib/supabase'
import { useAuth } from './AuthContext'

export const ADMIN_EMAIL = 'danieeelr10@gmail.com'

export const ALL_FEATURES = {
  inicio:      { label: 'Inicio',       default: true },
  registro:    { label: 'Registrar',    default: true },
  historial:   { label: 'Historial',    default: true },
  presupuesto: { label: 'Presupuesto',  default: true },
  tc:          { label: 'T.C',          default: true },
  deudas:      { label: 'Deudas',       default: true },
  ahorro:      { label: 'Ahorro',       default: true },
  analisis:    { label: 'Análisis',     default: false },
  ia:          { label: 'IA',           default: false },
  config:      { label: 'Config',       default: true },
  apuntes:     { label: 'Apuntes',      default: false },
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

    // Admin siempre tiene todo habilitado
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

      if (data?.features) {
        setFeatures({ ...DEFAULT_FEATURES, ...data.features })
      } else {
        // Primera vez: crear fila con defaults
        await supabase.from('user_features').upsert({
          user_id: user.id,
          email:   user.email,
          features: DEFAULT_FEATURES,
        })
        setFeatures(DEFAULT_FEATURES)
      }
      setLoading(false)
    }
    load()
  }, [user?.id])

  function hasFeature(key) {
    if (isAdmin) return true
    return features?.[key] !== false
  }

  return (
    <FeaturesContext.Provider value={{ features, hasFeature, isAdmin, loading }}>
      {children}
    </FeaturesContext.Provider>
  )
}

export const useFeatures = () => useContext(FeaturesContext)
