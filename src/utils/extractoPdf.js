import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

const MARGIN    = 16
const TEXT      = [17, 19, 24]
const TEXT_DIM  = [107, 114, 128]
const TEXT_DIM2 = [156, 163, 175]
const BLUE      = [59, 130, 246]
const GREEN     = [0, 167, 111]
const AMBER     = [217, 119, 6]
const GRID      = [229, 231, 235]
const ROW_ALT   = [249, 250, 251]

function fmtCOP(n) { return '$' + Math.round(n || 0).toLocaleString('es-CO') }
function fmtFecha(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Genera y descarga un extracto en PDF (texto real, no captura de pantalla)
// con los pagos de una cuenta externa — pensado para compartir con quien
// corresponda (contador, tesorero, etc.).
export function generarExtractoPDF(cuenta, pagos, { filtro = 'todos' } = {}) {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const contentW = pageW - MARGIN * 2
  let y = MARGIN

  // Pagos viejos no tienen "movimiento" — se tratan como Egreso (comportamiento
  // original, antes de que existiera esta distinción)
  const esIngreso = p => p.movimiento === 'Ingreso'
  const sorted = [...pagos].sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))
  const totalIngresos = sorted.filter(esIngreso).reduce((s, p) => s + (p.monto || 0), 0)
  const totalEgresos  = sorted.filter(p => !esIngreso(p)).reduce((s, p) => s + (p.monto || 0), 0)
  const neto = totalIngresos - totalEgresos

  // ---- Header ----
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.setTextColor(...BLUE)
  pdf.text('RUMBO · EXTRACTO', MARGIN, y)
  pdf.setTextColor(...TEXT_DIM)
  pdf.text(new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }), pageW - MARGIN, y, { align: 'right' })

  y += 10
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(21); pdf.setTextColor(...TEXT)
  pdf.text(`${cuenta.emoji || ''} ${cuenta.nombre}`.trim(), MARGIN, y)

  y += 6.5
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); pdf.setTextColor(...TEXT_DIM)
  const filtroLabel = filtro === 'pendientes' ? 'Pagos pendientes' : filtro === 'reportados' ? 'Pagos reportados' : 'Todos los pagos'
  pdf.text(`${filtroLabel} · ${sorted.length} registro${sorted.length !== 1 ? 's' : ''}`, MARGIN, y)

  y += 6
  pdf.setDrawColor(...GRID); pdf.setLineWidth(0.3)
  pdf.line(MARGIN, y, pageW - MARGIN, y)
  y += 11

  // ---- Resumen ----
  const third = contentW / 3
  const tiles = [
    { label: 'Ingresos', value: totalIngresos, color: GREEN },
    { label: 'Egresos',  value: totalEgresos,  color: BLUE },
    { label: 'Neto',     value: neto,          color: neto < 0 ? BLUE : TEXT },
  ]
  tiles.forEach((t, i) => {
    const x = MARGIN + third * i
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(...TEXT_DIM)
    pdf.text(t.label.toUpperCase(), x, y)
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(15); pdf.setTextColor(...t.color)
    pdf.text(`${t.value < 0 ? '-' : ''}${fmtCOP(Math.abs(t.value))}`, x, y + 6.5)
  })
  y += 18

  // ---- Tabla de pagos ----
  if (sorted.length > 0) {
    autoTable(pdf, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [['Fecha', 'Concepto', 'Monto', 'Estado']],
      body: sorted.map(p => [fmtFecha(p.fecha), p.concepto + (p.nota ? `\n${p.nota}` : ''), `${esIngreso(p) ? '+' : '-'} ${fmtCOP(p.monto)}`, p.reportado ? 'Reportado' : 'Pendiente']),
      theme: 'plain',
      styles: { font: 'helvetica', fontSize: 9, textColor: TEXT_DIM, cellPadding: { top: 3, bottom: 3, left: 0, right: 2 }, lineColor: GRID, lineWidth: 0.1, valign: 'top' },
      headStyles: { textColor: TEXT_DIM, fontStyle: 'bold', fontSize: 7.5 },
      columnStyles: {
        0: { cellWidth: 26 },
        1: { cellWidth: 'auto' },
        2: { halign: 'right', cellWidth: 30 },
        3: { halign: 'right', cellWidth: 26 },
      },
      alternateRowStyles: { fillColor: ROW_ALT },
      didParseCell: (data) => {
        if (data.section !== 'body') return
        if (data.column.index === 1) { data.cell.styles.textColor = TEXT; data.cell.styles.fontStyle = 'bold' }
        if (data.column.index === 2) {
          data.cell.styles.fontStyle = 'bold'
          data.cell.styles.textColor = esIngreso(sorted[data.row.index]) ? GREEN : BLUE
        }
        if (data.column.index === 3) {
          const reportado = sorted[data.row.index]?.reportado
          data.cell.styles.textColor = reportado ? GREEN : AMBER
          data.cell.styles.fontStyle = 'bold'
        }
      },
    })
  }

  // ---- Pie de página en todas las páginas ----
  const totalPages = pdf.internal.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p)
    pdf.setDrawColor(...GRID); pdf.setLineWidth(0.2)
    pdf.line(MARGIN, pageH - 14, pageW - MARGIN, pageH - 14)
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(...TEXT_DIM2)
    pdf.text('Generado con Rumbo', MARGIN, pageH - 9)
    pdf.text(`${p} / ${totalPages}`, pageW - MARGIN, pageH - 9, { align: 'right' })
  }

  pdf.save(`Extracto-${cuenta.nombre.replace(/\s+/g, '-')}-${new Date().toLocaleDateString('en-CA')}.pdf`)
}
