export const vistaGastos = `
<div id="gastos" class="view">
    <div class="card" style="margin-bottom: 20px; border-top: 4px solid var(--text-muted);">
        <div class="card-header-toggle" onclick="window.toggleCard(this)">
            <h2 style="margin: 0; font-size: 16px;">Configuración USD</h2><span class="toggle-icon">▼</span>
        </div>
        <div class="card-content" style="display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
            <label>MEP (Ahorros): <input type="text" id="usd-mep-gastos" class="money-input" value="0" style="width: 100px; padding: 6px;" onfocus="window.onMoneyFocus(this)" onblur="window.onMoneyBlur(this, 'ARS')"></label>
            <label>MEP Tarjeta (Gastos): <input type="text" id="usd-debito-gastos" class="money-input" value="0" style="width: 100px; padding: 6px;" onfocus="window.onMoneyFocus(this)" onblur="window.onMoneyBlur(this, 'ARS')"></label>
            <label>Impuesto (Gastos): <input type="text" id="usd-impuesto-gastos" class="money-input" value="0" style="width: 100px; padding: 6px;" onfocus="window.onMoneyFocus(this)" onblur="window.onMoneyBlur(this, 'ARS')"></label>
            <button class="btn-black" style="padding: 6px 15px;" onclick="window.guardarConfiguracionDolar('gastos')">Guardar Rate</button>
        </div>
    </div>

    <!-- NUEVO PANEL RESUMEN USD -->
    <div class="card" id="panel-resumen-usd" style="margin-bottom: 20px; border-top: 4px solid #174ea6; display: none;">
        <div class="card-header-toggle" onclick="window.toggleCard(this)">
            <h2 style="margin: 0; font-size: 16px;">Resumen Gastos en USD</h2><span class="toggle-icon">▼</span>
        </div>
        <div class="card-content" id="contenido-resumen-usd"></div>
    </div>

    <div class="cards-grid">
        <div class="card" style="border-top: 4px solid var(--text-main);">
            <h3>Gastos Totales (Propios)</h3>
            <div class="value" id="sum-gastos-total">$0,00</div>
        </div>
        <div class="card" style="border-top: 4px solid #5f6368;">
            <h3>Gastos de Terceros</h3>
            <div class="value" id="sum-gastos-terceros">$0,00</div>
        </div>
    </div>

    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap:10px;">
        <h2 style="margin: 0;">Gestión de Gastos</h2>
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <button onclick="window.crearNuevoTipoGastoPanel()" class="btn-black">➕ Crear Panel</button>
            <button onclick="window.abrirModalNuevoGasto()" class="btn-black" style="background-color: #202124;">➕ Nuevo Ítem Gasto</button>
            <button onclick="window.abrirModalCargaMasiva()" class="btn-black" style="background-color: #f1f3f4; color: #202124; border: 1px solid var(--card-border);">Carga CSV</button>
        </div>
    </div>

    <div class="filter-bar"><input type="text" id="filtro-texto-gastos" placeholder="Buscar gasto por panel o nombre de ítem..." style="flex: 1;"></div>
    
    <div id="contenedor-dinamico-gastos" style="display: flex; flex-direction: column; gap: 15px;"></div>
</div>
`;
