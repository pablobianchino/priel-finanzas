// Escapa texto de usuario para insertarlo en HTML (contenido o atributos)
export function esc(val) {
    return String(val ?? '').replace(/[&<>"'`]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' }[c]));
}

// Escapa texto de usuario para usarlo como argumento string dentro de un onclick="fn('...')"
export function jsq(val) {
    return esc(String(val ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, ' '));
}

export function parseMoney(val) {
    if(!val) return 0;
    let clean = String(val).replace(/[^0-9.,-]/g, '');
    const neg = clean.startsWith('-');
    clean = clean.replace(/-/g, '');
    const lastDot = clean.lastIndexOf('.'), lastComma = clean.lastIndexOf(',');
    if (lastDot > -1 && lastComma > -1) {
        // El último separador es el decimal; el otro es de miles
        if (lastComma > lastDot) clean = clean.replace(/\./g, '').replace(',', '.');
        else clean = clean.replace(/,/g, '');
    } else if (lastComma > -1) {
        clean = clean.split(',').length > 2 ? clean.replace(/,/g, '') : clean.replace(',', '.');
    } else if (lastDot > -1) {
        // Solo puntos: "1.500" o "1.234.567" son miles (formato es-AR); "12.5" es decimal
        if (/^\d{1,3}(\.\d{3})+$/.test(clean)) clean = clean.replace(/\./g, '');
    }
    if (neg) clean = '-' + clean;
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

export function getCostoCalculado(g, dDebito) {
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
