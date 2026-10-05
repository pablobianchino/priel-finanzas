import { auth, db, provider, signInWithPopup, signOut, onAuthStateChanged, doc, getDoc, setDoc, updateDoc, collection, getDocs, addDoc, deleteDoc, writeBatch } from './firebase.js';
import { parseMoney, formatearDinero, getCostoCalculado } from './logica.js';

import { vistaResumen } from '../vistas/resumen.js';
import { vistaGastos } from '../vistas/gastos.js';
import { vistaIngresos } from '../vistas/ingresos.js';
import { vistaAhorros } from '../vistas/ahorros.js';
import { vistaEstadisticas } from '../vistas/estadisticas.js';
import { vistaModales } from '../vistas/modales.js';

document.getElementById('views-container').innerHTML = vistaResumen + vistaGastos + vistaIngresos + vistaAhorros + vistaEstadisticas;
document.getElementById('modals-container').innerHTML = vistaModales;

const APP_VERSION = "v2.7.0";
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
    if (btn) btn.innerText = isDark ? '☀️' : '🌙';
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
let yearExists = Array.from(anioSelector.options).some(opt => opt.value === currentYear);
if (!yearExists) {
    anioSelector.add(new Option(currentYear, currentYear));
    const opts = Array.from(anioSelector.options).sort((a, b) => a.value - b.value);
    anioSelector.innerHTML = '';
    opts.forEach(opt => anioSelector.add(opt));
}
anioSelector.value = currentYear;

let totalGastosGlobal = 0, subtotalTerceros = 0, totalIngresosGlobal = 0, deudaFuturaTotal = 0;
let totalAhorrosEfectivizados = 0;
let listaGastos = [], listaIngresos = [], listaAhorros = [];
let chartResumen = null, chartIngresos = null, chartEstadisticas = null;

let gruposDistribucion = {};
let tiposGastoAsociaciones = {}; 
let ordenPanelesGasto = [];
let cuentasAhorro = []; 
let historialAhorros = [];
let sumPorGrupo = {};
let sumatoriaGastosPorOrigen = {};
let debounceTimer;
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

window.mostrarCargando = function(show) { document.getElementById('loading-screen').style.display = show ? 'flex' : 'none'; }
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
    const content = toggleEl.parentElement.nextElementSibling;
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
    if (tr.style.display === 'none') {
        tr.style.display = 'table-row';
        if (icon) icon.innerText = '▼';
    } else {
        tr.style.display = 'none';
        if (icon) icon.innerText = '▶';
    }
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
    document.getElementById('view-title').innerText = rawTitle.replace(/[^\w\s]/gi, '').trim();
    
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

onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
        document.getElementById('user-email').innerText = user.email;
        document.getElementById('logout-btn').style.display = 'inline-block';
        actualizarDashboard();
    } else {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('app-container').style.display = 'none';
        window.mostrarCargando(false);
    }
});

mesSelector.addEventListener('change', actualizarDashboard);
anioSelector.addEventListener('change', () => {
    actualizarDashboard();
    if (document.getElementById('estadisticas').classList.contains('active')) cargarEstadisticasAnuales();
});

document.getElementById('filtro-texto-gastos').addEventListener('input', () => window.recargarDatosVisuales());
document.getElementById('filtro-texto-ingresos').addEventListener('input', () => window.recargarDatosVisuales());

function obtenerMesId() { return `${anioSelector.value}-${mesSelector.value}`; }

window.exportarBackupMes = async function() {
    window.mostrarCargando(true);
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

async function actualizarDashboard() {
    if (!auth.currentUser) return;
    window.mostrarCargando(true);
    try {
        await cargarConfiguracion();
        await Promise.all([cargarGastosFetch(), cargarIngresosFetch(), cargarAhorrosFetch()]);
        window.recargarDatosVisuales();
    } catch(error) {
        console.error("Error cargando dashboard:", error);
    } finally {
        window.mostrarCargando(false);
    }
}

window.recargarDatosVisuales = function() {
    const dDebito = parseFloat(document.getElementById('usd-debito').dataset.raw || 0);
    const dImpuesto = parseFloat(document.getElementById('usd-impuesto').dataset.raw || 0);
    
    let gastosProc = procesarListaGastos(dDebito, dImpuesto);
    calcularSaldosOrigenes(gastosProc);
    
    totalAhorrosEfectivizados = 0;
    for(let g in gruposDistribucion) {
        gruposDistribucion[g].forEach(it => {
            if (it.ahorrado) totalAhorrosEfectivizados += (it.monto_ahorrado || 0);
        });
    }

    renderResumenUSD(gastosProc, dDebito);
    renderizacioDinamicaGastosPaneles(gastosProc, dDebito, dImpuesto);
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
            infoExtra += ` <span style="font-size:10px; background:#fce8e6; color:#c5221f; padding:2px 4px; border-radius:4px; margin-left:4px;">De: ${nomTercero}</span>`;
        }

        totalUSD += usdReal;
        totalARS += arsReal;

        let targetId = g.id;
        if(g.es_clon_destino) targetId = g.id.replace('_clon', '');

        html += `<tr class="tr-clickable" onclick="window.prepararEdicionGasto('${targetId}')">
                    <td>${g.nombre}${infoExtra}</td>
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

async function cargarAhorrosFetch() {
    try {
        const snap = await getDocs(collection(db, "finanzas", obtenerMesId(), "ahorros"));
        listaAhorros = [];
        snap.forEach(d => listaAhorros.push({ id: d.id, ...d.data() }));
    } catch(e) { console.error(e); listaAhorros = []; }
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
