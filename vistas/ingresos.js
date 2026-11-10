export const vistaIngresos = `
<div id="ingresos" class="view">
    <!-- PANEL RESUMEN USD (TERCEROS + PROPIOS) -->
    <div id="panel-resumen-usd-ingresos" class="card" style="display:none; margin-bottom: 14px;">
        <div class="card-header-toggle" onclick="window.toggleCard(this)">
            <h2 style="margin: 0;">Gastos en dólares (incluye terceros)</h2><span class="toggle-icon">▼</span>
        </div>
        <div class="card-content" id="contenido-resumen-usd-ingresos"></div>
    </div>

    <div style="display: flex; justify-content: space-between; align-items: center; margin: 0 0 12px; flex-wrap: wrap; gap:10px;">
        <h2 style="margin: 0; font-size: 16px;">Gestión de ingresos</h2>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button onclick="window.abrirModalHistorial()" class="btn-black btn-sec"><i class="ti ti-history"></i>Historial de ahorros</button>
            <button onclick="window.crearNuevoGrupoDistribucion()" class="btn-black btn-sec"><i class="ti ti-chart-pie"></i>Nuevo grupo</button>
            <button onclick="window.abrirModalNuevoIngreso()" class="btn-black"><i class="ti ti-plus"></i>Nuevo ingreso</button>
        </div>
    </div>
    <div class="filter-bar"><input type="text" id="filtro-texto-ingresos" placeholder="Buscar ingreso..." style="flex: 1;"></div>
    <div class="grid-2" style="align-items: start;">
        <div class="card">
            <div class="card-header-toggle" onclick="window.toggleCard(this)">
                <h3>Ingresos del mes</h3>
                <div style="display:flex; align-items:center; gap:10px;">
                    <div style="display:flex; flex-direction:column; text-align:right;">
                        <span class="value" id="sum-ingresos-disponible" style="font-size: 14px; margin: 0;">$0,00 Disp.</span>
                        <span id="sum-ingresos-cobrar" class="sub"></span>
                    </div>
                    <span class="toggle-icon">▼</span>
                </div>
            </div>
            <div class="card-content">
                <table>
                    <thead><tr><th>Origen</th><th>Grupo</th><th class="num">Bruto</th><th class="num">Gastado</th><th class="num">Disponible</th><th style="width:34px;"></th></tr></thead>
                    <tbody id="tabla-ingresos"></tbody>
                    <tfoot id="tfoot-ingresos"></tfoot>
                </table>
                <div class="chart-container" style="height: 220px; margin-top:16px;"><canvas id="chart-ingresos-mes"></canvas></div>
                <span id="sum-ingresos-mes" style="display:none;"></span>
            </div>
        </div>
        <div class="card">
            <div class="card-header-toggle" onclick="window.toggleCard(this)">
                <h3>Distribución de objetivos (presupuesto)</h3><span class="toggle-icon">▼</span>
            </div>
            <div class="card-content" id="tabla-distribucion"></div>
        </div>
    </div>
</div>
`;
