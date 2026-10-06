export const vistaModales = `
<!-- Modal Historial Ahorros -->
<div id="modal-historial" class="modal-overlay">
    <div class="modal-content" style="max-width: 650px;">
        <div class="modal-header">
            <h2 style="margin: 0; font-size: 18px;">Historial de Movimientos de Ahorro</h2>
            <button class="modal-close" onclick="window.cerrarModal('modal-historial')">✖</button>
        </div>
        <div id="historial-lista" style="max-height: 450px; overflow-y: auto; font-size: 13px;"></div>
    </div>
</div>

<!-- Modal Ingreso / Retiro Manual de Cuenta de Ahorro -->
<div id="modal-movimiento-ahorro" class="modal-overlay">
    <div class="modal-content" style="max-width: 450px;">
        <div class="modal-header">
            <h2 style="margin: 0; font-size: 18px;" id="titulo-modal-movimiento">Movimiento de Ahorro</h2>
            <button class="modal-close" onclick="window.cerrarModal('modal-movimiento-ahorro')">✖</button>
        </div>
        <form id="form-movimiento-ahorro" style="display: flex; flex-direction: column; gap: 15px;">
            <input type="hidden" id="movimiento-cuenta-id">
            <input type="hidden" id="movimiento-tipo">
            <div>
                <label style="font-size: 12px; color: var(--text-muted); display: block; margin-bottom: 5px;" id="label-cuenta-nombre">Cuenta:</label>
                <input type="text" id="movimiento-cuenta-nombre" readonly style="width: 100%; font-weight: 600; background: var(--highlight-bg);">
            </div>
            <div>
                <label style="font-size: 12px; color: var(--text-muted); display: block; margin-bottom: 5px;">Monto:</label>
                <input type="text" id="movimiento-monto" class="money-input" placeholder="Monto Total ARS" required onfocus="window.onMoneyFocus(this)" onblur="window.onMoneyBlur(this, 'ARS')" style="width: 100%; font-size: 16px; font-weight: bold;">
            </div>
            <div>
                <label style="font-size: 12px; color: var(--text-muted); display: block; margin-bottom: 5px;">Motivo / Detalle (Opcional):</label>
                <input type="text" id="movimiento-motivo" placeholder="Ej. Ahorro del mes, Rescate para gastos..." style="width: 100%;">
            </div>
            <p id="movimiento-ayuda" style="font-size: 11px; color: var(--text-muted); margin: 0;"></p>
            <button type="submit" class="btn-black" id="btn-submit-movimiento" style="margin-top: 10px;">Confirmar</button>
        </form>
    </div>
</div>

<!-- Modal Editar Movimiento de Ahorro -->
<div id="modal-editar-movimiento" class="modal-overlay">
    <div class="modal-content" style="max-width: 450px;">
        <div class="modal-header">
            <h2 style="margin: 0; font-size: 18px;" id="titulo-modal-editar-mov">Editar Transacción</h2>
            <button class="modal-close" onclick="window.cerrarModal('modal-editar-movimiento')">✖</button>
        </div>
        <form id="form-editar-movimiento" style="display: flex; flex-direction: column; gap: 15px;">
            <input type="hidden" id="edit-mov-id">
            <div>
                <label style="font-size: 12px; color: var(--text-muted); display: block; margin-bottom: 5px;">Cuenta:</label>
                <input type="text" id="edit-mov-cuenta" readonly style="width: 100%; font-weight: 600; background: var(--highlight-bg);">
            </div>
            <div>
                <label style="font-size: 12px; color: var(--text-muted); display: block; margin-bottom: 5px;">Monto:</label>
                <input type="text" id="edit-mov-monto" class="money-input" required onfocus="window.onMoneyFocus(this)" onblur="window.onMoneyBlur(this, 'ARS')" style="width: 100%; font-size: 16px; font-weight: bold;">
            </div>
            <div>
                <label style="font-size: 12px; color: var(--text-muted); display: block; margin-bottom: 5px;">Motivo / Detalle:</label>
                <input type="text" id="edit-mov-motivo" placeholder="Detalle..." style="width: 100%;">
            </div>
            <p id="edit-mov-ayuda" style="font-size: 11px; color: var(--text-muted); margin: 0;"></p>
            <button type="submit" class="btn-black" style="margin-top: 10px;">Guardar Cambios</button>
        </form>
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
                <label style="font-size: 13px; color: var(--text-muted);">Vincular a Grupo de Distribución (Presupuesto):</label>
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