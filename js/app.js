import { auth, db, provider, signInWithPopup, signOut, onAuthStateChanged, doc, getDoc, setDoc, updateDoc, collection, getDocs, addDoc, deleteDoc, writeBatch } from './firebase.js';
import { parseMoney, formatearDinero, getCostoCalculado, esc, jsq } from './logica.js';

import { vistaResumen } from '../vistas/resumen.js';
import { vistaGastos } from '../vistas/gastos.js';
import { vistaIngresos } from '../vistas/ingresos.js';
import { vistaAhorros } from '../vistas/ahorros.js';
import { vistaEstadisticas } from '../vistas/estadisticas.js';
import { vistaModales } from '../vistas/modales.js';

document.getElementById('views-container').innerHTML = vistaResumen + vistaGastos + vistaIngresos + vistaAhorros + vistaEstadisticas;
document.getElementById('modals-container').innerHTML = vistaModales;

const APP_VERSION = "v2.11";
window.APP_VERSION = APP_VERSION;

const updateVersionTags = () => {
    const floatingTag = document.getElementById("floating-version");
    if(floatingTag) floatingTag.innerText = APP_VERSION;
    const sidebarTag = document.getElementById("sidebar-version");
    if(sidebarTag) sidebarTag.innerText = APP_VERSION;
};
updateVersionTags();

// GESTIÓN DE TEMA CLARO / OSCURO
window.toggleTheme = function() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    actualizarIconoTema(isDark);
};

function actualizarIconoTema(isDark) {
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) btn.innerHTML = isDark ? '<i class="ti ti-sun"></i>' : '<i class="ti ti-moon"></i>';
}

const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
    actualizarIconoTema(true);
} else {
    actualizarIconoTema(false);
}

const mesSelector = document.getElementById('mes-selector');
const anioSelector = document.getElementById('anio-selector');
const colorPalette = ['#4285F4', '#EA4335', '#FBBC05', '#34A853', '#9C27B0', '#00BCD4', '#FF9800', '#795548', '#8BC34A', '#E91E63', '#3F51B5'];

const today = new Date();
const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
const currentYear = String(today.getFullYear());

mesSelector.value = currentMonth;
// Años disponibles: 4 hacia atrás y 1 hacia adelante, para poder navegar con las flechas del período
for (let y = parseInt(currentYear) - 4; y <= parseInt(currentYear) + 1; y++) {
    if (!Array.from(anioSelector.options).some(opt => opt.value === String(y))) anioSelector.add(new Option(String(y), String(y)));
}
anioSelector.value = currentYear;

// Flechas ‹ › del período: mueve el mes (y el año si hace falta)
window.cambiarPeriodo = function(delta) {
    let m = parseInt(mesSelector.value) + delta, a = parseInt(anioSelector.value);
    if (m < 1) { m = 12; a--; } else if (m > 12) { m = 1; a++; }
    const cambioAnio = String(a) !== anioSelector.value;
    if (!Array.from(anioSelector.options).some(opt => opt.value === String(a))) {
        anioSelector.add(new Option(String(a), String(a)));
        Array.from(anioSelector.options).sort((x, y) => x.value - y.value).forEach(opt => anioSelector.add(opt));
    }
    mesSelector.value = String(m).padStart(2, '0');
    anioSelector.value = String(a);
    (cambioAnio ? anioSelector : mesSelector).dispatchEvent(new Event('change'));
};

// Panel único de cotización del dólar (chip "MEP" de la barra superior)
window.abrirModalMep = function() { document.getElementById('modal-mep').style.display = 'flex'; };
function actualizarChipMep() {
    const el = document.getElementById('mep-chip-text');
    if (!el) return;
    const mep = parseFloat(document.getElementById('usd-mep')?.dataset.raw || 0);
    el.innerText = mep > 0 ? `MEP ${window.formatearDinero(mep).replace('$ ', '')}` : 'MEP sin cargar';
}
window.recalcularMepTarjeta = function() {
    const mep = window.parseMoney(document.getElementById('usd-mep').value);
    const com = parseFloat(document.getElementById('usd-comision-mep').value) || 0;
    const deb = Math.round(mep * (1 + com / 100) * 100) / 100;
    const el = document.getElementById('usd-debito');
    el.dataset.raw = deb; el.value = window.formatearDinero(deb, 'ARS');
};

let totalGastosGlobal = 0, subtotalTerceros = 0, totalIngresosGlobal = 0, deudaFuturaTotal = 0;
let aCobrarPorPersona = {};
const totalACobrar = () => Object.values(aCobrarPorPersona).reduce((s, v) => s + v, 0);
let listaGastos = [], listaIngresos = [];
let chartResumen = null, chartIngresos = null, chartEstadisticas = null;

let gruposDistribucion = {};
let tiposGastoAsociaciones = {}; 
let ordenPanelesGasto = [];
let cuentasAhorro = []; 
let historialAhorros = [];
let sumPorGrupo = {};
let sumatoriaGastosPorOrigen = {};
let debounceTimer;
let autoguardadoPendiente = false;
let sortablePaneles = null;

window.parseMoney = parseMoney;
window.formatearDinero = formatearDinero;

window.onMoneyBlur = function(el, monedaOverride) {
    let moneda = monedaOverride || 'ARS';
    if (el.id === 'gasto-monto') {
        moneda = document.getElementById('gasto-moneda').value;
    }
    let val = window.parseMoney(el.value);
    el.dataset.raw = val;
    el.value = window.formatearDinero(val, moneda);
};

window.onMoneyFocus = function(el) {
    let raw = el.dataset.raw;
    if(raw !== undefined && raw !== "") {
        el.value = String(raw).replace('.', ',');
    } else {
        el.value = "";
    }
};

window.mostrarCargando = function(show, text = "Cargando datos...") { 
    const el = document.getElementById('loading-screen');
    const txt = document.getElementById('loading-text');
    if (txt && text) txt.innerText = text;
    if (el) el.style.display = show ? 'flex' : 'none'; 
}
window.cerrarModal = function(id) { document.getElementById(id).style.display = 'none'; }

window.toggleCard = function(headerEl) {
    const content = headerEl.nextElementSibling;
    const icon = headerEl.querySelector('.toggle-icon');
    if (content.style.display === 'none') {
        content.style.display = 'block';
        if(icon) icon.innerText = '▼';
    } else {
        content.style.display = 'none';
        if(icon) icon.innerText = '▶';
    }
};

window.togglePanelGasto = function(toggleEl) {
    const content = toggleEl.closest('.card').querySelector('.card-content');
    const icon = toggleEl.querySelector('.toggle-icon');
    if (content.style.display === 'none') {
        content.style.display = 'block';
        if(icon) icon.innerText = '▼';
    } else {
        content.style.display = 'none';
        if(icon) icon.innerText = '▶';
    }
};

window.toggleIngresoDetalle = function(id) {
    const tr = document.getElementById(`detalle-ingreso-${id}`);
    const icon = document.getElementById(`icon-ingreso-${id}`);
    const abrir = tr.style.display === 'none';
    tr.style.display = abrir ? 'table-row' : 'none';
    if (icon) icon.className = abrir ? 'ti ti-chevron-down' : 'ti ti-chevron-right';
}

window.filtrarGastosIngreso = function(id, text) {
    const filter = text.toLowerCase();
    const list = document.getElementById(`lista-gastos-ingreso-${id}`);
    if (!list) return;
    const items = list.querySelectorAll('.gasto-item-origen');
    items.forEach(item => {
        const name = item.getAttribute('data-nombre');
        item.style.display = name.includes(filter) ? 'flex' : 'none';
    });
}

window.toggleSidebar = function() { 
    if(window.innerWidth <= 1024) {
        document.getElementById('sidebar').classList.toggle('open'); 
        document.getElementById('sidebar-overlay').classList.toggle('open');
    } else {
        document.getElementById('sidebar').classList.toggle('desktop-closed');
    }
};

window.switchView = async function(viewId, element) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.nav-btn-bottom').forEach(b => b.classList.remove('active'));
    
    document.getElementById(viewId).classList.add('active');
    
    document.querySelectorAll(`.nav-btn[onclick*="'${viewId}'"]`).forEach(b => b.classList.add('active'));
    document.querySelectorAll(`.nav-btn-bottom[onclick*="'${viewId}'"]`).forEach(b => b.classList.add('active'));

    let rawTitle = element.querySelector('.text') ? element.querySelector('.text').innerText : element.innerText;
    document.getElementById('view-title').innerText = rawTitle.replace(/[^\p{L}\p{N}\s\/.]/gu, '').replace(/\s+/g, ' ').trim();
    
    if(window.innerWidth <= 1024 && document.getElementById('sidebar').classList.contains('open')) {
        window.toggleSidebar();
    }
    if (viewId === 'estadisticas') await cargarEstadisticasAnuales();
};

document.getElementById('login-btn-main').addEventListener('click', () => {
    signInWithPopup(auth, provider).catch((error) => {
        alert("Error de inicio de sesión. Si estás en local con archivo (file://) debes subirlo a Vercel.");
    });
});
document.getElementById('logout-btn').addEventListener('click', (e) => { e.preventDefault(); signOut(auth); });
document.getElementById('logout-btn-mobile').addEventListener('click', (e) => { e.preventDefault(); signOut(auth); });

let ultimaCarga = Date.now();

onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
        document.getElementById('user-email').innerText = user.email;
        document.getElementById('logout-btn').style.display = 'inline-block';
        window.mostrarCargando(false);
        actualizarDashboard(false);
    } else {
        document.getElementById('app-container').style.display = 'none';
        document.getElementById('login-screen').style.display = 'flex';
        window.mostrarCargando(false);
    }
});

// Refresco silencioso e inteligente al volver a la app (móvil y web)
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && auth.currentUser) {
        const ahora = Date.now();
        if (ahora - ultimaCarga > 45000) {
            actualizarDashboard(false);
        }
    }
});
window.addEventListener('focus', () => {
    if (auth.currentUser && Date.now() - ultimaCarga > 45000) {
        actualizarDashboard(false);
    }
});

mesSelector.addEventListener('change', () => actualizarDashboard(true));
anioSelector.addEventListener('change', () => {
    actualizarDashboard(true);
    if (document.getElementById('estadisticas').classList.contains('active')) cargarEstadisticasAnuales();
});

document.getElementById('filtro-texto-gastos').addEventListener('input', () => window.recargarDatosVisuales());
document.getElementById('filtro-texto-ingresos').addEventListener('input', () => window.recargarDatosVisuales());

function obtenerMesId() { return `${anioSelector.value}-${mesSelector.value}`; }

window.exportarBackupMes = async function() {
    window.mostrarCargando(true, "Generando archivo de backup...");
    try {
        let backup = { mes: obtenerMesId(), configuracion: {}, ingresos: listaIngresos, gastos: listaGastos };
        const docSnap = await getDoc(doc(db, "finanzas", obtenerMesId()));
        if(docSnap.exists()) backup.configuracion = docSnap.data().configuracion || {};
        
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup, null, 2));
        const dlAnchorElem = document.createElement('a');
        dlAnchorElem.setAttribute("href",     dataStr     );
        dlAnchorElem.setAttribute("download", `backup_finanzas_${obtenerMesId()}.json`);
        dlAnchorElem.click();
    } catch(e) { alert("Error exportando backup."); }
    window.mostrarCargando(false);
}

async function actualizarDashboard(mostrarLoader = true) {
    if (!auth.currentUser) return;
    if (mostrarLoader) window.mostrarCargando(true, "Actualizando información...");
    try {
        await cargarConfiguracion();
        await Promise.all([cargarGastosFetch(), cargarIngresosFetch()]);
        window.recargarDatosVisuales();
        ultimaCarga = Date.now();
    } catch(error) {
        console.error("Error cargando dashboard:", error);
    } finally {
        if (mostrarLoader) window.mostrarCargando(false);
    }
}

window.recargarDatosVisuales = function() {
    actualizarChipMep();
    const dDebito = parseFloat(document.getElementById('usd-debito').dataset.raw || 0);
    
    let gastosProc = procesarListaGastos(dDebito);
    calcularSaldosOrigenes(gastosProc);

    renderResumenUSD(gastosProc, dDebito);
    renderizacioDinamicaGastosPaneles(gastosProc, dDebito);
    renderTablaIngresos(gastosProc); 
    renderDistribucionDirecta(); 
    renderCuentasAhorro(); 
    calcularBalance();
}

function renderResumenUSD(gastosProc, dDebito) {
    const paneles = [
        { panel: document.getElementById('panel-resumen-usd'), contenido: document.getElementById('contenido-resumen-usd') },
        { panel: document.getElementById('panel-resumen-usd-ingresos'), contenido: document.getElementById('contenido-resumen-usd-ingresos') }
    ];

    let gastosUSD = gastosProc.filter(g => g.moneda === 'USD');
    gastosUSD.sort((a, b) => b.costoCalculado - a.costoCalculado);

    if (gastosUSD.length === 0 || dDebito <= 0) {
        paneles.forEach(p => { if(p.panel) p.panel.style.display = 'none'; });
        return;
    }

    paneles.forEach(p => { if(p.panel) p.panel.style.display = 'block'; });

    let totalUSD = 0;
    let totalARS = 0;
    
    let html = `<table style="width:100%; margin-top:0;">
                    <thead><tr><th>Gasto</th><th style="text-align:right;">U$D Mes</th><th style="text-align:right;">ARS</th></tr></thead>
                    <tbody>`;
    
    gastosUSD.forEach(g => {
        let arsReal = g.costoCalculado; 
        let usdReal = arsReal / dDebito; 

        let infoExtra = '';
        if (g.tipo === 'Tarjeta') infoExtra += ` <span style="font-size:10px; color:var(--text-muted);">(${g.cuotas_pagadas}/${g.cuotas_totales})</span>`;
        
        if (g.es_clon_origen) {
            infoExtra += ` <span style="font-size:10px; color:var(--text-muted);">(Tu parte)</span>`;
        } else if (g.propietario === 'Tercero' || g.es_clon_destino) {
            let nomTercero = g.es_clon_destino ? (g.categoria.replace('Gastos de ', '')) : (g.tercero_nombre || 'Tercero');
            infoExtra += ` <span style="font-size:10px; background:#fce8e6; color:#c5221f; padding:2px 4px; border-radius:4px; margin-left:4px;">De: ${esc(nomTercero)}</span>`;
        }

        totalUSD += usdReal;
        totalARS += arsReal;

        let targetId = g.id;
        if(g.es_clon_destino) targetId = g.id.replace('_clon', '');

        html += `<tr class="tr-clickable" onclick="window.prepararEdicionGasto('${targetId}')">
                    <td>${esc(g.nombre)}${infoExtra}</td>
                    <td style="text-align:right;">U$D ${usdReal.toFixed(2)}</td>
                    <td style="text-align:right; font-weight:600;">${window.formatearDinero(arsReal)}</td>
                 </tr>`;
    });

    html += `</tbody>
             <tfoot style="border-top: 2px solid var(--card-border);">
                <tr>
                    <td style="font-weight:bold; padding-top:10px;">TOTAL USD MES</td>
                    <td style="text-align:right; font-weight:bold; color:#174ea6; padding-top:10px;">U$D ${totalUSD.toFixed(2)}</td>
                    <td style="text-align:right; font-weight:bold; padding-top:10px;">${window.formatearDinero(totalARS)}</td>
                </tr>
             </tfoot>
           </table>`;
    
    paneles.forEach(p => { if(p.contenido) p.contenido.innerHTML = html; });
}

async function cargarGastosFetch() {
    try {
        const querySnapshot = await getDocs(collection(db, "finanzas", obtenerMesId(), "gastos"));
        listaGastos = [];
        querySnapshot.forEach(d => listaGastos.push({ id: d.id, ...d.data() }));
    } catch(e) { console.error(e); listaGastos = []; }
}

async function cargarIngresosFetch() {
    try {
        const snap = await getDocs(collection(db, "finanzas", obtenerMesId(), "ingresos"));
        listaIngresos = []; 
        snap.forEach(d => listaIngresos.push({ id: d.id, ...d.data() }));
    } catch(e) { console.error(e); listaIngresos = []; }
}

async function cargarConfiguracion() {
    try {
        const docSnap = await getDoc(doc(db, "finanzas", obtenerMesId()));
        if (docSnap.exists() && docSnap.data().configuracion) {
            const config = docSnap.data().configuracion;
            
            const suffixes = ['', '-gastos', '-ingresos', '-ahorros'];
            suffixes.forEach(s => {
                const mepEl = document.getElementById(`usd-mep${s}`);
                if (mepEl) { mepEl.dataset.raw = config.dolar_mep || 0; mepEl.value = window.formatearDinero(config.dolar_mep || 0, 'ARS'); }
                const debEl = document.getElementById(`usd-debito${s}`);
                if (debEl) { debEl.dataset.raw = config.dolar_debito || 0; debEl.value = window.formatearDinero(config.dolar_debito || 0, 'ARS'); }
                const comEl = document.getElementById(`usd-comision-mep${s}`);
                if (comEl) { comEl.value = config.dolar_comision_mep !== undefined ? config.dolar_comision_mep : 0.6; }
            });
            
            // Migración y limpieza de Grupos de Distribución (Planificación pura)
            gruposDistribucion = config.grupos_distribucion || {};
            for (let g in gruposDistribucion) {
                if (!Array.isArray(gruposDistribucion[g])) gruposDistribucion[g] = Object.values(gruposDistribucion[g]);
                gruposDistribucion[g] = (gruposDistribucion[g] || []).filter(it => it !== null).map(it => {
                    return {
                        nombre: it.nombre || "Objetivo",
                        porc: typeof it.porc === 'number' ? it.porc : (parseFloat(it.porc) || 0)
                    };
                });
            }

            let oldTipos = config.tipos_gasto || { "Fijos": [], "Tarjeta": [], "Terceros": [] };
            for(let k in oldTipos) {
                if (typeof oldTipos[k] === 'string') oldTipos[k] = oldTipos[k] !== "" ? [oldTipos[k]] : [];
                else if (!Array.isArray(oldTipos[k])) oldTipos[k] = Object.values(oldTipos[k]);
                oldTipos[k] = oldTipos[k].filter(id => id !== null && id !== undefined && id.trim() !== "");
            }
            tiposGastoAsociaciones = oldTipos;
            cuentasAhorro = config.cuentas_ahorro || [];
            ordenPanelesGasto = config.orden_paneles_gasto || [];
            historialAhorros = config.historial_ahorros || [];
        } else {
            resetConfig();
        }
        Object.keys(tiposGastoAsociaciones).forEach(cat => {
            if(!ordenPanelesGasto.includes(cat)) ordenPanelesGasto.push(cat);
        });
        window.actualizarSelectsConfig();
    } catch(e) {
        console.error(e);
        resetConfig();
    }
}

function resetConfig() {
    const suffixes = ['', '-gastos', '-ingresos', '-ahorros'];
    suffixes.forEach(s => {
        const mepEl = document.getElementById(`usd-mep${s}`);
        if (mepEl) { mepEl.dataset.raw = 0; mepEl.value = window.formatearDinero(0); }
        const debEl = document.getElementById(`usd-debito${s}`);
        if (debEl) { debEl.dataset.raw = 0; debEl.value = window.formatearDinero(0); }
        const comEl = document.getElementById(`usd-comision-mep${s}`);
        if (comEl) { comEl.value = 0.6; }
    });
    gruposDistribucion = {}; tiposGastoAsociaciones = { "Fijos": [], "Tarjeta": [], "Terceros": [] }; cuentasAhorro = []; ordenPanelesGasto = []; historialAhorros = [];
}

