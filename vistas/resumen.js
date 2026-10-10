export const vistaResumen = `
<div id="resumen" class="view active">
    <div style="display: flex; justify-content: flex-end; gap:10px; margin-bottom: 15px; flex-wrap:wrap;">
        <button onclick="window.exportarBackupMes()" class="btn-black" style="background-color: #34A853; border: 1px solid #137333;">📥 Backup JSON</button>
        <button onclick="window.copiarMesAnterior()" class="btn-black" style="background-color: #e8eaed; color: #202124; border: 1px solid var(--card-border);">🔄 Importar Mes Anterior</button>
    </div>

    <div class="card" style="margin-bottom: 20px; border-top: 4px solid var(--text-muted);">
        <div class="card-header-toggle" onclick="window.toggleCard(this)">
            <h2 style="margin: 0; font-size: 16px;">Configuración Dólar MEP y Cotizaciones</h2><span class="toggle-icon">▼</span>
        </div>
        <div class="card-content" style="display: flex; flex-direction: column; gap: 12px;">
            <div style="display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
                <label>MEP (Ahorros): <input type="text" id="usd-mep" class="money-input" value="0" style="width: 105px; padding: 6px;" onfocus="window.onMoneyFocus(this)" onblur="window.onMoneyBlur(this, 'ARS')"></label>
                <label>MEP Tarjeta (Gastos): <input type="text" id="usd-debito" class="money-input" value="0" style="width: 105px; padding: 6px;" onfocus="window.onMoneyFocus(this)" onblur="window.onMoneyBlur(this, 'ARS')"></label>
                <label>Comisión Inviu/Broker (%): <input type="number" id="usd-comision-mep" step="0.1" min="0" max="10" value="0.6" style="width: 75px; padding: 6px;" onchange="window.actualizarCalculoMepEnPantalla('resumen')"></label>
                <label style="display:none;">Impuesto (Gastos): <input type="text" id="usd-impuesto" class="money-input" value="0" style="width: 80px; padding: 6px;" onfocus="window.onMoneyFocus(this)" onblur="window.onMoneyBlur(this, 'ARS')"></label>
                <button class="btn-black" style="padding: 6px 15px;" onclick="window.guardarConfiguracionDolar('resumen')">Guardar Rates</button>
            </div>

            <div style="background: var(--highlight-bg); padding: 10px 14px; border-radius: 8px; border: 1px solid var(--card-border); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                <div id="mep-live-info-resumen" style="font-size: 12px; color: var(--text-main);">
                    <span>⚡ Cotización MEP en vivo: <i>Haz clic en 'Consultar' para obtener el valor del mercado</i></span>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="btn-black" style="background-color: #174ea6; font-size: 12px; padding: 6px 12px;" onclick="window.consultarMepEnVivo('resumen')">⚡ Consultar MEP en vivo</button>
                    <button id="btn-aplicar-mep-resumen" class="btn-black" style="background-color: #137333; font-size: 12px; padding: 6px 12px; display: none;" onclick="window.aplicarMepConsultado('resumen')">✅ Aplicar Cotizaciones</button>
                </div>
            </div>
        </div>
    </div>

    <div class="cards-grid">
        <div class="card" style="border-top: 4px solid #f29900;">
            <div class="card-header-toggle" onclick="window.toggleCard(this)">
                <h3>Distribución de Objetivos</h3><span class="toggle-icon">▼</span>
            </div>
            <div class="card-content" id="res-ingresos-dist"></div>
        </div>
        
        <div style="display:flex; flex-direction:column; gap:20px;">
            <div class="card" style="border-top: 4px solid #34A853;">
                <h3>Ingresos Netos del Mes</h3>
                <div class="value" id="res-ingresos-mes">$0,00</div>
            </div>
            
            <div class="card" style="border-top: 4px solid #9c27b0;">
                <div class="card-header-toggle" onclick="window.toggleCard(this)">
                    <h3>Cuentas de Ahorro (Mes)</h3><span class="toggle-icon">▼</span>
                </div>
                <div class="card-content" id="res-ahorros-list"></div>
            </div>

            <div class="card" style="border-top: 4px solid #174ea6;">
                <h3>Gastos Totales (Propios)</h3>
                <div class="value" id="res-gastos-fijos">$0,00</div>
            </div>

            <div class="card" style="border-top: 4px solid #e91e63;">
                <h3>Deuda Futura (Tarjetas)</h3>
                <div class="value" id="res-deuda-futura" style="color: #e91e63;">$0,00</div>
                <p style="font-size:11px; color:var(--text-muted); margin-top:5px; margin-bottom:0;">Suma total de cuotas pendientes a futuro</p>
            </div>

            <div class="card" style="border-top: 4px solid #EA4335;">
                <h3>Saldo a favor general</h3>
                <div class="value" id="res-balance">$0,00</div>
                <div class="chart-container" style="height: 150px; margin-top: 15px;"><canvas id="chart-resumen"></canvas></div>
            </div>
        </div>
    </div>
</div>
`;
