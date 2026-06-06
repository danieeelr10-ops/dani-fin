import { useState, useEffect } from 'react'
import { Box, Typography } from '@mui/material'
import PortfolioSummary from 'src/components/inversiones/PortfolioSummary'
import AportesForm from 'src/components/inversiones/AportesForm'
import Metas from 'src/components/inversiones/Metas'
import Proyeccion from 'src/components/inversiones/Proyeccion'

const BG     = '#F7F7F8'
const T1     = '#111318'
const T2     = '#6B7280'
const BORDER = '#E5E7EB'

function load(key, def) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def } catch { return def }
}
function save(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)) } catch {}
}

const DEFAULT_PORTFOLIO = [
  { ticker: 'VOO',  shares: 0.31272, avgPrice: 639.55 },
  { ticker: 'NVDA', shares: 0.52667, avgPrice: 189.87 },
]
const DEFAULT_PRECIOS = { VOO: 639.55, NVDA: 189.87 }
const DEFAULT_TRM = 4500

const TABS = [
  { id: 'resumen',    label: 'Resumen' },
  { id: 'aportes',   label: 'Aportes' },
  { id: 'metas',     label: 'Metas' },
  { id: 'proyeccion', label: 'Proyección' },
]

export default function Inversiones() {
  const [tab, setTab] = useState('resumen')

  const [portfolio, setPortfolio] = useState(() => load('inv_portfolio', DEFAULT_PORTFOLIO))
  const [precios,   setPrecios]   = useState(() => load('inv_precios',   DEFAULT_PRECIOS))
  const [trm,       setTrm]       = useState(() => load('inv_trm',       DEFAULT_TRM))
  const [trmFecha,  setTrmFecha]  = useState(() => load('inv_trm_date',  null))
  const [trmLoading,    setTrmLoading]    = useState(false)
  const [preciosFecha,  setPreciosFecha]  = useState(() => load('inv_precios_date', null))
  const [preciosLoading, setPreciosLoading] = useState(false)
  const [aportes,   setAportes]   = useState(() => load('inv_aportes',   []))
  const [metas,     setMetas]     = useState(() => load('inv_metas',     []))

  const totalUSD = portfolio.reduce((s, p) => s + p.shares * (precios[p.ticker] || 0), 0)

  // Fallback: si algún ticker tiene precio 0 pero tiene avgPrice, usar avgPrice y re-fetchear
  useEffect(() => {
    const needsFallback = portfolio.filter(p => p.avgPrice > 0 && (!precios[p.ticker] || precios[p.ticker] === 0))
    if (needsFallback.length === 0) return
    const newPrecios = { ...precios }
    needsFallback.forEach(p => { newPrecios[p.ticker] = p.avgPrice })
    setPrecios(newPrecios); save('inv_precios', newPrecios)
    setPreciosFecha(null); save('inv_precios_date', null)
  }, [portfolio])

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
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
            setTrm(Math.round(rate)); setTrmFecha(today)
            save('inv_trm', Math.round(rate)); save('inv_trm_date', today)
            return
          }
        } catch {}
      }
    }
    fetchTRM().finally(() => setTrmLoading(false))
  }, [])

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    if (preciosFecha === today) return
    setPreciosLoading(true)
    async function fetchPrecios() {
      const tickers = portfolio.map(p => p.ticker).filter(Boolean)
      if (tickers.length === 0) { setPreciosLoading(false); return }
      try {
        const r = await fetch(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${tickers.join(',')}&fields=regularMarketPrice`, { headers: { Accept: 'application/json' } })
        const data = await r.json()
        const results = data?.quoteResponse?.result || []
        if (results.length === 0) return
        const newPrecios = { ...precios }
        results.forEach(q => { if (q.regularMarketPrice && tickers.includes(q.symbol)) newPrecios[q.symbol] = q.regularMarketPrice })
        setPrecios(newPrecios); save('inv_precios', newPrecios)
        setPreciosFecha(today); save('inv_precios_date', today)
      } catch {}
    }
    fetchPrecios().finally(() => setPreciosLoading(false))
  }, [])

  function handleUpdatePrecios(newPrecios, newTrm) {
    setPrecios(newPrecios); save('inv_precios', newPrecios)
    setTrm(newTrm); save('inv_trm', newTrm)
  }

  function handleUpdateShares(ticker, shares) {
    const next = portfolio.map(p => p.ticker === ticker ? { ...p, shares } : p)
    setPortfolio(next); save('inv_portfolio', next)
  }

  function handleAddPosition(ticker, shares, avgPrice) {
    const t = ticker.toUpperCase().trim()
    if (!t || portfolio.some(p => p.ticker === t)) return
    const next = [...portfolio, { ticker: t, shares, avgPrice }]
    setPortfolio(next); save('inv_portfolio', next)
    const newPrecios = { ...precios, [t]: avgPrice || 0 }
    setPrecios(newPrecios); save('inv_precios', newPrecios)
    // Forzar re-fetch de precios para incluir el nuevo ticker
    setPreciosFecha(null); save('inv_precios_date', null)
  }

  function handleDeletePosition(ticker) {
    const next = portfolio.filter(p => p.ticker !== ticker)
    setPortfolio(next); save('inv_portfolio', next)
  }

  function handleAddAporte(aporte) {
    const next = [aporte, ...aportes]
    setAportes(next); save('inv_aportes', next)
    if (!precios[aporte.ticker] || precios[aporte.ticker] === 0) {
      const newPrecios = { ...precios, [aporte.ticker]: aporte.precioCompra }
      setPrecios(newPrecios); save('inv_precios', newPrecios)
      setPreciosFecha(null); save('inv_precios_date', null)
    }
    const nextPortfolio = portfolio.map(p => {
      if (p.ticker !== aporte.ticker) return p
      const totalShares = p.shares + aporte.shares
      const avgPrice = totalShares > 0 ? (p.shares * p.avgPrice + aporte.shares * aporte.precioCompra) / totalShares : 0
      return { ...p, shares: totalShares, avgPrice }
    })
    setPortfolio(nextPortfolio); save('inv_portfolio', nextPortfolio)
  }

  function handleDeleteAporte(id) {
    const next = aportes.filter(a => a.id !== id)
    setAportes(next); save('inv_aportes', next)
  }

  function handleAddMeta(meta)         { const next = [...metas, meta];                  setMetas(next); save('inv_metas', next) }
  function handleEditMeta(id, updates) { const next = metas.map(m => m.id === id ? { ...m, ...updates } : m); setMetas(next); save('inv_metas', next) }
  function handleDeleteMeta(id)        { const next = metas.filter(m => m.id !== id);    setMetas(next); save('inv_metas', next) }

  return (
    <Box sx={{ bgcolor: BG, minHeight: '100%' }}>
    <Box sx={{ maxWidth: 600, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ px: 2, pt: 2.5, pb: 1.5 }}>
        <Typography sx={{ fontSize: 22, fontWeight: 700, color: T1, letterSpacing: '-0.3px' }}>Inversiones</Typography>
        <Typography sx={{ fontSize: 13, color: T2, mt: 0.25 }}>Portafolio de ETFs y acciones</Typography>
      </Box>

      {/* Tabs */}
      <Box sx={{ display: 'flex', gap: 0, p: '3px', mx: 2, mb: 2, borderRadius: '10px', bgcolor: '#EBEBEB', overflowX: 'auto', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
        {TABS.map(t => (
          <Box key={t.id} onClick={() => setTab(t.id)} sx={{
            flex: 1, px: 1.5, py: 0.625, borderRadius: '8px', textAlign: 'center',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0,
            bgcolor: tab === t.id ? '#fff' : 'transparent',
            color:   tab === t.id ? T1 : T2,
            boxShadow: tab === t.id ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
          }}>
            {t.label}
          </Box>
        ))}
      </Box>

      {tab === 'resumen'    && <PortfolioSummary portfolio={portfolio} precios={precios} trm={trm} trmLoading={trmLoading} trmFecha={trmFecha} preciosLoading={preciosLoading} preciosFecha={preciosFecha} onUpdatePrecios={handleUpdatePrecios} onUpdateShares={handleUpdateShares} onAddPosition={handleAddPosition} onDeletePosition={handleDeletePosition} />}
      {tab === 'aportes'   && <AportesForm portfolio={portfolio} aportes={aportes} onAdd={handleAddAporte} onDelete={handleDeleteAporte} />}
      {tab === 'metas'     && <Metas metas={metas} totalUSD={totalUSD} onAdd={handleAddMeta} onEdit={handleEditMeta} onDelete={handleDeleteMeta} />}
      {tab === 'proyeccion' && <Proyeccion portfolioActualUSD={totalUSD} />}
    </Box>
    </Box>
  )
}
