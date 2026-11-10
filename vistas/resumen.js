export const vistaResumen = `
<div id="resumen" class="view active">
    <div class="kpi-grid">
        <div class="card">
            <h3>Ingresos del mes</h3>
            <div class="value" id="res-ingresos-mes">$0,00</div>
            <div class="sub">Total bruto, todos los orígenes</div>
        </div>
        <div class="card">
            <h3>Gastos propios</h3>
            <div class="value" id="res-gastos-fijos">$0,00</div>
            <div class="sub" id="res-gastos-pct"></div>
        </div>
        <div class="card">
            <h3>Deuda en cuotas</h3>
            <div class="value" id="res-deuda-futura">$0,00</div>
            <div class="sub">Cuotas de tarjeta pendientes a futuro</div>
        </div>
        <div class="card strong">
            <h3>Saldo neto</h3>
            <div class="value" id="res-balance">$0,00</div>
            <div class="sub">Ingresos − gastos propios − ahorrado</div>
            <div class="kpi-detail" id="res-balance-detalle"></div>
        </div>
    </div>

    <div class="grid-2">
        <div class="card">
            <div class="card-header-toggle" onclick="window.toggleCard(this)">
                <h3>Distribución de objetivos</h3><span class="toggle-icon">▼</span>
            </div>
            <div class="card-content" id="res-ingresos-dist"></div>
        </div>
        <div class="card">
            <div class="card-header-toggle" onclick="window.toggleCard(this)">
                <h3>Cuentas de ahorro</h3><span class="toggle-icon">▼</span>
            </div>
            <div class="card-content" id="res-ahorros-list"></div>
        </div>
    </div>

    <div class="card" style="margin-top: 14px;">
        <h3>Gastos vs. saldo disponible</h3>
        <div class="chart-container" style="height: 200px; margin-top: 8px;"><canvas id="chart-resumen"></canvas></div>
    </div>
</div>
`;
