(function () {
  // Get theme colors from CSS variables
  function getThemeColors() {
    const style = getComputedStyle(document.documentElement);
    const isDark = document.documentElement.dataset.themeDark === "true";

    const primary = style.getPropertyValue("--color-primary").trim() || "#0f3d3e";
    const accent = style.getPropertyValue("--color-accent").trim() || "#73ffc6";
    const text = style.getPropertyValue("--color-text").trim() || "#e9f5f2";
    const mutedText = style.getPropertyValue("--color-mutedText").trim() || "#9fb3b5";
    const secondary = style.getPropertyValue("--color-secondary").trim() || "#124748";

    return {
      primary,
      accent,
      text,
      mutedText,
      grid: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
      label: isDark ? "#0b0b0b" : "#ffffff",
      stackedPalette: generateStackedPalette(accent, primary, secondary, isDark),
    };
  }

  // Generate a palette for stacked charts based on theme colors
  function generateStackedPalette(accent, primary, secondary, isDark) {
    if (isDark) {
      return [accent, adjustBrightness(accent, -30), primary, adjustBrightness(primary, 30), "#ffb86c", "#ff7a6a"];
    }
    return [primary, adjustBrightness(primary, 20), accent, adjustBrightness(accent, -20), secondary, adjustBrightness(secondary, -30)];
  }

  // Adjust color brightness
  function adjustBrightness(hex, percent) {
    const num = parseInt(hex.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, Math.max(0, (num >> 16) + amt));
    const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amt));
    const B = Math.min(255, Math.max(0, (num & 0x0000ff) + amt));
    return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
  }

  const valueLabelPlugin = {
    id: "valueLabel",
    afterDatasetsDraw(chart, args, opts) {
      const { ctx } = chart;
      const colors = getThemeColors();
      ctx.save();
      chart.data.datasets.forEach((dataset, datasetIndex) => {
        const meta = chart.getDatasetMeta(datasetIndex);
        meta.data.forEach((bar, index) => {
          const value = dataset.data[index];
          if (!value) return;
          const props = bar.getProps ? bar.getProps(["x", "y", "base"], true) : {};
          const x = props.x ?? bar.x;
          const yTop = props.y ?? bar.y;
          const yBase = props.base ?? bar.base ?? bar.y;
          const y = (yTop + yBase) / 2;
          ctx.fillStyle = (opts && opts.color) || colors.label;
          ctx.font = "600 12px 'Space Grotesk', 'Segoe UI', sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(value, x, y);
        });
      });
      ctx.restore();
    },
  };

  let purchaseChart;
  let costChart;
  let giftLocationChart;

  function createPurchaseChart(ctx, stats) {
    const colors = getThemeColors();
    const total = stats.totalCount || 1;
    const pendingCount = Math.max(total - stats.purchasedCount, 0);
    const data = total === 0 ? [1] : [stats.purchasedCount, pendingCount];

    return new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["Achetés", "À acheter"],
        datasets: [
          {
            data,
            backgroundColor: [colors.accent, colors.grid],
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        cutout: "65%",
        plugins: {
          legend: {
            labels: { color: colors.text, boxWidth: 12 },
          },
        },
      },
    });
  }

  function getCostData(stats, sortBy) {
    const entries = Object.entries(stats.costPerRecipient || {}).map(([label, value]) => ({
      label,
      value,
    }));

    if (sortBy === "amount") {
      entries.sort((a, b) => b.value - a.value);
    } else {
      entries.sort((a, b) => a.label.localeCompare(b.label, "fr", { sensitivity: "base" }));
    }

    if (!entries.length) {
      return { labels: ["-"], data: [0] };
    }

    return {
      labels: entries.map((e) => e.label),
      data: entries.map((e) => e.value),
    };
  }

  function createCostChart(ctx, stats, sortBy) {
    const colors = getThemeColors();
    const costData = getCostData(stats, sortBy);

    return new Chart(ctx, {
      type: "bar",
      data: {
        labels: costData.labels,
        datasets: [
          {
            label: "Coût (€)",
            data: costData.data,
            backgroundColor: costData.labels.map(() => colors.primary),
            borderRadius: 8,
          },
        ],
      },
      options: {
        scales: {
          x: {
            ticks: { color: colors.text },
            grid: { display: false },
          },
          y: {
            ticks: { color: colors.text },
            grid: { color: colors.grid },
          },
        },
        plugins: {
          legend: { display: false },
        },
      },
    });
  }

  function buildGiftLocationData(stats, sortBy) {
    const colors = getThemeColors();
    const counts = stats.recipientLocationCounts || {};
    const baseLabels = Object.keys(counts);

    const locationSet = new Set();
    baseLabels.forEach((recipient) => {
      Object.keys(counts[recipient]).forEach((loc) => locationSet.add(loc));
    });
    const locations = Array.from(locationSet).sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));

    if (!baseLabels.length || !locations.length) {
      return {
        labels: ["-"],
        datasets: [
          {
            label: "Aucun",
            data: [0],
            backgroundColor: colors.grid,
            borderRadius: 10,
            borderSkipped: false,
            stack: "stack",
          },
        ],
      };
    }

    const totals = baseLabels.map((recipient) => ({
      label: recipient,
      total: Object.values(counts[recipient] || {}).reduce((sum, n) => sum + (Number.isFinite(n) ? n : 0), 0),
    }));

    const labels =
      sortBy === "count"
        ? totals
            .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "fr", { sensitivity: "base" }))
            .map((t) => t.label)
        : baseLabels.sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));

    const palette = colors.stackedPalette;
    const radius = 12;
    const datasets = locations.map((loc, index) => ({
      label: loc,
      data: labels.map((recipient) => counts[recipient]?.[loc] || 0),
      backgroundColor: palette[index % palette.length],
      borderRadius: { topLeft: radius, topRight: radius, bottomLeft: radius, bottomRight: radius },
      borderSkipped: false,
      stack: "stack",
      barThickness: "flex",
      maxBarThickness: 38,
    }));

    return { labels, datasets };
  }

  function createGiftLocationChart(ctx, stats, sortBy) {
    const colors = getThemeColors();
    const { labels, datasets } = buildGiftLocationData(stats, sortBy);

    return new Chart(ctx, {
      type: "bar",
      data: { labels, datasets },
      plugins: [valueLabelPlugin],
      options: {
        responsive: true,
        interaction: { mode: "index", intersect: false },
        scales: {
          x: {
            stacked: true,
            ticks: { color: colors.text },
            grid: { display: false },
          },
          y: {
            stacked: true,
            beginAtZero: true,
            ticks: { color: colors.text, precision: 0, stepSize: 1 },
            grid: { color: colors.grid },
          },
        },
        plugins: {
          legend: {
            labels: { color: colors.text, boxWidth: 12 },
          },
          tooltip: { mode: "index", intersect: false },
          valueLabel: { color: colors.label },
        },
      },
    });
  }

  window.renderCharts = function renderCharts(stats) {
    const colors = getThemeColors();
    const purchaseCtx = document.getElementById("purchaseChart");
    const costCtx = document.getElementById("costChart");
    const locationCtx = document.getElementById("giftLocationChart");
    const costSort = document.getElementById("costSort")?.value || "name";
    const locationSort = document.getElementById("locationSort")?.value || "name";

    if (!purchaseCtx || !costCtx || !locationCtx || typeof Chart === "undefined") {
      return;
    }

    if (!purchaseChart) {
      purchaseChart = createPurchaseChart(purchaseCtx, stats);
    } else {
      const total = stats.totalCount || 1;
      const pending = Math.max(total - stats.purchasedCount, 0);
      purchaseChart.data.datasets[0].data = total === 0 ? [1] : [stats.purchasedCount, pending];
      purchaseChart.data.datasets[0].backgroundColor = [colors.accent, colors.grid];
      purchaseChart.options.plugins.legend.labels.color = colors.text;
      purchaseChart.update();
    }

    const costData = getCostData(stats, costSort);
    if (!costChart) {
      costChart = createCostChart(costCtx, stats, costSort);
    } else {
      costChart.data.labels = costData.labels;
      costChart.data.datasets[0].data = costData.data;
      costChart.data.datasets[0].backgroundColor = costData.labels.map(() => colors.primary);
      costChart.options.scales.x.ticks.color = colors.text;
      costChart.options.scales.y.ticks.color = colors.text;
      costChart.options.scales.y.grid.color = colors.grid;
      costChart.update();
    }

    const { labels, datasets } = buildGiftLocationData(stats, locationSort);
    if (!giftLocationChart) {
      giftLocationChart = createGiftLocationChart(locationCtx, stats, locationSort);
    } else {
      giftLocationChart.data.labels = labels;
      giftLocationChart.data.datasets = datasets;
      giftLocationChart.options.scales.x.ticks.color = colors.text;
      giftLocationChart.options.scales.y.ticks.color = colors.text;
      giftLocationChart.options.scales.y.grid.color = colors.grid;
      giftLocationChart.options.plugins.legend.labels.color = colors.text;
      giftLocationChart.update();
    }
  };

  // Function to update charts when theme changes
  window.updateChartsForTheme = function updateChartsForTheme(theme) {
    // Destroy existing charts
    if (purchaseChart) {
      purchaseChart.destroy();
      purchaseChart = null;
    }
    if (costChart) {
      costChart.destroy();
      costChart = null;
    }
    if (giftLocationChart) {
      giftLocationChart.destroy();
      giftLocationChart = null;
    }

    // Re-render charts will happen automatically when renderDashboard is called
    // Trigger a re-render if getCurrentStats is available
    if (typeof window.getCurrentStats === "function") {
      const stats = window.getCurrentStats();
      if (stats) {
        window.renderCharts(stats);
      }
    }
  };
})();
