import { useState, useEffect } from 'react'
import { Box, Typography } from '@mui/material'
import PortfolioView from 'src/components/inversiones/PortfolioView'
import Metas from 'src/components/inversiones/Metas'
import Proyeccion from 'src/components/inversiones/Proyeccion'

const BG     = '#F7F7F8'
const T1     = '#111318'
const T2     = '#6B7280'

function load(key, def) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def } catch { return def }
}
function save(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)) } catch {}
}

const DEFAULT_PORTFOLIO = []
const DEFAULT_PRECIOS   = {}
const DEFAULT_TRM = 4500

const TABS = [
  { id: 'portafolio', label: 'Portafolio' },
  { id: 'metas',      label: 'Metas' },
  { id: 'proyeccion', label: 'Proyección' },
]

export default function Inversiones() {
  const [tab, setTab] = useState('portafolio')

  const [portfolio, setPortfolio] = useState(() => load('inv_portfolio', DEFAULT_PORTFOLIO))
  const [precios,   setPrecios]   = useState(() => load('inv_precios',   DEFAULT_PRECIOS))
  const [trm,       setTrm]       = useState(() => load('inv_trm',       DEFAULT_TRM))
  const [trmFecha,  setTrmFecha]  = useState(() => load('inv_trm_date',  null))
  const [trmLoading,     setTrmLoading]     = useState(false)
  const [preciosFecha,   setPreciosFecha]   = useState(() => load('inv_precios_date', null))
  const [preciosLoading, setPreciosLoading] = useState(false)
  const [aportes,   setAportes]   = useState(() => load('inv_aportes',   []))
  const [metas,     setMetas]     = useState(() => load('inv_metas',     []))

  const totalUSD = portfolio.reduce((s, p) => s + p.shares * (precios[p.ticker] || 0), 0)

  // Fallback precios cero → usar avgPrice
  useEffect(() => {
    const needsFallback = portfolio.filter(p => p.avgPrice > 0 && (!precios[p.ticker] || precios[p.ticker] === 0))
    if (needsFallback.length === 0) return
    const newPrecios = { ...precios }
    needsFallback.forEach(p => { newPrecios[p.ticker] = p.avgPrice })
    setPrecios(newPrecios); save('inv_precios', newPrecios)
    setPreciosFecha(null); save('inv_precios_date', null)
  }, [portfolio])

  // Auto-fetch TRM diario
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

  // Auto-fetch precios — corre cuando cambia la lista de tickers
  const tickerKey = portfolio.map(p => p.ticker).sort().join(',')
  useEffect(() => {
    const tickers = portfolio.map(p => p.ticker).filter(Boolean)
    if (tickers.length === 0) return
    const today = new Date().toISOString().split('T')[0]
    const allFresh = preciosFecha === today && tickers.every(t => precios[t] > 0)
    if (allFresh) return

    setPreciosLoading(true)

    async function get(url, ms = 7000) {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), ms)
      try {
        const r = await fetch(url, { signal: ctrl.signal })
        clearTimeout(timer)
        return r
      } catch (e) {
        clearTimeout(timer)
        throw e
      }
    }

    async function fetchOneTicker(ticker) {
      const t = ticker.toUpperCase()

      // 1. corsproxy.io → Yahoo Finance v8 chart (precios en tiempo real)
      try {
        const yUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${t}?interval=1d&range=1d`
        const r = await get(`https://corsproxy.io/?${encodeURIComponent(yUrl)}`)
        if (r.ok) {
          const d = await r.json()
          const p = d?.chart?.result?.[0]?.meta?.regularMarketPrice
          if (p > 0) return p
        }
      } catch {}

      // 2. Stooq directo (sin CORS para la mayoría de navegadores)
      try {
        const r = await get(`https://stooq.com/q/l/?s=${t.toLowerCase()}.us&f=sd2t2ohlcv&h&e=csv`)
        if (r.ok) {
          const text = await r.text()
          const lines = text.trim().split('\n')
          if (lines.length >= 2) {
            const cols = lines[1].split(',')
            const close = parseFloat(cols[6])
            if (close > 0) return close
          }
        }
      } catch {}

      // 3. allorigins.win → Yahoo Finance v7 quote (proxy alternativo)
      try {
        const yUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${t}&fields=regularMarketPrice`
        const r = await get(`https://api.allorigins.win/raw?url=${encodeURIComponent(yUrl)}`)
        if (r.ok) {
          const d = await r.json()
          const p = d?.quoteResponse?.result?.[0]?.regularMarketPrice
          if (p > 0) return p
        }
      } catch {}

      return null
    }

    async function fetchAll() {
      const results = await Promise.all(
        tickers.map(async t => ({ ticker: t, price: await fetchOneTicker(t) }))
      )
      const newPrecios = { ...precios }
      let changed = false
      results.forEach(({ ticker, price }) => {
        if (price > 0) { newPrecios[ticker] = price; changed = true }
      })
      if (changed) {
        setPrecios(newPrecios); save('inv_precios', newPrecios)
        setPreciosFecha(today); save('inv_precios_date', today)
      }
    }

    fetchAll().finally(() => setPreciosLoading(false))
  }, [tickerKey]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleUpdatePrecios(newPrecios, newTrm) {
    setPrecios(newPrecios); save('inv_precios', newPrecios)
    setTrm(newTrm); save('inv_trm', newTrm)
  }

  function handleDeletePosition(ticker) {
    const next = portfolio.filter(p => p.ticker !== ticker)
    setPortfolio(next); save('inv_portfolio', next)
  }

  function handleAddAporte(aporte) {
    const next = [aporte, ...aportes]
    setAportes(next); save('inv_aportes', next)

    // Actualizar precio si no existe
    if (!precios[aporte.ticker] || precios[aporte.ticker] === 0) {
      const newPrecios = { ...precios, [aporte.ticker]: aporte.precioCompra }
      setPrecios(newPrecios); save('inv_precios', newPrecios)
      setPreciosFecha(null); save('inv_precios_date', null)
    }

    const exists = portfolio.some(p => p.ticker === aporte.ticker)
    if (!exists) {
      // Ticker nuevo — crear posición
      const newEntry = { ticker: aporte.ticker, shares: aporte.shares, avgPrice: aporte.precioCompra }
      const nextP = [...portfolio, newEntry]
      setPortfolio(nextP); save('inv_portfolio', nextP)
    } else {
      // Ticker existente — acumular acciones y recalcular precio promedio
      const nextP = portfolio.map(p => {
        if (p.ticker !== aporte.ticker) return p
        const totalShares = p.shares + aporte.shares
        const avgPrice = totalShares > 0
          ? (p.shares * p.avgPrice + aporte.shares * aporte.precioCompra) / totalShares
          : 0
        return { ...p, shares: totalShares, avgPrice }
      })
      setPortfolio(nextP); save('inv_portfolio', nextP)
    }
  }

  function handleDeleteAporte(id) {
    const next = aportes.filter(a => a.id !== id)
    setAportes(next); save('inv_aportes', next)
  }

  function handleAddMeta(meta)         { const n = [...metas, meta];                   setMetas(n); save('inv_metas', n) }
  function handleEditMeta(id, updates) { const n = metas.map(m => m.id === id ? { ...m, ...updates } : m); setMetas(n); save('inv_metas', n) }
  function handleDeleteMeta(id)        { const n = metas.filter(m => m.id !== id);     setMetas(n); save('inv_metas', n) }

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
