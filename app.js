import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, getDocs, addDoc, deleteDoc, writeBatch, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// CONTROL DE VERSIÓN GLOBAL
const APP_VERSION = "v2.0.0";
window.APP_VERSION = APP_VERSION;

const updateVersionTags = () => {
    const floatingTag = document.getElementById("floating-version");
    if(floatingTag) floatingTag.innerText = APP_VERSION;
    const sidebarTag = document.getElementById("sidebar-version");
    if(sidebarTag) sidebarTag.innerText = APP_VERSION;
};
updateVersionTags();

const firebaseConfig = {
    apiKey: "AIzaSyC8S5y_TJJFiL6Sqqwp6f2uidh4OiHDbnM",
    authDomain: "priel-finanzas.firebaseapp.com",
    projectId: "priel-finanzas",
    storageBucket: "priel-finanzas.firebasestorage.app",
    messagingSenderId: "732838355206",
    appId: "1:732838355206:web:89030db6e12b371478fe87"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const db = initializeFirestore(app, {
    localCache: persistentLocalCache({tabManager: persistentMultipleTabManager()})
});
const provider = new GoogleAuthProvider();

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

window.parseMoney = function(val) {
    if(!val) return 0;
    let clean = String(val).replace(/[^0-9.,-]/g, '');
    if(clean.indexOf('.') > -1 && clean.indexOf(',') > -1) {
        clean = clean.replace(/\./g, '').replace(',', '.');
    } else if (clean.indexOf(',') > -1) {
        clean = clean.replace(',', '.');
    }
    let res = parseFloat(clean);
    return isNaN(res) ? 0 : res;
};

window.formatearDinero = function(num, moneda = 'ARS') {
    if (isNaN(num) || num === null) num = 0;
    let fixed = Number(num).toFixed(2);
    let parts = fixed.split('.');
    let enteros = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    let decimales = parts[1] || '00';
    let prefix = moneda === 'USD' ? 'U$D ' : '$ ';
    return prefix + enteros + "," + decimales;
};

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
        if (name.includes(filter)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
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

/* ===== GESTION DE EVENTOS GLOBALES ===== */
document.getElementById('login-btn-main').addEventListener('click', () => {
    signInWithPopup(auth, provider).catch((error) => {
        console.error("Error de login:", error);
        alert("Ocurrió un error al iniciar sesión: " + error.message + "\n\nSi estás en localhost con file://, debes usar un servidor local o Vercel.");
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

document.getElementById('filtro-texto-gastos').addEventListener('input', window.recargarDatosVisuales);
document.getElementById('filtro-texto-ingresos').addEventListener('input', window.recargarDatosVisuales);


/* ===== FUNCIONES NÚCLEO ===== */

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
        const pGastos = cargarGastosFetch();
        const pIngresos = cargarIngresosFetch();
        const pAhorros = cargarAhorrosFetch();
        
        await Promise.all([pGastos, pIngresos, pAhorros]);
        
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

    renderizacioDinamicaGastosPaneles(gastosProc, dDebito, dImpuesto);
    renderTablaIngresos(gastosProc); 
    renderDistribucionDirecta(); 
    renderCuentasAhorro(); 
    calcularBalance();
}

async function cargarGastosFetch() {
    try {
        const querySnapshot = await getDocs(collection(db, "finanzas", obtenerMesId(), "gastos"));
        listaGastos = [];
        querySnapshot.forEach(d => listaGastos.push({ id: d.id, ...d.data() }));
    } catch(e) { console.error("Error cargando gastos:", e); listaGastos = []; }
}

async function cargarIngresosFetch() {
    try {
        const snap = await getDocs(collection(db, "finanzas", obtenerMesId(), "ingresos"));
        listaIngresos = []; 
        snap.forEach(d => listaIngresos.push({ id: d.id, ...d.data() }));
    } catch(e) { console.error("Error cargando ingresos:", e); listaIngresos = []; }
}

async function cargarAhorrosFetch() {
    try {
        const snap = await getDocs(collection(db, "finanzas", obtenerMesId(), "ahorros"));
        listaAhorros = [];
        snap.forEach(d => listaAhorros.push({ id: d.id, ...d.data() }));
    } catch(e) { console.error("Error cargando ahorros:", e); listaAhorros = []; }
}

async function cargarConfiguracion() {
    try {
        const docSnap = await getDoc(doc(db, "finanzas", obtenerMesId()));
        if (docSnap.exists() && docSnap.data().configuracion) {
            const config = docSnap.data().configuracion;
            
            document.getElementById('usd-mep').dataset.raw = config.dolar_mep || 0;
            document.getElementById('usd-mep').value = window.formatearDinero(config.dolar_mep || 0, 'ARS');
            
            document.getElementById('usd-debito').dataset.raw = config.dolar_debito || 0;
            document.getElementById('usd-debito').value = window.formatearDinero(config.dolar_debito || 0, 'ARS');
            
            document.getElementById('usd-impuesto').dataset.raw = config.dolar_impuesto || 0;
            document.getElementById('usd-impuesto').value = window.formatearDinero(config.dolar_impuesto || 0, 'ARS');

            document.getElementById('usd-mep-gastos').dataset.raw = config.dolar_mep || 0;
            document.getElementById('usd-mep-gastos').value = window.formatearDinero(config.dolar_mep || 0, 'ARS');

            document.getElementById('usd-debito-gastos').dataset.raw = config.dolar_debito || 0;
            document.getElementById('usd-debito-gastos').value = window.formatearDinero(config.dolar_debito || 0, 'ARS');

            document.getElementById('usd-impuesto-gastos').dataset.raw = config.dolar_impuesto || 0;
            document.getElementById('usd-impuesto-gastos').value = window.formatearDinero(config.dolar_impuesto || 0, 'ARS');
            
            gruposDistribucion = config.grupos_distribucion || {};
            for (let g in gruposDistribucion) {
                if (!Array.isArray(gruposDistribucion[g])) {
                    gruposDistribucion[g] = Object.values(gruposDistribucion[g]);
                }
                gruposDistribucion[g] = gruposDistribucion[g].filter(it => it !== null);
            }

            let oldTipos = config.tipos_gasto || { "Fijos": [], "Tarjeta": [], "Terceros": [] };
            for(let k in oldTipos) {
                if (typeof oldTipos[k] === 'string') {
                    oldTipos[k] = oldTipos[k] !== "" ? [oldTipos[k]] : [];
                } else if (!Array.isArray(oldTipos[k])) {
                    oldTipos[k] = Object.values(oldTipos[k]);
                }
                oldTipos[k] = oldTipos[k].filter(id => id !== null && id !== undefined && id.trim() !== "");
            }
            tiposGastoAsociaciones = oldTipos;
            cuentasAhorro = config.cuentas_ahorro || [];
            ordenPanelesGasto = config.orden_paneles_gasto || [];
            historialAhorros = config.historial_ahorros || [];

        } else {
            document.getElementById('usd-mep').dataset.raw = 0; document.getElementById('usd-mep').value = window.formatearDinero(0);
            document.getElementById('usd-debito').dataset.raw = 0; document.getElementById('usd-debito').value = window.formatearDinero(0);
            document.getElementById('usd-impuesto').dataset.raw = 0; document.getElementById('usd-impuesto').value = window.formatearDinero(0);
            document.getElementById('usd-mep-gastos').dataset.raw = 0; document.getElementById('usd-mep-gastos').value = window.formatearDinero(0);
            document.getElementById('usd-debito-gastos').dataset.raw = 0; document.getElementById('usd-debito-gastos').value = window.formatearDinero(0);
            document.getElementById('usd-impuesto-gastos').dataset.raw = 0; document.getElementById('usd-impuesto-gastos').value = window.formatearDinero(0);

            gruposDistribucion = {};
            tiposGastoAsociaciones = { "Fijos": [], "Tarjeta": [], "Terceros": [] };
            cuentasAhorro = [];
            ordenPanelesGasto = [];
            historialAhorros = [];
        }
        
        Object.keys(tiposGastoAsociaciones).forEach(cat => {
            if(!ordenPanelesGasto.includes(cat)) ordenPanelesGasto.push(cat);
        });

        actualizarSelectsConfig();
    } catch(e) {
        console.error("Error cargando configuración:", e);
        gruposDistribucion = {};
        tiposGastoAsociaciones = { "Fijos": [], "Tarjeta": [], "Terceros": [] };
        cuentasAhorro = [];
        ordenPanelesGasto = [];
        historialAhorros = [];
    }
}

function actualizarSelectsConfig() {
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

function getCostoCalculado(g, dDebito, dImpuesto) {
    let costoArsBase = g.monto;
    if (g.moneda === 'USD') {
        let vImp = g.monto * dImpuesto;
        costoArsBase = (vImp * 0.02) + (vImp * 0.21) + (vImp * 0.30) + (g.monto * dDebito);
    }
    let divisor = g.divisor || 1;
    if (g.propietario !== 'Tercero' && g.compartir_tipo === 'fijo') {
        return g.monto_fijo || 0;
    } else {
        let cuotaBase = g.tipo === 'Tarjeta' ? (costoArsBase / (g.cuotas_totales || 1)) : costoArsBase;
        return cuotaBase / divisor;
    }
}

function procesarListaGastos(dDebito, dImpuesto) {
    let arr = [];
    totalGastosGlobal = 0; subtotalTerceros = 0; deudaFuturaTotal = 0;

    if(!listaGastos) return arr;

    listaGastos.forEach(g => {
        let totalMesBase = g.monto;
        if (g.moneda === 'USD') {
            let vImp = g.monto * dImpuesto;
            totalMesBase = (vImp * 0.02) + (vImp * 0.21) + (vImp * 0.30) + (g.monto * dDebito);
        }
        
        let cuotaTotal = g.tipo === 'Tarjeta' ? (totalMesBase / (g.cuotas_totales || 1)) : totalMesBase;

        if (g.compartir_con && g.compartir_tipo && g.propietario === 'Propio') {
            let miParte = 0, suParte = 0;
            if (g.compartir_tipo === 'divisor') {
                miParte = cuotaTotal / (g.divisor || 2);
            } else if (g.compartir_tipo === 'fijo') {
                miParte = g.monto_fijo || 0; 
            }
            suParte = cuotaTotal - miParte;

            arr.push({ ...g, costoCalculado: miParte, es_clon_origen: true });
            
            arr.push({ 
                ...g, 
                id: g.id + '_clon', 
                categoria: "Gastos de " + g.compartir_con.trim(), 
                propietario: "Tercero", 
                costoCalculado: suParte, 
                es_clon_destino: true 
            });

            if (g.tipo === 'Tarjeta') {
                let cTot = g.cuotas_totales || 1; let cPag = g.cuotas_pagadas || 1;
                if (cTot > cPag) deudaFuturaTotal += (miParte * (cTot - cPag));
            }
            
            totalGastosGlobal += miParte;
            subtotalTerceros += suParte; 
        } else {
            arr.push({ ...g, costoCalculado: cuotaTotal });
            
            if (g.tipo === 'Tarjeta') {
                let cTot = g.cuotas_totales || 1; let cPag = g.cuotas_pagadas || 1;
                if (cTot > cPag) deudaFuturaTotal += (cuotaTotal * (cTot - cPag));
            }
            
            if (g.propietario !== 'Tercero') totalGastosGlobal += cuotaTotal;
            else subtotalTerceros += cuotaTotal;
        }
    });

    document.getElementById('res-gastos-fijos').innerText = formatearDinero(totalGastosGlobal);
    document.getElementById('sum-gastos-total').innerText = formatearDinero(totalGastosGlobal);
    document.getElementById('sum-gastos-terceros').innerText = formatearDinero(subtotalTerceros);
    document.getElementById('res-deuda-futura').innerText = formatearDinero(deudaFuturaTotal);

    return arr;
}

function getOrigenIdDeGasto(g) {
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
        if (origenId) {
            sumatoriaGastosPorOrigen[origenId] = (sumatoriaGastosPorOrigen[origenId] || 0) + g.costoCalculado;
        }
    });
}

window.crearNuevoTipoGastoPanel = function() {
    const nombre = prompt("Ingresa el nombre para el nuevo panel de gastos:");
    if (!nombre || nombre.trim() === "") return;
    const limpio = nombre.trim();
    if (tiposGastoAsociaciones[limpio] !== undefined) return alert("Este panel ya existe.");
    
    tiposGastoAsociaciones[limpio] = [];
    ordenPanelesGasto.push(limpio);
    guardarConfiguracionGlobalGlobal();
};

window.editarNombreTipoGastoPanel = async function(oldCategoria) {
    const nuevoNombre = prompt("Ingresa el nuevo nombre para este panel de gasto:", oldCategoria);
    if (!nuevoNombre || nuevoNombre.trim() === "" || nuevoNombre.trim() === oldCategoria) return;
    const limpio = nuevoNombre.trim();
    if (tiposGastoAsociaciones[limpio] !== undefined) return alert("Este panel ya existe.");
    
    window.mostrarCargando(true);
    const origenesVinculados = tiposGastoAsociaciones[oldCategoria];
    tiposGastoAsociaciones[limpio] = origenesVinculados;
    delete tiposGastoAsociaciones[oldCategoria];
    
    let idx = ordenPanelesGasto.indexOf(oldCategoria);
    if(idx > -1) ordenPanelesGasto[idx] = limpio;

    await actualizarConfiguracionDB({
        "configuracion.tipos_gasto": tiposGastoAsociaciones,
        "configuracion.orden_paneles_gasto": ordenPanelesGasto
    });
    
    const batch = writeBatch(db);
    let updatedCount = 0;
    listaGastos.forEach(g => {
        let catAsociada = g.categoria || "Fijos"; 
        if (catAsociada === oldCategoria) {
            const docRef = doc(db, "finanzas", obtenerMesId(), "gastos", g.id);
            batch.update(docRef, { categoria: limpio });
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
        guardarConfiguracionGlobalGlobal();
    }
};

window.toggleOrigenPanel = function(categoria, idOrigen, isChecked) {
    let origenes = tiposGastoAsociaciones[categoria] || [];
    origenes = origenes.filter(id => id && id.trim() !== "");

    if (isChecked) {
        if(!origenes.includes(idOrigen)) origenes.push(idOrigen);
    } else {
        origenes = origenes.filter(id => id !== idOrigen);
    }
    tiposGastoAsociaciones[categoria] = origenes;
    
    guardarConfiguracionGlobalGlobal(false);
    window.recargarDatosVisuales();
}

window.guardarConfiguracionDolar = async function(origenPanel) {
    let mep, debito, impuesto;
    if(origenPanel === 'gastos') {
        mep = document.getElementById('usd-mep-gastos').dataset.raw || 0;
        debito = document.getElementById('usd-debito-gastos').dataset.raw || 0;
        impuesto = document.getElementById('usd-impuesto-gastos').dataset.raw || 0;
    } else {
        mep = document.getElementById('usd-mep').dataset.raw || 0;
        debito = document.getElementById('usd-debito').dataset.raw || 0;
        impuesto = document.getElementById('usd-impuesto').dataset.raw || 0;
    }
    window.mostrarCargando(true);
    await actualizarConfiguracionDB({
        "configuracion.dolar_mep": parseFloat(mep),
        "configuracion.dolar_debito": parseFloat(debito),
        "configuracion.dolar_impuesto": parseFloat(impuesto)
    });
    await actualizarDashboard();
}

async function guardarConfiguracionGlobalGlobal(recargarCompleto = true) {
    if(recargarCompleto) window.mostrarCargando(true);
    await actualizarConfiguracionDB({
        "configuracion.tipos_gasto": tiposGastoAsociaciones,
        "configuracion.orden_paneles_gasto": ordenPanelesGasto
    });
    if(recargarCompleto) await actualizarDashboard();
}

window.toggleRecurrenciaGasto = async function(id, isChecked) {
    let gasto = listaGastos.find(g => g.id === id);
    if(gasto) {
        gasto.recurrente = isChecked;
        try {
            await updateDoc(doc(db, "finanzas", obtenerMesId(), "gastos", id), { recurrente: isChecked });
        } catch(e) { console.error("Error al actualizar recurrencia:", e); }
    }
};

window.cambiarOrigenGastoDirecto = async function(idGasto, idOrigen) {
    let gasto = listaGastos.find(g => g.id === idGasto);
    if(gasto) {
        gasto.id_origen = idOrigen;
        try {
            await updateDoc(doc(db, "finanzas", obtenerMesId(), "gastos", idGasto), { id_origen: idOrigen });
            window.recargarDatosVisuales();
        } catch(e) { console.error("Error al actualizar origen del gasto:", e); }
    }
};

window.toggleIgnorarOrigenGasto = async function(idGasto, isIgnored) {
    let gasto = listaGastos.find(g => g.id === idGasto);
    if(gasto) {
        gasto.ignorar_origen = isIgnored;
        try {
            await updateDoc(doc(db, "finanzas", obtenerMesId(), "gastos", idGasto), { ignorar_origen: isIgnored });
            window.recargarDatosVisuales();
        } catch(e) { console.error("Error al actualizar ignorar origen:", e); }
    }
};

function renderizacioDinamicaGastosPaneles(gastosProcesados, dDebito, dImpuesto) {
    let panelesAbiertos = [];
    document.querySelectorAll('.panel-gasto-item').forEach(panel => {
        const content = panel.querySelector('.card-content');
        if (content && content.style.display === 'block') {
            panelesAbiertos.push(panel.getAttribute('data-categoria'));
        }
    });

    const contenedor = document.getElementById('contenedor-dinamico-gastos');
    contenedor.innerHTML = '';
    if (sortablePaneles) sortablePaneles.destroy();

    const buscador = document.getElementById('filtro-texto-gastos').value.toLowerCase();

    let panelesData = [];

    for (let categoria in tiposGastoAsociaciones) {
        let origenesDelPanel = tiposGastoAsociaciones[categoria] || [];
        origenesDelPanel = origenesDelPanel.filter(id => id && id.trim() !== "" && (listaIngresos || []).some(i => i.id === id));
        
        let matchesCatName = buscador && categoria.toLowerCase().includes(buscador);

        let itemsPanel = gastosProcesados.filter(g => {
            if ((g.categoria || "Fijos") !== categoria) return false;
            if (!buscador) return true;
            if (matchesCatName) return true;
            return g.nombre.toLowerCase().includes(buscador);
        });

        if (buscador && !matchesCatName && itemsPanel.length === 0) continue;

        let totalPanel = itemsPanel.reduce((sum, g) => sum + g.costoCalculado, 0);

        let saldoHtml = '';
        if (origenesDelPanel.length === 0) {
            saldoHtml = `<div class="saldo-ok" style="padding: 6px 10px; border-radius: 6px; font-size: 12px; margin-bottom: 10px; display: inline-block;">Sin origen vinculado</div>`;
        } else {
            let saldosPills = origenesDelPanel.map(idInc => {
                let io = listaIngresos.find(i => i.id === idInc);
                if (!io) return '';
                let consumido = sumatoriaGastosPorOrigen[idInc] || 0;
                let restante = io.monto - consumido;
                let bg = restante < 0 ? '#fce8e6' : '#e6f4ea';
                let color = restante < 0 ? '#c5221f' : '#137333';
                return `<div style="background-color: ${bg}; color: ${color}; padding: 6px 10px; border-radius: 6px; font-size: 12px; font-weight: 500; display: inline-block; margin-right: 8px; margin-bottom: 8px;">Restante de ${io.nombre}: ${formatearDinero(restante)}</div>`;
            }).join('');
            saldoHtml = `<div style="display: flex; flex-wrap: wrap; margin-bottom: 5px;">${saldosPills}</div>`;
        }

        panelesData.push({
            categoria, totalPanel, itemsPanel, origenesDelPanel, saldoHtml
        });
    }

    panelesData.sort((a, b) => {
        let indexA = ordenPanelesGasto.indexOf(a.categoria);
        let indexB = ordenPanelesGasto.indexOf(b.categoria);
        if(indexA === -1) indexA = 999;
        if(indexB === -1) indexB = 999;
        return indexA - indexB;
    });

    panelesData.forEach(p => {
        let isOpen = panelesAbiertos.includes(p.categoria);
        let displayStyle = isOpen ? 'block' : 'none';
        let iconText = isOpen ? '▼' : '▶';

        let hasUnassociated = p.itemsPanel.some(g => {
            if (g.es_clon_destino) return false;
            let isUnassoc = false;
            if (p.origenesDelPanel.length > 1) {
                if (!g.id_origen || !p.origenesDelPanel.includes(g.id_origen)) isUnassoc = true;
            } else if (p.origenesDelPanel.length === 0) {
                isUnassoc = true;
            }
            return isUnassoc && !g.ignorar_origen;
        });
        
        let alertBadge = hasUnassociated ? `<span style="background-color: #fce8e6; color: #c5221f; padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-left: 10px; vertical-align: text-bottom;">⚠️ Falta origen</span>` : '';

        let itemsHTML = p.itemsPanel.map(g => {
            let originHtml = '';
            let isUnassociated = false; 

            if (!g.es_clon_destino) {
                if (p.origenesDelPanel.length > 1) {
                    let options = p.origenesDelPanel.map(idInc => {
                        let io = listaIngresos.find(i => i.id === idInc);
                        let isSelected = (g.id_origen === idInc) ? 'selected' : '';
                        return io ? `<option value="${io.id}" ${isSelected}>${io.nombre}</option>` : '';
                    }).join('');
                    
                    originHtml = `
                        <br>
                        <select onchange="window.cambiarOrigenGastoDirecto('${g.id}', this.value)" style="font-size:10px; padding:2px; margin-top:4px; max-width: 140px; border-radius:4px; border:1px solid #ccc; background:#fff;">
                            <option value="" ${!g.id_origen ? 'selected' : ''}>- Seleccionar Origen -</option>
                            ${options}
                        </select>
                    `;
                    if (!g.id_origen || !p.origenesDelPanel.includes(g.id_origen)) isUnassociated = true; 
                } else if (p.origenesDelPanel.length === 1) {
                    let io = listaIngresos.find(i=>i.id === p.origenesDelPanel[0]);
                    if(io) originHtml = `<br><span style="font-size:10px; color:var(--text-muted);">De: ${io.nombre}</span>`;
                } else {
                    isUnassociated = true; 
                }
            }

            if (!g.es_clon_destino && isUnassociated) {
                originHtml += `
                    <div style="margin-top: 4px; padding: 2px 4px; background: ${g.ignorar_origen ? '#f1f3f4' : '#fce8e6'}; border-radius: 4px; display: inline-block;">
                        <label style="font-size:10px; color:${g.ignorar_origen ? '#5f6368' : '#c5221f'}; display:flex; align-items:center; gap:4px; cursor:pointer; margin:0;">
                            <input type="checkbox" onchange="window.toggleIgnorarOrigenGasto('${g.id}', this.checked)" ${g.ignorar_origen ? 'checked' : ''} style="width:12px; height:12px; margin:0; cursor:pointer;"> 
                            ${g.ignorar_origen ? 'Aviso ignorado' : 'Ignorar falta de origen'}
                        </label>
                    </div>
                `;
            }
            
            let recCheckbox = g.tipo === 'Tarjeta' ? '<span style="color:#ccc; font-size:10px;">N/A</span>' : `<input type="checkbox" style="cursor:pointer;" onchange="window.toggleRecurrenciaGasto('${g.id}', this.checked)" ${g.recurrente !== false ? 'checked' : ''}>`;

            let cuotasDetalle = '';
            let bgRowStyle = '';
            if (g.tipo === 'Tarjeta') {
                cuotasDetalle = `<br><span style="font-size:11px; color:#174ea6;">${g.tarjeta || 'Tarjeta'} (${g.cuotas_pagadas}/${g.cuotas_totales})</span>`;
                if (parseInt(g.cuotas_pagadas) >= parseInt(g.cuotas_totales)) {
                    bgRowStyle = 'background-color: #e6f4ea;';
                }
            }

            let usdBtn = '';
            let breakdownHtml = '';
            if (g.moneda === 'USD') {
                let vImp = g.monto * dImpuesto;
                let sumImp = (vImp * 0.02) + (vImp * 0.21) + (vImp * 0.30);
                let vDeb = g.monto * dDebito;
                let totalCosto = sumImp + vDeb;

                usdBtn = `<br><span style="color:#174ea6; font-size:10px; cursor:pointer; text-decoration:underline;" onclick="document.getElementById('usd-detail-${g.id}').style.display = document.getElementById('usd-detail-${g.id}').style.display === 'none' ? 'table-row' : 'none'">Ver cálculo USD</span>`;
                breakdownHtml = `
                    <tr id="usd-detail-${g.id}" style="display:none; background-color:#f8f9fa;">
                        <td colspan="4" style="padding: 10px; font-size:11px; color:var(--text-muted);">
                            <strong>Cálculo USD:</strong><br>
                            Monto original: U$D ${g.monto}<br>
                            Monto x Dólar Impuesto (${dImpuesto}): $${(vImp).toFixed(2)} -> Impuestos (2%+21%+30%): $${(sumImp).toFixed(2)}<br>
                            Monto x Dólar Débito (${dDebito}): $${(vDeb).toFixed(2)}<br>
                            <b>Subtotal: $${(totalCosto).toFixed(2)}</b>
                            ${(g.divisor && g.divisor > 1) ? `<br><i>Dividido en ${g.divisor} partes: $${(totalCosto/g.divisor).toFixed(2)}</i>` : ''}
                        </td>
                    </tr>
                `;
            }

            let actionsHtml = '';
            if (g.es_clon_destino) {
                actionsHtml = `<span style="font-size:10px; color:#c5221f; font-weight:600;">🔒 Compartido (Edite el original)</span>`;
            } else {
                actionsHtml = `
                    <button class="btn-icon" onclick='window.abrirModalEditarGasto(${JSON.stringify(g).replace(/'/g, "&apos;")})'>✏️</button>
                    <button class="btn-icon" onclick="window.borrarGasto('${g.id}')">🗑️</button>
                `;
            }

            return `
                <tr style="${bgRowStyle}">
                    <td><strong>${g.nombre}</strong>${cuotasDetalle}${originHtml}${usdBtn}</td>
                    <td style="font-weight:600;">${formatearDinero(g.costoCalculado)}</td>
                    <td style="text-align:center;">${recCheckbox}</td>
                    <td style="white-space:nowrap;">${actionsHtml}</td>
                </tr>
                ${breakdownHtml}
            `;
        }).join('');

        contenedor.innerHTML += `
            <div class="card panel-gasto-item" data-categoria="${p.categoria}" style="border-top: 4px solid var(--primary-color);">
                <div style="display:flex; align-items:center;">
                    <span class="drag-handle" style="cursor:grab; margin-right:10px; font-size:20px; color:#ccc;">⠿</span>
                    <div class="card-header-toggle" onclick="window.togglePanelGasto(this)" style="margin-bottom:0; flex:1; display:flex; justify-content:space-between; align-items:center;">
                        <h2 style="margin:0; font-size:15px; flex:1;">
                            ${p.categoria} ${alertBadge}
                            <span style="font-weight:normal; font-size:13px; color:var(--text-muted);">
                                | Total: <b style="color:var(--text-main);">${formatearDinero(p.totalPanel)}</b>
                            </span>
                        </h2>
                        <span class="toggle-icon">${iconText}</span>
                    </div>
                </div>
                
                <div class="card-content" style="display:${displayStyle}; margin-top:15px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #eee;">
                        <button class="btn-black" style="padding: 4px 10px; font-size: 11px;" onclick="window.abrirModalNuevoGasto('${p.categoria}')">➕ Añadir Gasto Aquí</button>
                        <div style="display: flex; gap: 5px;">
                            <button class="btn-icon" onclick="window.editarNombreTipoGastoPanel('${p.categoria}')" title="Editar Panel">✏️</button>
                            <button class="btn-icon" onclick="window.eliminarTipoGastoPanel('${p.categoria}')" title="Eliminar Panel">🗑️</button>
                        </div>
                    </div>

                    <div style="margin-top:10px; border-bottom:1px solid #eee; padding-bottom:10px;">
                        <label style="font-size:11px; color:var(--text-muted); display:block; margin-bottom:5px;">Ingresos que alimentan este panel:</label>
                        <div style="display:flex; flex-wrap:wrap; gap:5px;">
                            ${listaIngresos.map(ing => `
                                <label style="font-size:11px; background:#e8eaed; padding:3px 6px; border-radius:4px; cursor:pointer;">
                                    <input type="checkbox" onchange="window.toggleOrigenPanel('${p.categoria}', '${ing.id}', this.checked)" ${p.origenesDelPanel.includes(ing.id)?'checked':''}>
                                    ${ing.nombre}
                                </label>
                            `).join('')}
                        </div>
                    </div>

                    ${p.saldoHtml}

                    <table style="width:100%; margin-top:10px;">
                        <thead>
                            <tr><th>Gasto</th><th>Costo Mes</th><th>Recurr.</th><th>⚙️</th></tr>
                        </thead>
                        <tbody>
                            ${itemsHTML}
                            ${p.itemsPanel.length === 0 ? '<tr><td colspan="4" style="color:var(--text-muted); text-align:center;">No hay gastos</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    });

    sortablePaneles = Sortable.create(contenedor, {
        handle: '.drag-handle',
        animation: 150,
        onEnd: function (evt) {
            const order = [];
            contenedor.querySelectorAll('.panel-gasto-item').forEach(el => {
                order.push(el.getAttribute('data-categoria'));
            });
            ordenPanelesGasto = order;
            guardarConfiguracionGlobalGlobal(false); 
        }
    });
}

window.abrirModalNuevoGasto = function(categoriaPredefinida = '') {
    document.getElementById('form-gasto').reset();
    document.getElementById('gasto-id').value = "";
    document.getElementById('titulo-modal-gasto').innerText = "Nuevo Gasto";
    window.toggleTercero('gasto');
    window.toggleCamposTarjeta('gasto');
    document.getElementById('gasto-compartir').checked = false;
    window.toggleDivisor('gasto');
    document.getElementById('gasto-recurrente').checked = true; 

    document.getElementById('gasto-monto').dataset.raw = "";
    document.getElementById('gasto-monto-fijo').dataset.raw = "";
    
    if (categoriaPredefinida && tiposGastoAsociaciones.hasOwnProperty(categoriaPredefinida)) {
        document.getElementById('gasto-categoria-select').value = categoriaPredefinida;
    } else if (Object.keys(tiposGastoAsociaciones).length > 0) {
        document.getElementById('gasto-categoria-select').value = Object.keys(tiposGastoAsociaciones)[0];
    }
    
    window.actualizarOrigenesGastoModal();
    document.getElementById('modal-gasto').style.display = 'flex';
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

    const catSelect = document.getElementById('gasto-categoria-select');
    let catValue = data.categoria || "Fijos";
    if(!tiposGastoAsociaciones.hasOwnProperty(catValue)) catValue = Object.keys(tiposGastoAsociaciones)[0] || "";
    catSelect.value = catValue;
    
    document.getElementById('gasto-tipo').value = data.tipo;
    document.getElementById('titulo-modal-gasto').innerText = "Editar Gasto";

    window.toggleTercero('gasto');
    
    if (data.propietario !== 'Tercero') {
        if (data.compartir_con && data.compartir_con.trim() !== '') {
            document.getElementById('gasto-compartir').checked = true;
            document.getElementById('gasto-compartir-con').value = data.compartir_con;
            document.getElementById('gasto-compartir-tipo').value = data.compartir_tipo || 'divisor';
            document.getElementById('gasto-divisor').value = data.divisor || 2;
            
            document.getElementById('gasto-monto-fijo').dataset.raw = data.monto_fijo || 0;
            document.getElementById('gasto-monto-fijo').value = window.formatearDinero(data.monto_fijo || 0, 'ARS');
        } else {
            document.getElementById('gasto-compartir').checked = false;
            document.getElementById('gasto-compartir-con').value = '';
        }
        window.toggleDivisor('gasto');
    }

    window.toggleCamposTarjeta('gasto');
    if (data.tipo === 'Tarjeta') {
        document.getElementById('gasto-tarjeta').value = data.tarjeta || 'VISA';
        document.getElementById('gasto-cuotas-totales').value = data.cuotas_totales || 1;
        document.getElementById('gasto-cuotas-pagadas').value = data.cuotas_pagadas || 1;
    }

    window.actualizarOrigenesGastoModal();
    if (data.id_origen) document.getElementById('gasto-origen-select').value = data.id_origen;

    document.getElementById('modal-gasto').style.display = 'flex';
}

window.actualizarOrigenesGastoModal = function() {
    const cat = document.getElementById('gasto-categoria-select').value;
    let origenesPanel = tiposGastoAsociaciones[cat] || [];
    origenesPanel = origenesPanel.filter(id => id && id.trim() !== "");

    const boxOrigen = document.getElementById('box-gasto-origen');
    const selOrigen = document.getElementById('gasto-origen-select');
    
    selOrigen.innerHTML = '<option value="">-- Seleccionar --</option>';
    if (origenesPanel.length > 1) {
        boxOrigen.style.display = 'block';
        selOrigen.required = true;
        origenesPanel.forEach(id => {
            let ing = listaIngresos.find(i => i.id === id);
            if(ing) selOrigen.add(new Option(ing.nombre, ing.id));
        });
    } else {
        boxOrigen.style.display = 'none';
        selOrigen.required = false;
    }
}

document.getElementById('form-gasto').addEventListener('submit', async (e) => {
    e.preventDefault();
    window.mostrarCargando(true);
    const idGasto = document.getElementById('gasto-id').value;
    const prop = document.getElementById('gasto-propietario').value;
    const tipo = document.getElementById('gasto-tipo').value;
    const cat = document.getElementById('gasto-categoria-select').value;
    const isRecurrente = document.getElementById('gasto-recurrente').checked;
    
    const checkboxCompartir = document.getElementById('gasto-compartir').checked;
    const compCon = document.getElementById('gasto-compartir-con').value.trim();
    const compTipo = document.getElementById('gasto-compartir-tipo').value;
    const montoGasto = parseFloat(document.getElementById('gasto-monto').dataset.raw || window.parseMoney(document.getElementById('gasto-monto').value));
    const montoFijo = parseFloat(document.getElementById('gasto-monto-fijo').dataset.raw || window.parseMoney(document.getElementById('gasto-monto-fijo').value));

    if (prop === 'Propio' && checkboxCompartir && compCon !== '') {
        let catCompartida = "Gastos de " + compCon;
        if (tiposGastoAsociaciones[catCompartida] === undefined) {
            tiposGastoAsociaciones[catCompartida] = [];
            ordenPanelesGasto.push(catCompartida);
            await actualizarConfiguracionDB({
                "configuracion.tipos_gasto": tiposGastoAsociaciones,
                "configuracion.orden_paneles_gasto": ordenPanelesGasto
            });
        }
    }

    let origenesPanel = tiposGastoAsociaciones[cat] || [];
    origenesPanel = origenesPanel.filter(id => id && id.trim() !== "");

    let id_origen = "";
    if(origenesPanel.length > 1) {
        id_origen = document.getElementById('gasto-origen-select').value;
    } else if (origenesPanel.length === 1) {
        id_origen = origenesPanel[0];
    }

    let datosGasto = {
        propietario: prop, 
        tercero_nombre: prop === 'Tercero' ? document.getElementById('gasto-tercero-nombre').value : '',
        nombre: document.getElementById('gasto-nombre').value, 
        monto: montoGasto,
        moneda: document.getElementById('gasto-moneda').value, 
        tipo: tipo,
        categoria: cat, 
        id_origen: id_origen, 
        recurrente: isRecurrente,
        compartir_con: (prop === 'Propio' && checkboxCompartir) ? compCon : '',
        compartir_tipo: (prop === 'Propio' && checkboxCompartir) ? compTipo : 'divisor',
        divisor: (prop === 'Propio' && checkboxCompartir && compTipo === 'divisor') ? parseInt(document.getElementById('gasto-divisor').value) || 1 : 1,
        monto_fijo: (prop === 'Propio' && checkboxCompartir && compTipo === 'fijo') ? montoFijo : null
    };

    let oldGasto = listaGastos.find(g => g.id === idGasto);
    if(oldGasto && oldGasto.ignorar_origen !== undefined) {
        datosGasto.ignorar_origen = oldGasto.ignorar_origen;
    }

    if (tipo === 'Tarjeta') {
        datosGasto.tarjeta = document.getElementById('gasto-tarjeta').value;
        datosGasto.cuotas_totales = parseInt(document.getElementById('gasto-cuotas-totales').value) || 1;
        datosGasto.cuotas_pagadas = parseInt(document.getElementById('gasto-cuotas-pagadas').value) || 1;
    }

    if (idGasto) await updateDoc(doc(db, "finanzas", obtenerMesId(), "gastos", idGasto), datosGasto);
    else await addDoc(collection(db, "finanzas", obtenerMesId(), "gastos"), datosGasto);
    
    window.cerrarModal('modal-gasto');
    await actualizarDashboard();
});

window.borrarGasto = async function(id) { 
    window.mostrarCargando(true);
    await deleteDoc(doc(db, "finanzas", obtenerMesId(), "gastos", id)); 
    await actualizarDashboard(); 
};

window.toggleCamposTarjeta = function(prefix) {
    prefix = prefix || 'gasto';
    const tipo = document.getElementById(`${prefix}-tipo`).value;
    if (tipo === 'Tarjeta') {
        document.getElementById(`campos-tarjeta`).style.display = 'flex';
        document.getElementById(`box-recurrente`).style.display = 'none';
    } else {
        document.getElementById(`campos-tarjeta`).style.display = 'none';
        document.getElementById(`box-recurrente`).style.display = 'flex';
    }
};

window.toggleDivisor = function(prefix) {
    prefix = prefix || 'gasto';
    const checked = document.getElementById(`${prefix}-compartir`).checked;
    const tComp = document.getElementById(`${prefix}-compartir-tipo`).value;
    
    document.getElementById(`${prefix}-compartir-con`).style.display = checked ? 'inline-block' : 'none';
    document.getElementById(`${prefix}-compartir-tipo`).style.display = checked ? 'inline-block' : 'none';

    if (checked) {
        document.getElementById(`${prefix}-compartir-con`).required = true;
        if (tComp === 'divisor') {
            document.getElementById(`${prefix}-divisor`).style.display = 'inline-block';
            document.getElementById(`${prefix}-monto-fijo`).style.display = 'none';
        } else {
            document.getElementById(`${prefix}-divisor`).style.display = 'none';
            document.getElementById(`${prefix}-monto-fijo`).style.display = 'inline-block';
        }
    } else {
        document.getElementById(`${prefix}-compartir-con`).required = false;
        document.getElementById(`${prefix}-divisor`).style.display = 'none';
        document.getElementById(`${prefix}-monto-fijo`).style.display = 'none';
    }
};

window.toggleTercero = function(prefix) {
    prefix = prefix || 'gasto';
    const prop = document.getElementById(`${prefix}-propietario`).value;
    const isTercero = prop === 'Tercero';
    document.getElementById(`${prefix}-tercero-nombre`).style.display = isTercero ? 'inline-block' : 'none';
    document.getElementById(`${prefix}-tercero-nombre`).required = isTercero;
    document.getElementById('box-compartir').style.display = isTercero ? 'none' : 'flex';
    if(isTercero) { document.getElementById(`${prefix}-compartir`).checked = false; window.toggleDivisor(prefix); }
};

window.crearCuentaAhorro = function() {
    let n = prompt("Nombre de la nueva Cuenta de Ahorro (Histórico):");
    if(!n || n.trim() === "") return;
    cuentasAhorro.push({ id: 'ah_' + Date.now(), nombre: n.trim(), depositado: false, saldo_anterior: 0, retiros: 0 });
    guardarConfiguracionAhorros();
}

window.borrarCuentaAhorro = function(id) {
    if(!confirm("¿Seguro que quieres eliminar esta cuenta de ahorro? Los porcentajes asignados a ella quedarán libres y su saldo histórico se perderá.")) return;
    cuentasAhorro = cuentasAhorro.filter(c => c.id !== id);
    
    for(let g in gruposDistribucion) {
        let arrItems = Array.isArray(gruposDistribucion[g]) ? gruposDistribucion[g] : [];
        arrItems.forEach(item => {
            if (item && item.ahorro_id === id) item.ahorro_id = "";
        });
    }
    guardarConfiguracionAhorros();
}

window.editarCuentaAhorro = function(id) {
    let acc = cuentasAhorro.find(c => c.id === id);
    if(!acc) return;
    let n = prompt("Editar nombre:", acc.nombre);
    if(n && n.trim() !== "") {
        acc.nombre = n.trim();
        guardarConfiguracionAhorros();
    }
}

window.toggleDepositoCuenta = function(id) {
    let acc = cuentasAhorro.find(c => c.id === id);
    if(acc) {
        acc.depositado = !acc.depositado;
        guardarConfiguracionAhorros();
    }
}

window.rescatarAhorro = function(id) {
    let acc = cuentasAhorro.find(c => c.id === id);
    if(!acc) return;
    let val = prompt(`¿Cuánto dinero quieres rescatar (retirar) de '${acc.nombre}'?\nUsa números negativos si quieres deshacer un rescate.`);
    if(val !== null && val.trim() !== "") {
        let monto = window.parseMoney(val);
        if(!isNaN(monto)) {
            acc.retiros = (acc.retiros || 0) + monto;
            
            historialAhorros.unshift({
                id: Date.now(),
                fecha: new Date().toLocaleString(),
                accion: monto >= 0 ? 'Retiro' : 'Ajuste',
                objetivo: 'Manual',
                cuenta: acc.nombre,
                monto: monto
            });

            guardarConfiguracionAhorros();
        }
    }
}

async function guardarConfiguracionAhorros() {
    window.mostrarCargando(true);
    await actualizarConfiguracionDB({
        "configuracion.cuentas_ahorro": cuentasAhorro,
        "configuracion.grupos_distribucion": gruposDistribucion,
        "configuracion.historial_ahorros": historialAhorros
    });
    await actualizarDashboard();
}

window.abrirModalHistorial = function() {
    const container = document.getElementById('historial-lista');
    container.innerHTML = '';
    if(!historialAhorros || historialAhorros.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding: 20px;">No hay movimientos recientes.</p>';
    } else {
        historialAhorros.forEach(h => {
            let color = h.accion === 'Ahorrado' ? '#137333' : '#c5221f';
            let icon = h.accion === 'Ahorrado' ? '💰' : '🔙';
            container.innerHTML += `
                <div style="border-bottom: 1px solid #eee; padding: 10px 0; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div style="font-size:11px; color:var(--text-muted);">${h.fecha}</div>
                        <div style="font-weight:500;">${icon} ${h.accion}: <span style="font-weight:normal;">${h.objetivo} -> ${h.cuenta}</span></div>
                    </div>
                    <div style="font-weight:bold; color:${color};">${window.formatearDinero(h.monto)}</div>
                </div>
            `;
        });
    }
    document.getElementById('modal-historial').style.display = 'flex';
}

function renderCuentasAhorro() {
    const cont = document.getElementById('contenedor-cuentas-ahorro');
    cont.innerHTML = '';
    
    let totalAhorrosHistorico = 0;
    let totalDepositadoMes = 0;
    let ahorrosSumaMesActual = {};
    let ahorrosProyectado = {};
    cuentasAhorro.forEach(c => { ahorrosSumaMesActual[c.id] = 0; ahorrosProyectado[c.id] = 0; });
    const dMep = parseFloat(document.getElementById('usd-mep').dataset.raw || 0);

    for(let grupoName in gruposDistribucion) {
        let totalGrupo = sumPorGrupo[grupoName] || 0;
        let arrItems = Array.isArray(gruposDistribucion[grupoName]) ? gruposDistribucion[grupoName] : [];
        arrItems.forEach(it => {
            if(it && it.ahorro_id && ahorrosSumaMesActual[it.ahorro_id] !== undefined) {
                if (it.ahorrado) {
                    ahorrosSumaMesActual[it.ahorro_id] += (it.monto_ahorrado || 0);
                } else {
                    ahorrosProyectado[it.ahorro_id] += totalGrupo * (it.porc / 100);
                }
            }
        });
    }

    let htmlResumen = '';

    cuentasAhorro.forEach(c => {
        let aporteMes = ahorrosSumaMesActual[c.id] || 0;
        let proyMes = ahorrosProyectado[c.id] || 0;
        let saldoAnt = c.saldo_anterior || 0;
        let retiros = c.retiros || 0;
        let sumaTotal = saldoAnt + aporteMes - retiros; 

        totalAhorrosHistorico += sumaTotal;
        if (c.depositado) totalDepositadoMes += aporteMes;

        if (aporteMes > 0 || proyMes > 0) {
            htmlResumen += `<div style="display:flex; justify-content:space-between; margin-bottom:8px; border-bottom:1px solid #eee; padding-bottom:5px;"><span>${c.nombre} ${c.depositado?'(Depositado)':''}</span> <strong style="color:#673ab7;">${window.formatearDinero(aporteMes)} <span style="font-size:10px; color:var(--text-muted); font-weight:normal;">+${window.formatearDinero(proyMes)} proy.</span></strong></div>`;
        }

        let bgStyle = c.depositado ? 'background-color: #e6f4ea; border: 2px solid #137333;' : 'border-top: 4px solid #673ab7; cursor: pointer;';
        let checkIcon = c.depositado ? '✅ ' : '⏳ ';
        let fontColor = c.depositado ? '#137333' : '#673ab7';
        let usdText = dMep > 0 ? `<div style="font-size:14px; color:var(--text-muted); margin-top:5px;">U$D ${(sumaTotal / dMep).toFixed(2)}</div>` : '';
        
        let textSaldoAnt = saldoAnt > 0 ? `<div style="font-size:11px; color:var(--text-muted);">Saldo ant.: ${window.formatearDinero(saldoAnt)}</div>` : '';
        let textAporte = `<div style="font-size:11px; color:var(--text-muted);">Efectivizado mes: ${window.formatearDinero(aporteMes)}</div>`;
        let textProy = proyMes > 0 ? `<div style="font-size:11px; color:#f29900;">Proyectado pendiente: ${window.formatearDinero(proyMes)}</div>` : '';
        let textRetiros = retiros !== 0 ? `<div style="font-size:11px; color:#d93025;">Retiros: -${window.formatearDinero(retiros)}</div>` : '';

        cont.innerHTML += `
            <div class="card tr-clickable" style="${bgStyle} display:flex; flex-direction:column; justify-content:space-between;" onclick="window.toggleDepositoCuenta('${c.id}')">
                <div>
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <h3 style="font-size:15px; color:var(--text-main); font-weight:600; margin:0;">${checkIcon}${c.nombre}</h3>
                        <div onclick="event.stopPropagation();">
                            <button class="btn-icon" onclick="window.rescatarAhorro('${c.id}')" style="font-size:12px;" title="Rescatar / Retirar dinero">💰</button>
                            <button class="btn-icon" onclick="window.editarCuentaAhorro('${c.id}')" style="font-size:12px;">✏️</button>
                            <button class="btn-icon" onclick="window.borrarCuentaAhorro('${c.id}')" style="font-size:12px;">🗑️</button>
                        </div>
                    </div>
                    <div style="margin-top: 10px; display:flex; flex-direction:column; gap:2px;">
                        ${textSaldoAnt}
                        ${textAporte}
                        ${textProy}
                        ${textRetiros}
                    </div>
                    <div class="value" style="color:${fontColor}; font-size:24px; margin-top:5px;">${window.formatearDinero(sumaTotal)}</div>
                    ${usdText}
                </div>
            </div>
        `;
    });

    if(cuentasAhorro.length === 0) {
        cont.innerHTML = `<p style="color:var(--text-muted); font-size:13px; margin:20px;">No has creado Cuentas de Ahorro.</p>`;
    }

    if(htmlResumen === '') htmlResumen = '<p style="color:var(--text-muted); font-size:13px;">No hay ahorros planificados este mes.</p>';
    document.getElementById('res-ahorros-list').innerHTML = htmlResumen;

    let totalUsdText = dMep > 0 ? `<span style="font-size:16px; color:var(--text-muted);">U$D ${(totalAhorrosHistorico / dMep).toFixed(2)}</span>` : '';
    let depositadoUsdText = dMep > 0 ? `<span style="font-size:16px; color:var(--text-muted);">U$D ${(totalDepositadoMes / dMep).toFixed(2)}</span>` : '';
    
    document.getElementById('sum-ahorros-total').innerHTML = `<span>${window.formatearDinero(totalAhorrosHistorico)}</span> ${totalUsdText}`;
    document.getElementById('sum-ahorros-depositado').innerHTML = `<span>${window.formatearDinero(totalDepositadoMes)}</span> ${depositadoUsdText}`;
}

window.crearNuevoGrupoDistribucion = function() {
    const nombre = prompt("Nombre del nuevo Grupo de Distribución:");
    if (!nombre || nombre.trim() === "") return;
    const gNombre = nombre.trim();
    if (gruposDistribucion[gNombre]) return alert("Este grupo ya existe.");
    gruposDistribucion[gNombre] = [{ nombre: "Nuevo Objetivo", porc: 100, ahorrado: false, monto_ahorrado: 0 }];
    autoGuardarDistribucionEstructura(true);
};

window.editarNombreGrupoDistribucion = async function(oldName) {
    const nuevoNombre = prompt("Nuevo nombre para el Grupo de Distribución:", oldName);
    if (!nuevoNombre || nuevoNombre.trim() === "" || nuevoNombre.trim() === oldName) return;
    const limpio = nuevoNombre.trim();
    if (gruposDistribucion[limpio] !== undefined) return alert("Este nombre de grupo ya existe.");
    
    window.mostrarCargando(true);
    gruposDistribucion[limpio] = gruposDistribucion[oldName];
    delete gruposDistribucion[oldName];
    
    const batch = writeBatch(db);
    listaIngresos.forEach(ing => {
        if (ing.grupo === oldName) {
            batch.update(doc(db, "finanzas", obtenerMesId(), "ingresos", ing.id), { grupo: limpio });
        }
    });
    await batch.commit();
    
    await actualizarConfiguracionDB({"configuracion.grupos_distribucion": gruposDistribucion});
    await actualizarDashboard();
}

window.eliminarGrupoDistribucion = function(grupoName) {
    if (confirm(`¿Estás seguro de borrar por completo el grupo '${grupoName}' y todos sus objetivos asignados?`)) {
        delete gruposDistribucion[grupoName];
        autoGuardarDistribucionEstructura(true);
    }
};

window.agregarObjetivoLinea = function(grupoName) {
    if(!Array.isArray(gruposDistribucion[grupoName])) gruposDistribucion[grupoName] = [];
    gruposDistribucion[grupoName].push({ nombre: "Nuevo Objetivo", porc: 0, ahorro_id: "", ahorrado: false, monto_ahorrado: 0 });
    window.recargarDatosVisuales();
    dispararDebounceAutoguardado();
};

window.eliminarObjetivoLinea = function(grupoName, index) {
    if (confirm("¿Seguro que deseas eliminar este objetivo?")) {
        gruposDistribucion[grupoName].splice(index, 1);
        autoGuardarDistribucionEstructura(true);
    }
};

window.actualizarDatoObjetivoMemory = function(grupoName, index, campo, valor) {
    gruposDistribucion[grupoName][index][campo] = campo === 'porc' ? (parseFloat(window.parseMoney(valor)) || 0) : valor;
    dispararDebounceAutoguardado();
};

window.asignarAhorroObjetivo = function(grupoName, index, ahorroId) {
    gruposDistribucion[grupoName][index].ahorro_id = ahorroId;
    dispararDebounceAutoguardado();
    window.recargarDatosVisuales();
}

window.efectivizarAhorroObjetivo = async function(grupoName, index) {
    let it = gruposDistribucion[grupoName][index];
    if (!it.ahorro_id) return alert("Selecciona una Cuenta de Ahorro primero.");
    
    const totalDineroGrupo = sumPorGrupo[grupoName] || 0;
    let monto = totalDineroGrupo * (it.porc / 100);

    it.ahorrado = true;
    it.monto_ahorrado = monto;

    let cuentaName = cuentasAhorro.find(c => c.id === it.ahorro_id)?.nombre || 'Cuenta eliminada';
    
    historialAhorros.unshift({
        id: Date.now(),
        fecha: new Date().toLocaleString(),
        accion: 'Ahorrado',
        objetivo: it.nombre,
        cuenta: cuentaName,
        monto: monto
    });

    autoGuardarDistribucionEstructura(true);
};

window.devolverAhorroObjetivo = async function(grupoName, index) {
    if(!confirm("¿Deshacer este ahorro y devolver el dinero a Disponible?")) return;
    let it = gruposDistribucion[grupoName][index];
    
    let cuentaName = cuentasAhorro.find(c => c.id === it.ahorro_id)?.nombre || 'Cuenta eliminada';
    
    historialAhorros.unshift({
        id: Date.now(),
        fecha: new Date().toLocaleString(),
        accion: 'Devuelto',
        objetivo: it.nombre,
        cuenta: cuentaName,
        monto: it.monto_ahorrado
    });

    it.ahorrado = false;
    it.monto_ahorrado = 0;

    autoGuardarDistribucionEstructura(true);
};

window.calcularBidireccionalLinea = function(grupoName, index, disparadoPor) {
    const totalDineroGrupo = sumPorGrupo[grupoName] || 0;
    const inpPct = document.getElementById(`pct-${grupoName}-${index}`);
    const inpPesos = document.getElementById(`pesos-${grupoName}-${index}`);

    let pesosCalculados = 0;

    if (disparadoPor === 'pct') {
        let pct = parseFloat(window.parseMoney(inpPct.value)) || 0;
        pesosCalculados = (totalDineroGrupo * (pct / 100));
        inpPesos.dataset.raw = pesosCalculados;
        inpPesos.value = window.formatearDinero(pesosCalculados);
        gruposDistribucion[grupoName][index].porc = pct;
    } else {
        pesosCalculados = parseFloat(window.parseMoney(inpPesos.value)) || 0;
        let pctCalculado = totalDineroGrupo > 0 ? ((pesosCalculados / totalDineroGrupo) * 100) : 0;
        inpPct.dataset.raw = pctCalculado;
        inpPct.value = pctCalculado.toFixed(2);
        gruposDistribucion[grupoName][index].porc = parseFloat(pctCalculado);
    }
    
    const dMep = parseFloat(document.getElementById('usd-mep').dataset.raw || 0);
    const lblUsd = document.getElementById(`usd-calc-${grupoName}-${index}`);
    if (lblUsd && dMep > 0) {
        lblUsd.innerText = `U$D ${(pesosCalculados / dMep).toFixed(2)}`;
    }

    let sumTotalPctCard = 0;
    gruposDistribucion[grupoName].forEach((_, idx) => {
        let pVal = parseFloat(window.parseMoney(document.getElementById(`pct-${grupoName}-${idx}`).value)) || 0;
        sumTotalPctCard += pVal;
    });
    const lblSum = document.getElementById(`sum-card-pct-${grupoName}`);
    if (lblSum) {
        lblSum.innerText = `Total: ${sumTotalPctCard.toFixed(2)}%`;
        lblSum.style.color = Math.abs(sumTotalPctCard - 100) < 0.1 ? 'green' : 'red';
    }

    dispararDebounceAutoguardado();
    window.recargarDatosVisuales();
};

function dispararDebounceAutoguardado() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        autoGuardarDistribucionEstructura(false);
    }, 800);
}

async function autoGuardarDistribucionEstructura(recargarUI = false) {
    try {
        if(recargarUI) window.mostrarCargando(true);
        await actualizarConfiguracionDB({
            "configuracion.grupos_distribucion": gruposDistribucion,
            "configuracion.historial_ahorros": historialAhorros
        });
        if(recargarUI) await actualizarDashboard();
    } catch(e) { console.error("Error autoguardando:", e); }
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
                let restante = ing.monto - consumido;
                sumPorGrupo[ing.grupo] = (sumPorGrupo[ing.grupo] || 0) + restante;
                totalDistribuibleGlobal += restante;
            }
        });
    }
    
    totalDistribuibleGlobal -= totalAhorrosEfectivizados;

    let resHtml = '';
    if(Object.keys(gruposDistribucion).length === 0) {
        divDist.innerHTML = '<p style="color:var(--text-muted); font-size:13px;">No hay grupos de distribución creados.</p>';
    }

    for(let grupoName in gruposDistribucion) {
        let totalGrupo = sumPorGrupo[grupoName] || 0;
        let cfgItems = Array.isArray(gruposDistribucion[grupoName]) ? gruposDistribucion[grupoName] : [];
        let sumPorcentajesGrupo = cfgItems.reduce((acc, el) => acc + (el.porc || 0), 0);
        let colorValidacion = Math.abs(sumPorcentajesGrupo - 100) < 0.1 ? 'green' : 'red';

        let grupoAhorrado = 0;
        cfgItems.forEach(it => { if(it.ahorrado) grupoAhorrado += (it.monto_ahorrado || 0); });
        let disponibleReal = totalGrupo - grupoAhorrado;

        let htmlBlock = `
            <div style="background:#f8f9fa; border-radius:8px; padding:15px; margin-bottom:15px; border:1px solid var(--card-border);">
                <div style="display:flex; justify-content:space-between; margin-bottom:10px; align-items:center; flex-wrap:wrap; gap:5px;">
                    <div style="display:flex; align-items:center; gap:5px;">
                        <strong style="font-size:14px; color:var(--text-main);">${grupoName}</strong>
                        <button class="btn-icon" onclick="window.editarNombreGrupoDistribucion('${grupoName}')" style="font-size:12px;">✏️</button>
                    </div>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span id="sum-card-pct-${grupoName}" style="font-size:12px; font-weight:bold; color:${colorValidacion};">Total: ${sumPorcentajesGrupo.toFixed(2)}%</span>
                        <span style="font-weight:600; font-size:13px; color:#4285F4;">Disp. Restante: ${window.formatearDinero(disponibleReal)}</span>
                        <button class="btn-icon" onclick="window.eliminarGrupoDistribucion('${grupoName}')" title="Eliminar Grupo Completo">❌</button>
                    </div>
                </div>
                <div style="display:flex; flex-direction:column; gap:8px;">
        `;

        resHtml += `<strong style="font-size:13px; display:block; margin-top:10px;">${grupoName}:</strong><div style="font-size: 13px; color: var(--text-muted); line-height: 1.6;">`;

        cfgItems.forEach((it, idx) => {
            if(!it) return;
            let dineroCalculado = totalGrupo * ((it.porc || 0) / 100);
            let opcionesAhorroHTML = cuentasAhorro.map(c => `<option value="${c.id}" ${it.ahorro_id === c.id ? 'selected':''}>${c.nombre}</option>`).join('');

            if (it.ahorrado) {
                htmlBlock += `
                    <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; background: #e6f4ea; padding: 8px; border-radius: 6px; border: 1px solid #137333;">
                        <span style="flex:2; font-size:12px; font-weight:600; color:#137333;">🔒 ${it.nombre}</span>
                        <span style="width:60px; text-align:center; font-size:12px; color:#137333;">${Number(it.porc).toFixed(2)}%</span>
                        <span style="width:105px; font-size:13px; font-weight:bold; color:#137333;">${window.formatearDinero(it.monto_ahorrado)}</span>
                        <span style="width:110px; font-size:11px; color:#137333; font-style:italic;">-> ${cuentasAhorro.find(c => c.id === it.ahorro_id)?.nombre || 'Cta'}</span>
                        <button class="btn-icon" onclick="window.devolverAhorroObjetivo('${grupoName}', ${idx})" title="Deshacer y Devolver a Disponible">🔙</button>
                    </div>
                `;
                let usdSummary = dMep > 0 ? ` <span style="font-size:11px; color:var(--text-muted);">(U$D ${(it.monto_ahorrado/dMep).toFixed(2)})</span>` : '';
                resHtml += `<span style="color: #137333;">🔒 ${it.nombre} (${Number(it.porc).toFixed(2)}%):</span> ${window.formatearDinero(it.monto_ahorrado)}${usdSummary}<br>`;
            } else {
                let usdText = dMep > 0 ? `<div id="usd-calc-${grupoName}-${idx}" style="font-size:10px; color:var(--text-muted); text-align:center; margin-top:2px;">U$D ${(dineroCalculado / dMep).toFixed(2)}</div>` : `<div id="usd-calc-${grupoName}-${idx}" style="font-size:10px; color:var(--text-muted); text-align:center; margin-top:2px;"></div>`;

                htmlBlock += `
                    <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                        <input type="text" value="${it.nombre}" style="flex:2; padding:5px; font-size:12px;" oninput="window.actualizarDatoObjetivoMemory('${grupoName}', ${idx}, 'nombre', this.value)" placeholder="Objetivo">
                        <input type="text" id="pct-${grupoName}-${idx}" value="${Number(it.porc).toFixed(2)}" style="width:60px; padding:5px; font-size:12px; text-align:center;" onblur="window.calcularBidireccionalLinea('${grupoName}', ${idx}, 'pct')" placeholder="%">
                        <span style="font-size:11px;">%</span>
                        <div style="display:flex; flex-direction:column;">
                            <input type="text" id="pesos-${grupoName}-${idx}" value="${window.formatearDinero(dineroCalculado)}" class="money-input" style="width:105px; padding:5px; font-size:12px;" data-raw="${dineroCalculado}" onfocus="window.onMoneyFocus(this)" onblur="window.calcularBidireccionalLinea('${grupoName}', ${idx}, 'pesos'); window.onMoneyBlur(this, 'ARS')" placeholder="$">
                            ${usdText}
                        </div>
                        
                        <select onchange="window.asignarAhorroObjetivo('${grupoName}', ${idx}, this.value)" style="width:110px; padding:4px; font-size:11px; background:#f1f3f4; border:1px solid #ccc; border-radius:4px;">
                            <option value="">-- Cuenta Ahorro --</option>
                            ${opcionesAhorroHTML}
                        </select>
                        
                        <button class="btn-icon" onclick="window.efectivizarAhorroObjetivo('${grupoName}', ${idx})" title="Ahorrar este monto">💰</button>
                        <button class="btn-icon" onclick="window.eliminarObjetivoLinea('${grupoName}', ${idx})">🗑️</button>
                    </div>
                `;
                let usdSummary = dMep > 0 ? ` <span style="font-size:11px; color:var(--text-muted);">(U$D ${(dineroCalculado/dMep).toFixed(2)})</span>` : '';
                resHtml += `<span style="color: var(--text-main);">${it.nombre} (${Number(it.porc).toFixed(2)}%):</span> ${window.formatearDinero(dineroCalculado)}${usdSummary}<br>`;
            }
        });

        htmlBlock += `
                </div>
                <button class="btn-black" style="margin-top:10px; padding:4px 12px; font-size:12px; background-color:#f1f3f4; color:var(--text-main); border:1px solid #ccc;" onclick="window.agregarObjetivoLinea('${grupoName}')">➕ Añadir Ítem Objetivo</button>
            </div>
        `;
        resHtml += `</div>`;
        divDist.innerHTML += htmlBlock;
    }

    resDist.innerHTML = `<div style="font-size: 18px; font-weight: bold; margin-bottom: 8px; color: #4285F4;">Disponible Total Libre: ${window.formatearDinero(totalDistribuibleGlobal)}</div>` + resHtml;
}

window.abrirModalNuevoIngreso = function() {
    document.getElementById('form-ingreso').reset(); document.getElementById('ingreso-id').value = "";
    document.getElementById('titulo-modal-ingreso').innerText = "Nuevo Ingreso";
    document.getElementById('ingreso-grupo').value = "";
    document.getElementById('ingreso-monto').dataset.raw = "";
    document.getElementById('modal-ingreso').style.display = 'flex';
}

window.abrirModalEditarIngreso = function(data) {
    document.getElementById('ingreso-id').value = data.id; document.getElementById('ingreso-nombre').value = data.nombre;
    
    document.getElementById('ingreso-monto').dataset.raw = data.monto;
    document.getElementById('ingreso-monto').value = window.formatearDinero(data.monto, 'ARS');

    document.getElementById('ingreso-grupo').value = data.grupo || "";
    document.getElementById('titulo-modal-ingreso').innerText = "Editar Ingreso";
    document.getElementById('modal-ingreso').style.display = 'flex';
}

document.getElementById('form-ingreso').addEventListener('submit', async (e) => {
    e.preventDefault(); window.mostrarCargando(true);
    const id = document.getElementById('ingreso-id').value;
    const data = { 
        nombre: document.getElementById('ingreso-nombre').value, 
        monto: parseFloat(document.getElementById('ingreso-monto').dataset.raw || window.parseMoney(document.getElementById('ingreso-monto').value)), 
        grupo: document.getElementById('ingreso-grupo').value 
    };
    if(id) await updateDoc(doc(db, "finanzas", obtenerMesId(), "ingresos", id), data);
    else await addDoc(collection(db, "finanzas", obtenerMesId(), "ingresos"), data);
    window.cerrarModal('modal-ingreso'); await actualizarDashboard();
});

window.borrarIngreso = async function(id) { 
    window.mostrarCargando(true); 
    await deleteDoc(doc(db, "finanzas", obtenerMesId(), "ingresos", id)); 
    await actualizarDashboard(); 
};

function renderTablaIngresos(gastosProc) {
    const tabla = document.getElementById('tabla-ingresos');
    tabla.innerHTML = ''; 
    totalIngresosGlobal = 0;
    let totalDisponibleGlobalIngresos = 0;
    
    let chartLabels = []; let chartData = []; let chartColors = [];

    if (!Array.isArray(gastosProc)) {
        const dDebito = parseFloat(document.getElementById('usd-debito').dataset.raw || 0);
        const dImpuesto = parseFloat(document.getElementById('usd-impuesto').dataset.raw || 0);
        gastosProc = procesarListaGastos(dDebito, dImpuesto);
    }

    const filter = document.getElementById('filtro-texto-ingresos').value.toLowerCase();

    if(listaIngresos) {
        listaIngresos.forEach((data, index) => {
            if (filter && !data.nombre.toLowerCase().includes(filter)) return;
            
            let assignedColor = colorPalette[index % colorPalette.length];
            totalIngresosGlobal += data.monto;
            
            let consumido = sumatoriaGastosPorOrigen[data.id] || 0;
            let disponibleReal = data.monto - consumido;
            totalDisponibleGlobalIngresos += disponibleReal;

            chartLabels.push(data.nombre); 
            chartData.push(data.monto); 
            chartColors.push(assignedColor);

            let gastosAsociados = gastosProc.filter(g => g.propietario !== 'Tercero' && getOrigenIdDeGasto(g) === data.id);

            const trMain = document.createElement('tr');
            trMain.className = "tr-clickable";
            trMain.onclick = function() { window.toggleIngresoDetalle(data.id); };
            
            trMain.innerHTML = `
                <td>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span id="icon-ingreso-${data.id}" style="font-size:10px; color:var(--text-muted);">▶</span>
                        <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background-color:${assignedColor};"></span>
                        ${data.nombre}
                    </div>
                </td>
                <td><span style="background:#e8eaed; padding:2px 6px; border-radius:4px; font-size:11px;">${data.grupo || 'Ninguno'}</span></td>
                <td style="color:var(--text-muted);">${window.formatearDinero(data.monto)}</td>
                <td style="font-weight:600; color:${disponibleReal < 0 ? '#d93025' : '#137333'}">${window.formatearDinero(disponibleReal)}</td>
                <td style="white-space: nowrap;">
                    <button class="btn-icon" onclick='event.stopPropagation(); window.abrirModalEditarIngreso(${JSON.stringify(data).replace(/"/g, '&quot;')})'>✏️</button>
                    <button class="btn-icon" onclick="event.stopPropagation(); window.borrarIngreso('${data.id}')">🗑️</button>
                </td>
            `;
            tabla.appendChild(trMain);

            const trDetail = document.createElement('tr');
            trDetail.id = `detalle-ingreso-${data.id}`;
            trDetail.className = "details-row";
            trDetail.style.display = "none";
            trDetail.innerHTML = `
                <td colspan="5" style="padding: 10px 15px; background-color: #fcfcfc; border-bottom: 2px solid var(--card-border);">
                    <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 10px;">
                        <span style="font-size: 13px; font-weight: 600;">Gastos de este origen</span>
                        <input type="text" placeholder="Buscar gasto..." style="padding: 4px 8px; font-size: 11px; border: 1px solid #ccc; border-radius: 4px; width: 150px;" onkeyup="window.filtrarGastosIngreso('${data.id}', this.value)">
                    </div>
                    <ul id="lista-gastos-ingreso-${data.id}" style="list-style: none; padding: 0; margin: 0; font-size: 12px; color: var(--text-muted); display:flex; flex-direction:column; gap:4px; max-height: 200px; overflow-y: auto;">
                        ${gastosAsociados.length > 0 ? gastosAsociados.map(g => `
                            <li class="gasto-item-origen" data-nombre="${g.nombre.toLowerCase()}">
                                <span style="display:inline-block; width:90px; font-weight:600; color:var(--text-main);">${window.formatearDinero(g.costoCalculado)}</span> - 
                                <span>${g.nombre} <i style="color:#aaa; font-size:10px;">(${g.categoria})</i></span>
                            </li>
                        `).join('') : '<li style="color:#999; font-style:italic;">No hay gastos descontados de este origen</li>'}
                    </ul>
                </td>
            `;
            tabla.appendChild(trDetail);
        });
    }

    document.getElementById('sum-ingresos-mes').innerText = window.formatearDinero(totalIngresosGlobal);
    document.getElementById('sum-ingresos-disponible').innerText = `${window.formatearDinero(totalDisponibleGlobalIngresos)} Disp.`;
    document.getElementById('res-ingresos-mes').innerText = window.formatearDinero(totalIngresosGlobal);

    if (chartIngresos) chartIngresos.destroy();
    chartIngresos = new Chart(document.getElementById('chart-ingresos-mes').getContext('2d'), {
        type: 'pie', data: { labels: chartLabels, datasets: [{ data: chartData, backgroundColor: chartColors }] }, 
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
}

function calcularBalance() {
    const balance = totalIngresosGlobal - totalGastosGlobal - totalAhorrosEfectivizados;
    const bElement = document.getElementById('res-balance');
    bElement.innerText = window.formatearDinero(balance);
    bElement.style.color = balance >= 0 ? '#137333' : '#d93025';

    if (chartResumen) chartResumen.destroy();
    chartResumen = new Chart(document.getElementById('chart-resumen').getContext('2d'), {
        type: 'pie', data: { 
            labels: ['Gastos Totales', 'Ahorrado Congelado', 'Disponible Libre'], 
            datasets: [{ 
                data: [totalGastosGlobal, totalAhorrosEfectivizados, balance > 0 ? balance : 0], 
                backgroundColor: ['#EA4335', '#9c27b0', '#4285F4'] 
            }] 
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: {boxWidth: 10, font: {size: 10}} } } }
    });
}

async function cargarEstadisticasAnuales() {
    const anio = anioSelector.value;
    const meses = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    const nombresMeses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    
    let ingresosData = new Array(12).fill(0);
    let gastosData = new Array(12).fill(0);
    let ahorrosData = new Array(12).fill(0);

    window.mostrarCargando(true);

    const promesas = meses.map(async (mes, index) => {
        const mesId = `${anio}-${mes}`;
        const docSnap = await getDoc(doc(db, "finanzas", mesId));
        let dDebito = 0, dImpuesto = 0;
        let gruposDistLocal = {};
        let tiposGastoLocal = {};
        
        if (docSnap.exists() && docSnap.data().configuracion) {
            dDebito = docSnap.data().configuracion.dolar_debito || 0;
            dImpuesto = docSnap.data().configuracion.dolar_impuesto || 0;
            gruposDistLocal = docSnap.data().configuracion.grupos_distribucion || {};
            let oldTipos = docSnap.data().configuracion.tipos_gasto || {};
            for(let k in oldTipos) {
                if (typeof oldTipos[k] === 'string') {
                    oldTipos[k] = oldTipos[k] !== "" ? [oldTipos[k]] : [];
                } else if (!Array.isArray(oldTipos[k])) {
                    oldTipos[k] = Object.values(oldTipos[k]);
                }
            }
            tiposGastoLocal = oldTipos;
        }

        let sumatoriaGastosPorOrigenLocal = {};
        const gasSnap = await getDocs(collection(db, "finanzas", mesId, "gastos"));
        let totalGas = 0;
        gasSnap.forEach(d => {
            let g = d.data();
            if (g.propietario === 'Tercero') return;
            let costoCalculado = getCostoCalculado(g, dDebito, dImpuesto);
            
            if (g.compartir_con && g.compartir_tipo) {
                let cuotaTotal = g.tipo === 'Tarjeta' ? (costoCalculado / (g.cuotas_totales || 1)) : costoCalculado;
                if (g.compartir_tipo === 'divisor') {
                    costoCalculado = cuotaTotal / (g.divisor || 2);
                } else if (g.compartir_tipo === 'fijo') {
                    costoCalculado = g.monto_fijo || 0;
                }
            }

            totalGas += costoCalculado;
            
            let catAsociada = g.categoria || "Fijos";
            let origenesPanel = tiposGastoLocal[catAsociada] || [];
            let origenId = g.id_origen || (origenesPanel.length > 0 ? origenesPanel[0] : null);
            if (origenId) {
                sumatoriaGastosPorOrigenLocal[origenId] = (sumatoriaGastosPorOrigenLocal[origenId] || 0) + costoCalculado;
            }
        });
        gastosData[index] = totalGas;

        let sumPorGrupoLocal = {};
        const ingSnap = await getDocs(collection(db, "finanzas", mesId, "ingresos"));
        let totalIng = 0; 
        ingSnap.forEach(d => { 
            let ing = {id: d.id, ...d.data()};
            totalIng += ing.monto; 
            if (ing.grupo) {
                let consumido = sumatoriaGastosPorOrigenLocal[ing.id] || 0;
                let restante = ing.monto - consumido;
                sumPorGrupoLocal[ing.grupo] = (sumPorGrupoLocal[ing.grupo] || 0) + restante;
            }
        });
        ingresosData[index] = totalIng;

        let totalAhorroMes = 0;
        for(let gName in gruposDistLocal) {
            let cfgItemsLocal = Array.isArray(gruposDistLocal[gName]) ? gruposDistLocal[gName] : [];
            cfgItemsLocal.forEach(it => {
                if (it && it.ahorro_id && it.ahorrado) {
                    totalAhorroMes += (it.monto_ahorrado || 0);
                }
            });
        }
        ahorrosData[index] = totalAhorroMes;

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
                { label: 'Ahorro Planificado', data: ahorrosData, backgroundColor: '#9C27B0' }
            ]
        },
        options: { 
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } },
            scales: { y: { beginAtZero: true } },
            tooltips: { callbacks: { label: function(t, d) { return window.formatearDinero(t.yLabel); } } }
        }
    });
    window.mostrarCargando(false);
}

window.abrirModalCargaMasiva = function() { document.getElementById('archivo-csv').value = ""; document.getElementById('modal-carga-masiva').style.display = 'flex'; }
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
                    let monto = parseFloat(col[1].replace(',', '.'));
                    if (!col[0] || isNaN(monto)) continue;
                    let tipo = (col[3]||'').toLowerCase().includes('tarjeta') ? 'Tarjeta' : 'Fijo';
                    batch.set(doc(ref), {
                        propietario: 'Propio', tercero_nombre: '', nombre: col[0], monto: monto, moneda: col[2].toUpperCase() === 'USD' ? 'USD' : 'ARS',
                        tipo: tipo, categoria: "Fijos", id_origen: "", recurrente: true, 
                        compartir_con: '', compartir_tipo: 'divisor', divisor: parseInt(col[4]) || 1, monto_fijo: null,
                        tarjeta: tipo === 'Tarjeta' ? (col[5]||'VISA') : null,
                        cuotas_totales: tipo === 'Tarjeta' ? (parseInt(col[6])||1) : null, cuotas_pagadas: tipo === 'Tarjeta' ? (parseInt(col[7])||1) : null
                    });
                    count++;
                }
            }
            if(count>0){ await batch.commit(); window.cerrarModal('modal-carga-masiva'); await actualizarDashboard(); }
            else { window.mostrarCargando(false); }
        } catch(e){ window.mostrarCargando(false); alert("Error CSV."); }
    };
    reader.readAsText(input.files[0]);
};

window.copiarMesAnterior = async function() {
    if(!confirm("¿Importar todos los datos y saldo acumulado de ahorros del mes anterior?")) return;
    window.mostrarCargando(true);
    let m = parseInt(mesSelector.value)-1, a = parseInt(anioSelector.value);
    if(m===0){ m=12; a--; }
    const prev = `${a}-${m.toString().padStart(2, '0')}`;
    const actual = obtenerMesId();

    try {
        const prevDocSnap = await getDoc(doc(db, "finanzas", prev));
        let prevData = prevDocSnap.exists() ? prevDocSnap.data() : { configuracion: {} };
        let prevConfig = prevData.configuracion || {};

        let dDebito = prevConfig.dolar_debito || 0;
        let dImpuesto = prevConfig.dolar_impuesto || 0;
        let prevTipos = prevConfig.tipos_gasto || {};
        let prevDist = prevConfig.grupos_distribucion || {};
        let prevCuentas = prevConfig.cuentas_ahorro || [];

        let sumatoriaGastosPrev = {};
        const snapG = await getDocs(collection(db, "finanzas", prev, "gastos"));
        let prevGastosToCopy = [];
        snapG.forEach(d => {
            let g = d.data();
            if(g.tipo==='Tarjeta'){ 
                if(g.cuotas_pagadas < g.cuotas_totales) {
                    let gCopy = {...g};
                    gCopy.cuotas_pagadas++; 
                    prevGastosToCopy.push(gCopy);
                }
            } else if (g.tipo === 'Fijo' && g.recurrente !== false) {
                prevGastosToCopy.push({...g});
            }

            if(g.propietario !== 'Tercero') {
                let costo = getCostoCalculado(g, dDebito, dImpuesto);
                if (g.compartir_con && g.compartir_tipo) {
                    let cuotaTotal = g.tipo === 'Tarjeta' ? (costo / (g.cuotas_totales || 1)) : costo;
                    if (g.compartir_tipo === 'divisor') costo = cuotaTotal / (g.divisor || 2);
                    else costo = g.monto_fijo || 0;
                }

                let catAsociada = g.categoria || "Fijos";
                let origenesPanel = prevTipos[catAsociada] || [];
                let origenId = g.id_origen || (origenesPanel.length > 0 ? origenesPanel[0] : null);
                if (origenId) {
                    sumatoriaGastosPrev[origenId] = (sumatoriaGastosPrev[origenId] || 0) + costo;
                }
            }
        });

        let sumPorGrupoPrev = {};
        const snapI = await getDocs(collection(db, "finanzas", prev, "ingresos"));
        let prevIngresosToCopy = [];
        snapI.forEach(d => {
            let ing = {id: d.id, ...d.data()};
            prevIngresosToCopy.push(d.data());
            if (ing.grupo) {
                let consumido = sumatoriaGastosPrev[ing.id] || 0;
                let restante = ing.monto - consumido;
                sumPorGrupoPrev[ing.grupo] = (sumPorGrupoPrev[ing.grupo] || 0) + restante;
            }
        });

        let ahorrosSumaPrev = {};
        for(let gName in prevDist) {
            let arrItems = Array.isArray(prevDist[gName]) ? prevDist[gName] : [];
            arrItems.forEach(it => {
                if (it && it.ahorro_id && it.ahorrado) {
                    ahorrosSumaPrev[it.ahorro_id] = (ahorrosSumaPrev[it.ahorro_id] || 0) + (it.monto_ahorrado || 0);
                }
            });
        }

        let nuevasCuentas = prevCuentas.map(c => {
            let aportePrev = ahorrosSumaPrev[c.id] || 0;
            let saldoFinalPrev = (c.saldo_anterior || 0) + aportePrev - (c.retiros || 0);
            return {
                id: c.id,
                nombre: c.nombre,
                depositado: false,
                saldo_anterior: saldoFinalPrev,
                retiros: 0
            };
        });

        prevConfig.cuentas_ahorro = nuevasCuentas;

        await setDoc(doc(db, "finanzas", actual), { configuracion: prevConfig }, { merge: true });

        for(const g of prevGastosToCopy) { await addDoc(collection(db, "finanzas", actual, "gastos"), g); }
        for(const ing of prevIngresosToCopy) { await addDoc(collection(db, "finanzas", actual, "ingresos"), ing); }

        await actualizarDashboard();
    } catch (e) { 
        console.error(e);
        window.mostrarCargando(false); 
        alert("Error al copiar datos: " + e.message); 
    }
};

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').then(reg => {
            console.log('SW registrado correctamente.');
        }).catch(err => console.log('Error registrando SW: ', err));
    });
}
