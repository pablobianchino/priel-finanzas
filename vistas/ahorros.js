export const vistaAhorros = `
<div id="ahorros" class="view">
    <div class="card" style="margin-bottom: 20px; border-top: 4px solid var(--text-muted);">
        <div class="card-header-toggle" onclick="window.toggleCard(this)">
            <h2 style="margin: 0; font-size: 16px;">Configuración USD</h2><span class="toggle-icon">▼</span>
        </div>
        <div class="card-content" style="display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
            <label>MEP (Ahorros): <input type="text" id="usd-mep-ahorros" class="money-input" value="0" style="width: 100px; padding: 6px;" onfocus="window.onMoneyFocus(this)" onblur="window.onMoneyBlur(this, 'ARS')"></label>
            <label>MEP Tarjeta (Gastos): <input type="text" id="usd-debito-ahorros" class="money-input" value="0" style="width: 100px; padding: 6px;" onfocus="window.onMoneyFocus(this)" onblur="window.onMoneyBlur(this, 'ARS')"></label>
            <label>Impuesto (Gastos): <input type="text" id="usd-impuesto-ahorros" class="money-input" value="0" style="width: 100px; padding: 6px;" onfocus="window.onMoneyFocus(this)" onblur="window.onMoneyBlur(this, 'ARS')"></label>
            <button class="btn-black" style="padding: 6px 15px;" onclick="window.guardarConfiguracionDolar('ahorros')">Guardar Rate</button>
        </div>
    </div>

    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap:10px;">
        <h2 style="margin: 0;">Cuentas de Ahorro Histórico</h2>
        <div style="display: flex; gap: 10px;">
            <button onclick="window.abrirModalHistorial()" class="btn-black" style="background-color: var(--highlight-bg); color: var(--text-main); border: 1px solid var(--card-border);">🧾 Ver Historial</button>
            <button onclick="window.crearCuentaAhorro()" class="btn-black">➕ Nueva Cuenta</button>
        </div>
    </div>
    
    <div class="cards-grid">
        <div class="card" style="border-top: 4px solid #9c27b0;">
            <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 20px;">
                <div>
                    <h3>Total Global Ahorrado (Histórico)</h3>
                    <div class="value" id="sum-ahorros-total" style="display: flex; flex-direction: column; gap: 5px; font-size: 22px;">$0,00</div>
                </div>
                <div style="text-align: right;">
                    <h3 style="color: #137333;">Total Depositado (Mes Actual)</h3>
                    <div class="value" id="sum-ahorros-depositado" style="color: #137333; font-size: 22px; display: flex; flex-direction: column; gap: 5px;">$0,00</div>
                </div>
            </div>
        </div>
    </div>
    <div id="contenedor-cuentas-ahorro" class="cards-grid"></div>
</div>
`;
