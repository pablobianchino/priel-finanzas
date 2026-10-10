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

<!-- Modal Crear / Editar Cuenta de Ahorro -->
<div id="modal-cuenta-ahorro" class="modal-overlay">
    <div class="modal-content" style="max-width: 480px;">
        <div class="modal-header">
            <h2 style="margin: 0; font-size: 18px;" id="titulo-modal-cuenta-ahorro">Cuenta de Ahorro</h2>
            <button class="modal-close" onclick="window.cerrarModal('modal-cuenta-ahorro')">✖</button>
        </div>
        <form id="form-cuenta-ahorro" style="display: flex; flex-direction: column; gap: 15px;">
            <input type="hidden" id="cuenta-ahorro-id">
            <div>
                <label style="font-size: 12px; color: var(--text-muted); display: block; margin-bottom: 5px;">Nombre de la Cuenta:</label>
                <input type="text" id="cuenta-ahorro-nombre" placeholder="Ej. Galileo Multi Strategy, Fondo Emergencia..." required style="width: 100%; font-size: 14px;">
            </div>
            <div>
                <label style="font-size: 12px; color: var(--text-muted); display: block; margin-bottom: 5px;">Moneda Principal de la Cuenta:</label>
                <select id="cuenta-moneda" style="width: 100%; font-size: 14px; padding: 7px; border-radius: 6px; border: 1px solid var(--card-border); background: var(--bg-card); color: var(--text-main);" onchange="window.onCambiarMonedaCuenta(this.value)">
                    <option value="ARS">🇦🇷 Pesos Argentinos (ARS) - Fondeo local / FCI en pesos</option>
                    <option value="USD">🇺🇸 Dólares Estadounidenses (USD) - Inviu USD / FCI Dólares</option>
                </select>
            </div>
            
            <div style="background: var(--highlight-bg); padding: 12px; border-radius: 8px; border: 1px solid var(--card-border); display: flex; flex-direction: column; gap: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <label style="font-size: 12px; font-weight: 600; color: var(--text-main);" id="label-saldo-base">Saldo Inicial / Base:</label>
                    <span id="cuenta-mep-info" style="font-size: 11px; color: #174ea6; font-weight: 500;"></span>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div>
                        <label style="font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 3px;">En Pesos (ARS):</label>
                        <input type="text" id="cuenta-saldo-ars" class="money-input" placeholder="$ 0,00" onfocus="window.onMoneyFocus(this)" onblur="window.onCuentaMontoBlur('ars')" oninput="window.onCuentaMontoInput('ars')" style="width: 100%; font-size: 14px; font-weight: 600;">
                    </div>
                    <div>
                        <label style="font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 3px;">En Dólares (USD):</label>
                        <input type="text" id="cuenta-saldo-usd" class="money-input" placeholder="U$D 0,00" onfocus="window.onMoneyFocus(this)" onblur="window.onCuentaMontoBlur('usd')" oninput="window.onCuentaMontoInput('usd')" style="width: 100%; font-size: 14px; font-weight: 600;">
                    </div>
                </div>
                <p style="font-size: 11px; color: var(--text-muted); margin: 0;">💡 Puedes escribir el valor en pesos o en dólares. La conversión se calcula automáticamente según el Dólar MEP.</p>
            </div>

            <button type="submit" class="btn-black" id="btn-submit-cuenta-ahorro" style="margin-top: 5px;">Guardar Cuenta</button>
        </form>
    </div>
</div>

