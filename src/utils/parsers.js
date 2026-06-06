import { NUMS_ES, CATEGORIAS_VOZ, CUENTAS_VOZ, PALABRAS_RUIDO } from 'src/constants';

// ── Banco notification parser ─────────────────────────
export function parsearMonto(texto) {
  const patrones = [
    /\$\s*([\d]{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?)/,
    /\$\s*(\d+(?:[.,]\d{1,2})?)/,
    /([\d]{1,3}(?:[.,]\d{3})+)\s*pesos/i,
  ];
  for (const pat of patrones) {
    const m = texto.match(pat);
    if (m) {
      let raw = m[1].replace(/\s/g, '');
      const lastDot = raw.lastIndexOf('.');
      const lastComma = raw.lastIndexOf(',');
      if (lastDot > 0 && lastComma > 0) {
        raw = lastDot > lastComma ? raw.replace(/,/g, '') : raw.replace(/\./g, '').replace(',', '.');
      } else if (lastDot > 0 && (raw.length - lastDot - 1) === 3) {
        raw = raw.replace('.', '');
      } else if (lastComma > 0 && (raw.length - lastComma - 1) === 3) {
        raw = raw.replace(',', '');
      } else if (lastComma > 0) {
        raw = raw.replace(',', '.');
      }
      const n = parseFloat(raw);
      if (!isNaN(n) && n > 0) return n;
    }
  }
  return null;
}

export function parsearComercio(texto) {
  const patrones = [
    /\ben\s+([A-ZÁÉÍÓÚÑ][A-Za-záéíóúñÁÉÍÓÚÑ0-9\s*.\-'&]{2,40?})(?:\s+con\b|\s+TC\b|\s*[-–]\s|\.|,|$)/i,
    /compra(?:ste|do)?\s+en\s+([A-Za-záéíóúñ0-9\s*.\-'&]{2,40?})(?:\s*[-–]|\.|,|$)/i,
    /establecimiento[:\s]+([A-Za-záéíóúñ0-9\s*.\-'&]{2,40})/i,
  ];
  for (const pat of patrones) {
    const m = texto.match(pat);
    if (m) {
      const c = m[1].trim().replace(/\s+/g, ' ');
      if (c.length >= 2) return c;
    }
  }
  return '';
}

export function parsearBanco(texto) {
  const t = texto.toLowerCase();
  if (t.includes('nequi')) return 'Nequi';
  if (t.includes('daviplata')) return 'Daviplata';
  if (/\bnu\b|nubank/.test(t)) return 'Nu';
  if (t.includes('bancolombia') || t.includes('davivienda')) return 'Nequi';
  if (t.includes('tarjeta débito') || t.includes('tarjeta debito')) return 'Nequi';
  if (t.includes('tdc') || t.includes('tarjeta de crédito') || t.includes('crédito')) return 'T.C';
  return '';
}

export function parsearTipoMovimiento(texto) {
  const t = texto.toLowerCase();
  const ingresos = ['recibiste', 'transferencia recibida', 'abono', 'ingreso', 'depósito', 'te enviaron', 'reintegro'];
  return ingresos.some(p => t.includes(p)) ? 'Ingreso' : 'Egreso';
}

export function inferirCategoria(comercio) {
  if (!comercio) return '';
  const c = comercio.toLowerCase();
  const mapa = {
    Mercado:         ['éxito','exito','ara','jumbo','carrefour','mercado','supermercado','d1','sprint','la 14','alkosto','olimpica'],
    Transporte:      ['uber','cabify','indriver','taxi','sitp','transmilenio','rapitaxi','beat'],
    Salidas:         ['mcdonald','rappi','domicilios','burger','pizza','restaurante','kfc','subway','crepes','frisby','el corral','cerveza','bar','cafe','starbucks','juan valdez'],
    Salud:           ['compensar','sanitas','colmedica','eps','farmacia','drogueria','drogas','clinica','hospital','laboratorio'],
    Entretenimiento: ['netflix','spotify','apple','disney','hbo','paramount','youtube','prime','steam','playstation','cine','royal films'],
    Extras:          ['rappi pro','amazon','mercadolibre','aliexpress','shein'],
    Vehiculos:       ['terpel','biomax','primax','gasolina','combustible'],
    Educacion:       ['udemy','coursera','platzi','duolingo','google','microsoft','universidad','colegio'],
    Hogar:           ['claro','movistar','tigo','wom','etb','codensa','gas natural','acueducto','epm'],
    Trabajo:         ['canva','adobe','notion','slack','figma','capcut','zoom','dropbox'],
    Regalos:         ['falabella','ripley','zara','h&m','tennis'],
  };
  for (const [cat, keys] of Object.entries(mapa)) {
    if (keys.some(k => c.includes(k))) return cat;
  }
  return '';
}

export function parsearNotificacion(texto) {
  return {
    monto: parsearMonto(texto),
    comercio: parsearComercio(texto),
    cuenta: parsearBanco(texto),
    movimiento: parsearTipoMovimiento(texto),
    categoria: inferirCategoria(parsearComercio(texto)),
  };
}

// ── Voz parser ────────────────────────────────────────
function parsearNumeroEs(texto) {
  const norm = texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const dm = norm.match(/\b(\d[\d\s.,]*)\b/);
  if (dm) {
    let raw = dm[1].trim();
    const lastDot = raw.lastIndexOf('.');
    const lastComma = raw.lastIndexOf(',');
    if (lastDot > 0 && lastComma > 0) {
      raw = lastDot > lastComma ? raw.replace(/,/g, '') : raw.replace(/\./g, '').replace(',', '.');
    } else if (lastDot > 0 && (raw.length - lastDot - 1) === 3) {
      raw = raw.replace('.', '');
    } else if (lastComma > 0 && (raw.length - lastComma - 1) === 3) {
      raw = raw.replace(',', '');
    }
    const n = parseFloat(raw.replace(/\s/g, ''));
    if (!isNaN(n) && n > 0) {
      const rest = norm.slice(norm.indexOf(dm[0]) + dm[0].length).trim();
      if (/^lucas?/.test(rest)) return n * 1000;
      if (/^palos?/.test(rest)) return n * 1000000;
      return n;
    }
  }
  if (/medio\s*palo/.test(norm)) return 500000;
  if (/un\s*palo/.test(norm)) return 1000000;
  if (/dos\s*palos/.test(norm)) return 2000000;
  if (/medio\s*millon/.test(norm)) return 500000;

  const words = norm.split(/\s+/);
  let total = 0, current = 0, hasMil = false;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w === 'medio' && (words[i + 1] === 'mil' || words[i + 1] === 'palo')) {
      if (words[i + 1] === 'mil') { total += 500; hasMil = true; } else total += 500000;
      i++; continue;
    }
    if (NUMS_ES[w] !== undefined) {
      const v = NUMS_ES[w];
      if (v === 100) current = current === 0 ? 100 : current * 100;
      else current += v;
    } else if (w === 'mil') {
      total += (current === 0 ? 1 : current) * 1000; current = 0; hasMil = true;
    } else if (['millon', 'millones', 'palo', 'palos'].includes(w)) {
      total += (current === 0 ? 1 : current) * 1000000; current = 0;
    } else if (['luca', 'lucas'].includes(w)) {
      total += current * 1000; current = 0; hasMil = true;
    }
  }
  total += current;
  if (total > 0 && total < 1000 && !hasMil) total *= 1000;
  return total > 0 ? total : null;
}

export function parsearVoz(transcript) {
  const norm = transcript.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  let categoria = '', cuenta = '', monto = null, movimiento = 'Egreso', tipoMov = 'Variable';

  const esIngreso = /\b(me pagaron|me entraron|me abonaron|recibi|recibí|me consignaron|ingreso|llego|llegó|cobré)\b/.test(norm);
  if (esIngreso) movimiento = 'Ingreso';
  if (/\b(arriendo|internet|luz|gas|agua|netflix|spotify|sueldo|salario|fijo|mensual)\b/.test(norm)) tipoMov = 'Fijo';

  for (const [key, val] of Object.entries(CUENTAS_VOZ).sort((a, b) => b[0].length - a[0].length)) {
    if (norm.includes(key)) { cuenta = val; break; }
  }
  for (const [key, val] of Object.entries(CATEGORIAS_VOZ).sort((a, b) => b[0].length - a[0].length)) {
    if (norm.includes(key)) { categoria = val; break; }
  }
  monto = parsearNumeroEs(norm);

  let concepto = transcript
    .replace(/\b\d[\d.,\s]*\b/g, '')
    .replace(PALABRAS_RUIDO, '')
    .replace(/\b(lucas?|palos?|mil|pesos|millon(es)?)\b/gi, '')
    .replace(/\b(nequi|tarjeta|credito|daviplata|efectivo|cash)\b/gi, '');
  Object.keys(CATEGORIAS_VOZ).forEach(k => {
    if (norm.includes(k)) concepto = concepto.replace(new RegExp(k, 'gi'), '');
  });
  concepto = concepto.replace(/\s+/g, ' ').trim();

  return { monto, categoria, cuenta, concepto, movimiento, tipoMov };
}