window.actualizarSelectsConfig = function() {
    const selectIngreso = document.getElementById('ingreso-grupo');
    const selectGastoModal = document.getElementById('gasto-categoria-select');
    selectIngreso.innerHTML = '<option value="">-- Ninguno --</option>';
    for(let key in gruposDistribucion) { selectIngreso.add(new Option(key, key)); }
    selectGastoModal.innerHTML = '';
    for(let cat in tiposGastoAsociaciones) { selectGastoModal.add(new Option(cat, cat)); }
}

async function actualizarConfiguracionDB(camposUpdate) {
    const docRef = doc(db, "finanzas", obtenerMesId());
    try {
        await updateDoc(docRef, camposUpdate);
    } catch(e) {
        // Solo se crea el documento si realmente no existe; cualquier otro error (permisos, red) se propaga
        if (e && e.code && e.code !== 'not-found') throw e;
        const fullConfig = {
            configuracion: {
                dolar_mep: parseFloat(document.getElementById('usd-mep').dataset.raw || 0),
                dolar_debito: parseFloat(document.getElementById('usd-debito').dataset.raw || 0),
                dolar_comision_mep: parseFloat(document.getElementById('usd-comision-mep')?.value || 0.6),
                grupos_distribucion: gruposDistribucion,
                tipos_gasto: tiposGastoAsociaciones,
                cuentas_ahorro: cuentasAhorro,
                orden_paneles_gasto: ordenPanelesGasto,
                historial_ahorros: historialAhorros
            }
        };
        // Los cambios solicitados ("configuracion.x") tienen prioridad sobre el estado en pantalla
        for (const [clave, valor] of Object.entries(camposUpdate)) {
            const campo = clave.replace(/^configuracion\./, '');
            fullConfig.configuracion[campo] = valor;
        }
        await setDoc(docRef, fullConfig, { merge: true });
    }
}

function procesarListaGastos(dDebito) {
    let arr = [];
    totalGastosGlobal = 0; subtotalTerceros = 0; deudaFuturaTotal = 0; aCobrarPorPersona = {};
    if(!listaGastos) return arr;
    
    listaGastos.forEach(g => {
        let cuotaTotal = getCostoCalculado(g, dDebito);

        if (g.compartir_con && g.compartir_tipo && g.propietario === 'Propio') {
            let miParte = g.compartir_tipo === 'divisor' ? (cuotaTotal / (g.divisor || 2)) : (g.monto_fijo || 0);
            let suParte = cuotaTotal - miParte;

            arr.push({ ...g, costoCalculado: miParte, es_clon_origen: true });
            arr.push({ ...g, id: g.id + '_clon', categoria: "Gastos de " + g.compartir_con.trim(), propietario: "Tercero", costoCalculado: suParte, es_clon_destino: true });

            if (g.tipo === 'Tarjeta' && (g.cuotas_totales || 1) > (g.cuotas_pagadas || 1)) deudaFuturaTotal += (miParte * (g.cuotas_totales - g.cuotas_pagadas));
            totalGastosGlobal += miParte; subtotalTerceros += suParte;
            // Lo que pagás vos por la otra persona y te debe
            const persona = g.compartir_con.trim();
            aCobrarPorPersona[persona] = (aCobrarPorPersona[persona] || 0) + suParte;
        } else {
            arr.push({ ...g, costoCalculado: cuotaTotal });
            if (g.propietario !== 'Tercero' && g.tipo === 'Tarjeta' && (g.cuotas_totales || 1) > (g.cuotas_pagadas || 1)) deudaFuturaTotal += (cuotaTotal * (g.cuotas_totales - (g.cuotas_pagadas || 1)));
            if (g.propietario !== 'Tercero') totalGastosGlobal += cuotaTotal;
            else subtotalTerceros += cuotaTotal;
        }
    });
    
    document.getElementById('res-gastos-fijos').innerText = window.formatearDinero(totalGastosGlobal);
    document.getElementById('sum-gastos-total').innerText = window.formatearDinero(totalGastosGlobal);
    document.getElementById('sum-gastos-terceros').innerText = window.formatearDinero(subtotalTerceros);
    document.getElementById('res-deuda-futura').innerText = window.formatearDinero(deudaFuturaTotal);
    return arr;
}

function getOrigenIdDeGasto(g) {
    if (g.ignorar_origen) return null;
    let catAsociada = g.categoria || "Fijos";
    let origenesPanel = tiposGastoAsociaciones[catAsociada] || [];
    origenesPanel = origenesPanel.filter(id => id && id.trim() !== "");
    if (origenesPanel.length === 1) return origenesPanel[0];
    if (origenesPanel.length > 1) return origenesPanel.includes(g.id_origen) ? g.id_origen : origenesPanel[0];
    return null;
}

function calcularSaldosOrigenes(gastosProc) {
    sumatoriaGastosPorOrigen = {};
    if(!gastosProc) return;
    gastosProc.forEach(g => {
        if (g.propietario === 'Tercero' && !g.es_clon_destino) return; 
        let origenId = getOrigenIdDeGasto(g);
        if (origenId) sumatoriaGastosPorOrigen[origenId] = (sumatoriaGastosPorOrigen[origenId] || 0) + g.costoCalculado;
    });
}

window.crearNuevoTipoGastoPanel = function() {
    const nombre = prompt("Ingresa el nombre para el nuevo panel de gastos:");
    if (!nombre || nombre.trim() === "") return;
    if (tiposGastoAsociaciones[nombre.trim()] !== undefined) return alert("Este panel ya existe.");
    tiposGastoAsociaciones[nombre.trim()] = []; ordenPanelesGasto.push(nombre.trim());
    window.guardarConfiguracionGlobalGlobal();
};

window.editarNombreTipoGastoPanel = async function(oldCategoria) {
    const nuevoNombre = prompt("Ingresa el nuevo nombre para este panel de gasto:", oldCategoria);
    if (!nuevoNombre || nuevoNombre.trim() === "" || nuevoNombre.trim() === oldCategoria) return;
    if (tiposGastoAsociaciones[nuevoNombre.trim()] !== undefined) return alert("Este panel ya existe.");
    window.mostrarCargando(true);
    tiposGastoAsociaciones[nuevoNombre.trim()] = tiposGastoAsociaciones[oldCategoria];
    delete tiposGastoAsociaciones[oldCategoria];
    let idx = ordenPanelesGasto.indexOf(oldCategoria);
    if(idx > -1) ordenPanelesGasto[idx] = nuevoNombre.trim();
    await actualizarConfiguracionDB({"configuracion.tipos_gasto": tiposGastoAsociaciones, "configuracion.orden_paneles_gasto": ordenPanelesGasto});
    const batch = writeBatch(db);
    let updatedCount = 0;
    listaGastos.forEach(g => {
        if ((g.categoria || "Fijos") === oldCategoria) {
            batch.update(doc(db, "finanzas", obtenerMesId(), "gastos", g.id), { categoria: nuevoNombre.trim() });
            updatedCount++;
        }
    });
    if (updatedCount > 0) await batch.commit();
    await actualizarDashboard();
};

window.eliminarTipoGastoPanel = function(categoria) {
    if (confirm(`¿Estás seguro de eliminar el panel '${categoria}'? No se borrarán los gastos asignados pero quedarán huérfanos.`)) {
        delete tiposGastoAsociaciones[categoria];
        ordenPanelesGasto = ordenPanelesGasto.filter(c => c !== categoria);
        window.guardarConfiguracionGlobalGlobal();
    }
};

window.toggleOrigenPanel = function(categoria, idOrigen, isChecked) {
    let origenes = tiposGastoAsociaciones[categoria] || [];
    origenes = origenes.filter(id => id && id.trim() !== "");
    if (isChecked) { if(!origenes.includes(idOrigen)) origenes.push(idOrigen); } 
    else { origenes = origenes.filter(id => id !== idOrigen); }
    tiposGastoAsociaciones[categoria] = origenes;
    window.guardarConfiguracionGlobalGlobal(false);
    window.recargarDatosVisuales();
}

let ultimoMepConsultado = null;

