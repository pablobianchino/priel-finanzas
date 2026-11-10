export const vistaAhorros = `
<div id="ahorros" class="view">
    <div style="display: flex; justify-content: space-between; align-items: center; margin: 0 0 12px; flex-wrap: wrap; gap:10px;">
        <h2 style="margin: 0; font-size: 16px;">Cuentas de ahorro</h2>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button onclick="window.abrirModalHistorial()" class="btn-black btn-sec"><i class="ti ti-history"></i>Historial de movimientos</button>
            <button onclick="window.crearCuentaAhorro()" class="btn-black"><i class="ti ti-plus"></i>Nueva cuenta</button>
        </div>
    </div>

    <div class="kpi-grid" style="grid-template-columns: repeat(2, minmax(0, 1fr)); max-width: 640px;">
        <div class="card">
            <h3>Total ahorrado (histórico)</h3>
            <div class="value" id="sum-ahorros-total" style="display: flex; flex-direction: column; gap: 2px;">$0,00</div>
        </div>
        <div class="card">
            <h3>Movimientos del mes</h3>
            <div class="value" id="sum-ahorros-depositado" style="display: flex; flex-direction: column; gap: 2px;">$0,00</div>
        </div>
    </div>
    <div id="contenedor-cuentas-ahorro" class="cards-grid"></div>
</div>
`;
