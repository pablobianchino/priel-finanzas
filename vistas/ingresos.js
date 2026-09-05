export const vistaIngresos = `
<div id="ingresos" class="view">
    <div class="card" style="margin-bottom: 20px; border-top: 4px solid var(--text-muted);">
        <div class="card-header-toggle" onclick="window.toggleCard(this)">
            <h2 style="margin: 0; font-size: 16px;">Configuración USD</h2><span class="toggle-icon">▼</span>
        </div>
        <div class="card-content" style="display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
            <label>MEP (Ahorros): <input type="text" id="usd-mep-ingresos" class="money-input" value="0" style="width: 100px; padding: 6px;" onfocus="window.onMoneyFocus(this)" onblur="window.onMoneyBlur(this, 'ARS')"></label>
            <label>MEP Tarjeta (Gastos): <input type="text" id="usd-debito-ingresos" class="money-input" value="0" style="width: 100px; padding: 6px;" onfocus="window.onMoneyFocus(this)" onblur="window.onMoneyBlur(this, 'ARS')"></label>
            <label>Impuesto (Gastos): <input type="text" id="usd-impuesto-ingresos" class="money-input" value="0" style="width: 100px; padding: 6px;" onfocus="window.onMoneyFocus(this)" onblur="window.onMoneyBlur(this, 'ARS')"></label>
            <button class="btn-black" style="padding: 6px 15px;" onclick="window.guardarConfiguracionDolar('ingresos')">Guardar Rate</button>
        </div>
    </div>

    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap:10px;">
        <h2 style="margin: 0;">Gestión de Ingresos</h2>
        <div style="display: flex; gap: 10px;">
            <button onclick="window.abrirModalHistorial()" class="btn-black" style="background-color: var(--highlight-bg); color: var(--text-main); border: 1px solid var(--card-border);">🧾 Historial Ahorros</button>
            <button onclick="window.abrirModalNuevoIngreso()" class="btn-black">➕ Nuevo Ingreso</button>
            <button onclick="window.crearNuevoGrupoDistribucion()" class="btn-black" style="background-color: var(--highlight-bg); color: var(--text-main); border: 1px solid var(--card-border);">➕ Nuevo Grupo Dist.</button>
        </div>
    </div>
    <div class="filter-bar"><input type="text" id="filtro-texto-ingresos" placeholder="Buscar ingreso..." style="flex: 1;"></div>
    <div class="grid-2">
        <div class="card" style="border-top: 4px solid #34A853;">
            <div class="card-header-toggle" onclick="window.toggleCard(this)">
                <h3 style="font-size:15px;">Ingresos del Mes</h3>
                <div style="display:flex; align-items:center; gap:10px;">
                    <div style="display:flex; flex-direction:column; text-align:right;">
                        <span style="font-size: 11px; color:var(--text-muted);">Total Bruto: <span id="sum-ingresos-mes"></span></span>
                        <span class="value" id="sum-ingresos-disponible" style="font-size: 16px; margin: 0; color:#137333;">$0,00 Disp.</span>
                    </div>
                    <span class="toggle-icon">▼</span>
                </div>
            </div>
            <div class="card-content">
                <table>
                    <thead><tr><th>Origen</th><th>Grupo Vinculado</th><th>Bruto</th><th>Disponible</th><th>⚙️</th></tr></thead>
                    <tbody id="tabla-ingresos"></tbody>
                </table>
                <div class="chart-container" style="height: 250px; margin-top:20px;"><canvas id="chart-ingresos-mes"></canvas></div>
            </div>
        </div>
        <div class="card" style="border-top: 4px solid #f29900;">
            <div class="card-header-toggle" onclick="window.toggleCard(this)">
                <h3 style="font-size: 15px;">Distribución Directa de Objetivos</h3><span class="toggle-icon">▼</span>
            </div>
            <div class="card-content" id="tabla-distribucion"></div>
        </div>
    </div>
</div>
`;
