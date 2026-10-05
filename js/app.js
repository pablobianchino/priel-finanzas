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

const APP_VERSION = "v2.5.1";
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
    
    document.querySelectorAll(`.nav-btn[onclick*="'${viewId}'"]`).forEach(b => b.add('active'));
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
    const panel = document.getElementById('panel-resumen-usd');
    const contenido = document.getElementById('contenido-resumen-usd');
    if (!panel || !contenido) return;

    let gastosUSD = gastosProc.filter(g => g.moneda === 'USD');
    gastosUSD.sort((a, b) => b.costoCalculado - a.costoCalculado);

    if (gastosUSD.length === 0 || dDebito <= 0) {
        panel.style.display = 'none';
        return;
    }

    panel.style.display = 'block';
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
        } else if (g.propietario === 'Tercero') {
            let nomTercero = g.es_clon_destino ? (g.categoria.replace('Gastos de ', '')) : (g.tercero_nombre || 'Tercero');
            infoExtra += ` <span style="font-size:10px; background:#fce8e6; color:#c5221f; padding:2px 4px; border-radius:4px; margin-left:4px;">De: ${nomTercero}</span>`;
        }

        totalUSD += usdReal;
        totalARS += arsReal;

        html += `<tr>
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
    
    contenido.innerHTML = html;
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
                if (debEl) { debEl.dataset.raw = config.dolar_debito || 0; debEl.value = window.formatearDinero(config.dolar_debito || 0, 'ARS'); }
                const impEl = document.getElementById(`usd-impuesto${s}`);
                if (impEl) { impEl.dataset.raw = config.dolar_impuesto || 0; impEl.value = window.formatearDinero(config.dolar_impuesto || 0, 'ARS'); }
            });
            
            gruposDistribucion = config.grupos_distribucion || {};
            for (let g in gruposDistribucion) {
                if (!Array.isArray(gruposDistribucion[g])) gruposDistribucion[g] = Object.values(gruposDistribucion[g]);
                gruposDistribucion[g] = gruposDistribucion[g].filter(it => it !== null);
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
        const impEl = document.getElementById(`usd-impuesto${s}`);
        if (impEl) { impEl.dataset.raw = 0; impEl.value = window.formatearDinero(0); }
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
        const fullConfig = {
            configuracion: {
                dolar_mep: parseFloat(document.getElementById('usd-mep').dataset.raw || 0),
                dolar_debito: parseFloat(document.getElementById('usd-debito').dataset.raw || 0),
                dolar_impuesto: parseFloat(document.getElementById('usd-impuesto').dataset.raw || 0),
                grupos_distribucion: gruposDistribucion,
                tipos_gasto: tiposGastoAsociaciones,
                cuentas_ahorro: cuentasAhorro,
                orden_paneles_gasto: ordenPanelesGasto,
                historial_ahorros: historialAhorros
            }
        };
        await setDoc(docRef, fullConfig);
    }
}

function procesarListaGastos(dDebito, dImpuesto) {
    let arr = [];
    totalGastosGlobal = 0; subtotalTerceros = 0; deudaFuturaTotal = 0;
    if(!listaGastos) return arr;
    
    listaGastos.forEach(g => {
        let cuotaTotal = getCostoCalculado(g, dDebito, dImpuesto) || 0;

        if (g.compartir_con && g.compartir_tipo && (g.propietario === 'Propio' || !g.propietario)) {
            let compTipo = g.compartir_tipo || 'divisor';
            let div = parseInt(g.divisor) || 2;
            let miParte = compTipo === 'divisor' ? (cuotaTotal / div) : (parseFloat(g.monto_fijo) || 0);
            let suParte = Math.max(0, cuotaTotal - miParte);

            arr.push({ ...g, costoCalculado: miParte, es_clon_origen: true });
            arr.push({ ...g, id: g.id + '_clon', categoria: "Gastos de " + g.compartir_con.trim(), propietario: "Tercero", costoCalculado: suParte, es_clon_destino: true });

            if (g.tipo === 'Tarjeta' && (g.cuotas_totales || 1) > (g.cuotas_pagadas || 1)) deudaFuturaTotal += (miParte * (g.cuotas_totales - g.cuotas_pagadas));
            totalGastosGlobal += miParte; subtotalTerceros += suParte; 
        } else {
            arr.push({ ...g, costoCalculado: cuotaTotal });
            if (g.tipo === 'Tarjeta' && (g.cuotas_totales || 1) > (g.cuotas_pagadas || 1)) deudaFuturaTotal += (cuotaTotal * (g.cuotas_totales - g.cuotas_pagadas));
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

window.guardarConfiguracionDolar = async function(origenPanel) {
    let suffix = origenPanel === 'resumen' ? '' : `-${origenPanel}`;
    let mep = window.parseMoney(document.getElementById(`usd-mep${suffix}`).value);
    let debito = window.parseMoney(document.getElementById(`usd-debito${suffix}`).value);
    let impuesto = window.parseMoney(document.getElementById(`usd-impuesto${suffix}`).value);
    window.mostrarCargando(true);
    await actualizarConfiguracionDB({ "configuracion.dolar_mep": mep, "configuracion.dolar_debito": debito, "configuracion.dolar_impuesto": impuesto });
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

function renderizacioDinamicaGastosPaneles(gastosProcesados, dDebito, dImpuesto) {
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
        let saldoHtml = origenesDelPanel.length === 0 ? `<div class="saldo-ok" style="padding: 6px 10px; border-radius: 6px; font-size: 12px; margin-bottom: 10px; display: inline-block;">Sin origen vinculado</div>` : `<div style="display: flex; flex-wrap: wrap; margin-bottom: 5px;">${origenesDelPanel.map(idInc => {
            let io = listaIngresos.find(i => i.id === idInc);
            if (!io) return '';
            let restante = io.monto - (sumatoriaGastosPorOrigen[idInc] || 0);
            return `<div style="background-color: ${restante < 0 ? '#fce8e6' : '#e6f4ea'}; color: ${restante < 0 ? '#c5221f' : '#137333'}; padding: 6px 10px; border-radius: 6px; font-size: 12px; font-weight: 500; display: inline-block; margin-right: 8px; margin-bottom: 8px;">Restante de ${io.nombre}:${window.formatearDinero(restante)}</div>`;
        }).join('')}</div>`;

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
        let alertBadge = hasUnassociated ? `<span style="background-color: #fce8e6; color: #c5221f; padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-left: 10px; vertical-align: text-bottom;">⚠️ Falta origen</span>` : '';

        let itemsHTML = p.itemsPanel.map(g => {
            let originHtml = '';
            let isUnassociated = false; 

            if (!g.es_clon_destino) {
                if (p.origenesDelPanel.length > 1) {
                    originHtml = `<br><select onclick="event.stopPropagation()" onchange="window.cambiarOrigenGastoDirecto('${g.id}', this.value)" style="font-size:10px; padding:2px; margin-top:4px; max-width: 140px; border-radius:4px; border:1px solid var(--card-border); background:var(--input-bg); color:var(--text-main);"><option value="" ${!g.id_origen ? 'selected' : ''}>- Seleccionar Origen -</option>${p.origenesDelPanel.map(idInc => {
                        let io = listaIngresos.find(i => i.id === idInc);
                        return io ? `<option value="${io.id}" ${g.id_origen === idInc ? 'selected' : ''}>${io.nombre}</option>` : '';
                    }).join('')}</select>`;
                    if (!g.id_origen || !p.origenesDelPanel.includes(g.id_origen)) isUnassociated = true; 
                } else if (p.origenesDelPanel.length === 1) {
                    let io = listaIngresos.find(i=>i.id === p.origenesDelPanel[0]);
                    if(io) originHtml = `<br><span style="font-size:10px; color:var(--text-muted);">De: ${io.nombre}</span>`;
                } else isUnassociated = true; 
            }

            if (!g.es_clon_destino && isUnassociated) {
                originHtml += `<div style="margin-top: 4px; padding: 2px 4px; background: ${g.ignorar_origen ? 'var(--highlight-bg)' : '#fce8e6'}; border-radius: 4px; display: inline-block;"><label style="font-size:10px; color:${g.ignorar_origen ? 'var(--text-muted)' : '#c5221f'}; display:flex; align-items:center; gap:4px; cursor:pointer; margin:0;"><input type="checkbox" onclick="event.stopPropagation()" onchange="window.toggleIgnorarOrigenGasto('${g.id}', this.checked)" ${g.ignorar_origen ? 'checked' : ''} style="width:12px; height:12px; margin:0; cursor:pointer;"> ${g.ignorar_origen ? 'Aviso ignorado' : 'Ignorar falta de origen'}</label></div>`;
            }
            
            let recCheckbox = g.tipo === 'Tarjeta' ? '<span style="color:var(--text-muted); font-size:10px;">N/A</span>' : `<input type="checkbox" style="cursor:pointer;" onclick="event.stopPropagation()" onchange="window.toggleRecurrenciaGasto('${g.id}', this.checked)" ${g.recurrente !== false ? 'checked' : ''}>`;
            let cuotasDetalle = g.tipo === 'Tarjeta' ? `<br><span style="font-size:11px; color:#174ea6;">${g.tarjeta || 'Tarjeta'} (${g.cuotas_pagadas}/${g.cuotas_totales})</span>` : '';
            let bgRowStyle = g.tipo === 'Tarjeta' && parseInt(g.cuotas_pagadas) >= parseInt(g.cuotas_totales) ? 'background-color: var(--highlight-bg);' : '';

            let usdBtn = '', breakdownHtml = '';
            if (g.moneda === 'USD') {
                let vDeb = g.monto * dDebito, totalCosto = vDeb;
                usdBtn = `<br><span style="color:#174ea6; font-size:10px; cursor:pointer; text-decoration:underline;" onclick="event.stopPropagation(); document.getElementById('usd-detail-${g.id}').style.display = document.getElementById('usd-detail-${g.id}').style.display === 'none' ? 'table-row' : 'none'">Ver cálculo USD</span>`;
                breakdownHtml = `<tr id="usd-detail-${g.id}" style="display:none; background-color:var(--highlight-bg);"><td colspan="4" style="padding: 10px; font-size:11px; color:var(--text-muted);"><strong>Cálculo USD:</strong><br>Monto original: U$D ${g.monto}<br>Monto x Dólar MEP Tarjeta (${dDebito}): $${(vDeb).toFixed(2)}<br><b>Subtotal: $${(totalCosto).toFixed(2)}</b>${(g.divisor && g.divisor > 1) ? `<br><i>Dividido en ${g.divisor} partes:$${(totalCosto/g.divisor).toFixed(2)}</i>` : ''}</td></tr>`;
            }

            let actionsHtml = g.es_clon_destino ? `<span style="font-size:10px; color:#c5221f; font-weight:600;">🔒 Compartido (Edite original)</span>` : `<button class="btn-icon" onclick="event.stopPropagation(); window.borrarGasto('${g.id}')">🗑️</button>`;

            return `<tr style="${bgRowStyle} ${g.es_clon_destino ? '' : 'cursor:pointer;'}" ${g.es_clon_destino ? '' : `onclick="window.prepararEdicionGasto('${g.id}')"`}><td><strong>${g.nombre}</strong>${cuotasDetalle}${originHtml}${usdBtn}</td><td style="font-weight:600;">${window.formatearDinero(g.costoCalculado)}</td><td style="text-align:center;">${recCheckbox}</td><td style="white-space:nowrap;">${actionsHtml}</td></tr>${breakdownHtml}`;
        }).join('');

        contenedor.innerHTML += `
            <div class="card panel-gasto-item" data-categoria="${p.categoria}" style="border-top: 4px solid var(--primary-color);">
                <div style="display:flex; align-items:center;">
                    <span class="drag-handle" style="cursor:grab; margin-right:10px; font-size:20px; color:var(--text-muted);">⠿</span>
                    <div class="card-header-toggle" onclick="window.togglePanelGasto(this)" style="margin-bottom:0; flex:1; display:flex; justify-content:space-between; align-items:center;">
                        <h2 style="margin:0; font-size:15px; flex:1;">${p.categoria} ${alertBadge}<span style="font-weight:normal; font-size:13px; color:var(--text-muted);"> | Total: <b style="color:var(--text-main);">${window.formatearDinero(p.totalPanel)}</b></span></h2>
                        <span class="toggle-icon">${iconText}</span>
                    </div>
                </div>
                <div class="card-content" style="display:${displayStyle}; margin-top:15px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid var(--card-border);">
                        <button class="btn-black" style="padding: 4px 10px; font-size: 11px;" onclick="window.abrirModalNuevoGasto('${p.categoria}')">➕ Añadir Gasto</button>
                        <div style="display: flex; gap: 5px;">
                            <button class="btn-icon" onclick="window.editarNombreTipoGastoPanel('${p.categoria}')">✏️</button>
                            <button class="btn-icon" onclick="window.eliminarTipoGastoPanel('${p.categoria}')">🗑️</button>
                        </div>
                    </div>
                    <div style="margin-top:10px; border-bottom:1px solid var(--card-border); padding-bottom:10px;">
                        <label style="font-size:11px; color:var(--text-muted); display:block; margin-bottom:5px;">Ingresos que alimentan este panel:</label>
                        <div style="display:flex; flex-wrap:wrap; gap:5px;">
                            ${listaIngresos.map(ing => `<label style="font-size:11px; background:var(--highlight-bg); padding:3px 6px; border-radius:4px; cursor:pointer;"><input type="checkbox" onchange="window.toggleOrigenPanel('${p.categoria}', '${ing.id}', this.checked)" ${p.origenesDelPanel.includes(ing.id)?'checked':''}>${ing.nombre}</label>`).join('')}
                        </div>
                    </div>
                    ${p.saldoHtml}
                    <table style="width:100%; margin-top:10px;">
                        <thead><tr><th>Gasto</th><th>Costo Mes</th><th>Recurr.</th><th>⚙️</th></tr></thead>
                        <tbody>${itemsHTML || '<tr><td colspan="4" style="color:var(--text-muted); text-align:center;">No hay gastos</td></tr>'}</tbody>
                    </table>
                </div>
            </div>`;
    });

    sortablePaneles = Sortable.create(contenedor, {
        handle: '.drag-handle', animation: 150,
        onEnd: function () {
            ordenPanelesGasto = Array.from(contenedor.querySelectorAll('.panel-gasto-item')).map(el => el.getAttribute('data-categoria'));
            window.guardarConfiguracionGlobalGlobal(false); 
        }
    });
}

window.abrirModalNuevoGasto = function(categoriaPredefinida = '') {
    document.getElementById('form-gasto').reset(); document.getElementById('gasto-id').value = ""; document.getElementById('titulo-modal-gasto').innerText = "Nuevo Gasto";
    window.toggleTercero('gasto'); window.toggleCamposTarjeta('gasto'); document.getElementById('gasto-compartir').checked = false; window.toggleDivisor('gasto'); document.getElementById('gasto-recurrente').checked = true; 
    document.getElementById('gasto-monto').dataset.raw = ""; document.getElementById('gasto-monto-fijo').dataset.raw = "";
    
    if (categoriaPredefinida && tiposGastoAsociaciones.hasOwnProperty(categoriaPredefinida)) document.getElementById('gasto-categoria-select').value = categoriaPredefinida;
    else if (Object.keys(tiposGastoAsociaciones).length > 0) document.getElementById('gasto-categoria-select').value = Object.keys(tiposGastoAsociaciones)[0];
    
    window.actualizarOrigenesGastoModal(); document.getElementById('modal-gasto').style.display = 'flex';
}

window.abrirModalEditarGasto = function(data) {
    document.getElementById('gasto-id').value = data.id;
    document.getElementById('gasto-propietario').value = data.
