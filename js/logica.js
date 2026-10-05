export function parseMoney(val) {
    if(!val) return 0;
    let clean = String(val).replace(/[^0-9.,-]/g, '');
    if(clean.indexOf('.') > -1 && clean.indexOf(',') > -1) {
        clean = clean.replace(/\./g, '').replace(',', '.');
    } else if (clean.indexOf(',') > -1) {
        clean = clean.replace(',', '.');
    }
    let res = parseFloat(clean);
    return isNaN(res) ? 0 : res;
}

export function formatearDinero(num, moneda = 'ARS') {
    if (isNaN(num) || num === null) num = 0;
    let fixed = Number(num).toFixed(2);
    let parts = fixed.split('.');
    let enteros = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    let decimales = parts[1] || '00';
    let prefix = moneda === 'USD' ? 'U$D ' : '$ ';
    return prefix + enteros + "," + decimales;
}

export function getCostoCalculado(g, dDebito, dImpuesto) {
    let gMonto = typeof g.monto === 'number' ? g.monto : parseMoney(g.monto);
    let costoArsBase = gMonto;
    
    if (g.moneda === 'USD') {
        let rate = typeof dDebito === 'number' ? dDebito : parseMoney(dDebito);
        costoArsBase = gMonto * rate;
    }
    
    let cuotasTotales = parseInt(g.cuotas_totales);
    if (isNaN(cuotasTotales) || cuotasTotales < 1) cuotasTotales = 1;
    
    return g.type === 'Tarjeta' || g.tipo === 'Tarjeta' ? (costoArsBase / cuotasTotales) : costoArsBase;
}