window.consultarMepEnVivo = async function(origenPanel) {
    const panels = ['resumen', 'gastos', 'ingresos', 'ahorros'];
    panels.forEach(p => {
        const infoEl = document.getElementById(`mep-live-info-${p}`);
        if (infoEl) infoEl.innerHTML = `<span style="color:#174ea6;"><i class="ti ti-clock"></i> Consultando cotización de mercado en vivo...</span>`;
    });

    try {
        // Consultar DolarApi (MEP Bolsa)
        let response = await fetch('https://dolarapi.com/v1/dolares/bolsa');
        let data = null;
        if (response.ok) {
            data = await response.json();
        } else {
            // Fallback con ArgentinaDatos o CriptoYa
            const fbResp = await fetch('https://api.argentinadatos.com/v1/cotizaciones/dolares/bolsa');
            if (fbResp.ok) {
                const fbData = await fbResp.json();
                const latest = Array.isArray(fbData) ? fbData[fbData.length - 1] : fbData;
                data = { venta: latest.venta || latest.valor, fechaActualizacion: latest.fecha };
            }
        }

        if (!data || !data.venta) {
            throw new Error("No se pudo obtener la cotización.");
        }

        const mepMercado = parseFloat(data.venta);
        ultimoMepConsultado = {
            mercado: mepMercado,
            fecha: data.fechaActualizacion ? new Date(data.fechaActualizacion).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        window.actualizarCalculoMepEnPantalla(origenPanel);
    } catch(err) {
        console.error("Error al consultar MEP en vivo:", err);
        panels.forEach(p => {
            const infoEl = document.getElementById(`mep-live-info-${p}`);
            if (infoEl) infoEl.innerHTML = `<span style="color:#c5221f;">⚠ No se pudo consultar la cotización en vivo. Intenta de nuevo en unos momentos.</span>`;
        });
    }
};

window.actualizarCalculoMepEnPantalla = function(origenPanel) {
    if (!ultimoMepConsultado) return;
    const panels = ['resumen', 'gastos', 'ingresos', 'ahorros'];
    
    // Obtener la comisión configurada en el panel activo
    const suffix = origenPanel === 'resumen' ? '' : `-${origenPanel}`;
    const comisionInp = document.getElementById(`usd-comision-mep${suffix}`);
    const comisionPct = parseFloat(comisionInp?.value || 0.6);

    // Sincronizar inputs de comisión en los demás paneles
    panels.forEach(p => {
        const s = p === 'resumen' ? '' : `-${p}`;
        const inp = document.getElementById(`usd-comision-mep${s}`);
        if (inp && inp !== comisionInp) inp.value = comisionPct;
    });

    const mepMercado = ultimoMepConsultado.mercado;
    const recargoMonto = mepMercado * (comisionPct / 100);
    const mepEfectivo = mepMercado + recargoMonto;
    ultimoMepConsultado.efectivo = mepEfectivo;
    ultimoMepConsultado.comisionPct = comisionPct;

    panels.forEach(p => {
        const infoEl = document.getElementById(`mep-live-info-${p}`);
        const btnAplicar = document.getElementById(`btn-aplicar-mep-${p}`);
        if (infoEl) {
            infoEl.innerHTML = `
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    <span><i class="ti ti-building-bank"></i> <b>Mercado (Ahorros):</b> <span style="font-weight:700; color:var(--text-main);">${window.formatearDinero(mepMercado, 'ARS')}</span></span>
                    <span style="color:var(--text-muted);">|</span>
                    <span><i class="ti ti-trending-up"></i> <b>+${comisionPct}% Broker:</b> +${window.formatearDinero(recargoMonto, 'ARS')}</span>
                    <span style="color:var(--text-muted);">➔</span>
                    <span style="background:#e6f4ea; color:#137333; padding:2px 8px; border-radius:6px; font-weight:bold; font-size:12px;">
                        MEP Compra (Gastos): ${window.formatearDinero(mepEfectivo, 'ARS')}
                    </span>
                    <span style="font-size:11px; color:var(--text-muted);">(${ultimoMepConsultado.fecha})</span>
                </div>`;
        }
        if (btnAplicar) btnAplicar.style.display = 'none';
    });

    // Rellena los campos del panel (sin guardar): el usuario revisa y toca "Guardar"
    const mepIn = document.getElementById('usd-mep'), debIn = document.getElementById('usd-debito');
    if (mepIn) { mepIn.dataset.raw = mepMercado; mepIn.value = window.formatearDinero(mepMercado, 'ARS'); }
    if (debIn) { const e = Math.round(mepEfectivo * 100) / 100; debIn.dataset.raw = e; debIn.value = window.formatearDinero(e, 'ARS'); }
};

window.aplicarMepConsultado = async function(origenPanel) {
    if (!ultimoMepConsultado || !ultimoMepConsultado.mercado) return;
    const mepMercado = ultimoMepConsultado.mercado;
    const mepEfectivo = ultimoMepConsultado.efectivo || mepMercado;
    const panels = ['resumen', 'gastos', 'ingresos', 'ahorros'];

    panels.forEach(p => {
        const s = p === 'resumen' ? '' : `-${p}`;
        const mepEl = document.getElementById(`usd-mep${s}`);
        const debEl = document.getElementById(`usd-debito${s}`);
        if (mepEl) {
            // Valuación de Cartera/Ahorros: cotización limpia de mercado (idéntica a Inviu)
            mepEl.dataset.raw = mepMercado;
            mepEl.value = window.formatearDinero(mepMercado, 'ARS');
        }
        if (debEl) {
            // Gastos / Compras: cotización efectiva con comisión de compra del broker
            debEl.dataset.raw = mepEfectivo;
            debEl.value = window.formatearDinero(mepEfectivo, 'ARS');
        }
    });

    await window.guardarConfiguracionDolar(origenPanel);
};

window.guardarConfiguracionDolar = async function(origenPanel) {
    let suffix = origenPanel === 'resumen' ? '' : `-${origenPanel}`;
    let mep = window.parseMoney(document.getElementById(`usd-mep${suffix}`).value);
    let debito = window.parseMoney(document.getElementById(`usd-debito${suffix}`).value);
    let comision = parseFloat(document.getElementById(`usd-comision-mep${suffix}`)?.value || 0.6);

    window.cerrarModal('modal-mep');
    window.mostrarCargando(true, "Guardando cotizaciones USD...");
    await actualizarConfiguracionDB({ 
        "configuracion.dolar_mep": mep, 
        "configuracion.dolar_debito": debito, 
        "configuracion.dolar_comision_mep": comision
    });
    await actualizarDashboard();
}

window.guardarConfiguracionGlobalGlobal = async function(recargarCompleto = true) {
    if(recargarCompleto) window.mostrarCargando(true);
    await actualizarConfiguracionDB({"configuracion.tipos_gasto": tiposGastoAsociaciones, "configuracion.orden_paneles_gasto": ordenPanelesGasto});
    if(recargarCompleto) await actualizarDashboard();
}

window.toggleRecurrenciaGasto = async function(id, isChecked) {
    try { await updateDoc(doc(db, "finanzas", obtenerMesId(), "gastos", id), { recurrente: isChecked }); } 
    catch(e) { console.error("Error al actualizar recurrencia:", e); }
};

window.cambiarOrigenGastoDirecto = async function(idGasto, idOrigen) {
    let gasto = listaGastos.find(g => g.id === idGasto);
    if(gasto) {
        gasto.id_origen = idOrigen;
        try {
            await updateDoc(doc(db, "finanzas", obtenerMesId(), "gastos", idGasto), { id_origen: idOrigen });
            window.recargarDatosVisuales();
        } catch(e) {}
    }
};

window.toggleIgnorarOrigenGasto = async function(idGasto, isIgnored) {
    let gasto = listaGastos.find(g => g.id === idGasto);
    if(gasto) {
        gasto.ignorar_origen = isIgnored;
        try {
            await updateDoc(doc(db, "finanzas", obtenerMesId(), "gastos", idGasto), { ignorar_origen: isIgnored });
            window.recargarDatosVisuales();
        } catch(e) {}
    }
};

window.prepararEdicionGasto = function(id) {
    let gasto = listaGastos.find(g => g.id === id);
    if (gasto) window.abrirModalEditarGasto(gasto);
};

window.prepararEdicionIngreso = function(id) {
    let ingreso = listaIngresos.find(i => i.id === id);
    if (ingreso) window.abrirModalEditarIngreso(ingreso);
};

function renderizacioDinamicaGastosPaneles(gastosProcesados, dDebito) {
    let panelesAbiertos = [];
    document.querySelectorAll('.panel-gasto-item').forEach(panel => {
        if (panel.querySelector('.card-content') && panel.querySelector('.card-content').style.display === 'block') panelesAbiertos.push(panel.getAttribute('data-categoria'));
    });

    const contenedor = document.getElementById('contenedor-dinamico-gastos');
    contenedor.innerHTML = '';
    if (sortablePaneles) sortablePaneles.destroy();

    const buscador = document.getElementById('filtro-texto-gastos').value.toLowerCase();
    let panelesData = [];

    for (let categoria in tiposGastoAsociaciones) {
        let origenesDelPanel = (tiposGastoAsociaciones[categoria] || []).filter(id => id && id.trim() !== "" && (listaIngresos || []).some(i => i.id === id));
        let matchesCatName = buscador && categoria.toLowerCase().includes(buscador);
        let itemsPanel = gastosProcesados.filter(g => {
            if ((g.categoria || "Fijos") !== categoria) return false;
            if (!buscador) return true;
            return matchesCatName || g.nombre.toLowerCase().includes(buscador);
        });

        if (buscador && !matchesCatName && itemsPanel.length === 0) continue;

        itemsPanel.sort((a, b) => b.costoCalculado - a.costoCalculado);
        let totalPanel = itemsPanel.reduce((sum, g) => sum + g.costoCalculado, 0);

        // Chips de saldo restante por cada ingreso que alimenta el panel
        let saldoHtml = origenesDelPanel.map(idInc => {
            let io = listaIngresos.find(i => i.id === idInc);
            if (!io) return '';
            let restante = io.monto - (sumatoriaGastosPorOrigen[idInc] || 0);
            return `<span class="pill ${restante < 0 ? 'bad' : 'ok'}">${esc(io.nombre)}: ${restante < 0 ? 'faltan' : 'quedan'} ${window.formatearDinero(Math.abs(restante)).replace('$ ', '')}</span>`;
        }).join('');

        panelesData.push({ categoria, totalPanel, itemsPanel, origenesDelPanel, saldoHtml });
    }

    panelesData.sort((a, b) => {
        let idxA = ordenPanelesGasto.indexOf(a.categoria), idxB = ordenPanelesGasto.indexOf(b.categoria);
        return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
    });

    panelesData.forEach(p => {
        let isOpen = panelesAbiertos.includes(p.categoria);
        let displayStyle = isOpen ? 'block' : 'none';
        let iconText = isOpen ? '▼' : '▶';

        let hasUnassociated = p.itemsPanel.some(g => !g.es_clon_destino && !g.ignorar_origen && ((p.origenesDelPanel.length > 1 && (!g.id_origen || !p.origenesDelPanel.includes(g.id_origen))) || p.origenesDelPanel.length === 0));
        let alertBadge = hasUnassociated ? `<span class="pill warn"><i class="ti ti-alert-triangle"></i>Falta origen</span>` : '';

        let itemsHTML = p.itemsPanel.map(g => {
            const editId = g.es_clon_destino ? g.id.replace('_clon', '') : g.id;
            const esTarjeta = g.tipo === 'Tarjeta';
            const esSuscripcion = esTarjeta && parseInt(g.cuotas_totales || 1) <= 1;

            // --- Gasto: nombre + detalles en una sola línea secundaria ---
            let detalles = [];
            if (g.moneda === 'USD') detalles.push(`U$D ${Number(g.monto).toFixed(2)} × ${window.formatearDinero(dDebito).replace('$ ', '')}`);
            if (g.es_clon_origen) detalles.push(`tu parte · compartido con ${esc(g.compartir_con)}`);
            else if (g.es_clon_destino) detalles.push(`parte de ${esc(g.categoria.replace('Gastos de ', ''))}`);
            else if (g.propietario === 'Tercero') detalles.push(`de ${esc(g.tercero_nombre || 'tercero')}`);
            const detalleHtml = detalles.length ? ` <span class="sub">${detalles.join(' · ')}</span>` : '';

            // --- Medio ---
            const medioHtml = esTarjeta ? `<span class="pill info">${esc(g.tarjeta || 'Tarjeta')}</span>` : `<span class="pill">Fijo</span>`;

            // --- Origen ---
            let origenHtml = '';
            if (g.es_clon_destino) {
                origenHtml = `<span class="sub">A cobrar</span>`;
            } else if (p.origenesDelPanel.length > 1) {
                const sinOrigen = !g.id_origen || !p.origenesDelPanel.includes(g.id_origen);
                origenHtml = `<select onclick="event.stopPropagation()" onchange="window.cambiarOrigenGastoDirecto('${g.id}', this.value)" style="font-size:12px; padding:3px 6px; max-width:150px; ${sinOrigen && !g.ignorar_origen ? 'border-color:var(--bad);' : ''}"><option value="" ${!g.id_origen ? 'selected' : ''}>Elegir origen</option>${p.origenesDelPanel.map(idInc => {
                    let io = listaIngresos.find(i => i.id === idInc);
                    return io ? `<option value="${io.id}" ${g.id_origen === idInc ? 'selected' : ''}>${esc(io.nombre)}</option>` : '';
                }).join('')}</select>`;
            } else if (p.origenesDelPanel.length === 1) {
                const io = listaIngresos.find(i => i.id === p.origenesDelPanel[0]);
                origenHtml = io ? esc(io.nombre) : '';
            } else {
                origenHtml = g.ignorar_origen
                    ? `<span class="sub">Sin origen (ignorado)</span>`
                    : `<span class="dn">Sin origen</span>`;
            }
            if (!g.es_clon_destino && !g.ignorar_origen && (p.origenesDelPanel.length === 0 || (p.origenesDelPanel.length > 1 && (!g.id_origen || !p.origenesDelPanel.includes(g.id_origen))))) {
                origenHtml += ` <label class="sub" style="cursor:pointer;" onclick="event.stopPropagation()"><input type="checkbox" onchange="window.toggleIgnorarOrigenGasto('${g.id}', this.checked)" style="width:12px; height:12px; vertical-align:middle;"> ignorar</label>`;
            } else if (!g.es_clon_destino && g.ignorar_origen) {
                origenHtml += ` <label class="sub" style="cursor:pointer;" onclick="event.stopPropagation()"><input type="checkbox" checked onchange="window.toggleIgnorarOrigenGasto('${g.id}', this.checked)" style="width:12px; height:12px; vertical-align:middle;"> ignorado</label>`;
            }

            // --- Cuota ---
            let cuotaHtml;
            if (esTarjeta && !esSuscripcion) cuotaHtml = `${g.cuotas_pagadas} / ${g.cuotas_totales}`;
            else cuotaHtml = `<span class="muted">${g.recurrente === false ? 'Único' : 'Mensual'}</span>`;
            const terminada = esTarjeta && !esSuscripcion && parseInt(g.cuotas_pagadas) >= parseInt(g.cuotas_totales);

            const accion = g.es_clon_destino
                ? `<i class="ti ti-lock row-act" title="Gasto compartido: se edita desde el original"></i>`
                : `<i class="ti ti-pencil row-act"></i>`;

            return `<tr class="tr-clickable" style="${terminada ? 'background-color: var(--highlight-bg);' : ''}" onclick="window.prepararEdicionGasto('${editId}')"><td>${esc(g.nombre)}${detalleHtml}</td><td>${medioHtml}</td><td>${origenHtml}</td><td class="num">${cuotaHtml}</td><td class="num">${window.formatearDinero(g.costoCalculado).replace('$ ', '')}</td><td class="num">${accion}</td></tr>`;
        }).join('');

        const checksOrigen = listaIngresos.length === 0
            ? '<div class="menu-item sub">Todavía no hay ingresos cargados.</div>'
            : listaIngresos.map(ing => `<label class="menu-item" style="padding:6px 10px;"><input type="checkbox" onchange="window.toggleOrigenPanel('${jsq(p.categoria)}', '${ing.id}', this.checked)" ${p.origenesDelPanel.includes(ing.id) ? 'checked' : ''}> ${esc(ing.nombre)}</label>`).join('');

        contenedor.innerHTML += `
            <div class="card panel-gasto-item" data-categoria="${esc(p.categoria)}">
                <div class="panel-head">
                    <div class="left">
                        <span class="drag-handle" title="Arrastrar para reordenar"><i class="ti ti-grip-vertical"></i></span>
                        <div class="card-header-toggle" onclick="window.togglePanelGasto(this)" style="margin:0; gap:8px; justify-content:flex-start; flex-wrap:wrap;">
                            <span class="toggle-icon">${iconText}</span>
                            <span class="card-title">${esc(p.categoria)}</span>
                            <span class="pill">${p.itemsPanel.length} ${p.itemsPanel.length === 1 ? 'gasto' : 'gastos'}</span>
                            ${p.saldoHtml}${alertBadge}
                        </div>
                    </div>
                    <div class="right">
                        <span class="panel-total">${window.formatearDinero(p.totalPanel)}</span>
                        <button class="btn-black btn-sec btn-sm" onclick="window.abrirModalNuevoGasto('${jsq(p.categoria)}')"><i class="ti ti-plus"></i>Gasto</button>
                        <details class="menu">
                            <summary class="btn-icon" title="Opciones del panel" aria-label="Opciones del panel"><i class="ti ti-dots"></i></summary>
                            <div class="menu-pop">
                                <button onclick="window.editarNombreTipoGastoPanel('${jsq(p.categoria)}')"><i class="ti ti-pencil"></i>Renombrar panel</button>
                                <button class="btn-danger-text" onclick="window.eliminarTipoGastoPanel('${jsq(p.categoria)}')"><i class="ti ti-trash"></i>Eliminar panel</button>
                                <hr>
                                <div class="menu-title">Ingresos que alimentan este panel</div>
                                ${checksOrigen}
                            </div>
                        </details>
                    </div>
                </div>
                <div class="card-content" style="display:${displayStyle}; margin-top:10px;">
                    <table>
                        <thead><tr><th>Gasto</th><th>Medio</th><th>Origen</th><th class="num">Cuota</th><th class="num">Costo del mes</th><th style="width:34px;"></th></tr></thead>
                        <tbody>${itemsHTML || '<tr><td colspan="6" class="sub" style="text-align:center;">No hay gastos en este panel</td></tr>'}</tbody>
                        ${p.itemsPanel.length ? `<tfoot><tr><td colspan="4">Total del panel</td><td class="num">${window.formatearDinero(p.totalPanel).replace('$ ', '')}</td><td></td></tr></tfoot>` : ''}
                    </table>
                </div>
            </div>`;
    });

    // Si la librería no cargó (sin red), el resto de la pantalla igual se renderiza
    if (typeof Sortable !== 'undefined') sortablePaneles = Sortable.create(contenedor, {
        handle: '.drag-handle', animation: 150,
        onEnd: function () {
            ordenPanelesGasto = Array.from(contenedor.querySelectorAll('.panel-gasto-item')).map(el => el.dataset.categoria);
            window.guardarConfiguracionGlobalGlobal(false);
        }
    });
}

window.abrirModalNuevoGasto = function(categoriaPredefinida = '') {
    document.getElementById('form-gasto').reset(); document.getElementById('gasto-id').value = ""; document.getElementById('titulo-modal-gasto').innerText = "Nuevo gasto"; document.getElementById('btn-eliminar-gasto').style.display = 'none';
    window.toggleTercero('gasto'); window.toggleCamposTarjeta('gasto'); document.getElementById('gasto-compartir').checked = false; window.toggleDivisor('gasto'); document.getElementById('gasto-recurrente').checked = true; 
    document.getElementById('gasto-monto').dataset.raw = ""; document.getElementById('gasto-monto-fijo').dataset.raw = "";
    
    if (categoriaPredefinida && tiposGastoAsociaciones.hasOwnProperty(categoriaPredefinida)) document.getElementById('gasto-categoria-select').value = categoriaPredefinida;
    else if (Object.keys(tiposGastoAsociaciones).length > 0) document.getElementById('gasto-categoria-select').value = Object.keys(tiposGastoAsociaciones)[0];
    
    window.actualizarOrigenesGastoModal(); document.getElementById('modal-gasto').style.display = 'flex';
}

window.abrirModalEditarGasto = function(data) {
    document.getElementById('gasto-id').value = data.id;
    document.getElementById('gasto-propietario').value = data.propietario || 'Propio';
    document.getElementById('gasto-tercero-nombre').value = data.tercero_nombre || '';
    document.getElementById('gasto-nombre').value = data.nombre;
    document.getElementById('gasto-monto').dataset.raw = data.monto;
    document.getElementById('gasto-moneda').value = data.moneda || "ARS";
    document.getElementById('gasto-monto').value = window.formatearDinero(data.monto, data.moneda);
    document.getElementById('gasto-recurrente').checked = data.recurrente !== false; 
    
    let catValue = data.categoria || "Fijos";
    if(!tiposGastoAsociaciones.hasOwnProperty(catValue)) catValue = Object.keys(tiposGastoAsociaciones)[0] || "";
    document.getElementById('gasto-categoria-select').value = catValue; document.getElementById('gasto-tipo').value = data.tipo;
    document.getElementById('titulo-modal-gasto').innerText = "Editar gasto";
    document.getElementById('btn-eliminar-gasto').style.display = 'inline-flex';

    window.toggleTercero('gasto');
    if (data.propietario !== 'Tercero') {
        if (data.compartir_con && data.compartir_con.trim() !== '') {
            document.getElementById('gasto-compartir').checked = true; document.getElementById('gasto-compartir-con').value = data.compartir_con;
            document.getElementById('gasto-compartir-tipo').value = data.compartir_tipo || 'divisor'; document.getElementById('gasto-divisor').value = data.divisor || 2;
            document.getElementById('gasto-monto-fijo').dataset.raw = data.monto_fijo || 0; document.getElementById('gasto-monto-fijo').value = window.formatearDinero(data.monto_fijo || 0, 'ARS');
        } else {
            document.getElementById('gasto-compartir').checked = false; document.getElementById('gasto-compartir-con').value = '';
        }
        window.toggleDivisor('gasto');
    }

    window.toggleCamposTarjeta('gasto');
    if (data.tipo === 'Tarjeta') {
        document.getElementById('gasto-tarjeta').value = data.tarjeta || 'VISA'; document.getElementById('gasto-cuotas-totales').value = data.cuotas_totales || 1; document.getElementById('gasto-cuotas-pagadas').value = data.cuotas_pagadas || 1;
    }

    window.actualizarOrigenesGastoModal();
    if (data.id_origen) document.getElementById('gasto-origen-select').value = data.id_origen;
    document.getElementById('modal-gasto').style.display = 'flex';
}

window.actualizarOrigenesGastoModal = function() {
    const cat = document.getElementById('gasto-categoria-select').value;
    let origenesPanel = (tiposGastoAsociaciones[cat] || []).filter(id => id && id.trim() !== "");
    const boxOrigen = document.getElementById('box-gasto-origen'), selOrigen = document.getElementById('gasto-origen-select');
    selOrigen.innerHTML = '<option value="">-- Seleccionar --</option>';
    if (origenesPanel.length > 1) {
        boxOrigen.style.display = 'block'; selOrigen.required = true;
        origenesPanel.forEach(id => { let ing = listaIngresos.find(i => i.id === id); if(ing) selOrigen.add(new Option(ing.nombre, ing.id)); });
    } else {
        boxOrigen.style.display = 'none'; selOrigen.required = false;
    }
}

window.toggleCamposTarjeta = function(prefix = 'gasto') {
    const tipo = document.getElementById(`${prefix}-tipo`).value;
    const cuotasTotales = parseInt(document.getElementById(`${prefix}-cuotas-totales`).value) || 1;
    document.getElementById(`campos-tarjeta`).style.display = tipo === 'Tarjeta' ? 'flex' : 'none';
    
    const mostrarRecurrente = tipo !== 'Tarjeta' || cuotasTotales <= 1;
    document.getElementById(`box-recurrente`).style.display = mostrarRecurrente ? 'flex' : 'none';
};

window.toggleDivisor = function(prefix = 'gasto') {
    const checked = document.getElementById(`${prefix}-compartir`).checked;
    const tComp = document.getElementById(`${prefix}-compartir-tipo`).value;
    document.getElementById(`${prefix}-compartir-con`).style.display = checked ? 'inline-block' : 'none';
    document.getElementById(`${prefix}-compartir-tipo`).style.display = checked ? 'inline-block' : 'none';
    if (checked) {
        document.getElementById(`${prefix}-compartir-con`).required = true;
        document.getElementById(`${prefix}-divisor`).style.display = tComp === 'divisor' ? 'inline-block' : 'none';
        document.getElementById(`${prefix}-monto-fijo`).style.display = tComp === 'divisor' ? 'none' : 'inline-block';
    } else {
        document.getElementById(`${prefix}-compartir-con`).required = false;
        document.getElementById(`${prefix}-divisor`).style.display = 'none'; document.getElementById(`${prefix}-monto-fijo`).style.display = 'none';
    }
};

window.toggleTercero = function(prefix = 'gasto') {
    const prop = document.getElementById(`${prefix}-propietario`).value, isTercero = prop === 'Tercero';
    document.getElementById(`${prefix}-tercero-nombre`).style.display = isTercero ? 'inline-block' : 'none';
    document.getElementById(`${prefix}-tercero-nombre`).required = isTercero;
    document.getElementById('box-compartir').style.display = isTercero ? 'none' : 'flex';
    if(isTercero) { document.getElementById(`${prefix}-compartir`).checked = false; window.toggleDivisor(prefix); }
};

// =========================================================================
// FASE 2: GESTIÓN MANUAL DE CUENTAS DE AHORRO Y MOVIMIENTOS (CONVERSIÓN MEP)
// =========================================================================

function getDolarMep() {
    const el = document.getElementById('usd-mep') || document.getElementById('usd-mep-ahorros');
    return parseFloat(el?.dataset?.raw || window.parseMoney(el?.value) || 0);
}

// Monto en dólares de un movimiento: el guardado al momento de la operación.
// Movimientos antiguos (sin monto_usd) se estiman con el MEP del mes.
function usdDeMov(m, dMepFallback) {
    const guardado = m.monto_usd;
    if (guardado !== undefined && guardado !== null && guardado !== '' && !isNaN(parseFloat(guardado))) return parseFloat(guardado);
    return dMepFallback > 0 ? ((parseFloat(m.monto) || 0) / dMepFallback) : 0;
}

function calcularTotalesCuenta(cuentaId) {
    const c = cuentasAhorro.find(acc => acc.id === cuentaId) || {};
    const dMep = getDolarMep();
    const esUsd = c.moneda === 'USD' || (c.nombre && (c.nombre.toLowerCase().includes('usd') || c.nombre.toLowerCase().includes('galileo')));
    const movs = (historialAhorros || []).filter(m => m.cuenta_id === cuentaId);
    
    let saldoAntUsd = 0;
    let saldoAntArs = 0;

    if (esUsd) {
        // Un 0 explícito en USD es válido (cuenta vaciada); solo se deriva del ARS si el campo no existe
        const tieneUsd = c.saldo_anterior_usd !== undefined && c.saldo_anterior_usd !== null && c.saldo_anterior_usd !== '';
        saldoAntUsd = tieneUsd ? (parseFloat(c.saldo_anterior_usd) || 0) : (dMep > 0 ? ((parseFloat(c.saldo_anterior) || 0) / dMep) : 0);
        saldoAntArs = dMep > 0 ? (saldoAntUsd * dMep) : (parseFloat(c.saldo_anterior) || 0);
    } else {
        saldoAntArs = parseFloat(c.saldo_anterior) || 0;
        saldoAntUsd = dMep > 0 ? (saldoAntArs / dMep) : 0;
    }

    const ingresos = movs.filter(m => m.tipo === 'ingreso').reduce((sum, m) => sum + (parseFloat(m.monto) || 0), 0);
    const retiros = movs.filter(m => m.tipo === 'retiro').reduce((sum, m) => sum + (parseFloat(m.monto) || 0), 0);
    const netoMes = ingresos - retiros;

    // Los dólares de cada movimiento quedan fijos (monto_usd guardado al momento de la operación)
    const ingresosUsd = movs.filter(m => m.tipo === 'ingreso').reduce((sum, m) => sum + usdDeMov(m, dMep), 0);
    const retirosUsd = movs.filter(m => m.tipo === 'retiro').reduce((sum, m) => sum + usdDeMov(m, dMep), 0);

    let saldoFinal = 0;
    let saldoFinalUsd = 0;

    if (esUsd) {
        saldoFinalUsd = saldoAntUsd + (ingresosUsd - retirosUsd);
        saldoFinal = dMep > 0 ? (saldoFinalUsd * dMep) : (saldoAntArs + netoMes);
    } else {
        saldoFinal = saldoAntArs + netoMes;
        saldoFinalUsd = dMep > 0 ? (saldoFinal / dMep) : 0;
    }

    return { 
        esUsd,
        saldoAnt: saldoAntArs, 
        saldoAntUsd,
        ingresos,
        retiros,
        ingresosUsd,
        retirosUsd,
        netoMes,
        saldoFinal,
        saldoFinalUsd
    };
}

window.onCambiarMonedaCuenta = function(moneda) {
    const labelBase = document.getElementById('label-saldo-base');
    if (labelBase) {
        labelBase.innerText = moneda === 'USD' ? 'Saldo Inicial / Base (Dólares):' : 'Saldo Inicial / Base (Pesos):';
    }
};

// Helpers de conversión bidireccional ARS <-> USD para Cuenta de Ahorro
window.onCuentaMontoInput = function(disparadoPor) {
    const dMep = getDolarMep();
    const inpArs = document.getElementById('cuenta-saldo-ars');
    const inpUsd = document.getElementById('cuenta-saldo-usd');
    if (!inpArs || !inpUsd) return;

    if (disparadoPor === 'ars') {
        const valArs = window.parseMoney(inpArs.value);
        inpArs.dataset.raw = valArs;
        if (dMep > 0) {
            const valUsd = valArs / dMep;
            inpUsd.dataset.raw = valUsd;
            inpUsd.value = valUsd > 0 ? valUsd.toFixed(2) : '';
        }
    } else if (disparadoPor === 'usd') {
        const valUsd = window.parseMoney(inpUsd.value);
        inpUsd.dataset.raw = valUsd;
        if (dMep > 0) {
            const valArs = valUsd * dMep;
            inpArs.dataset.raw = valArs;
            inpArs.value = valArs > 0 ? valArs.toFixed(2) : '';
        }
    }
};

window.onCuentaMontoBlur = function(disparadoPor) {
    const dMep = getDolarMep();
    const inpArs = document.getElementById('cuenta-saldo-ars');
    const inpUsd = document.getElementById('cuenta-saldo-usd');
    if (!inpArs || !inpUsd) return;

    const valArs = parseFloat(inpArs.dataset.raw || window.parseMoney(inpArs.value)) || 0;
    inpArs.dataset.raw = valArs;
    inpArs.value = window.formatearDinero(valArs, 'ARS');

    if (dMep > 0) {
        const valUsd = valArs / dMep;
        inpUsd.dataset.raw = valUsd;
        inpUsd.value = window.formatearDinero(valUsd, 'USD');
    }
};

// Helpers de conversión bidireccional ARS <-> USD para Movimientos
window.onMovimientoMontoInput = function(disparadoPor) {
    const dMep = getDolarMep();
    const inpArs = document.getElementById('movimiento-monto-ars');
    const inpUsd = document.getElementById('movimiento-monto-usd');
    if (!inpArs || !inpUsd) return;

    if (disparadoPor === 'ars') {
        const valArs = window.parseMoney(inpArs.value);
        inpArs.dataset.raw = valArs;
        if (dMep > 0) {
            const valUsd = valArs / dMep;
            inpUsd.dataset.raw = valUsd;
            inpUsd.value = valUsd > 0 ? valUsd.toFixed(2) : '';
        }
    } else if (disparadoPor === 'usd') {
        const valUsd = window.parseMoney(inpUsd.value);
        inpUsd.dataset.raw = valUsd;
        if (dMep > 0) {
            const valArs = valUsd * dMep;
            inpArs.dataset.raw = valArs;
            inpArs.value = valArs > 0 ? valArs.toFixed(2) : '';
        }
    }
};

window.onMovimientoMontoBlur = function(disparadoPor) {
    const dMep = getDolarMep();
    const inpArs = document.getElementById('movimiento-monto-ars');
    const inpUsd = document.getElementById('movimiento-monto-usd');
    if (!inpArs || !inpUsd) return;

    const valArs = parseFloat(inpArs.dataset.raw || window.parseMoney(inpArs.value)) || 0;
    inpArs.dataset.raw = valArs;
    inpArs.value = window.formatearDinero(valArs, 'ARS');

    if (dMep > 0) {
        const valUsd = valArs / dMep;
        inpUsd.dataset.raw = valUsd;
        inpUsd.value = window.formatearDinero(valUsd, 'USD');
    }
};

// Helpers de conversión bidireccional ARS <-> USD para Editar Movimientos
window.onEditMovMontoInput = function(disparadoPor) {
    const dMep = getDolarMep();
    const inpArs = document.getElementById('edit-mov-monto-ars');
    const inpUsd = document.getElementById('edit-mov-monto-usd');
    if (!inpArs || !inpUsd) return;

    if (disparadoPor === 'ars') {
        const valArs = window.parseMoney(inpArs.value);
        inpArs.dataset.raw = valArs;
        if (dMep > 0) {
            const valUsd = valArs / dMep;
            inpUsd.dataset.raw = valUsd;
            inpUsd.value = valUsd > 0 ? valUsd.toFixed(2) : '';
        }
    } else if (disparadoPor === 'usd') {
        const valUsd = window.parseMoney(inpUsd.value);
        inpUsd.dataset.raw = valUsd;
        if (dMep > 0) {
            const valArs = valUsd * dMep;
            inpArs.dataset.raw = valArs;
            inpArs.value = valArs > 0 ? valArs.toFixed(2) : '';
        }
    }
};

window.onEditMovMontoBlur = function(disparadoPor) {
    const dMep = getDolarMep();
    const inpArs = document.getElementById('edit-mov-monto-ars');
    const inpUsd = document.getElementById('edit-mov-monto-usd');
    if (!inpArs || !inpUsd) return;

    const valArs = parseFloat(inpArs.dataset.raw || window.parseMoney(inpArs.value)) || 0;
    inpArs.dataset.raw = valArs;
    inpArs.value = window.formatearDinero(valArs, 'ARS');

    if (dMep > 0) {
        const valUsd = valArs / dMep;
        inpUsd.dataset.raw = valUsd;
        inpUsd.value = window.formatearDinero(valUsd, 'USD');
    }
};

// Helpers de conversión bidireccional ARS <-> USD para Sub-Cajas
window.onSubcajaMontoInput = function(disparadoPor) {
    const dMep = getDolarMep();
    const inpArs = document.getElementById('subcaja-monto-ars');
    const inpUsd = document.getElementById('subcaja-monto-usd');
    if (!inpArs || !inpUsd) return;

    if (disparadoPor === 'ars') {
        const valArs = window.parseMoney(inpArs.value);
        inpArs.dataset.raw = valArs;
        if (dMep > 0) {
            const valUsd = valArs / dMep;
            inpUsd.dataset.raw = valUsd;
            inpUsd.value = valUsd > 0 ? valUsd.toFixed(2) : '';
        }
    } else if (disparadoPor === 'usd') {
        const valUsd = window.parseMoney(inpUsd.value);
        inpUsd.dataset.raw = valUsd;
        if (dMep > 0) {
            const valArs = valUsd * dMep;
            inpArs.dataset.raw = valArs;
            inpArs.value = valArs > 0 ? valArs.toFixed(2) : '';
        }
    }
};

window.onSubcajaMontoBlur = function(disparadoPor) {
    const dMep = getDolarMep();
    const inpArs = document.getElementById('subcaja-monto-ars');
    const inpUsd = document.getElementById('subcaja-monto-usd');
    if (!inpArs || !inpUsd) return;

    const valArs = parseFloat(inpArs.dataset.raw || window.parseMoney(inpArs.value)) || 0;
    inpArs.dataset.raw = valArs;
    inpArs.value = window.formatearDinero(valArs, 'ARS');

    if (dMep > 0) {
        const valUsd = valArs / dMep;
        inpUsd.dataset.raw = valUsd;
        inpUsd.value = window.formatearDinero(valUsd, 'USD');
    }
};

window.abrirModalSubcaja = function(cuentaId, subcajaId = null) {
    let acc = cuentasAhorro.find(c => c.id === cuentaId);
    if (!acc) return;
    const dMep = getDolarMep();
    const esUsd = acc.moneda === 'USD' || (acc.nombre && (acc.nombre.toLowerCase().includes('usd') || acc.nombre.toLowerCase().includes('galileo')));

    document.getElementById('form-subcaja').reset();
    document.getElementById('subcaja-cuenta-id').value = cuentaId;
    document.getElementById('subcaja-id').value = subcajaId || '';
    document.getElementById('subcaja-cuenta-nombre').value = `${acc.nombre} (${esUsd ? 'USD' : 'ARS'})`;

    const mepInfoEl = document.getElementById('subcaja-mep-info');
    if (mepInfoEl) {
        mepInfoEl.innerText = dMep > 0 ? `Cotiz. MEP: ${window.formatearDinero(dMep, 'ARS')}` : `MEP no configurado`;
    }

    const totales = calcularTotalesCuenta(cuentaId);
    const subcajas = acc.sub_cajas || [];
    let subcajaExistente = subcajaId ? subcajas.find(s => s.id === subcajaId) : null;

    if (subcajaExistente) {
        document.getElementById('titulo-modal-subcaja').innerText = `✏️ Editar Sub-Caja: ${subcajaExistente.nombre}`;
        document.getElementById('subcaja-nombre').value = subcajaExistente.nombre;
        document.getElementById('subcaja-color').value = subcajaExistente.color || '#1a73e8';

        let montoArs = parseFloat(subcajaExistente.monto) || 0;
        let montoUsd = parseFloat(subcajaExistente.monto_usd) || 0;

        if (esUsd && (!montoUsd || montoUsd === 0) && dMep > 0 && montoArs > 0) {
            montoUsd = montoArs / dMep;
        } else if (!esUsd && (!montoArs || montoArs === 0) && dMep > 0 && montoUsd > 0) {
            montoArs = montoUsd * dMep;
        }

        if (esUsd && montoUsd > 0 && dMep > 0) {
            montoArs = montoUsd * dMep;
        }

        document.getElementById('subcaja-monto-ars').dataset.raw = montoArs;
        document.getElementById('subcaja-monto-ars').value = window.formatearDinero(montoArs, 'ARS');
        document.getElementById('subcaja-monto-usd').dataset.raw = montoUsd;
        document.getElementById('subcaja-monto-usd').value = window.formatearDinero(montoUsd, 'USD');
    } else {
        document.getElementById('titulo-modal-subcaja').innerText = `➕ Nueva Sub-Caja en ${acc.nombre}`;
        document.getElementById('subcaja-nombre').value = '';
        document.getElementById('subcaja-color').value = '#1a73e8';
        document.getElementById('subcaja-monto-ars').dataset.raw = '0';
        document.getElementById('subcaja-monto-ars').value = window.formatearDinero(0, 'ARS');
        document.getElementById('subcaja-monto-usd').dataset.raw = '0';
        document.getElementById('subcaja-monto-usd').value = window.formatearDinero(0, 'USD');
    }

    // Calcular cuánto queda sin asignar en la cuenta
    let totalAsignadoArs = 0;
    let totalAsignadoUsd = 0;
    subcajas.forEach(s => {
        if (s.id === subcajaId) return;
        if (esUsd) {
            let sUsd = parseFloat(s.monto_usd) || (dMep > 0 ? (parseFloat(s.monto) / dMep) : 0);
            totalAsignadoUsd += sUsd;
            totalAsignadoArs += (dMep > 0 ? sUsd * dMep : (parseFloat(s.monto) || 0));
        } else {
            let sArs = parseFloat(s.monto) || 0;
            totalAsignadoArs += sArs;
            totalAsignadoUsd += (dMep > 0 ? sArs / dMep : 0);
        }
    });

    const saldoTotalCuenta = esUsd ? totales.saldoFinalUsd : totales.saldoFinal;
    const asignadoOtro = esUsd ? totalAsignadoUsd : totalAsignadoArs;
    const disponible = Math.max(0, saldoTotalCuenta - asignadoOtro);

    const infoDisp = document.getElementById('subcaja-disponible-info');
    if (infoDisp) {
        infoDisp.innerHTML = esUsd
            ? `💡 Saldo libre en la cuenta para asignar: <b>${window.formatearDinero(disponible, 'USD')}</b> (≈ ${window.formatearDinero(disponible * dMep, 'ARS')})`
            : `💡 Saldo libre en la cuenta para asignar: <b>${window.formatearDinero(disponible, 'ARS')}</b>`;
    }

    document.getElementById('modal-subcaja').style.display = 'flex';
};

window.eliminarSubcaja = async function(cuentaId, subcajaId) {
    let acc = cuentasAhorro.find(c => c.id === cuentaId);
    if (!acc) return;
    let sub = (acc.sub_cajas || []).find(s => s.id === subcajaId);
    if (!sub) return;

    if (!confirm(`¿Seguro que deseas eliminar la sub-caja '${sub.nombre}'? Su monto volverá a quedar como 'Saldo Libre' en la cuenta madre.`)) return;

    acc.sub_cajas = (acc.sub_cajas || []).filter(s => s.id !== subcajaId);
    window.mostrarCargando(true);
    await actualizarConfiguracionDB({
        "configuracion.cuentas_ahorro": cuentasAhorro
    });
    await actualizarDashboard();
};

document.getElementById('form-subcaja').addEventListener('submit', async (e) => {
    e.preventDefault();
    const cuentaId = document.getElementById('subcaja-cuenta-id').value;
    const subcajaId = document.getElementById('subcaja-id').value;
    const nombre = document.getElementById('subcaja-nombre').value.trim();
    const color = document.getElementById('subcaja-color').value || '#1a73e8';
    const inpArs = document.getElementById('subcaja-monto-ars');
    const inpUsd = document.getElementById('subcaja-monto-usd');
    const dMep = getDolarMep();

    if (!nombre) return alert("Por favor ingresa un nombre para la sub-caja.");

    let acc = cuentasAhorro.find(c => c.id === cuentaId);
    if (!acc) return alert("Cuenta madre no encontrada.");
    const esUsd = acc.moneda === 'USD' || (acc.nombre && (acc.nombre.toLowerCase().includes('usd') || acc.nombre.toLowerCase().includes('galileo')));

    let montoArs = parseFloat(inpArs.dataset.raw || window.parseMoney(inpArs.value)) || 0;
    let montoUsd = parseFloat(inpUsd.dataset.raw || window.parseMoney(inpUsd.value)) || 0;

    if (esUsd && dMep > 0 && (!montoArs || montoArs === 0)) {
        montoArs = montoUsd * dMep;
    } else if (!esUsd && dMep > 0 && (!montoUsd || montoUsd === 0)) {
        montoUsd = montoArs / dMep;
    }

    if (!Array.isArray(acc.sub_cajas)) acc.sub_cajas = [];

    window.mostrarCargando(true);
    try {
        if (!subcajaId) {
            // Nueva sub-caja
            acc.sub_cajas.push({
                id: 'sub_' + Date.now(),
                nombre: nombre,
                monto: montoArs,
                monto_usd: montoUsd,
                color: color
            });
        } else {
            // Edición
            let sub = acc.sub_cajas.find(s => s.id === subcajaId);
            if (sub) {
                sub.nombre = nombre;
                sub.monto = montoArs;
                sub.monto_usd = montoUsd;
                sub.color = color;
            }
        }

        await actualizarConfiguracionDB({
            "configuracion.cuentas_ahorro": cuentasAhorro
        });

        window.cerrarModal('modal-subcaja');
        await actualizarDashboard();
    } catch(err) {
        console.error("Error guardando sub-caja:", err);
        alert("Error al guardar la sub-caja: " + err.message);
        window.mostrarCargando(false);
    }
});

window.crearCuentaAhorro = function() {
    const dMep = getDolarMep();
    document.getElementById('form-cuenta-ahorro').reset();
    document.getElementById('cuenta-ahorro-id').value = "";
    document.getElementById('titulo-modal-cuenta-ahorro').innerText = "➕ Nueva Cuenta de Ahorro";
    
    document.getElementById('cuenta-moneda').value = "ARS";
    window.onCambiarMonedaCuenta("ARS");

    document.getElementById('cuenta-saldo-ars').dataset.raw = "0";
    document.getElementById('cuenta-saldo-ars').value = window.formatearDinero(0, 'ARS');
    document.getElementById('cuenta-saldo-usd').dataset.raw = "0";
    document.getElementById('cuenta-saldo-usd').value = window.formatearDinero(0, 'USD');

    const mepInfoEl = document.getElementById('cuenta-mep-info');
    if (mepInfoEl) {
        mepInfoEl.innerText = dMep > 0 ? `Cotiz. MEP: ${window.formatearDinero(dMep, 'ARS')}` : `MEP no configurado`;
    }

    document.getElementById('modal-cuenta-ahorro').style.display = 'flex';
};

window.editarCuentaAhorro = function(id) {
    let acc = cuentasAhorro.find(c => c.id === id);
    if (!acc) return;
    const dMep = getDolarMep();

    document.getElementById('cuenta-ahorro-id').value = acc.id;
    document.getElementById('titulo-modal-cuenta-ahorro').innerText = `✏️ Editar Cuenta: ${acc.nombre}`;
    document.getElementById('cuenta-ahorro-nombre').value = acc.nombre;

    const esUsd = acc.moneda === 'USD' || (acc.nombre && (acc.nombre.toLowerCase().includes('usd') || acc.nombre.toLowerCase().includes('galileo')));
    const selectMoneda = document.getElementById('cuenta-moneda');
    if (selectMoneda) {
        selectMoneda.value = esUsd ? 'USD' : (acc.moneda || 'ARS');
    }
    window.onCambiarMonedaCuenta(selectMoneda ? selectMoneda.value : 'ARS');

    let saldoArs = parseFloat(acc.saldo_anterior) || 0;
    let saldoUsd = parseFloat(acc.saldo_anterior_usd) || 0;

    if (esUsd && (!saldoUsd || saldoUsd === 0) && dMep > 0 && saldoArs > 0) {
        saldoUsd = saldoArs / dMep;
    } else if (!esUsd && (!saldoArs || saldoArs === 0) && dMep > 0 && saldoUsd > 0) {
        saldoArs = saldoUsd * dMep;
    }

    if (esUsd && saldoUsd > 0 && dMep > 0) {
        saldoArs = saldoUsd * dMep;
    }

    document.getElementById('cuenta-saldo-ars').dataset.raw = saldoArs;
    document.getElementById('cuenta-saldo-ars').value = window.formatearDinero(saldoArs, 'ARS');

    document.getElementById('cuenta-saldo-usd').dataset.raw = saldoUsd;
    document.getElementById('cuenta-saldo-usd').value = window.formatearDinero(saldoUsd, 'USD');

    const mepInfoEl = document.getElementById('cuenta-mep-info');
    if (mepInfoEl) {
        mepInfoEl.innerText = dMep > 0 ? `Cotiz. MEP: ${window.formatearDinero(dMep, 'ARS')}` : `MEP no configurado`;
    }

    document.getElementById('modal-cuenta-ahorro').style.display = 'flex';
};

document.getElementById('form-cuenta-ahorro').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('cuenta-ahorro-id').value;
    const nombre = document.getElementById('cuenta-ahorro-nombre').value.trim();
    const moneda = document.getElementById('cuenta-moneda').value || 'ARS';
    const inpArs = document.getElementById('cuenta-saldo-ars');
    const inpUsd = document.getElementById('cuenta-saldo-usd');
    const dMep = getDolarMep();

    let saldoArs = parseFloat(inpArs.dataset.raw || window.parseMoney(inpArs.value)) || 0;
    let saldoUsd = parseFloat(inpUsd.dataset.raw || window.parseMoney(inpUsd.value)) || 0;

    if (moneda === 'USD' && dMep > 0 && (!saldoArs || saldoArs === 0)) {
        saldoArs = saldoUsd * dMep;
    } else if (moneda === 'ARS' && dMep > 0 && (!saldoUsd || saldoUsd === 0)) {
        saldoUsd = saldoArs / dMep;
    }

    if (!nombre) return alert("Por favor ingresa un nombre para la cuenta.");

    window.mostrarCargando(true);
    try {
        if (!id) {
            // Nueva cuenta
            cuentasAhorro.push({
                id: 'ah_' + Date.now(),
                nombre: nombre,
                moneda: moneda,
                depositado: false,
                saldo_anterior: saldoArs,
                saldo_anterior_usd: saldoUsd
            });
        } else {
            // Edición de cuenta existente
            let acc = cuentasAhorro.find(c => c.id === id);
            if (acc) {
                acc.nombre = nombre;
                acc.moneda = moneda;
                acc.saldo_anterior = saldoArs;
                acc.saldo_anterior_usd = saldoUsd;
            }
        }

        await actualizarConfiguracionDB({
            "configuracion.cuentas_ahorro": cuentasAhorro
        });

        window.cerrarModal('modal-cuenta-ahorro');
        await actualizarDashboard();
    } catch(err) {
        console.error("Error guardando cuenta de ahorro:", err);
        alert("Error al guardar la cuenta: " + err.message);
        window.mostrarCargando(false);
    }
});

