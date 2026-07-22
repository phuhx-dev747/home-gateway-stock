/**
 * charts.js - uPlot chart factory for Gateway Monitor
 * Creates a unified telemetry chart with CPU, RAM, and Temperature series.
 */
function createTelemetryChart(containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    throw new Error(`Chart container '#${containerId}' not found in DOM.`);
  }

  const chartWidth = Math.max(container.offsetWidth, 200);
  const chartHeight = Math.max(container.offsetHeight, 120);

  const opts = {
    id: 'telemetry-chart',
    width: chartWidth,
    height: chartHeight,
    cursor: {
      y: false,
      drag: { x: true, y: false, uni: 50 },
    },
    scales: {
      x: { time: true },
      y: { range: [0, 100] },
    },
    axes: [
      {
        stroke: '#555',
        size: 25,
        grid: { stroke: 'rgba(255,255,255,0.03)' },
        ticks: { stroke: 'rgba(255,255,255,0.03)' },
        values: (u, vals) => vals.map(v => {
          const d = new Date(v * 1000);
          return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }),
      },
      {
        stroke: '#555',
        size: 35,
        grid: { stroke: 'rgba(255,255,255,0.03)' },
        ticks: { stroke: 'rgba(255,255,255,0.03)' },
        values: (u, vals) => vals.map(v => v != null ? v.toFixed(1) + '%' : ''),
      },
    ],
    series: [
      {},
      { label: 'CPU', stroke: '#f87171', width: 2, fill: 'rgba(248,113,113,0.08)', points: { show: false } },
      { label: 'RAM', stroke: '#60a5fa', width: 2, fill: 'rgba(96,165,250,0.08)', points: { show: false } },
      { label: 'Temp', stroke: '#fbbf24', width: 2, fill: 'rgba(251,191,36,0.08)', points: { show: false } },
    ],
  };

  const data = [[], [], [], []];
  let chart;
  try {
    chart = new uPlot(opts, data, container);
  } catch (e) {
    throw new Error('uPlot init failed: ' + e.message);
  }

  const resizeObserver = new ResizeObserver(() => {
    const newWidth = Math.max(container.clientWidth, 200);
    const newHeight = Math.max(container.clientHeight, 120);
    if (newWidth > 0 && newHeight > 0) {
      chart.setSize({ width: newWidth, height: newHeight });
    }
  });
  resizeObserver.observe(container);

  return chart;
}
