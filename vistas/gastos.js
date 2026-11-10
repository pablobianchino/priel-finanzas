export const vistaGastos = `
<div id="gastos" class="view">
    <!-- PANEL RESUMEN USD -->
    <div class="card" id="panel-resumen-usd" style="margin-bottom: 14px; display: none;">
        <div class="card-header-toggle" onclick="window.toggleCard(this)">
            <h2 style="margin: 0;">Gastos en dólares</h2><span class="toggle-icon">▼</span>
        </div>
        <div class="card-content" id="contenido-resumen-usd"></div>
    </div>

    <div class="kpi-grid" style="grid-template-columns: repeat(2, minmax(0, 1fr)); max-width: 640px;">
        <div class="card">
            <h3>Gastos propios</h3>
            <div class="value" id="sum-gastos-total">$0,00</div>
        </div>
        <div class="card">
            <h3>Gastos de terceros</h3>
            <div class="value" id="sum-gastos-terceros">$0,00</div>
        </div>
    </div>

    <div style="display: flex; justify-content: space-between; align-items: center; margin: 6px 0 12px; flex-wrap: wrap; gap: 10px;">
        <h2 style="margin: 0; font-size: 16px;">Gestión de gastos</h2>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button onclick="window.crearNuevoTipoGastoPanel()" class="btn-black btn-sec"><i class="ti ti-layout-list"></i>Nuevo panel</button>
            <button onclick="window.abrirModalNuevoGasto()" class="btn-black"><i class="ti ti-plus"></i>Nuevo gasto</button>
        </div>
    </div>

    <div class="filter-bar"><input type="text" id="filtro-texto-gastos" placeholder="Buscar por panel o nombre de gasto..." style="flex: 1;"></div>

    <div id="contenedor-dinamico-gastos" style="display: flex; flex-direction: column; gap: 14px;"></div>
</div>
`;
