import { useState, useEffect } from 'react'
import { Box, Typography } from '@mui/material'
import PortfolioView from 'src/components/inversiones/PortfolioView'
import Metas from 'src/components/inversiones/Metas'
import Proyeccion from 'src/components/inversiones/Proyeccion'
import { supabase } from 'src/lib/supabase'
import { useFinanzas } from 'src/context/FinanzasContext'

const BG     = '#F7F7F8'
const T1     = '#111318'
const T2     = '#6B7280'

const TABS = [
  { id: 'portafolio', label: 'Portafolio' },
  { id: 'metas',      label: 'Metas' },
  { id: 'proyeccion', label: 'Proyección' },
]

export default function Inversiones() {
  const { state, saveInversiones } = useFinanzas()
  const [tab, setTab] = useState('portafolio')
  const [trmLoading,     setTrmLoading]     = useState(false)
  const [preciosLoading, setPreciosLoading] = useState(false)

  // state.inversiones sincroniza vía Supabase, así que el portafolio es el
  // mismo en todos los dispositivos — antes esto vivía solo en localStorage.
  const inv = state.inversiones || {}
  const portfolio    = inv.portfolio    || []
  const precios      = inv.precios      || {}
  const trm          = inv.trm          || 4500
  const trmFecha      = inv.trmFecha     || null
  const preciosFecha  = inv.preciosFecha || null
  const aportes       = inv.aportes      || []
  const metas         = inv.metas        || []

  // Forma funcional: siempre fusiona contra el estado más reciente, no contra
  // el "inv" capturado en el render donde se creó este patch(). Sin esto, el
  // auto-fetch de TRM o de precios (useEffect con deps fijas) podía resolver
  // después de que la migración ya hubiera poblado el portafolio y pisarlo
  // de vuelta a vacío con su propia copia vieja de "inv".
  function patch(partial) {
    saveInversiones(prevInv => ({ ...(prevInv || {}), ...partial }))
  }

  const totalUSD = portfolio.reduce((s, p) => s + p.shares * (precios[p.ticker] || 0), 0)

  // Fallback precios cero → usar avgPrice
  useEffect(() => {
    const needsFallback = portfolio.filter(p => p.avgPrice > 0 && (!precios[p.ticker] || precios[p.ticker] === 0))
    if (needsFallback.length === 0) return
    const newPrecios = { ...precios }
    needsFallback.forEach(p => { newPrecios[p.ticker] = p.avgPrice })
    patch({ precios: newPrecios, preciosFecha: null })
  }, [portfolio]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-fetch TRM diario
  useEffect(() => {
    const today = new Date().toLocaleDateString('en-CA')
    if (trmFecha === today) return
    setTrmLoading(true)
    const sources = [
      { url: 'https://latest.currency-api.pages.dev/v1/currencies/usd.json', parse: d => d?.usd?.cop },
      { url: 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json', parse: d => d?.usd?.cop },
      { url: 'https://open.er-api.com/v6/latest/USD', parse: d => d?.rates?.COP },
    ]
    async function fetchTRM() {
      for (const src of sources) {
        try {
          const r = await fetch(src.url)
          const data = await r.json()
          const rate = src.parse(data)
          if (rate && rate > 1000) {
            patch({ trm: Math.round(rate), trmFecha: today })
            return
          }
        } catch {}
      }
    }
    fetchTRM().finally(() => setTrmLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-fetch precios — corre cuando cambia la lista de tickers.
  // La consulta a Yahoo Finance corre server-side (Edge Function stock-prices)
  // porque el navegador no puede llamarla directo (CORS), y los proxies
  // públicos gratuitos que se usaban antes (corsproxy.io, allorigins.win,
  // stooq legacy) dejaron de funcionar con el tiempo.
  const tickerKey = portfolio.map(p => p.ticker).sort().join(',')
  useEffect(() => {
    const tickers = portfolio.map(p => p.ticker).filter(Boolean)
    if (tickers.length === 0) return
    const today = new Date().toLocaleDateString('en-CA')
    const allFresh = preciosFecha === today && tickers.every(t => precios[t] > 0)
    if (allFresh) return

    setPreciosLoading(true)

    async function fetchAll() {
      const { data, error } = await supabase.functions.invoke('stock-prices', { body: { tickers } })
      if (error || !data?.prices) return
      patch({ precios: { ...precios, ...data.prices }, preciosFecha: today })
    }

    fetchAll().finally(() => setPreciosLoading(false))
  }, [tickerKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Refresco manual — para cuando el usuario quiere forzar un precio nuevo
  // a mitad del día sin esperar al cambio de fecha.
  async function refetchPrecios() {
    const tickers = portfolio.map(p => p.ticker).filter(Boolean)
    if (tickers.length === 0) return
    setPreciosLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('stock-prices', { body: { tickers } })
      if (error || !data?.prices) return
      const today = new Date().toLocaleDateString('en-CA')
      patch({ precios: { ...precios, ...data.prices }, preciosFecha: today })
    } finally {
      setPreciosLoading(false)
    }
  }

  function handleUpdatePrecios(newPrecios, newTrm) {
    patch({ precios: newPrecios, trm: newTrm })
  }

  function handleDeletePosition(ticker) {
    patch({ portfolio: portfolio.filter(p => p.ticker !== ticker) })
  }

  function handleAddAporte(aporte) {
    const nextAportes = [aporte, ...aportes]
    const updates = { aportes: nextAportes }

    // Actualizar precio si no existe
    let nextPrecios = precios
    if (!precios[aporte.ticker] || precios[aporte.ticker] === 0) {
      nextPrecios = { ...precios, [aporte.ticker]: aporte.precioCompra }
      updates.precios = nextPrecios
      updates.preciosFecha = null
    }

    const exists = portfolio.some(p => p.ticker === aporte.ticker)
    if (!exists) {
      // Ticker nuevo — crear posición
      updates.portfolio = [...portfolio, { ticker: aporte.ticker, shares: aporte.shares, avgPrice: aporte.precioCompra }]
    } else {
      // Ticker existente — acumular acciones y recalcular precio promedio
      updates.portfolio = portfolio.map(p => {
        if (p.ticker !== aporte.ticker) return p
        const totalShares = p.shares + aporte.shares
        const avgPrice = totalShares > 0
          ? (p.shares * p.avgPrice + aporte.shares * aporte.precioCompra) / totalShares
          : 0
        return { ...p, shares: totalShares, avgPrice }
      })
    }

    patch(updates)
  }

  function handleDeleteAporte(id) {
    patch({ aportes: aportes.filter(a => a.id !== id) })
  }

  function handleAddMeta(meta)         { patch({ metas: [...metas, meta] }) }
  function handleEditMeta(id, updates) { patch({ metas: metas.map(m => m.id === id ? { ...m, ...updates } : m) }) }
  function handleDeleteMeta(id)        { patch({ metas: metas.filter(m => m.id !== id) }) }

  return (
    <Box sx={{ bgcolor: BG, minHeight: '100%' }}>
      <Box sx={{ maxWidth: 600, mx: 'auto' }}>

        {/* Header */}
        <Box sx={{ px: 2, pt: 2.5, pb: 1.5 }}>
          <Typography sx={{ fontSize: 22, fontWeight: 700, color: T1, letterSpacing: '-0.3px' }}>
            Inversiones
          </Typography>
          <Typography sx={{ fontSize: 13, color: T2, mt: 0.25 }}>
            Portafolio de ETFs y acciones
          </Typography>
        </Box>

        {/* Tabs */}
        <Box sx={{
          display: 'flex', p: '3px', mx: 2, mb: 2,
          borderRadius: '10px', bgcolor: '#EBEBEB',
        }}>
          {TABS.map(t => (
            <Box key={t.id} onClick={() => setTab(t.id)} sx={{
              flex: 1, px: 1.5, py: 0.625, borderRadius: '8px', textAlign: 'center',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
              bgcolor: tab === t.id ? '#fff' : 'transparent',
              color:   tab === t.id ? T1 : T2,
              boxShadow: tab === t.id ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
            }}>
              {t.label}
            </Box>
          ))}
        </Box>

        {tab === 'portafolio' && (
          <PortfolioView
            portfolio={portfolio}
            precios={precios}
            trm={trm}
            trmLoading={trmLoading}
            trmFecha={trmFecha}
            preciosLoading={preciosLoading}
            preciosFecha={preciosFecha}
            aportes={aportes}
            onUpdatePrecios={handleUpdatePrecios}
            onRefetchPrecios={refetchPrecios}
            onDeletePosition={handleDeletePosition}
            onAddAporte={handleAddAporte}
            onDeleteAporte={handleDeleteAporte}
          />
        )}
        {tab === 'metas' && (
          <Metas
            metas={metas}
            totalUSD={totalUSD}
            onAdd={handleAddMeta}
            onEdit={handleEditMeta}
            onDelete={handleDeleteMeta}
          />
        )}
        {tab === 'proyeccion' && (
          <Proyeccion portfolioActualUSD={totalUSD} />
        )}

      </Box>
    </Box>
  )
}