window.borrarCuentaAhorro = function(id) {
    let acc = cuentasAhorro.find(c => c.id === id);
    if(!acc) return;
    if(!confirm(`¿Seguro que deseas eliminar la cuenta de ahorro '${acc.nombre}'? Sus movimientos en el historial se conservarán con el nombre de la cuenta.`)) return;
    cuentasAhorro = cuentasAhorro.filter(c => c.id !== id);
    window.guardarConfiguracionAhorros();
}

window.toggleDepositoCuenta = function(id) {
    let acc = cuentasAhorro.find(c => c.id === id);
    if(acc) { 
        acc.depositado = !acc.depositado; 
        window.guardarConfiguracionAhorros(); 
    }
}

window.abrirModalMovimiento = function(cuentaId, tipo) {
    let acc = cuentasAhorro.find(c => c.id === cuentaId);
    if (!acc) return;
    const dMep = getDolarMep();

    document.getElementById('form-movimiento-ahorro').reset();
    document.getElementById('movimiento-cuenta-id').value = cuentaId;
    document.getElementById('movimiento-tipo').value = tipo;
    document.getElementById('movimiento-cuenta-nombre').value = acc.nombre;

    // Sub-cajas selector
    const boxSubcaja = document.getElementById('box-movimiento-subcaja');
    const selectSubcaja = document.getElementById('movimiento-subcaja-id');
    const labelSubcaja = document.getElementById('label-movimiento-subcaja');

    if (boxSubcaja && selectSubcaja) {
        const subcajas = acc.sub_cajas || [];
        if (subcajas.length > 0) {
            boxSubcaja.style.display = 'block';
            if (labelSubcaja) {
                labelSubcaja.innerText = tipo === 'ingreso' ? 'Asignar a Sub-Caja (Opcional):' : 'Descontar de Sub-Caja (Opcional):';
            }
            selectSubcaja.innerHTML = `<option value="">-- Saldo Libre / General --</option>` + 
                subcajas.map(s => `<option value="${s.id}">${esc(s.nombre)}</option>`).join('');
        } else {
            boxSubcaja.style.display = 'none';
            selectSubcaja.innerHTML = '';
        }
    }
    
    document.getElementById('movimiento-monto-ars').dataset.raw = "";
    document.getElementById('movimiento-monto-ars').value = "";
    document.getElementById('movimiento-monto-usd').dataset.raw = "";
    document.getElementById('movimiento-monto-usd').value = "";

    const mepInfoEl = document.getElementById('movimiento-mep-info');
    if (mepInfoEl) {
        mepInfoEl.innerText = dMep > 0 ? `Cotiz. MEP: ${window.formatearDinero(dMep, 'ARS')}` : `MEP no configurado`;
    }

    const tituloEl = document.getElementById('titulo-modal-movimiento');
    const submitBtn = document.getElementById('btn-submit-movimiento');
    const ayudaEl = document.getElementById('movimiento-ayuda');

    if (tipo === 'ingreso') {
        tituloEl.innerText = `➕ Ingresar Dinero a ${acc.nombre}`;
        submitBtn.innerText = "Confirmar Ingreso";
        submitBtn.style.backgroundColor = "#137333";
        ayudaEl.innerText = "Este monto se sumará al pozo acumulado de tu cuenta de ahorro.";
    } else {
        tituloEl.innerText = `➖ Retirar Dinero de ${acc.nombre}`;
        submitBtn.innerText = "Confirmar Retiro";
        submitBtn.style.backgroundColor = "#c5221f";
        ayudaEl.innerText = "ℹ️ Al retirar, el sistema creará automáticamente un registro en tus 'Ingresos del Mes' como [Rescate - " + acc.nombre + "] sumando este dinero al Disponible para usar en tus gastos.";
    }

    document.getElementById('modal-movimiento-ahorro').style.display = 'flex';
}

