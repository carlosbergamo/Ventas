// ════════════════════════════════════════════════════════
//  DASHBOARD DE VENTAS — Code.gs
//  Backend para GitHub Pages: responde JSON vía doGet()
//  Hoja esperada: "Ventas"
//  Columnas: Fecha | Producto | Categoría | Región | Cantidad | Monto | Estado
// ════════════════════════════════════════════════════════

function doGet(e) {
  const data   = getDashboardData();
  const output = ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}

// ── Punto de entrada principal ────────────────────────
function getDashboardData() {
  try {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Ventas');

    if (!sheet) throw new Error('No se encontró la hoja "Ventas".');

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: false, error: 'La hoja no tiene datos.' };

    const data = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
    const rows = data.filter(r => r[0] !== '' && r[5] !== '');

    return {
      success:     true,
      kpis:        calcKpis(rows),
      revenue:     calcRevenuePorMes(rows),
      funnel:      calcFunnel(rows),
      topProducts: calcTopProductos(rows),
      categories:  calcCategorias(rows),
      regions:     calcRegiones(rows),
      lastUpdated: new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
    };

  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ── KPIs ──────────────────────────────────────────────
function calcKpis(rows) {
  const cerradas   = rows.filter(r => String(r[6]).toLowerCase() === 'cerrado');
  const totalMonto = cerradas.reduce((s, r) => s + Number(r[5]), 0);
  const unidades   = cerradas.reduce((s, r) => s + Number(r[4]), 0);
  const ticket     = cerradas.length > 0 ? totalMonto / cerradas.length : 0;
  const conversion = rows.length > 0 ? (cerradas.length / rows.length) * 100 : 0;

  return {
    ingresos:   formatMonto(totalMonto),
    unidades:   unidades,
    ticket:     formatMonto(ticket),
    conversion: conversion.toFixed(1)
  };
}

// ── Ingresos por mes ──────────────────────────────────
function calcRevenuePorMes(rows) {
  const meses    = {};
  const cerradas = rows.filter(r => String(r[6]).toLowerCase() === 'cerrado');

  cerradas.forEach(r => {
    const fecha = new Date(r[0]);
    if (isNaN(fecha)) return;
    const key = fecha.getFullYear() + '-' + String(fecha.getMonth() + 1).padStart(2, '0');
    meses[key] = (meses[key] || 0) + Number(r[5]);
  });

  const sorted   = Object.keys(meses).sort();
  const MESES_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  return {
    labels: sorted.map(k => {
      const [y, m] = k.split('-');
      return MESES_ES[parseInt(m) - 1] + ' ' + y.slice(2);
    }),
    values: sorted.map(k => Math.round(meses[k]))
  };
}

// ── Embudo ────────────────────────────────────────────
function calcFunnel(rows) {
  const orden  = ['Prospecto','Contactado','Calificado','Propuesta','Cerrado'];
  const conteo = {};
  orden.forEach(e => conteo[e] = 0);

  rows.forEach(r => {
    const estado = String(r[6]).trim();
    const idx    = orden.indexOf(estado);
    if (idx === -1) return;
    for (let i = 0; i <= idx; i++) conteo[orden[i]]++;
  });

  return orden.map(e => ({ label: e, val: conteo[e] }));
}

// ── Top 5 productos ───────────────────────────────────
function calcTopProductos(rows) {
  const prod     = {};
  const cerradas = rows.filter(r => String(r[6]).toLowerCase() === 'cerrado');

  cerradas.forEach(r => {
    const nombre = String(r[1]).trim();
    if (!nombre) return;
    prod[nombre] = (prod[nombre] || 0) + Number(r[5]);
  });

  return Object.entries(prod)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, rev]) => ({ name, rev: formatMonto(rev) }));
}

// ── Categorías ────────────────────────────────────────
function calcCategorias(rows) {
  const cat      = {};
  const cerradas = rows.filter(r => String(r[6]).toLowerCase() === 'cerrado');
  const total    = cerradas.reduce((s, r) => s + Number(r[5]), 0);

  cerradas.forEach(r => {
    const c = String(r[2]).trim() || 'Sin categoría';
    cat[c]  = (cat[c] || 0) + Number(r[5]);
  });

  return Object.entries(cat)
    .sort((a, b) => b[1] - a[1])
    .map(([name, val]) => ({
      name,
      pct: total > 0 ? Math.round((val / total) * 100) : 0
    }));
}

// ── Regiones ──────────────────────────────────────────
function calcRegiones(rows) {
  const reg      = {};
  const cerradas = rows.filter(r => String(r[6]).toLowerCase() === 'cerrado');
  const total    = cerradas.reduce((s, r) => s + Number(r[5]), 0);

  cerradas.forEach(r => {
    const region = String(r[3]).trim() || 'Sin región';
    reg[region]  = (reg[region] || 0) + Number(r[5]);
  });

  return Object.entries(reg)
    .sort((a, b) => b[1] - a[1])
    .map(([name, val]) => ({
      name,
      val: formatMonto(val),
      pct: total > 0 ? Math.round((val / total) * 100) : 0
    }));
}

// ── Utilidad ──────────────────────────────────────────
function formatMonto(n) {
  if (n >= 1000000) return '$' + (n / 1000000).toFixed(2) + 'M';
  if (n >= 1000)    return '$' + Math.round(n / 1000) + 'K';
  return '$' + Math.round(n).toLocaleString('es-AR');
}
