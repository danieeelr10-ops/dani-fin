import { useState, useMemo } from 'react'
import { Box, Typography, Card, alpha } from '@mui/material'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts'

const ANIOS_OPTS = [5, 10, 15, 20, 25, 30]

function fmt(n) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const aportado = payload.find(p => p.dataKey === 'aportado')?.value || 0
  const ganancia = payload.find(p => p.dataKey === 'ganancia')?.value || 0
  return (
    <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 1.5, boxShadow: 3 }}>
      <Typography sx={{ fontSize: 12, fontWeight: 700, mb: 0.5 }}>{label}</Typography>
      <Typography sx={{ fontSize: 11, color: '#60a5fa' }}>Aportado: ${(aportado).toLocaleString('en-US', { minimumFractionDigits: 0 })}</Typography>
      <Typography sx={{ fontSize: 11, color: '#4ade80' }}>Ganancia: ${(ganancia).toLocaleString('en-US', { minimumFractionDigits: 0 })}</Typography>
      <Typography sx={{ fontSize: 11, fontWeight: 700, mt: 0.5 }}>Total: ${(aportado + ganancia).toLocaleString('en-US', { minimumFractionDigits: 0 })}</Typography>
    </Box>
  )
}

export default function Proyeccion({ portfolioActualUSD = 0 }) {
  const [aporteMensual, setAporteMensual] = useState('200')
  const [retornoAnual, setRetornoAnual] = useState('10')
  const [anios, setAnios] = useState(20)

  const data = useMemo(() => {
    const aporte = parseFloat(aporteMensual) || 0
    const tasa = (parseFloat(retornoAnual) || 0) / 100
    const tasaMensual = tasa / 12
    let saldo = portfolioActualUSD

    return Array.from({ length: anios }, (_, i) => {
      const anio = i + 1
      // Crecer saldo existente + aportes mensuales con interés compuesto
      for (let m = 0; m < 12; m++) {
        saldo = saldo * (1 + tasaMensual) + aporte
      }
      const totalAportado = portfolioActualUSD + aporte * 12 * anio
      const ganancia = Math.max(0, saldo - totalAportado)
      return {
        año: `A${anio}`,
        aportado: Math.round(totalAportado),
        ganancia: Math.round(ganancia),
        total: Math.round(saldo),
      }
    })
  }, [aporteMensual, retornoAnual, anios, portfolioActualUSD])

  const last = data[data.length - 1]
  const totalFinal = last?.total || 0
  const totalAportadoFinal = last?.aportado || 0
  const gananciaFinal = last?.ganancia || 0
  const multiplicador = totalAportadoFinal > 0 ? totalFinal / totalAportadoFinal : 1

  return (
    <Box sx={{ p: 2 }}>
      {/* Inputs */}
      <Card sx={{ p: 2, mb: 2, border: '1px solid', borderColor: 'divider' }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1.5 }}>Parámetros</Typography>
        <Box sx={{ display: 'flex', gap: 1, mb: 1.25, flexWrap: 'wrap' }}>
          <Box sx={{ flex: '1 1 120px' }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', mb: 0.5 }}>Aporte mensual (USD)</Typography>
            <Box component="input" type="number" value={aporteMensual} onChange={e => setAporteMensual(e.target.value)}
              sx={{ width: '100%', bgcolor: 'background.default', border: '1px solid', borderColor: 'divider', borderRadius: 1.5, px: 1.5, py: 0.875, fontSize: 13, fontFamily: 'inherit', color: 'text.primary', outline: 'none', boxSizing: 'border-box', '&:focus': { borderColor: 'primary.main' } }} />
          </Box>
          <Box sx={{ flex: '1 1 120px' }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', mb: 0.5 }}>Retorno anual (%)</Typography>
            <Box component="input" type="number" value={retornoAnual} onChange={e => setRetornoAnual(e.target.value)}
              sx={{ width: '100%', bgcolor: 'background.default', border: '1px solid', borderColor: 'divider', borderRadius: 1.5, px: 1.5, py: 0.875, fontSize: 13, fontFamily: 'inherit', color: 'text.primary', outline: 'none', boxSizing: 'border-box', '&:focus': { borderColor: 'primary.main' } }} />
          </Box>
        </Box>
        <Box>
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', mb: 0.75 }}>Horizonte</Typography>
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            {ANIOS_OPTS.map(a => (
              <Box key={a} onClick={() => setAnios(a)}
                sx={{ px: 1.5, py: 0.5, borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid', transition: 'all 0.15s',
                  borderColor: anios === a ? 'primary.main' : 'divider',
                  bgcolor: anios === a ? 'primary.main' : 'transparent',
                  color: anios === a ? '#fff' : 'text.secondary' }}>
                {a}a
              </Box>
            ))}
          </Box>
        </Box>
      </Card>

      {/* KPIs */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        {[
          { label: `En ${anios} años`, value: `$${totalFinal.toLocaleString('en-US', { minimumFractionDigits: 0 })}`, color: 'text.primary', sub: 'USD total' },
          { label: 'Total aportado', value: `$${totalAportadoFinal.toLocaleString('en-US', { minimumFractionDigits: 0 })}`, color: '#60a5fa', sub: 'USD' },
          { label: 'Ganancia compuesta', value: `$${gananciaFinal.toLocaleString('en-US', { minimumFractionDigits: 0 })}`, color: '#4ade80', sub: `×${multiplicador.toFixed(1)}` },
        ].map(k => (
          <Card key={k.label} sx={{ flex: '1 1 auto', p: 1.5, border: '1px solid', borderColor: 'divider', minWidth: 100 }}>
            <Typography sx={{ fontSize: 10, color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>{k.label}</Typography>
            <Typography sx={{ fontSize: 17, fontWeight: 800, color: k.color, lineHeight: 1.2 }}>{k.value}</Typography>
            <Typography sx={{ fontSize: 10, color: 'text.disabled', mt: 0.3 }}>{k.sub}</Typography>
          </Card>
        ))}
      </Box>

      {/* Gráfico */}
      <Card sx={{ p: 2, mb: 2, border: '1px solid', borderColor: 'divider' }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1.5 }}>
          Proyección año a año
        </Typography>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(145,158,171,0.12)" vertical={false} />
            <XAxis dataKey="año" tick={{ fontSize: 10, fill: '#919EAB' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={fmt} tick={{ fontSize: 10, fill: '#919EAB' }} axisLine={false} tickLine={false} width={48} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(145,158,171,0.06)' }} />
            <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 11 }} formatter={v => v === 'aportado' ? 'Aportado' : 'Ganancia'} />
            <Bar dataKey="aportado" stackId="a" fill="#60a5fa" radius={[0, 0, 3, 3]} />
            <Bar dataKey="ganancia" stackId="a" fill="#4ade80" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Tabla */}
      <Card sx={{ overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ px: 2, py: 1, bgcolor: alpha('#919EAB', 0.06), borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 1 }}>
            {['Año', 'Aportado', 'Ganancia', 'Total'].map(h => (
              <Typography key={h} sx={{ fontSize: 10, fontWeight: 700, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</Typography>
            ))}
          </Box>
        </Box>
        {data.map((row, i) => (
          <Box key={row.año} sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 1, px: 2, py: 1, borderBottom: i < data.length - 1 ? '1px solid' : 'none', borderColor: 'divider', '&:hover': { bgcolor: alpha('#919EAB', 0.03) } }}>
            <Typography sx={{ fontSize: 12, fontWeight: 600 }}>{row.año}</Typography>
            <Typography sx={{ fontSize: 12, color: '#60a5fa', fontWeight: 600 }}>{fmt(row.aportado)}</Typography>
            <Typography sx={{ fontSize: 12, color: '#4ade80', fontWeight: 600 }}>{fmt(row.ganancia)}</Typography>
            <Typography sx={{ fontSize: 12, fontWeight: 700 }}>{fmt(row.total)}</Typography>
          </Box>
        ))}
      </Card>
    </Box>
  )
}