<!-- Modal Crear / Editar Sub-Caja (Bolsillo) -->
<div id="modal-subcaja" class="modal-overlay">
    <div class="modal-content" style="max-width: 480px;">
        <div class="modal-header">
            <h2 style="margin: 0; font-size: 18px;" id="titulo-modal-subcaja">Sub-Caja de Ahorro</h2>
            <button class="modal-close" onclick="window.cerrarModal('modal-subcaja')">✖</button>
        </div>
        <form id="form-subcaja" style="display: flex; flex-direction: column; gap: 15px;">
            <input type="hidden" id="subcaja-cuenta-id">
            <input type="hidden" id="subcaja-id">
            
            <div>
                <label style="font-size: 12px; color: var(--text-muted); display: block; margin-bottom: 5px;">Cuenta Madre:</label>
                <input type="text" id="subcaja-cuenta-nombre" readonly style="width: 100%; font-weight: 600; background: var(--highlight-bg);">
            </div>

            <div>
                <label style="font-size: 12px; color: var(--text-muted); display: block; margin-bottom: 5px;">Nombre de la Sub-Caja / Destino:</label>
                <input type="text" id="subcaja-nombre" placeholder="Ej. Vacaciones 2026, Producción Disco Mandala, Equipamiento..." required style="width: 100%; font-size: 14px;">
            </div>

            <div style="background: var(--highlight-bg); padding: 12px; border-radius: 8px; border: 1px solid var(--card-border); display: flex; flex-direction: column; gap: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <label style="font-size: 12px; font-weight: 600; color: var(--text-main);">Monto Asignado:</label>
                    <span id="subcaja-mep-info" style="font-size: 11px; color: #174ea6; font-weight: 500;"></span>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div>
                        <label style="font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 3px;">Monto ARS ($):</label>
                        <input type="text" id="subcaja-monto-ars" class="money-input" placeholder="$ 0,00" onfocus="window.onMoneyFocus(this)" onblur="window.onSubcajaMontoBlur('ars')" oninput="window.onSubcajaMontoInput('ars')" style="width: 100%; font-size: 14px; font-weight: 600;">
                    </div>
                    <div>
                        <label style="font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 3px;">Monto USD (U$D):</label>
                        <input type="text" id="subcaja-monto-usd" class="money-input" placeholder="U$D 0,00" onfocus="window.onMoneyFocus(this)" onblur="window.onSubcajaMontoBlur('usd')" oninput="window.onSubcajaMontoInput('usd')" style="width: 100%; font-size: 14px; font-weight: 600;">
                    </div>
                </div>
                
                <div id="subcaja-disponible-info" style="font-size: 11px; color: var(--text-muted);"></div>
            </div>

            <div>
                <label style="font-size: 12px; color: var(--text-muted); display: block; margin-bottom: 5px;">Color Identificador:</label>
                <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                    <input type="color" id="subcaja-color" value="#1a73e8" style="width: 40px; height: 36px; border: none; border-radius: 6px; cursor: pointer; padding: 0;">
                    <button type="button" class="btn-black" style="padding: 4px 10px; font-size: 11px; background: #1a73e8;" onclick="document.getElementById('subcaja-color').value='#1a73e8'">Azul</button>
                    <button type="button" class="btn-black" style="padding: 4px 10px; font-size: 11px; background: #e37400;" onclick="document.getElementById('subcaja-color').value='#e37400'">Naranja</button>
                    <button type="button" class="btn-black" style="padding: 4px 10px; font-size: 11px; background: #137333;" onclick="document.getElementById('subcaja-color').value='#137333'">Verde</button>
                    <button type="button" class="btn-black" style="padding: 4px 10px; font-size: 11px; background: #9c27b0;" onclick="document.getElementById('subcaja-color').value='#9c27b0'">Púrpura</button>
                    <button type="button" class="btn-black" style="padding: 4px 10px; font-size: 11px; background: #d93025;" onclick="document.getElementById('subcaja-color').value='#d93025'">Rojo</button>
                    <button type="button" class="btn-black" style="padding: 4px 10px; font-size: 11px; background: #0097a7;" onclick="document.getElementById('subcaja-color').value='#0097a7'">Cian</button>
                </div>
            </div>

            <button type="submit" class="btn-black" id="btn-submit-subcaja" style="margin-top: 5px;">Guardar Sub-Caja</button>
        </form>
    </div>
</div>