document.getElementById('form-movimiento-ahorro').addEventListener('submit', async (e) => {
    e.preventDefault();
    const cuentaId = document.getElementById('movimiento-cuenta-id').value;
    const tipo = document.getElementById('movimiento-tipo').value;
    const subcajaId = document.getElementById('movimiento-subcaja-id')?.value || null;
    const inpArs = document.getElementById('movimiento-monto-ars');
    const monto = parseFloat(inpArs.dataset.raw || window.parseMoney(inpArs.value));
    const motivo = document.getElementById('movimiento-motivo').value.trim();

    if (isNaN(monto) || monto <= 0) {
        return alert("Por favor ingresa un monto válido mayor a 0 en pesos o dólares.");
    }

    let acc = cuentasAhorro.find(c => c.id === cuentaId);
    if (!acc) return alert("Cuenta no encontrada.");

    if (tipo === 'retiro') {
        const saldoActual = calcularTotalesCuenta(cuentaId).saldoFinal;
        if (monto > saldoActual + 0.01 && !confirm(`El retiro (${window.formatearDinero(monto)}) supera el saldo de la cuenta (${window.formatearDinero(saldoActual)}). ¿Continuar igual?`)) return;
    }

    window.mostrarCargando(true);
    const movId = 'mov_' + Date.now();
    let idIngresoGenerado = null;

    // Se fijan los dólares del movimiento y el MEP de este momento (no cambian si luego se mueve la cotización)
    const dMepMov = getDolarMep();
    const inpUsdMov = document.getElementById('movimiento-monto-usd');
    let montoUsdMov = window.parseMoney(inpUsdMov ? inpUsdMov.value : 0);
    if (!(montoUsdMov > 0) || Math.abs(montoUsdMov * dMepMov - monto) > Math.max(1, monto * 0.01)) {
        montoUsdMov = dMepMov > 0 ? monto / dMepMov : null;
    }

    try {
        let subcajaNombre = '';
        if (subcajaId && Array.isArray(acc.sub_cajas)) {
            let sub = acc.sub_cajas.find(s => s.id === subcajaId);
            if (sub) {
                subcajaNombre = sub.nombre;
                const esUsd = acc.moneda === 'USD' || (acc.nombre && (acc.nombre.toLowerCase().includes('usd') || acc.nombre.toLowerCase().includes('galileo')));
                const montoUsd = montoUsdMov || 0;

                if (tipo === 'ingreso') {
                    sub.monto = (parseFloat(sub.monto) || 0) + monto;
                    if (esUsd) sub.monto_usd = (parseFloat(sub.monto_usd) || 0) + montoUsd;
                } else if (tipo === 'retiro') {
                    sub.monto = Math.max(0, (parseFloat(sub.monto) || 0) - monto);
                    if (esUsd) sub.monto_usd = Math.max(0, (parseFloat(sub.monto_usd) || 0) - montoUsd);
                }
            }
        }

        if (tipo === 'retiro') {
            // INYECCIÓN A DISPONIBLE: Se crea automáticamente el registro en la colección de ingresos del mes
            const rescueName = subcajaNombre ? `[Rescate - ${acc.nombre} / ${subcajaNombre}]` : `[Rescate - ${acc.nombre}]`;
            const docRef = await addDoc(collection(db, "finanzas", obtenerMesId(), "ingresos"), {
                nombre: rescueName,
                monto: monto,
                grupo: "",
                es_rescate: true,
                origen_movimiento_id: movId
            });
            idIngresoGenerado = docRef.id;
        }

        const nuevoMov = {
            id: movId,
            fecha: new Date().toLocaleString(),
            tipo: tipo,
            accion: tipo === 'ingreso' ? 'Ingreso' : 'Retiro',
            cuenta_id: cuentaId,
            cuenta: acc.nombre,
            subcaja_id: subcajaId,
            subcaja: subcajaNombre,
            monto: monto,
            monto_usd: montoUsdMov,
            tc: dMepMov > 0 ? dMepMov : null,
            motivo: motivo || (subcajaNombre ? `${tipo === 'ingreso' ? 'Aporte a' : 'Rescate de'} ${subcajaNombre}` : (tipo === 'ingreso' ? 'Aporte a cuenta de ahorro' : 'Rescate para disponible')),
            id_ingreso_generado: idIngresoGenerado
        };

        if (!Array.isArray(historialAhorros)) historialAhorros = [];
        historialAhorros.unshift(nuevoMov);

        await actualizarConfiguracionDB({
            "configuracion.cuentas_ahorro": cuentasAhorro,
            "configuracion.historial_ahorros": historialAhorros
        });

        window.cerrarModal('modal-movimiento-ahorro');
        await actualizarDashboard();
    } catch(err) {
        console.error("Error al registrar movimiento:", err);
        alert("Ocurrió un error al registrar el movimiento: " + err.message);
        window.mostrarCargando(false);
    }
});

window.abrirModalHistorial = function() {
    const container = document.getElementById('historial-lista');
    container.innerHTML = '';
    
    if(!historialAhorros || historialAhorros.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding: 20px;">No hay movimientos registrados en este mes.</p>';
    } else {
        const dMep = getDolarMep();
        historialAhorros.forEach(h => {
            const esIngreso = h.tipo === 'ingreso' || (h.accion && h.accion.toLowerCase().includes('ingreso')) || (h.accion && h.accion.toLowerCase().includes('ahorrado'));
            const badgeClass = esIngreso ? 'badge-mov-ingreso' : 'badge-mov-retiro';
            const badgeText = esIngreso ? '🟢 Ingreso' : '🔴 Retiro';
            const montoColor = esIngreso ? '#137333' : '#c5221f';
            const prefixSign = esIngreso ? '+' : '-';
            const detalleExtra = h.motivo || h.objetivo || '';
            const rescateNotice = h.id_ingreso_generado ? `<span style="font-size:10px; color:#174ea6; display:block; margin-top:2px;">↳ Inyectado como Ingreso disponible</span>` : '';
            const usdMov = usdDeMov(h, dMep);
            const usdConversion = usdMov > 0 ? `<span style="font-size:11px; color:var(--text-muted); display:block; text-align:right;">U$D ${usdMov.toFixed(2)}${h.tc ? ` · MEP ${window.formatearDinero(h.tc)}` : ''}</span>` : '';

            container.innerHTML += `
                <div style="border-bottom: 1px solid var(--card-border); padding: 12px 0; display:flex; justify-content:space-between; align-items:center; gap: 10px;">
                    <div style="flex: 1;">
                        <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                            <span class="badge-mov ${badgeClass}">${badgeText}</span>
                            <span style="font-size:11px; color:var(--text-muted);">${esc(h.fecha)}</span>
                        </div>
                        <div style="font-weight:600; font-size:14px; color:var(--text-main);">${esc(h.cuenta || 'Cuenta')}</div>
                        ${detalleExtra ? `<div style="font-size:12px; color:var(--text-muted);">${esc(detalleExtra)}</div>` : ''}
                        ${rescateNotice}
                    </div>
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div>
                            <div style="font-weight:bold; font-size:15px; color:${montoColor}; white-space:nowrap;">${prefixSign} ${window.formatearDinero(h.monto)}</div>
                            ${usdConversion}
                        </div>
                        <div style="display:flex; gap:4px;">
                            <button class="btn-icon" onclick="window.abrirModalEditarMovimiento('${h.id}')" title="Editar monto/motivo"><i class="ti ti-pencil"></i></button>
                            <button class="btn-icon" onclick="window.eliminarMovimientoAhorro('${h.id}')" title="Eliminar movimiento"><i class="ti ti-trash"></i></button>
                        </div>
                    </div>
                </div>`;
        });
    }
    document.getElementById('modal-historial').style.display = 'flex';
}

// Aplica a la sub-caja del movimiento un cambio de monto (delta > 0 suma, < 0 resta), en ARS
function ajustarSubcajaPorMovimiento(mov, deltaArs, deltaUsd) {
    if (!mov.subcaja_id || (!deltaArs && !deltaUsd)) return false;
    const acc = cuentasAhorro.find(c => c.id === mov.cuenta_id);
    const sub = acc && Array.isArray(acc.sub_cajas) ? acc.sub_cajas.find(s => s.id === mov.subcaja_id) : null;
    if (!sub) return false;
    const esUsd = acc.moneda === 'USD' || (acc.nombre && (acc.nombre.toLowerCase().includes('usd') || acc.nombre.toLowerCase().includes('galileo')));
    sub.monto = Math.max(0, (parseFloat(sub.monto) || 0) + deltaArs);
    if (esUsd) sub.monto_usd = Math.max(0, (parseFloat(sub.monto_usd) || 0) + (deltaUsd || 0));
    return true;
}

window.abrirModalEditarMovimiento = function(movId) {
    const mov = (historialAhorros || []).find(m => m.id === movId);
    if (!mov) return;
    const dMep = getDolarMep();

    document.getElementById('edit-mov-id').value = mov.id;
    document.getElementById('edit-mov-cuenta').value = `${mov.cuenta} (${mov.tipo === 'ingreso' ? 'Ingreso' : 'Retiro'})`;
    
    document.getElementById('edit-mov-monto-ars').dataset.raw = mov.monto;
    document.getElementById('edit-mov-monto-ars').value = window.formatearDinero(mov.monto, 'ARS');

    // Se muestran los dólares fijados al momento del movimiento, no los del MEP de hoy
    const usdVal = usdDeMov(mov, dMep);
    document.getElementById('edit-mov-monto-usd').dataset.raw = usdVal;
    document.getElementById('edit-mov-monto-usd').value = window.formatearDinero(usdVal, 'USD');

    const mepInfoEl = document.getElementById('edit-mov-mep-info');
    if (mepInfoEl) {
        mepInfoEl.innerText = dMep > 0 ? `Cotiz. MEP: ${window.formatearDinero(dMep, 'ARS')}` : `MEP no configurado`;
    }

    document.getElementById('edit-mov-motivo').value = mov.motivo || mov.objetivo || '';
    
    const ayudaEl = document.getElementById('edit-mov-ayuda');
    if (mov.id_ingreso_generado) {
        ayudaEl.innerText = "ℹ️ Al actualizar este monto, se sincronizará automáticamente el ingreso [Rescate - " + mov.cuenta + "] correspondiente en tus Ingresos del Mes.";
    } else {
        ayudaEl.innerText = "";
    }

    document.getElementById('modal-editar-movimiento').style.display = 'flex';
}

document.getElementById('form-editar-movimiento').addEventListener('submit', async (e) => {
    e.preventDefault();
    const movId = document.getElementById('edit-mov-id').value;
    const inpArs = document.getElementById('edit-mov-monto-ars');
    const nuevoMonto = window.parseMoney(inpArs.value);
    const nuevoMotivo = document.getElementById('edit-mov-motivo').value.trim();

    if (isNaN(nuevoMonto) || nuevoMonto <= 0) {
        return alert("Por favor ingresa un monto válido mayor a 0.");
    }

    const mov = (historialAhorros || []).find(m => m.id === movId);
    if (!mov) return;

    window.mostrarCargando(true);
    try {
        const signo = mov.tipo === 'ingreso' ? 1 : -1;
        const dMepEdit = getDolarMep();
        const usdViejo = usdDeMov(mov, dMepEdit);
        let usdNuevo = usdViejo;
        if (Math.abs(nuevoMonto - mov.monto) > 0.005) {
            // Si cambió el monto, se recalculan los dólares (lo tipeado en USD o, si no, al MEP actual)
            const usdTipeado = window.parseMoney(document.getElementById('edit-mov-monto-usd').value);
            usdNuevo = (usdTipeado > 0 && Math.abs(usdTipeado * dMepEdit - nuevoMonto) <= Math.max(1, nuevoMonto * 0.01)) ? usdTipeado : (dMepEdit > 0 ? nuevoMonto / dMepEdit : usdViejo);
            mov.tc = dMepEdit > 0 ? dMepEdit : (mov.tc || null);
        }
        const huboSub = ajustarSubcajaPorMovimiento(mov, (nuevoMonto - mov.monto) * signo, (usdNuevo - usdViejo) * signo);
        mov.monto = nuevoMonto;
        mov.monto_usd = usdNuevo;
        mov.motivo = nuevoMotivo;

        // Si fue un retiro que generó un ingreso en el mes, sincronizar monto en Firestore
        if (mov.id_ingreso_generado) {
            try {
                await updateDoc(doc(db, "finanzas", obtenerMesId(), "ingresos", mov.id_ingreso_generado), {
                    monto: nuevoMonto
                });
            } catch(eIgnored) {}
        }

        const upd = { "configuracion.historial_ahorros": historialAhorros };
        if (huboSub) upd["configuracion.cuentas_ahorro"] = cuentasAhorro;
        await actualizarConfiguracionDB(upd);

        window.cerrarModal('modal-editar-movimiento');
        await actualizarDashboard();
        window.abrirModalHistorial();
    } catch(err) {
        console.error("Error al editar movimiento:", err);
        alert("Error al actualizar la transacción: " + err.message);
        window.mostrarCargando(false);
    }
});

window.eliminarMovimientoAhorro = async function(movId) {
    const mov = (historialAhorros || []).find(m => m.id === movId);
    if (!mov) return;

    const confirmMsg = mov.id_ingreso_generado 
        ? `¿Seguro que deseas eliminar este retiro de ${window.formatearDinero(mov.monto)}? También se eliminará el registro de Ingreso generado en el mes.`
        : `¿Seguro que deseas eliminar este movimiento de ${window.formatearDinero(mov.monto)}?`;

    if (!confirm(confirmMsg)) return;

    window.mostrarCargando(true);
    try {
        // Si generó un ingreso en el mes, eliminarlo de la colección de ingresos
        if (mov.id_ingreso_generado) {
            try {
                await deleteDoc(doc(db, "finanzas", obtenerMesId(), "ingresos", mov.id_ingreso_generado));
            } catch(eIgnored) {}
        }

        // Revertir el efecto que tuvo el movimiento sobre su sub-caja
        const huboSub = ajustarSubcajaPorMovimiento(mov, -mov.monto * (mov.tipo === 'ingreso' ? 1 : -1), -usdDeMov(mov, getDolarMep()) * (mov.tipo === 'ingreso' ? 1 : -1));
        historialAhorros = historialAhorros.filter(m => m.id !== movId);

        const upd = { "configuracion.historial_ahorros": historialAhorros };
        if (huboSub) upd["configuracion.cuentas_ahorro"] = cuentasAhorro;
        await actualizarConfiguracionDB(upd);

        await actualizarDashboard();
        window.abrirModalHistorial();
    } catch(err) {
        console.error("Error al eliminar movimiento:", err);
        alert("Error al eliminar la transacción: " + err.message);
        window.mostrarCargando(false);
    }
};

window.guardarConfiguracionAhorros = async function() {
    window.mostrarCargando(true);
    await actualizarConfiguracionDB({ 
        "configuracion.cuentas_ahorro": cuentasAhorro, 
        "configuracion.grupos_distribucion": gruposDistribucion, 
        "configuracion.historial_ahorros": historialAhorros 
    });
    await actualizarDashboard();
}

