// Precios de acciones/ETFs en tiempo real, consultados server-side.
// El navegador no puede llamar a Yahoo Finance directamente por CORS, y los
// proxies públicos gratuitos (corsproxy.io, allorigins.win, stooq legacy)
// se caen o cambian de formato con el tiempo — por eso esto corre aquí.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS } })
}

async function fetchPrice(ticker: string): Promise<number | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RumboBot/1.0)' } })
    if (!r.ok) return null
    const d = await r.json()
    const p = d?.chart?.result?.[0]?.meta?.regularMarketPrice
    return typeof p === 'number' && p > 0 ? p : null
  } catch {
    return null
  }
}

type SearchHit = { symbol: string; name: string; exchange: string; type: string }

// Busca empresas/ETFs por nombre (ej: "apple" -> AAPL · Apple Inc.) para que
// el usuario no tenga que adivinar el ticker exacto.
async function searchCompanies(query: string): Promise<SearchHit[]> {
  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=8&newsCount=0`
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RumboBot/1.0)' } })
    if (!r.ok) return []
    const d = await r.json()
    const quotes = Array.isArray(d?.quotes) ? d.quotes : []
    return quotes
      .filter((q: any) => q.symbol && (q.quoteType === 'EQUITY' || q.quoteType === 'ETF'))
      .map((q: any) => ({
        symbol: q.symbol,
        name: q.longname || q.shortname || q.symbol,
        exchange: q.exchDisp || q.exchange || '',
        type: q.quoteType,
      }))
      .slice(0, 8)
  } catch {
    return []
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    const body = await req.json().catch(() => ({}))

    // Búsqueda por nombre de empresa
    if (typeof body.search === 'string' && body.search.trim()) {
      const results = await searchCompanies(body.search.trim())
      return json({ results })
    }

    // Precios por ticker
    const raw = Array.isArray(body.tickers) ? body.tickers : []
    const tickers = [...new Set(raw.map((t: unknown) => String(t).trim().toUpperCase()).filter(Boolean))].slice(0, 25)
    if (tickers.length === 0) return json({ prices: {} })

    const prices: Record<string, number> = {}
    await Promise.all(tickers.map(async (t) => {
      const p = await fetchPrice(t)
      if (p != null) prices[t] = p
    }))

    return json({ prices, fetchedAt: new Date().toISOString() })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
