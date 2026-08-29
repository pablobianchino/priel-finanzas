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
    let costoArsBase = g.monto;
    if (g.moneda === 'USD') {
        let vImp = g.monto * dImpuesto;
        costoArsBase = (vImp * 0.02) + (vImp * 0.21) + (vImp * 0.30) + (g.monto * dDebito);
    }
    return g.tipo === 'Tarjeta' ? (costoArsBase / (g.cuotas_totales || 1)) : costoArsBase;
}