function renderCuentasAhorro() {
    const cont = document.getElementById('contenedor-cuentas-ahorro');
    cont.innerHTML = '';
    const dMep = parseFloat(document.getElementById('usd-mep').dataset.raw || 0);

    let totalAhorrosHistorico = 0;
    let totalNetoMes = 0;
    let htmlResumen = '';

    let cuentasCalculadas = cuentasAhorro.map(c => {
        const totales = calcularTotalesCuenta(c.id);
        return {
            ...c,
            ...totales
        };
    }).sort((a, b) => b.saldoFinal - a.saldoFinal);

    cuentasCalculadas.forEach(c => {
        totalAhorrosHistorico += c.saldoFinal;
        totalNetoMes += c.netoMes;

        let netoTag = '';
        if (c.netoMes > 0) {
            netoTag = `<span style="font-size:11px; color:#137333; font-weight:600;"> (+${window.formatearDinero(c.netoMes)})</span>`;
        } else if (c.netoMes < 0) {
            netoTag = `<span style="font-size:11px; color:#c5221f; font-weight:600;"> (${window.formatearDinero(c.netoMes)})</span>`;
        }

        const netoCelda = Math.abs(c.netoMes) < 0.005 ? '<span class="muted">—</span>'
            : `<span class="${c.netoMes > 0 ? 'up' : 'dn'}">${c.netoMes > 0 ? '+' : '−'}${window.formatearDinero(Math.abs(c.netoMes)).replace('$ ', '')}</span>`;
        htmlResumen += `
            <tr>
                <td>${esc(c.nombre)}${c.depositado ? ' <i class="ti ti-circle-check up" title="Conciliada"></i>' : ''}</td>
                <td style="text-align:center;"><span class="pill ${c.esUsd ? 'info' : ''}">${c.esUsd ? 'USD' : 'ARS'}</span></td>
                <td class="num">${c.esUsd ? window.formatearDinero(c.saldoFinalUsd, 'USD').replace('U$D ', '') : window.formatearDinero(c.saldoFinal).replace('$ ', '')}</td>
                <td class="num">${window.formatearDinero(c.saldoFinal).replace('$ ', '')}</td>
                <td class="num">${netoCelda}</td>
            </tr>`;

        const monedaBadge = c.esUsd 
            ? `<span style="font-size:10px; background:#e8f0fe; color:#174ea6; padding:2px 6px; border-radius:4px; font-weight:700; border:1px solid #c2e7ff; margin-left:5px;">USD</span>`
            : `<span style="font-size:10px; background:#f1f3f4; color:#5f6368; padding:2px 6px; border-radius:4px; font-weight:600; margin-left:5px;">ARS</span>`;

        let saldoAntDisplay = c.esUsd 
            ? `${window.formatearDinero(c.saldoAntUsd, 'USD')} <span style="font-size:11px; color:var(--text-muted);">(${window.formatearDinero(c.saldoAnt, 'ARS')})</span>`
            : `${window.formatearDinero(c.saldoAnt, 'ARS')}`;

        let saldoFinalHtml = '';
        if (c.esUsd) {
            saldoFinalHtml = `
                <div class="value" style="color:#174ea6; font-size:24px; margin-top:2px;">${window.formatearDinero(c.saldoFinalUsd, 'USD')}</div>
                <div style="font-size:13px; color:var(--text-main); font-weight:600; margin-top:3px;">≈ ${window.formatearDinero(c.saldoFinal, 'ARS')} <span style="font-size:11px; color:var(--text-muted); font-weight:normal;">(al MEP actual)</span></div>
            `;
        } else {
            saldoFinalHtml = `
                <div class="value" style="color:${c.depositado ? '#137333' : '#673ab7'}; font-size:24px; margin-top:2px;">${window.formatearDinero(c.saldoFinal, 'ARS')}</div>
                ${dMep > 0 ? `<div style="font-size:13px; color:var(--text-muted); margin-top:3px;">≈ ${window.formatearDinero(c.saldoFinalUsd, 'USD')}</div>` : ''}
            `;
        }

        // Cálculo de Sub-Cajas y Estructura en Árbol
        const subcajas = c.sub_cajas || [];
        let totalSubcajasArs = 0;
        let totalSubcajasUsd = 0;

        subcajas.forEach(s => {
            let sArs = 0;
            let sUsd = 0;
            if (c.esUsd) {
                sUsd = parseFloat(s.monto_usd) || (dMep > 0 ? (parseFloat(s.monto) / dMep) : 0);
                sArs = dMep > 0 ? (sUsd * dMep) : (parseFloat(s.monto) || 0);
            } else {
                sArs = parseFloat(s.monto) || 0;
                sUsd = dMep > 0 ? (sArs / dMep) : 0;
            }
            totalSubcajasArs += sArs;
            totalSubcajasUsd += sUsd;
        });

        const saldoBaseTotal = c.esUsd ? c.saldoFinalUsd : c.saldoFinal;
        const asignadoTotal = c.esUsd ? totalSubcajasUsd : totalSubcajasArs;
        const libreMonto = Math.max(0, saldoBaseTotal - asignadoTotal);
        const libreArs = c.esUsd ? (libreMonto * dMep) : libreMonto;
        const libreUsd = c.esUsd ? libreMonto : (dMep > 0 ? libreMonto / dMep : 0);

        let progressBarSegments = '';
        let treeBranchesHtml = '';

        subcajas.forEach(s => {
            let sMonto = c.esUsd ? (parseFloat(s.monto_usd) || (dMep > 0 ? parseFloat(s.monto)/dMep : 0)) : (parseFloat(s.monto) || 0);
            let sArs = c.esUsd ? (sMonto * dMep) : sMonto;
            let sUsd = c.esUsd ? sMonto : (dMep > 0 ? sMonto / dMep : 0);
            let porc = saldoBaseTotal > 0 ? Math.min(100, (sMonto / saldoBaseTotal) * 100) : 0;
            let sColor = s.color || '#1a73e8';

            progressBarSegments += `<div class="subcajas-progress-segment" style="width: ${porc}%; background-color: ${sColor};" title="${esc(s.nombre)}: ${porc.toFixed(1)}%"></div>`;

            let sMontoDisplay = c.esUsd 
                ? `${window.formatearDinero(sUsd, 'USD')}`
                : `${window.formatearDinero(sArs, 'ARS')}`;
            
            let sSecDisplay = c.esUsd
                ? `≈ ${window.formatearDinero(sArs, 'ARS')} (${porc.toFixed(1)}%)`
                : (dMep > 0 ? `≈ ${window.formatearDinero(sUsd, 'USD')} (${porc.toFixed(1)}%)` : `${porc.toFixed(1)}%`);

            treeBranchesHtml += `
                <div class="subcaja-branch">
                    <div class="subcaja-card">
                        <div class="subcaja-info">
                            <span class="subcaja-dot" style="background-color: ${sColor};"></span>
                            <span class="subcaja-name" title="${esc(s.nombre)}">${esc(s.nombre)}</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div class="subcaja-values">
                                <span class="subcaja-amount">${sMontoDisplay}</span>
                                <span class="subcaja-secondary">${sSecDisplay}</span>
                            </div>
                            <div style="display: flex; gap: 2px;">
                                <button class="btn-icon" onclick="window.abrirModalSubcaja('${c.id}', '${s.id}')" title="Editar Sub-Caja" style="font-size: 11px; padding: 2px 4px;"><i class="ti ti-pencil"></i></button>
                                <button class="btn-icon" onclick="window.eliminarSubcaja('${c.id}', '${s.id}')" title="Eliminar Sub-Caja" style="font-size: 11px; padding: 2px 4px;"><i class="ti ti-trash"></i></button>
                            </div>
                        </div>
                    </div>
                </div>`;
        });

        // Sub-caja libre/sin asignar si existe saldo remanente
        if (libreMonto > 0.01) {
            let librePorc = saldoBaseTotal > 0 ? (libreMonto / saldoBaseTotal) * 100 : 0;
            progressBarSegments += `<div class="subcajas-progress-segment" style="width: ${librePorc}%; background-color: var(--card-border);" title="Libre: ${librePorc.toFixed(1)}%"></div>`;

            let libreDisplay = c.esUsd 
                ? `${window.formatearDinero(libreUsd, 'USD')}`
                : `${window.formatearDinero(libreArs, 'ARS')}`;
            
            let libreSecDisplay = c.esUsd
                ? `≈ ${window.formatearDinero(libreArs, 'ARS')} (${librePorc.toFixed(1)}%)`
                : (dMep > 0 ? `≈ ${window.formatearDinero(libreUsd, 'USD')} (${librePorc.toFixed(1)}%)` : `${librePorc.toFixed(1)}%`);

            treeBranchesHtml += `
                <div class="subcaja-branch">
                    <div class="subcaja-card libre">
                        <div class="subcaja-info">
                            <span class="subcaja-dot" style="background-color: #9aa0a6;"></span>
                            <span class="subcaja-name" style="color: var(--text-muted); font-style: italic;"><i class="ti ti-sparkles"></i> Libre / Sin Asignar</span>
                        </div>
                        <div class="subcaja-values">
                            <span class="subcaja-amount" style="color: var(--text-muted);">${libreDisplay}</span>
                            <span class="subcaja-secondary">${libreSecDisplay}</span>
                        </div>
                    </div>
                </div>`;
        }

        let subcajasBlockHtml = `
            <div class="subcajas-container">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                    <span style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Sub-Cajas (Destinos)</span>
                    <button class="btn-black" style="font-size: 11px; padding: 2px 7px; background: var(--highlight-bg); color: var(--text-main); border: 1px solid var(--card-border);" onclick="window.abrirModalSubcaja('${c.id}')"><i class="ti ti-plus"></i> Sub-Caja</button>
                </div>
                ${subcajas.length > 0 ? `<div class="subcajas-progress-bar">${progressBarSegments}</div>` : ''}
                <div class="subcajas-tree">
                    ${treeBranchesHtml}
                </div>
            </div>`;

        cont.innerHTML += `
            <div class="card" style="${c.depositado ? 'background-color: #e6f4ea; border: 2px solid #137333;' : (c.esUsd ? 'border-top: 4px solid #174ea6;' : 'border-top: 4px solid #673ab7;')} display:flex; flex-direction:column; justify-content:space-between; gap: 15px;">
                <div>
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div style="display:flex; align-items:center; flex-wrap:wrap; cursor:pointer;" onclick="window.toggleDepositoCuenta('${c.id}')" title="Clic para marcar/desmarcar conciliado">
                            <h3 style="font-size:16px; color:var(--text-main); font-weight:600; margin:0;">
                                ${c.depositado ? '✅ ' : '⏳ '}${c.nombre}
                            </h3>
                            ${monedaBadge}
                        </div>
                        <div onclick="event.stopPropagation();">
                            <button class="btn-icon" onclick="window.editarCuentaAhorro('${c.id}')" title="Editar cuenta / saldo"><i class="ti ti-pencil"></i></button>
                            <button class="btn-icon" onclick="window.borrarCuentaAhorro('${c.id}')" title="Eliminar cuenta"><i class="ti ti-trash"></i></button>
                        </div>
                    </div>
                    
                    <div style="margin-top: 12px; display:flex; flex-direction:column; gap:4px; font-size:12px;">
                        <div style="color:var(--text-muted); display:flex; justify-content:space-between; align-items:center;">
                            <span>Saldo ant. (inicial):</span> <b>${saldoAntDisplay}</b>
                        </div>
                        ${c.ingresos > 0 ? `<div style="color:#137333; display:flex; justify-content:space-between;"><span>Ingresos del mes:</span> <b>+${c.esUsd ? window.formatearDinero(c.ingresosUsd, 'USD') + ' ' : ''}<span style="font-weight:normal;">${c.esUsd ? '(' : ''}${window.formatearDinero(c.ingresos)}${c.esUsd ? ')' : ''}</span></b></div>` : ''}
                        ${c.retiros > 0 ? `<div style="color:#c5221f; display:flex; justify-content:space-between;"><span>Retiros del mes:</span> <b>-${c.esUsd ? window.formatearDinero(c.retirosUsd, 'USD') + ' ' : ''}<span style="font-weight:normal;">${c.esUsd ? '(' : ''}${window.formatearDinero(c.retiros)}${c.esUsd ? ')' : ''}</span></b></div>` : ''}
                    </div>

                    <div style="margin-top: 15px; padding-top: 10px; border-top: 1px dashed var(--card-border);">
                        <span style="font-size:11px; color:var(--text-muted); text-transform:uppercase; font-weight:600; letter-spacing:0.5px;">Saldo Total Acumulado</span>
                        ${saldoFinalHtml}
                    </div>

                    ${subcajasBlockHtml}
                </div>

                <div style="display:flex; gap:8px; margin-top:5px;">
                    <button class="btn-ahorro-action btn-ahorro-ingresar" onclick="window.abrirModalMovimiento('${c.id}', 'ingreso')"><i class="ti ti-plus"></i> Ingresar</button>
                    <button class="btn-ahorro-action btn-ahorro-retirar" onclick="window.abrirModalMovimiento('${c.id}', 'retiro')"><i class="ti ti-minus"></i> Retirar</button>
                </div>
            </div>`;
    });

    if(cuentasCalculadas.length === 0) {
        cont.innerHTML = `<p style="color:var(--text-muted); font-size:13px; margin:20px;">No has creado Cuentas de Ahorro todavía. Haz clic en '<i class="ti ti-plus"></i> Nueva Cuenta' arriba.</p>`;
    }

    const mesTotalTxt = Math.abs(totalNetoMes) < 0.005 ? '<span class="muted">—</span>' : `<span class="${totalNetoMes > 0 ? 'up' : 'dn'}">${totalNetoMes > 0 ? '+' : '−'}${window.formatearDinero(Math.abs(totalNetoMes)).replace('$ ', '')}</span>`;
    document.getElementById('res-ahorros-list').innerHTML = htmlResumen === '' ? '<p class="sub">No hay cuentas de ahorro configuradas.</p>' : `
        <table>
            <thead><tr><th>Cuenta</th><th style="text-align:center;">Moneda</th><th class="num">Saldo</th><th class="num">Equiv. ARS</th><th class="num">Mes</th></tr></thead>
            <tbody>${htmlResumen}</tbody>
            <tfoot><tr><td>Total</td><td></td><td></td><td class="num">${window.formatearDinero(totalAhorrosHistorico).replace('$ ', '')}</td><td class="num">${mesTotalTxt}</td></tr></tfoot>
        </table>`;
    document.getElementById('sum-ahorros-total').innerHTML = `<span>${window.formatearDinero(totalAhorrosHistorico)}</span> ${dMep > 0 ? `<span style="font-size:16px; color:var(--text-muted);">U$D ${(totalAhorrosHistorico / dMep).toFixed(2)}</span>` : ''}`;
    
    let mesNetoHtml = `${window.formatearDinero(totalNetoMes)}`;
    if (totalNetoMes > 0) mesNetoHtml = `+${mesNetoHtml}`;
    document.getElementById('sum-ahorros-depositado').innerHTML = `<span style="color:${totalNetoMes >= 0 ? '#137333' : '#c5221f'}">${mesNetoHtml}</span>`;
}

// =========================================================================
// FASE 1: DISTRIBUCIÓN DE OBJETIVOS (PRESUPUESTO VISUAL)
// =========================================================================

window.crearNuevoGrupoDistribucion = function() {
    const nombre = prompt("Nombre del nuevo Grupo de Distribución (Presupuesto):");
    if (nombre && nombre.trim() !== "") {
        if (gruposDistribucion[nombre.trim()]) return alert("Este grupo ya existe.");
        gruposDistribucion[nombre.trim()] = [{ nombre: "Nuevo Objetivo", porc: 100 }];
        window.autoGuardarDistribucionEstructura(true);
    }
};

window.editarNombreGrupoDistribucion = async function(oldName) {
    const nuevoNombre = prompt("Nuevo nombre para el Grupo de Distribución:", oldName);
    if (nuevoNombre && nuevoNombre.trim() !== "" && nuevoNombre.trim() !== oldName) {
        if (gruposDistribucion[nuevoNombre.trim()] !== undefined) return alert("Este nombre de grupo ya existe.");
        window.mostrarCargando(true);
        gruposDistribucion[nuevoNombre.trim()] = gruposDistribucion[oldName];
        delete gruposDistribucion[oldName];
        const batch = writeBatch(db);
        listaIngresos.forEach(ing => { if (ing.grupo === oldName) batch.update(doc(db, "finanzas", obtenerMesId(), "ingresos", ing.id), { grupo: nuevoNombre.trim() }); });
        await batch.commit();
        await actualizarConfiguracionDB({"configuracion.grupos_distribucion": gruposDistribucion});
        await actualizarDashboard();
    }
}

window.eliminarGrupoDistribucion = function(grupoName) {
    if (confirm(`¿Estás seguro de borrar el grupo de presupuesto '${grupoName}'?`)) { 
        delete gruposDistribucion[grupoName]; 
        window.autoGuardarDistribucionEstructura(true); 
    }
};

window.agregarObjetivoLinea = function(grupoName) {
    if(!Array.isArray(gruposDistribucion[grupoName])) gruposDistribucion[grupoName] = [];
    gruposDistribucion[grupoName].push({ nombre: "Nuevo Objetivo", porc: 0 });
    window.recargarDatosVisuales(); 
    window.dispararDebounceAutoguardado();
};

window.eliminarObjetivoLinea = function(grupoName, index) {
    if (confirm("¿Seguro que deseas eliminar este objetivo?")) { 
        gruposDistribucion[grupoName].splice(index, 1); 
        window.autoGuardarDistribucionEstructura(true); 
    }
};

window.actualizarDatoObjetivoMemory = function(grupoName, index, campo, valor) {
    if (!gruposDistribucion[grupoName] || !gruposDistribucion[grupoName][index]) return;
    gruposDistribucion[grupoName][index][campo] = campo === 'porc' ? (parseFloat(window.parseMoney(valor)) || 0) : valor;
    window.dispararDebounceAutoguardado();
};

window.calcularBidireccionalLinea = function(grupoName, index, disparadoPor) {
    const totalDineroGrupo = sumPorGrupo[grupoName] || 0;
    const inpPct = document.getElementById(`pct-${grupoName}-${index}`);
    const inpPesos = document.getElementById(`pesos-${grupoName}-${index}`);
    if (!inpPct || !inpPesos) return;

    let pesosCalculados = 0;
    if (disparadoPor === 'pct') {
        let pct = parseFloat(window.parseMoney(inpPct.value)) || 0; 
        pesosCalculados = (totalDineroGrupo * (pct / 100));
        inpPesos.dataset.raw = pesosCalculados; 
        inpPesos.value = window.formatearDinero(pesosCalculados); 
        if (gruposDistribucion[grupoName] && gruposDistribucion[grupoName][index]) {
            gruposDistribucion[grupoName][index].porc = pct;
        }
    } else {
        pesosCalculados = parseFloat(window.parseMoney(inpPesos.value)) || 0; 
        let pctCalculado = totalDineroGrupo > 0 ? ((pesosCalculados / totalDineroGrupo) * 100) : 0;
        inpPct.dataset.raw = pctCalculado; 
        inpPct.value = pctCalculado.toFixed(2); 
        if (gruposDistribucion[grupoName] && gruposDistribucion[grupoName][index]) {
            gruposDistribucion[grupoName][index].porc = parseFloat(pctCalculado);
        }
    }

    const dMep = parseFloat(document.getElementById('usd-mep').dataset.raw || 0);
    const usdEl = document.getElementById(`usd-calc-${grupoName}-${index}`);
    if (usdEl && dMep > 0) {
        usdEl.innerText = `U$D ${(pesosCalculados / dMep).toFixed(2)}`;
    }

    window.dispararDebounceAutoguardado(); 
    window.recargarDatosVisuales();
};

window.dispararDebounceAutoguardado = function() {
    clearTimeout(debounceTimer);
    autoguardadoPendiente = true;
    debounceTimer = setTimeout(() => { autoguardadoPendiente = false; window.autoGuardarDistribucionEstructura(false); }, 800);
}

