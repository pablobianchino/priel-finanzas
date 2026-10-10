export const vistaGastos = `
<div id="gastos" class="view">
    <div class="card" style="margin-bottom: 20px; border-top: 4px solid var(--text-muted);">
        <div class="card-header-toggle" onclick="window.toggleCard(this)">
            <h2 style="margin: 0; font-size: 16px;">Configuración Dólar MEP y Cotizaciones</h2><span class="toggle-icon">▼</span>
        </div>
        <div class="card-content" style="display: flex; flex-direction: column; gap: 12px;">
            <div style="display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
                <label>MEP (Ahorros): <input type="text" id="usd-mep-gastos" class="money-input" value="0" style="width: 105px; padding: 6px;" onfocus="window.onMoneyFocus(this)" onblur="window.onMoneyBlur(this, 'ARS')"></label>
                <label>MEP Tarjeta (Gastos): <input type="text" id="usd-debito-gastos" class="money-input" value="0" style="width: 105px; padding: 6px;" onfocus="window.onMoneyFocus(this)" onblur="window.onMoneyBlur(this, 'ARS')"></label>
                <label>Comisión Inviu/Broker (%): <input type="number" id="usd-comision-mep-gastos" step="0.1" min="0" max="10" value="0.6" style="width: 75px; padding: 6px;" onchange="window.actualizarCalculoMepEnPantalla('gastos')"></label>
                <label style="display:none;">Impuesto (Gastos): <input type="text" id="usd-impuesto-gastos" class="money-input" value="0" style="width: 80px; padding: 6px;" onfocus="window.onMoneyFocus(this)" onblur="window.onMoneyBlur(this, 'ARS')"></label>
                <button class="btn-black" style="padding: 6px 15px;" onclick="window.guardarConfiguracionDolar('gastos')">Guardar Rates</button>
            </div>

            <div style="background: var(--highlight-bg); padding: 10px 14px; border-radius: 8px; border: 1px solid var(--card-border); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                <div id="mep-live-info-gastos" style="font-size: 12px; color: var(--text-main);">
                    <span>⚡ Cotización MEP en vivo: <i>Haz clic en 'Consultar' para obtener el valor del mercado</i></span>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="btn-black" style="background-color: #174ea6; font-size: 12px; padding: 6px 12px;" onclick="window.consultarMepEnVivo('gastos')">⚡ Consultar MEP en vivo</button>
                    <button id="btn-aplicar-mep-gastos" class="btn-black" style="background-color: #137333; font-size: 12px; padding: 6px 12px; display: none;" onclick="window.aplicarMepConsultado('gastos')">✅ Aplicar Cotizaciones</button>
                </div>
            </div>
        </div>
    </div>

    <!-- PANEL RESUMEN USD -->
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
