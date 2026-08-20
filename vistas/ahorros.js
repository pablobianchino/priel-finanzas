export const vistaAhorros = `
<div id="ahorros" class="view">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap:10px;">
        <h2 style="margin: 0;">Cuentas de Ahorro Histórico</h2>
        <div style="display: flex; gap: 10px;">
            <button onclick="window.abrirModalHistorial()" class="btn-black" style="background-color: #f1f3f4; color: #202124; border: 1px solid var(--card-border);">🧾 Ver Historial</button>
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