window.autoGuardarDistribucionEstructura = async function(recargarUI = false) {
    try {
        if(recargarUI) window.mostrarCargando(true);
        await actualizarConfiguracionDB({ 
            "configuracion.grupos_distribucion": gruposDistribucion 
        });
        if(recargarUI) await actualizarDashboard();
    } catch(e) {
        console.error("Error al autoguardar distribucion:", e);
    }
}

function renderDistribucionDirecta() {
    const divDist = document.getElementById('tabla-distribucion');
    const resDist = document.getElementById('res-ingresos-dist');
    divDist.innerHTML = '';
    const dMep = parseFloat(document.getElementById('usd-mep').dataset.raw || 0);

    let totalDistribuibleGlobal = 0;
    sumPorGrupo = {};

    if(listaIngresos) {
        listaIngresos.forEach(ing => {
            if (ing.grupo) {
                let consumido = sumatoriaGastosPorOrigen[ing.id] || 0;
                let disponible = ing.monto - consumido;
                sumPorGrupo[ing.grupo] = (sumPorGrupo[ing.grupo] || 0) + disponible;
                totalDistribuibleGlobal += disponible;
            }
        });
    }

    let resHtml = '';
    if(Object.keys(gruposDistribucion).length === 0) {
        divDist.innerHTML = '<p class="sub">No hay grupos de distribución. Creá uno con "Nuevo grupo" para presupuestar tus ingresos.</p>';
        resHtml = '<p class="sub">No hay grupos de distribución creados.</p>';
    }

    for(let grupoName in gruposDistribucion) {
        let totalGrupo = sumPorGrupo[grupoName] || 0;
        let cfgItems = Array.isArray(gruposDistribucion[grupoName]) ? gruposDistribucion[grupoName] : [];

        let sumPorcentajesGrupo = cfgItems.reduce((acc, el) => acc + (parseFloat(el && el.porc) || 0), 0);
        let pctOk = Math.abs(sumPorcentajesGrupo - 100) < 0.1;
        const faltaPct = 100 - sumPorcentajesGrupo;

        // ---- Editor (vista Ingresos): una fila por objetivo, mismo orden que en memoria ----
        let filasEdit = '';
        cfgItems.forEach((it, idx) => {
            if(!it) return;
            let pctVal = parseFloat(it.porc) || 0;
            let dineroCalculado = totalGrupo * (pctVal / 100);
            filasEdit += `
                <tr>
                    <td><input type="text" value="${esc(it.nombre)}" style="width:100%; padding:6px 8px; font-size:13px;" oninput="window.actualizarDatoObjetivoMemory('${jsq(grupoName)}', ${idx}, 'nombre', this.value)" placeholder="Nombre del objetivo"></td>
                    <td class="num"><input type="text" id="pct-${esc(grupoName)}-${idx}" value="${pctVal.toFixed(2)}" style="width:70px; padding:6px 8px; font-size:13px; text-align:right;" onblur="window.calcularBidireccionalLinea('${jsq(grupoName)}', ${idx}, 'pct')" placeholder="%"></td>
                    <td class="num"><input type="text" id="pesos-${esc(grupoName)}-${idx}" value="${window.formatearDinero(dineroCalculado)}" class="money-input" style="width:130px; padding:6px 8px; font-size:13px; text-align:right;" data-raw="${dineroCalculado}" onfocus="window.onMoneyFocus(this)" onblur="window.calcularBidireccionalLinea('${jsq(grupoName)}', ${idx}, 'pesos'); window.onMoneyBlur(this, 'ARS')" placeholder="$"></td>
                    <td class="num sub" id="usd-calc-${esc(grupoName)}-${idx}">${dMep > 0 ? `U$D ${(dineroCalculado / dMep).toFixed(2)}` : ''}</td>
                    <td class="num"><button class="btn-icon" onclick="window.eliminarObjetivoLinea('${jsq(grupoName)}', ${idx})" title="Eliminar objetivo"><i class="ti ti-trash"></i></button></td>
                </tr>`;
        });

        divDist.innerHTML += `
            <div style="border:1px solid var(--card-border); border-radius:10px; padding:12px 14px; margin-bottom:12px;">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:6px;">
                    <div style="display:flex; align-items:center; gap:6px;">
                        <span class="card-title">${esc(grupoName)}</span>
                        <button class="btn-icon" onclick="window.editarNombreGrupoDistribucion('${jsq(grupoName)}')" title="Renombrar grupo"><i class="ti ti-pencil"></i></button>
                    </div>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span class="pill ${pctOk ? 'ok' : 'bad'}" id="sum-card-pct-${esc(grupoName)}">Suma ${sumPorcentajesGrupo.toFixed(2)}%</span>
                        <span class="sub">Disponible <b style="color:var(--text-main); font-weight:600;">${window.formatearDinero(totalGrupo)}</b></span>
                        <button class="btn-icon" onclick="window.eliminarGrupoDistribucion('${jsq(grupoName)}')" title="Eliminar grupo"><i class="ti ti-trash"></i></button>
                    </div>
                </div>
                <table>
                    <thead><tr><th>Objetivo</th><th class="num">%</th><th class="num">Monto ARS</th><th class="num">USD</th><th></th></tr></thead>
                    <tbody>${filasEdit || '<tr><td colspan="5" class="sub">Sin objetivos.</td></tr>'}</tbody>
                </table>
                <button class="btn-black btn-sec btn-sm" style="margin-top:8px;" onclick="window.agregarObjetivoLinea('${jsq(grupoName)}')"><i class="ti ti-plus"></i>Objetivo</button>
            </div>`;

        // ---- Resumen (vista Resumen): tabla de solo lectura, ordenada por porcentaje ----
        const orden = cfgItems.filter(it => it).slice().sort((a, b) => (parseFloat(b.porc) || 0) - (parseFloat(a.porc) || 0));
        let filasRes = '', sumMontos = 0;
        orden.forEach(it => {
            const p = parseFloat(it.porc) || 0, m = totalGrupo * (p / 100);
            sumMontos += m;
            filasRes += `<tr><td>${esc(it.nombre)}</td><td style="width:22%;"><div class="bar"><div style="width:${Math.min(100, p)}%"></div></div></td><td class="num">${p.toFixed(1)}</td><td class="num">${window.formatearDinero(m).replace('$ ', '')}</td><td class="num sub">${dMep > 0 ? window.formatearDinero(m / dMep, 'USD').replace('U$D ', '') : ''}</td></tr>`;
        });
        resHtml += `
            <div style="${resHtml ? 'margin-top:16px;' : ''}">
                <div style="display:flex; justify-content:space-between; align-items:baseline;"><span class="card-title">${esc(grupoName)}</span><span class="sub">Disponible <b style="color:var(--text-main); font-weight:600;">${window.formatearDinero(totalGrupo)}</b></span></div>
                <table>
                    <thead><tr><th>Objetivo</th><th>Avance</th><th class="num">%</th><th class="num">ARS</th><th class="num">USD</th></tr></thead>
                    <tbody>${filasRes || '<tr><td colspan="5" class="sub">Sin objetivos.</td></tr>'}</tbody>
                    <tfoot><tr><td>Total</td><td></td><td class="num ${pctOk ? '' : 'dn'}">${sumPorcentajesGrupo.toFixed(1)}</td><td class="num">${window.formatearDinero(sumMontos).replace('$ ', '')}</td><td class="num sub">${dMep > 0 ? window.formatearDinero(sumMontos / dMep, 'USD').replace('U$D ', '') : ''}</td></tr></tfoot>
                </table>
                ${pctOk ? '' : `<div class="alert warn"><i class="ti ti-alert-triangle"></i>Los porcentajes suman ${sumPorcentajesGrupo.toFixed(1)}%. ${faltaPct > 0 ? `Falta asignar ${faltaPct.toFixed(1)}% (${window.formatearDinero(totalGrupo * faltaPct / 100)}).` : `Se pasan ${(-faltaPct).toFixed(1)}%.`}</div>`}
            </div>`;
    }

    resDist.innerHTML = resHtml;
}

// =========================================================================
// INGRESOS Y GASTOS (CRUD Y PROCESAMIENTO)
// =========================================================================

window.abrirModalNuevoIngreso = function() {
    document.getElementById('form-ingreso').reset(); 
    document.getElementById('ingreso-id').value = ""; 
    document.getElementById('titulo-modal-ingreso').innerText = "Nuevo ingreso";
    document.getElementById('btn-eliminar-ingreso').style.display = 'none';
    document.getElementById('ingreso-grupo').value = ""; 
    document.getElementById('ingreso-monto').dataset.raw = ""; 
    document.getElementById('modal-ingreso').style.display = 'flex';
}

window.abrirModalEditarIngreso = function(data) {
    document.getElementById('ingreso-id').value = data.id; 
    document.getElementById('ingreso-nombre').value = data.nombre;
    document.getElementById('ingreso-monto').dataset.raw = data.monto; 
    document.getElementById('ingreso-monto').value = window.formatearDinero(data.monto, 'ARS');
    document.getElementById('ingreso-grupo').value = data.grupo || ""; 
    document.getElementById('titulo-modal-ingreso').innerText = "Editar ingreso";
    document.getElementById('btn-eliminar-ingreso').style.display = 'inline-flex';
    document.getElementById('modal-ingreso').style.display = 'flex';
}

document.getElementById('form-gasto').addEventListener('submit', async (e) => {
    e.preventDefault(); window.mostrarCargando(true);
    const idGasto = document.getElementById('gasto-id').value, prop = document.getElementById('gasto-propietario').value, tipo = document.getElementById('gasto-tipo').value, cat = document.getElementById('gasto-categoria-select').value, isRecurrente = document.getElementById('gasto-recurrente').checked;
    const checkboxCompartir = document.getElementById('gasto-compartir').checked, compCon = document.getElementById('gasto-compartir-con').value.trim(), compTipo = document.getElementById('gasto-compartir-tipo').value;
    // Se parsea siempre el valor visible (no dataset.raw): al guardar con Enter no hay blur y raw quedaría desactualizado
    const montoGasto = window.parseMoney(document.getElementById('gasto-monto').value);
    const montoFijo = window.parseMoney(document.getElementById('gasto-monto-fijo').value);
    if (!(montoGasto > 0)) { window.mostrarCargando(false); return alert("Ingresa un monto mayor a 0."); }
    const cuotasTot = parseInt(document.getElementById('gasto-cuotas-totales').value) || 1;
    const cuotasPag = parseInt(document.getElementById('gasto-cuotas-pagadas').value) || 1;
    if (tipo === 'Tarjeta' && cuotasPag > cuotasTot) { window.mostrarCargando(false); return alert("Las cuotas pagadas no pueden superar las cuotas totales."); }

    if (prop === 'Propio' && checkboxCompartir && compCon !== '') {
        let catCompartida = "Gastos de " + compCon;
        if (tiposGastoAsociaciones[catCompartida] === undefined) {
            tiposGastoAsociaciones[catCompartida] = []; ordenPanelesGasto.push(catCompartida);
            await actualizarConfiguracionDB({ "configuracion.tipos_gasto": tiposGastoAsociaciones, "configuracion.orden_paneles_gasto": ordenPanelesGasto });
        }
    }

    let origenesPanel = (tiposGastoAsociaciones[cat] || []).filter(id => id && id.trim() !== "");
    let id_origen = origenesPanel.length > 1 ? document.getElementById('gasto-origen-select').value : (origenesPanel.length === 1 ? origenesPanel[0] : "");

    let datosGasto = { propietario: prop, tercero_nombre: prop === 'Tercero' ? document.getElementById('gasto-tercero-nombre').value : '', nombre: document.getElementById('gasto-nombre').value, monto: montoGasto, moneda: document.getElementById('gasto-moneda').value, tipo: tipo, categoria: cat, id_origen: id_origen, recurrente: isRecurrente, compartir_con: (prop === 'Propio' && checkboxCompartir) ? compCon : '', compartir_tipo: (prop === 'Propio' && checkboxCompartir) ? compTipo : 'divisor', divisor: (prop === 'Propio' && checkboxCompartir && compTipo === 'divisor') ? parseInt(document.getElementById('gasto-divisor').value) || 1 : 1, monto_fijo: (prop === 'Propio' && checkboxCompartir && compTipo === 'fijo') ? montoFijo : null };

    let oldGasto = listaGastos.find(g => g.id === idGasto);
    if(oldGasto && oldGasto.ignorar_origen !== undefined) datosGasto.ignorar_origen = oldGasto.ignorar_origen;

    if (tipo === 'Tarjeta') { datosGasto.tarjeta = document.getElementById('gasto-tarjeta').value; datosGasto.cuotas_totales = parseInt(document.getElementById('gasto-cuotas-totales').value) || 1; datosGasto.cuotas_pagadas = parseInt(document.getElementById('gasto-cuotas-pagadas').value) || 1; }

    if (idGasto) await updateDoc(doc(db, "finanzas", obtenerMesId(), "gastos", idGasto), datosGasto);
    else await addDoc(collection(db, "finanzas", obtenerMesId(), "gastos"), datosGasto);
    
    window.cerrarModal('modal-gasto'); 
    await actualizarDashboard();
});

document.getElementById('form-ingreso').addEventListener('submit', async (e) => {
    e.preventDefault(); 
    window.mostrarCargando(true);
    const id = document.getElementById('ingreso-id').value;
    const data = {
        nombre: document.getElementById('ingreso-nombre').value,
        monto: window.parseMoney(document.getElementById('ingreso-monto').value),
        grupo: document.getElementById('ingreso-grupo').value
    };
    if (!(data.monto > 0)) { window.mostrarCargando(false); return alert("Ingresa un monto mayor a 0."); }
    if(id) await updateDoc(doc(db, "finanzas", obtenerMesId(), "ingresos", id), data);
    else await addDoc(collection(db, "finanzas", obtenerMesId(), "ingresos"), data);
    window.cerrarModal('modal-ingreso'); 
    await actualizarDashboard();
});

window.borrarIngreso = async function(id) { 
    if(!confirm("¿Estás seguro de eliminar este ingreso?")) return false;
    window.mostrarCargando(true);
    await deleteDoc(doc(db, "finanzas", obtenerMesId(), "ingresos", id));
    await actualizarDashboard();
    return true;
};

// Eliminar desde el formulario de edición (el borrado ya no está en cada fila de la tabla)
window.eliminarDesdeModal = async function(tipo) {
    const id = document.getElementById(`${tipo}-id`).value;
    if (!id) return;
    const modalId = tipo === 'gasto' ? 'modal-gasto' : 'modal-ingreso';
    const borrado = tipo === 'gasto' ? await window.borrarGasto(id) : await window.borrarIngreso(id);
    if (borrado) window.cerrarModal(modalId);
};

window.borrarGasto = async function(id) {
    if(!confirm("¿Estás seguro de eliminar este gasto?")) return false;
    window.mostrarCargando(true);
    await deleteDoc(doc(db, "finanzas", obtenerMesId(), "gastos", id));
    await actualizarDashboard();
    return true;
};

function renderTablaIngresos(gastosProc) {
    const tabla = document.getElementById('tabla-ingresos'); 
    tabla.innerHTML = ''; 
    totalIngresosGlobal = 0; 
    let totalDisponibleGlobalIngresos = 0;
    let totalGastadoVisible = 0, totalBrutoVisible = 0, totalDispVisible = 0;
    let chartLabels = [];
    let chartData = []; 
    let chartColors = [];

    if (!Array.isArray(gastosProc)) {
        const dDebito = parseFloat(document.getElementById('usd-debito').dataset.raw || 0);
        gastosProc = procesarListaGastos(dDebito);
    }
    const filter = document.getElementById('filtro-texto-ingresos').value.toLowerCase();
    
    if(listaIngresos) {
        listaIngresos.sort((a, b) => b.monto - a.monto);

        listaIngresos.forEach((data, index) => {
            // El total global NO depende del buscador (alimenta Resumen y Balance)
            totalIngresosGlobal += data.monto;
            let disponibleReal = data.monto - (sumatoriaGastosPorOrigen[data.id] || 0);
            totalDisponibleGlobalIngresos += disponibleReal;
            if (filter && !data.nombre.toLowerCase().includes(filter)) return;
            let assignedColor = colorPalette[index % colorPalette.length];
            totalBrutoVisible += data.monto; totalDispVisible += disponibleReal;

            chartLabels.push(data.nombre);
            chartData.push(data.monto); 
            chartColors.push(assignedColor);

            let gastosAsociados = gastosProc.filter(g => g.propietario !== 'Tercero' && getOrigenIdDeGasto(g) === data.id);
            const trMain = document.createElement('tr'); 
            trMain.className = "tr-clickable"; 
            trMain.onclick = function() { window.prepararEdicionIngreso(data.id); };
            
            let rescateTag = data.es_rescate ? ` <span class="pill info">Rescate</span>` : '';
            const gastadoOrigen = sumatoriaGastosPorOrigen[data.id] || 0;
            if (!filter || data.nombre.toLowerCase().includes(filter)) { totalGastadoVisible += gastadoOrigen; }

            trMain.innerHTML = `<td><div style="display:flex; align-items:center; gap:8px;"><button class="btn-icon" style="padding:0 2px;" onclick="event.stopPropagation(); window.toggleIngresoDetalle('${data.id}')" aria-label="Ver gastos de este origen"><i class="ti ti-chevron-right" id="icon-ingreso-${data.id}"></i></button><span style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color:${assignedColor}; flex-shrink:0;"></span><span>${esc(data.nombre)}</span>${rescateTag}</div></td><td>${data.grupo ? `<span class="pill">${esc(data.grupo)}</span>` : '<span class="sub">Sin grupo</span>'}</td><td class="num">${window.formatearDinero(data.monto).replace('$ ', '')}</td><td class="num">${window.formatearDinero(gastadoOrigen).replace('$ ', '')}</td><td class="num ${disponibleReal < 0 ? 'dn' : 'up'}">${window.formatearDinero(disponibleReal).replace('$ ', '')}</td><td class="num"><i class="ti ti-pencil row-act"></i></td>`;
            tabla.appendChild(trMain);

            const trDetail = document.createElement('tr');
            trDetail.id = `detalle-ingreso-${data.id}`;
            trDetail.className = "details-row";
            trDetail.style.display = "none";
            trDetail.innerHTML = `<td colspan="6" style="padding: 10px 14px; background-color: var(--highlight-bg);"><div style="display: flex; gap: 10px; align-items: center; margin-bottom: 8px;"><span class="sub" style="font-weight:600;">Gastos de este origen</span><input type="text" placeholder="Buscar gasto..." style="padding: 4px 8px; font-size: 12px; width: 160px;" onkeyup="window.filtrarGastosIngreso('${data.id}', this.value)"></div><ul id="lista-gastos-ingreso-${data.id}" style="list-style: none; padding: 0; margin: 0; font-size: 12px; color: var(--text-muted); display:flex; flex-direction:column; gap:4px; max-height: 200px; overflow-y: auto;">${gastosAsociados.length > 0 ? gastosAsociados.map(g => `<li class="gasto-item-origen" data-nombre="${esc(g.nombre.toLowerCase())}"><span style="display:inline-block; width:100px; font-weight:600; color:var(--text-main);" class="num">${window.formatearDinero(g.costoCalculado)}</span> ${esc(g.nombre)} <span class="sub">(${esc(g.categoria)})</span></li>`).join('') : '<li class="sub">No hay gastos descontados de este origen</li>'}</ul></td>`;
            tabla.appendChild(trDetail);
        });
    }

    const tfIng = document.getElementById('tfoot-ingresos');
    if (tfIng) tfIng.innerHTML = listaIngresos && listaIngresos.length ? `<tr><td colspan="2">Total${filter ? ' (filtrado)' : ''}</td><td class="num">${window.formatearDinero(totalBrutoVisible).replace('$ ', '')}</td><td class="num">${window.formatearDinero(totalGastadoVisible).replace('$ ', '')}</td><td class="num ${totalDispVisible < 0 ? 'dn' : 'up'}">${window.formatearDinero(totalDispVisible).replace('$ ', '')}</td><td></td></tr>` : '';
    document.getElementById('sum-ingresos-mes').innerText = window.formatearDinero(totalIngresosGlobal);
    document.getElementById('sum-ingresos-disponible').innerText = `${window.formatearDinero(totalDisponibleGlobalIngresos)} Disp.`;
    const cobrarIng = totalACobrar();
    document.getElementById('sum-ingresos-cobrar').innerText = cobrarIng > 0.005 ? `incluye ${window.formatearDinero(cobrarIng)} a cobrar a terceros` : '';
    document.getElementById('res-ingresos-mes').innerText = window.formatearDinero(totalIngresosGlobal);
    
    if (chartIngresos) chartIngresos.destroy();
    chartIngresos = new Chart(document.getElementById('chart-ingresos-mes').getContext('2d'), { 
        type: 'pie', 
        data: { labels: chartLabels, datasets: [{ data: chartData, backgroundColor: chartColors }] }, 
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } 
    });
}

