export const vistaEstadisticas = `
<div id="estadisticas" class="view">
    <div class="card" style="border-top: 4px solid var(--text-main);">
        <div class="card-header-toggle" onclick="window.toggleCard(this)">
            <h3 style="font-size: 16px;">Estadísticas Anual de Ingresos vs Gastos vs Ahorros</h3><span class="toggle-icon">▼</span>
        </div>
        <div class="card-content">
            <div class="chart-container" style="height: 400px; margin-top: 20px;"><canvas id="chart-estadisticas"></canvas></div>
        </div>
    </div>
</div>
`;