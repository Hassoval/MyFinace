/**
 * MyFinance - Chart.js Wrapper
 * Initializes and manages clean, dark-mode-aware financial charts
 */

import {
  Chart,
  ArcElement,
  LineElement,
  BarElement,
  PointElement,
  BarController,
  DoughnutController,
  LineController,
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  RadialLinearScale,
  TimeScale,
  TimeSeriesScale,
  Decimation,
  Filler,
  Legend,
  Title,
  Tooltip,
  SubTitle,
} from 'chart.js';

Chart.register(
  ArcElement,
  LineElement,
  BarElement,
  PointElement,
  BarController,
  DoughnutController,
  LineController,
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  RadialLinearScale,
  TimeScale,
  TimeSeriesScale,
  Decimation,
  Filler,
  Legend,
  Title,
  Tooltip,
  SubTitle
);

const activeCharts: Map<string, Chart> = new Map();

/**
 * Destroy existing chart on canvas if any
 */
export function destroyChart(canvasId: string): void {
  const existing = activeCharts.get(canvasId);
  if (existing) {
    existing.destroy();
    activeCharts.delete(canvasId);
  }
}

/**
 * Render Income vs Expenses Bar Chart
 */
export function renderIncomeExpenseBarChart(
  canvasId: string,
  labels: string[],
  incomeData: number[],
  expenseData: number[],
  isDark: boolean
): Chart | null {
  destroyChart(canvasId);

  const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
  if (!canvas) return null;

  const textColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? 'rgba(51, 65, 85, 0.3)' : 'rgba(226, 232, 240, 0.8)';

  const chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Receitas (Kz)',
          data: incomeData,
          backgroundColor: '#10b981', // Emerald
          borderRadius: 6,
          maxBarThickness: 32,
        },
        {
          label: 'Despesas (Kz)',
          data: expenseData,
          backgroundColor: '#ef4444', // Red
          borderRadius: 6,
          maxBarThickness: 32,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: textColor,
            font: { family: 'inherit', size: 12, weight: 500 },
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 16,
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const val = ctx.parsed.y ?? 0;
              const formatted = new Intl.NumberFormat('pt-PT').format(val);
              return ` ${ctx.dataset.label}: ${formatted} Kz`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: textColor, font: { size: 11 } },
        },
        y: {
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            font: { size: 11 },
            callback: (value) => {
              const num = Number(value);
              if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M Kz`;
              if (num >= 1000) return `${(num / 1000).toFixed(0)}k Kz`;
              return `${num} Kz`;
            },
          },
        },
      },
    },
  });

  activeCharts.set(canvasId, chart);
  return chart;
}

/**
 * Render Category Distribution Doughnut Chart
 */
export function renderCategoryDoughnutChart(
  canvasId: string,
  labels: string[],
  data: number[],
  colors: string[],
  isDark: boolean
): Chart | null {
  destroyChart(canvasId);

  const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
  if (!canvas) return null;

  const textColor = isDark ? '#94a3b8' : '#64748b';

  const chart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: colors.length ? colors : ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'],
          borderWidth: isDark ? 2 : 1,
          borderColor: isDark ? '#1e293b' : '#ffffff',
          hoverOffset: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: textColor,
            font: { size: 12 },
            boxWidth: 12,
            padding: 12,
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const val = ctx.parsed ?? 0;
              const formatted = new Intl.NumberFormat('pt-PT').format(val);
              return ` ${ctx.label}: ${formatted} Kz`;
            },
          },
        },
      },
    },
  });

  activeCharts.set(canvasId, chart);
  return chart;
}
