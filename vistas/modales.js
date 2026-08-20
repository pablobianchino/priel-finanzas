export const vistaModales = `
<!-- Modal Historial Ahorros -->
<div id="modal-historial" class="modal-overlay">
    <div class="modal-content" style="max-width: 600px;">
        <div class="modal-header">
            <h2 style="margin: 0; font-size: 18px;">Historial de Ahorros y Retiros</h2>
            <button class="modal-close" onclick="window.cerrarModal('modal-historial')">✖</button>
        </div>
        <div id="historial-lista" style="max-height: 400px; overflow-y: auto; font-size: 13px;"></div>
    </div>
</div>

<!-- Modal Gasto -->
<div id="modal-gasto" class="modal-overlay">
    <div class="modal-content">
        <div class="modal-header">
            <h2 style="margin: 0; font-size: 18px;" id="titulo-modal-gasto">Gasto</h2>
            <button class="modal-close" onclick="window.cerrarModal('modal-gasto')">✖</button>
        </div>
        <form id="form-gasto" style="display: flex; flex-direction: column; gap: 15px;">
            <input type="hidden" id="gasto-id">
            <div style="display: flex; gap: 10px;">
                <select id="gasto-propietario" style="flex:1;" onchange="window.toggleTercero('gasto')">
                    <option value="Propio">Gasto Propio</option>
                    <option value="Tercero">Gasto de Tercero</option>
                </select>
                <input type="text" id="gasto-tercero-nombre" placeholder="Nombre Tercero" style="display:none; flex:1;">
            </div>
            <input type="text" id="gasto-nombre" placeholder="Nombre (ej. Internet)" required>
            <div style="display: flex; gap: 10px;">
                <input type="text" id="gasto-monto" class="money-input" placeholder="Monto Total" required style="flex: 1;" onfocus="window.onMoneyFocus(this)" onblur="window.onMoneyBlur(this)">
                <select id="gasto-moneda" onchange="window.onMoneyBlur(document.getElementById('gasto-monto'))">
                    <option value="ARS">ARS</option>
                    <option value="USD">USD</option>
                </select>
            </div>
            <div>
                <label style="font-size: 12px; color: var(--text-muted);">Asignar a Panel de Gasto:</label>
                <select id="gasto-categoria-select" style="width: 100%; margin-top: 5px;" required onchange="window.actualizarOrigenesGastoModal()"></select>
            </div>
            <div id="box-gasto-origen" style="display:none;">
                <label style="font-size: 12px; color: var(--text-muted);">Selecciona a qué ingreso descontar (Mío):</label>
                <select id="gasto-origen-select" style="width: 100%; margin-top: 5px;"></select>
            </div>
            <select id="gasto-tipo" onchange="window.toggleCamposTarjeta('gasto')">
                <option value="Fijo">Fijo / Pago Único</option><option value="Tarjeta">Tarjeta de Crédito</option>
            </select>
            <div id="box-recurrente" style="display: flex; align-items: center; gap: 10px; margin-top:5px;">
                <input type="checkbox" id="gasto-recurrente" checked style="width: 16px; height: 16px; cursor: pointer;">
                <label for="gasto-recurrente" style="font-size: 13px; cursor: pointer; color: var(--text-main);">Gasto Fijo Recurrente (copiar al próximo mes)</label>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;" id="box-compartir">
                <input type="checkbox" id="gasto-compartir" style="width: 16px; height: 16px;" onchange="window.toggleDivisor('gasto')">
                <label for="gasto-compartir" style="font-size: 14px; cursor: pointer;">Compartir / Dividir gasto</label>
                <input type="text" id="gasto-compartir-con" placeholder="Compartir con (Nombre)" style="display: none; flex: 1; padding: 6px; font-size:13px; border-radius: 6px; border: 1px solid #ccc;">
                <select id="gasto-compartir-tipo" style="display: none; padding: 6px; font-size:13px;" onchange="window.toggleDivisor('gasto')">
                    <option value="divisor">Dividir en partes</option><option value="fijo">Monto exacto (Mi parte)</option>
                </select>
                <select id="gasto-divisor" style="display: none; padding: 6px; font-size:13px;">
                    <option value="2">2</option><option value="3">3</option><option value="4">4</option>
                </select>
                <input type="text" id="gasto-monto-fijo" class="money-input" style="display: none; width: 120px; padding: 6px; font-size:13px;" placeholder="ARS final" onfocus="window.onMoneyFocus(this)" onblur="window.onMoneyBlur(this, 'ARS')">
            </div>
            <div id="campos-tarjeta" style="display: none; gap: 10px; flex-wrap: wrap;">
                <select id="gasto-tarjeta" style="flex: 1;"><option value="VISA">VISA</option><option value="MASTERCARD">MASTERCARD</option><option value="MP">MP</option></select>
                <input type="number" id="gasto-cuotas-totales" placeholder="Cuotas Tot" min="1" style="width: 100px;">
                <input type="number" id="gasto-cuotas-pagadas" placeholder="Cuotas Pag" min="1" style="width: 100px;">
            </div>
            <button type="submit" class="btn-black" id="btn-submit-gasto" style="margin-top: 10px;">Guardar Gasto</button>
        </form>
    </div>
</div>

<!-- Modal Ingreso -->
<div id="modal-ingreso" class="modal-overlay">
    <div class="modal-content">
        <div class="modal-header">
            <h2 style="margin: 0; font-size: 18px;" id="titulo-modal-ingreso">Ingreso</h2>
            <button class="modal-close" onclick="window.cerrarModal('modal-ingreso')">✖</button>
        </div>
        <form id="form-ingreso" style="display: flex; flex-direction: column; gap: 15px;">
            <input type="hidden" id="ingreso-id">
            <input type="text" id="ingreso-nombre" placeholder="Origen (ej. Mandala Ensambles)" required>
            <input type="text" id="ingreso-monto" class="money-input" placeholder="Monto Total ARS" required onfocus="window.onMoneyFocus(this)" onblur="window.onMoneyBlur(this, 'ARS')">
            <div>
                <label style="font-size: 13px; color: var(--text-muted);">Vincular a Grupo de Distribución:</label>
                <select id="ingreso-grupo" style="width:100%; margin-top:5px;"></select>
            </div>
            <button type="submit" class="btn-black" id="btn-submit-ingreso" style="margin-top: 10px;">Guardar Ingreso</button>
        </form>
    </div>
</div>

<!-- Modal Carga Masiva CSV -->
<div id="modal-carga-masiva" class="modal-overlay">
    <div class="modal-content">
        <div class="modal-header">
            <h2 style="margin: 0; font-size: 18px;">Carga Masiva (CSV)</h2>
            <button class="modal-close" onclick="window.cerrarModal('modal-carga-masiva')">✖</button>
        </div>
        <input type="file" id="archivo-csv" accept=".csv" style="width: 100%; box-sizing: border-box; margin-bottom: 15px;">
        <button class="btn-black" onclick="window.procesarCSV()" style="width: 100%;">Importar Gastos</button>
    </div>
</div>
`;