function calcularBalance() {
    // Lo aportado a cuentas de ahorro en el mes ya no está disponible (los retiros ya suman como ingreso "Rescate")
    const aportesAhorroMes = (historialAhorros || []).filter(m => m.tipo === 'ingreso').reduce((s, m) => s + (parseFloat(m.monto) || 0), 0);
    const balance = totalIngresosGlobal - totalGastosGlobal - aportesAhorroMes;
    const bElement = document.getElementById('res-balance');
    bElement.innerText = window.formatearDinero(balance);
    bElement.style.color = balance >= 0 ? '#137333' : '#d93025';

    // Neto = lo que te queda cuando los terceros te pagan. En cuenta = neto − lo que adelantaste por ellos.
    const aCobrar = totalACobrar();
    const detalle = document.getElementById('res-balance-detalle');
    if (detalle) {
        const personas = Object.entries(aCobrarPorPersona).filter(([, v]) => Math.abs(v) > 0.005)
            .map(([n, v]) => `${esc(n)}: ${window.formatearDinero(v)}`).join(' · ');
        detalle.innerHTML = aCobrar > 0.005
            ? `<div class="r"><span>En cuenta</span><b>${window.formatearDinero(balance - aCobrar)}</b></div>
               <div class="r"><span>A cobrar</span><b>${window.formatearDinero(aCobrar)}</b></div>
               <div>${personas}</div>`
            : '<div>Sin gastos compartidos pendientes de cobro</div>';
    }
    const pctEl = document.getElementById('res-gastos-pct');
    if (pctEl) pctEl.innerText = totalIngresosGlobal > 0 ? `${(totalGastosGlobal / totalIngresosGlobal * 100).toFixed(0)}% de los ingresos` : 'Sin ingresos cargados';

    if (chartResumen) chartResumen.destroy();
    chartResumen = new Chart(document.getElementById('chart-resumen').getContext('2d'), {
        type: 'pie', 
        data: { 
            labels: ['Gastos Totales', 'Disponible Libre'], 
            datasets: [{ 
                data: [totalGastosGlobal, balance > 0 ? balance : 0], 
                backgroundColor: ['#EA4335', '#34A853'] 
            }] 
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { legend: { position: 'right', labels: {boxWidth: 10, font: {size: 10}} } } 
        }
    });
}

async function cargarEstadisticasAnuales() {
    const anio = anioSelector.value; 
    const meses = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']; 
    const nombresMeses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    let ingresosData = new Array(12).fill(0), gastosData = new Array(12).fill(0), ahorrosData = new Array(12).fill(0);
    window.mostrarCargando(true);

    const promesas = meses.map(async (mes, index) => {
        const mesId = `${anio}-${mes}`; 
        const docSnap = await getDoc(doc(db, "finanzas", mesId));
        let dDebito = 0, historialMes = [];
        
        if (docSnap.exists() && docSnap.data().configuracion) {
            dDebito = docSnap.data().configuracion.dolar_debito || 0; 
            historialMes = docSnap.data().configuracion.historial_ahorros || [];
        }

        let totalGas = 0;
        const gasSnap = await getDocs(collection(db, "finanzas", mesId, "gastos"));
        gasSnap.forEach(d => {
            let g = d.data(); 
            if (g.propietario === 'Tercero') return;
            let cuotaTotal = getCostoCalculado(g, dDebito);
            let costoCalculado = cuotaTotal;
            if (g.compartir_con && g.compartir_tipo) {
                costoCalculado = g.compartir_tipo === 'divisor' ? cuotaTotal / (g.divisor || 2) : (g.monto_fijo || 0);
            }
            totalGas += costoCalculado;
        });
        gastosData[index] = totalGas;

        let totalIng = 0; 
        const ingSnap = await getDocs(collection(db, "finanzas", mesId, "ingresos"));
        ingSnap.forEach(d => { 
            let ing = d.data(); 
            totalIng += (parseFloat(ing.monto) || 0); 
        });
        ingresosData[index] = totalIng;

        let totalAhorroIngresado = 0;
        historialMes.forEach(m => {
            if (m.tipo === 'ingreso') totalAhorroIngresado += (parseFloat(m.monto) || 0);
        });
        ahorrosData[index] = totalAhorroIngresado;
    });

    await Promise.all(promesas);

    if (chartEstadisticas) chartEstadisticas.destroy();
    chartEstadisticas = new Chart(document.getElementById('chart-estadisticas').getContext('2d'), {
        type: 'bar', 
        data: { 
            labels: nombresMeses, 
            datasets: [
                { label: 'Ingresos', data: ingresosData, backgroundColor: '#34A853' }, 
                { label: 'Gastos Propios', data: gastosData, backgroundColor: '#EA4335' }, 
                { label: 'Ahorro Depositado', data: ahorrosData, backgroundColor: '#9C27B0' }
            ] 
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            scales: { y: { beginAtZero: true } }, 
            plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: function(ctx) { return `${ctx.dataset.label}: ${window.formatearDinero(ctx.parsed.y)}`; } } } }
        }
    });
    window.mostrarCargando(false);
}

window.procesarCSV = async function() {
    const input = document.getElementById('archivo-csv');
    if (!input.files || input.files.length === 0) return alert("Selecciona un CSV.");
    window.mostrarCargando(true);
    const reader = new FileReader();
    reader.onload = async function(e) {
        const rows = e.target.result.split('\n').filter(row => row.trim() !== '');
        if (rows.length <= 1) { window.mostrarCargando(false); return alert("El archivo está vacío."); }
        try {
            const batch = writeBatch(db); const ref = collection(db, "finanzas", obtenerMesId(), "gastos");
            let count = 0;
            for (let i = 1; i < rows.length; i++) {
                const col = rows[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
                if (col.length >= 4) {
                    let monto = window.parseMoney(col[1]);
                    if (!col[0] || isNaN(monto)) continue;
                    let tipo = (col[3]||'').toLowerCase().includes('tarjeta') ? 'Tarjeta' : 'Fijo';
                    batch.set(doc(ref), { propietario: 'Propio', tercero_nombre: '', nombre: col[0], monto: monto, moneda: col[2].toUpperCase() === 'USD' ? 'USD' : 'ARS', tipo: tipo, categoria: "Fijos", id_origen: "", recurrente: true, compartir_con: '', compartir_tipo: 'divisor', divisor: parseInt(col[4]) || 1, monto_fijo: null, tarjeta: tipo === 'Tarjeta' ? (col[5]||'VISA') : null, cuotas_totales: tipo === 'Tarjeta' ? (parseInt(col[6])||1) : null, cuotas_pagadas: tipo === 'Tarjeta' ? (parseInt(col[7])||1) : null });
                    count++;
                }
            }
            if (count > 0) {
                await batch.commit();
                window.cerrarModal('modal-carga-masiva');
                await actualizarDashboard();
                alert(`¡Éxito! Se cargaron ${count} gastos en lote.`);
            } else {
                window.mostrarCargando(false);
                alert("No se identificaron gastos válidos en el archivo.");
            }
        } catch(e) {
            window.mostrarCargando(false);
            alert("Error al procesar el archivo CSV.");
        }
    };
    reader.readAsText(input.files[0]);
};

// =========================================================================
// FASE 3: IMPORTACIÓN Y TRASPASO MENSUAL CON SALDOS HISTÓRICOS ABSOLUTOS
// =========================================================================

window.copiarMesAnterior = async function() {
    if(!confirm("¿Importar todos los datos, gastos recurrentes, cuotas y arrastre de saldo final de ahorros del mes anterior?")) return;
    // Protección: si este mes ya tiene datos, la importación pisa cuentas, historial de ahorros y gastos con el mismo id
    const yaHayDatos = listaGastos.length > 0 || listaIngresos.length > 0 || (historialAhorros || []).length > 0;
    if (yaHayDatos && !confirm(`Este mes (${obtenerMesId()}) YA tiene datos. Importar reemplazará las cuentas de ahorro, borrará su historial de movimientos y sobrescribirá gastos/ingresos que provengan del mes anterior. ¿Seguro que querés continuar?`)) return;
    window.mostrarCargando(true);
    let m = parseInt(mesSelector.value) - 1, a = parseInt(anioSelector.value);
    if(m === 0){ m = 12; a--; }
    const prev = `${a}-${m.toString().padStart(2, '0')}`, actual = obtenerMesId();
    
    try {
        const prevDocSnap = await getDoc(doc(db, "finanzas", prev));
        let prevData = prevDocSnap.exists() ? prevDocSnap.data() : { configuracion: {} };
        let prevConfig = prevData.configuracion || {};
        let prevTipos = prevConfig.tipos_gasto || {};
        let prevDist = prevConfig.grupos_distribucion || {};
        let prevCuentas = prevConfig.cuentas_ahorro || [];
        let prevHistorial = prevConfig.historial_ahorros || [];
        
        // 1. Limpieza de grupos de distribución para presupuesto limpio
        let cleanDist = {};
        for (let gName in prevDist) {
            let items = Array.isArray(prevDist[gName]) ? prevDist[gName] : Object.values(prevDist[gName]);
            cleanDist[gName] = items.filter(it => it !== null).map(it => ({
                nombre: it.nombre || "Objetivo",
                porc: typeof it.porc === 'number' ? it.porc : (parseFloat(it.porc) || 0)
            }));
        }

        // 2. Cálculo del Saldo Final Absoluto de cada cuenta de ahorro del mes pasado
        let dMepPrev = parseFloat(prevConfig.dolar_mep) || 0;
        let nuevasCuentas = prevCuentas.map(c => {
            let movsCuenta = prevHistorial.filter(m => m.cuenta_id === c.id);
            let ingMes = movsCuenta.filter(m => m.tipo === 'ingreso').reduce((sum, m) => sum + (parseFloat(m.monto) || 0), 0);
            let retMes = movsCuenta.filter(m => m.tipo === 'retiro').reduce((sum, m) => sum + (parseFloat(m.monto) || 0), 0);
            let saldoAnt = parseFloat(c.saldo_anterior) || 0;
            let saldoAntUsd = parseFloat(c.saldo_anterior_usd) || 0;
            let esUsd = c.moneda === 'USD' || (c.nombre && (c.nombre.toLowerCase().includes('usd') || c.nombre.toLowerCase().includes('galileo')));

            // Soporte para datos legacy si existían
            if (c.retiros) retMes += (parseFloat(c.retiros) || 0);

            let saldoFinalAbsoluto = saldoAnt + ingMes - retMes;
            let saldoFinalUsd = 0;
            if (esUsd) {
                let ingUsd = movsCuenta.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + usdDeMov(m, dMepPrev), 0);
                let retUsd = movsCuenta.filter(m => m.tipo === 'retiro').reduce((s, m) => s + usdDeMov(m, dMepPrev), 0);
                saldoFinalUsd = saldoAntUsd + ingUsd - retUsd;
            }

            // Preservar estructura de sub-cajas
            let subCajasCopiadas = (c.sub_cajas || []).map(s => ({ ...s }));

            return {
                id: c.id,
                nombre: c.nombre,
                moneda: esUsd ? 'USD' : (c.moneda || 'ARS'),
                depositado: false,
                saldo_anterior: saldoFinalAbsoluto,
                saldo_anterior_usd: saldoFinalUsd,
                sub_cajas: subCajasCopiadas
            };
        });

        // 3. Preparar nueva configuración para el mes
        let nuevaConfiguracion = {
            dolar_mep: prevConfig.dolar_mep || 0,
            dolar_debito: prevConfig.dolar_debito || 0,
            tipos_gasto: prevTipos,
            orden_paneles_gasto: prevConfig.orden_paneles_gasto || Object.keys(prevTipos),
            grupos_distribucion: cleanDist,
            cuentas_ahorro: nuevasCuentas,
            historial_ahorros: [] // Inicia nuevo ciclo mensual de movimientos
        };

        // 4. Copiar Gastos (Incrementando cuotas y filtrando recurrentes)
        const snapG = await getDocs(collection(db, "finanzas", prev, "gastos"));
        let prevGastosToCopy = [];
        
        snapG.forEach(d => {
            let g = d.data();
            g.id = d.id;
            
            let cuotasTotales = parseInt(g.cuotas_totales);
            if (isNaN(cuotasTotales) || cuotasTotales < 1) cuotasTotales = 1;
            let cuotasPagadas = parseInt(g.cuotas_pagadas);
            if (isNaN(cuotasPagadas) || cuotasPagadas < 1) cuotasPagadas = 1;
            
            let esSuscripcionTarjeta = (g.tipo === 'Tarjeta' || g.type === 'Tarjeta') && cuotasTotales <= 1;
            
            let gCopy = null;
            if ((g.tipo === 'Tarjeta' || g.type === 'Tarjeta') && !esSuscripcionTarjeta) {
                if (cuotasPagadas < cuotasTotales) {
                    gCopy = { ...g };
                    gCopy.cuotas_pagadas = cuotasPagadas + 1;
                }
            } else if ((g.tipo === 'Fijo' || esSuscripcionTarjeta) && g.recurrente !== false) {
                gCopy = { ...g };
            }
            
            if (gCopy) {
                prevGastosToCopy.push(gCopy);
            }
        });
        
        // 5. Copiar Ingresos habituales (excluyendo rescates automáticos de un solo mes)
        const snapI = await getDocs(collection(db, "finanzas", prev, "ingresos"));
        let prevIngresosToCopy = [];
        
        snapI.forEach(d => {
            let ing = d.data();
            ing.id = d.id;
            if (!ing.es_rescate) {
                prevIngresosToCopy.push(ing);
            }
        });

        // 6. Ejecución atómica en Firestore con writeBatch
        const batch = writeBatch(db);
        const actualRef = doc(db, "finanzas", actual);
        batch.set(actualRef, { configuracion: nuevaConfiguracion }, { merge: true });
        
        let gCount = 0;
        prevGastosToCopy.forEach(g => {
            let docId = g.id;
            delete g.id;
            const ref = doc(collection(db, "finanzas", actual, "gastos"), docId);
            batch.set(ref, g);
            gCount++;
        });
        
        let iCount = 0;
        prevIngresosToCopy.forEach(ing => {
            let docId = ing.id;
            delete ing.id;
            const ref = doc(collection(db, "finanzas", actual, "ingresos"), docId);
            batch.set(ref, ing);
            iCount++;
        });

        await batch.commit();
        alert(`¡Importación exitosa! Se copiaron ${gCount} gastos, ${iCount} ingresos y se actualizaron los saldos iniciales de las cuentas de ahorro.`);
        await actualizarDashboard();
    } catch (e) {
        console.error(e);
        window.mostrarCargando(false);
        alert("Error al copiar datos: " + e.message);
    }
};

// =========================================================================
// AUTO-ACTUALIZACIÓN DE VERSIÓN (mismo mecanismo que Notas, Admisión y Festival)
// Compara APP_VERSION con version.json (siempre desde la red); si difieren, limpia cachés y recarga sola.
// Chequea: al arrancar, al volver a la pestaña, al recuperar conexión y cada 15 min.
// =========================================================================
const VERSION_LOOP_KEY = 'last_auto_reloaded_version';
let versionActualizando = false;

async function leerVersionRemota(timeoutMs) {
    try {
        const c = new AbortController();
        const t = timeoutMs ? setTimeout(() => c.abort(), timeoutMs) : null;
        const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store', signal: c.signal });
        if (t) clearTimeout(t);
        if (!r.ok) return null;
        const d = await r.json();
        return (d && d.version) || null;
    } catch (e) { return null; } // sin conexión: se reintenta luego
}

// Devuelve true si inició una actualización (la página se va a recargar)
async function chequearActualizacion(preventivo) {
    if (versionActualizando) return true;
    // No interrumpir un formulario abierto (se reintenta en el próximo chequeo)
    if (!preventivo && Array.from(document.querySelectorAll('.modal-overlay')).some(m => m.style.display === 'flex')) return false;
    const remota = await leerVersionRemota(preventivo ? 2000 : 0);
    if (!remota) return false;
    if (remota === APP_VERSION) { try { sessionStorage.removeItem(VERSION_LOOP_KEY); } catch (e) {} return false; }

    // Protección contra bucle: si ya se recargó para esta versión en esta sesión, no insistir
    let previa = null; try { previa = sessionStorage.getItem(VERSION_LOOP_KEY); } catch (e) {}
    if (previa === remota) { console.warn('[Auto-Update] Ya se recargó para ' + remota + '. Se omite bucle.'); return false; }
    try { sessionStorage.setItem(VERSION_LOOP_KEY, remota); } catch (e) {}
    versionActualizando = true;

    if (preventivo) {
        const txt = document.getElementById('loading-text');
        if (txt) txt.innerText = 'Actualizando a la versión ' + remota + '...';
    } else {
        const v = document.getElementById('update-version'); if (v) v.innerText = remota;
        const b = document.getElementById('banner-update'); if (b) b.style.display = 'block';
    }

    // No perder cambios pendientes (autoguardado de la distribución)
    try { if (autoguardadoPendiente) { clearTimeout(debounceTimer); autoguardadoPendiente = false; await window.autoGuardarDistribucionEstructura(false); } } catch (e) {}

    try {
        if (window.caches) { const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))); }
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            const reg = await navigator.serviceWorker.getRegistration();
            if (reg) await reg.update();
        }
    } catch (e) {}

    setTimeout(() => window.location.reload(), preventivo ? 300 : 1200);
    return true;
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        chequearActualizacion(false);
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.getRegistration().then(reg => reg && reg.update());
        }
    }
});
window.addEventListener('online', () => chequearActualizacion(false));
setInterval(() => chequearActualizacion(false), 15 * 60 * 1000);
chequearActualizacion(true); // al arrancar, antes de que el usuario empiece a trabajar

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register(`sw.js?v=${APP_VERSION}`).then(reg => reg.update()).catch(err => console.log('Error registrando SW: ', err));
    });
    // Un service worker nuevo tomó el control: verificar si corresponde actualizar
    navigator.serviceWorker.addEventListener('controllerchange', () => chequearActualizacion(false));
}