<!-- Modal Ingreso / Retiro Manual de Cuenta de Ahorro -->
<div id="modal-movimiento-ahorro" class="modal-overlay">
    <div class="modal-content" style="max-width: 480px;">
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
            
            <div id="box-movimiento-subcaja" style="display: none;">
                <label style="font-size: 12px; color: var(--text-muted); display: block; margin-bottom: 5px;" id="label-movimiento-subcaja">Asignar a Sub-Caja:</label>
                <select id="movimiento-subcaja-id" style="width: 100%; font-size: 14px; padding: 7px; border-radius: 6px; border: 1px solid var(--card-border); background: var(--bg-card); color: var(--text-main);"></select>
            </div>

            <div style="background: var(--highlight-bg); padding: 12px; border-radius: 8px; border: 1px solid var(--card-border); display: flex; flex-direction: column; gap: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <label style="font-size: 12px; font-weight: 600; color: var(--text-main);">Monto a mover:</label>
                    <span id="movimiento-mep-info" style="font-size: 11px; color: #174ea6; font-weight: 500;"></span>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div>
                        <label style="font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 3px;">Monto ARS ($):</label>
                        <input type="text" id="movimiento-monto-ars" class="money-input" placeholder="$ 0,00" onfocus="window.onMoneyFocus(this)" onblur="window.onMovimientoMontoBlur('ars')" oninput="window.onMovimientoMontoInput('ars')" style="width: 100%; font-size: 15px; font-weight: bold;">
                    </div>
                    <div>
                        <label style="font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 3px;">Monto USD (U$D):</label>
                        <input type="text" id="movimiento-monto-usd" class="money-input" placeholder="U$D 0,00" onfocus="window.onMoneyFocus(this)" onblur="window.onMovimientoMontoBlur('usd')" oninput="window.onMovimientoMontoInput('usd')" style="width: 100%; font-size: 15px; font-weight: bold;">
                    </div>
                </div>
            </div>

            <div>
                <label style="font-size: 12px; color: var(--text-muted); display: block; margin-bottom: 5px;">Motivo / Detalle (Opcional):</label>
                <input type="text" id="movimiento-motivo" placeholder="Ej. Ahorro del mes, Rescate para gastos..." style="width: 100%;">
            </div>
            <p id="movimiento-ayuda" style="font-size: 11px; color: var(--text-muted); margin: 0;"></p>
            <button type="submit" class="btn-black" id="btn-submit-movimiento" style="margin-top: 5px;">Confirmar</button>
        </form>
    </div>
</div>

<!-- Modal Editar Movimiento de Ahorro -->
<div id="modal-editar-movimiento" class="modal-overlay">
    <div class="modal-content" style="max-width: 480px;">
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

            <div style="background: var(--highlight-bg); padding: 12px; border-radius: 8px; border: 1px solid var(--card-border); display: flex; flex-direction: column; gap: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <label style="font-size: 12px; font-weight: 600; color: var(--text-main);">Monto:</label>
                    <span id="edit-mov-mep-info" style="font-size: 11px; color: #174ea6; font-weight: 500;"></span>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div>
                        <label style="font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 3px;">Monto ARS ($):</label>
                        <input type="text" id="edit-mov-monto-ars" class="money-input" placeholder="$ 0,00" onfocus="window.onMoneyFocus(this)" onblur="window.onEditMovMontoBlur('ars')" oninput="window.onEditMovMontoInput('ars')" style="width: 100%; font-size: 15px; font-weight: bold;">
                    </div>
                    <div>
                        <label style="font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 3px;">Monto USD (U$D):</label>
                        <input type="text" id="edit-mov-monto-usd" class="money-input" placeholder="U$D 0,00" onfocus="window.onMoneyFocus(this)" onblur="window.onEditMovMontoBlur('usd')" oninput="window.onEditMovMontoInput('usd')" style="width: 100%; font-size: 15px; font-weight: bold;">
                    </div>
                </div>
            </div>

            <div>
                <label style="font-size: 12px; color: var(--text-muted); display: block; margin-bottom: 5px;">Motivo / Detalle:</label>
                <input type="text" id="edit-mov-motivo" placeholder="Detalle..." style="width: 100%;">
            </div>
            <p id="edit-mov-ayuda" style="font-size: 11px; color: var(--text-muted); margin: 0;"></p>
            <button type="submit" class="btn-black" style="margin-top: 5px;">Guardar Cambios</button>
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