// js/demographic.js
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

const demographicVizPath = './data/plot/demographic_viz.csv';
const performanceBins  = ['25%', '50%', '75%', '100%'];
const margin = { top: 40, right: 20, bottom: 60, left: 60 };
const svgWidth  = 800;
const svgHeight = 300;
const chartWidth  = svgWidth - margin.left - margin.right;
const chartHeight = svgHeight - margin.top  - margin.bottom;

// ─── CONTAINER & DROPDOWN ────────────────────────────────────────────────────
const container = d3.select('main')
  .append('div')
    .attr('id', 'demographic-viz-container');

const controlDiv = container.append('div')
  .attr('id', 'control-div');

controlDiv.append('label')
  .attr('for', 'demo-select')
  .text('Group by: ')
  .attr('class', 'control-label');

const select = controlDiv.append('select')
  .attr('id', 'demo-select')
  .attr('class', 'control-select');

['sex', 'age_group', 'bmi_group'].forEach(bin =>
  select.append('option')
    .attr('value', bin)
    .text(bin.replace('_', ' ').toUpperCase())
);

// ─── SVG CANVAS FOR HEART RATE ────────────────────────────────────────────────
const svgHR = container.append('svg')
    .attr('width', svgWidth)
    .attr('height', svgHeight)
    .attr('class', 'chart-svg')
  .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

svgHR.append('text')
  .attr('class', 'chart-title')
  .attr('x', chartWidth / 2)
  .attr('y', -margin.top / 2)
  .text('Average Heart Rate by Performance & Demographic');

const xAxisGroupHR = svgHR.append('g')
  .attr('class', 'x-axis')
  .attr('transform', `translate(0,${chartHeight})`);

const yAxisGroupHR = svgHR.append('g')
  .attr('class', 'y-axis');

svgHR.append('text')
  .attr('class', 'y-axis-label')
  .attr('transform', 'rotate(-90)')
  .attr('x', -chartHeight / 2)
  .attr('y', -45)
  .attr('text-anchor', 'middle')
  .text('Heart Rate (bpm)');

svgHR.append('text')
  .attr('class', 'x-axis-label')
  .attr('x', chartWidth / 2)
  .attr('y', chartHeight + margin.bottom - 10)
  .attr('text-anchor', 'middle')
  .text('Performance Percentile');

// ─── SVG CANVAS FOR RESPIRATION RATE ─────────────────────────────────────────
const svgRR = container.append('svg')
    .attr('width', svgWidth)
    .attr('height', svgHeight)
    .attr('class', 'chart-svg')
    .style('margin-top', '30px')
  .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

svgRR.append('text')
  .attr('class', 'chart-title')
  .attr('x', chartWidth / 2)
  .attr('y', -margin.top / 2)
  .text('Average Respiration Rate by Performance & Demographic');

const xAxisGroupRR = svgRR.append('g')
  .attr('class', 'x-axis')
  .attr('transform', `translate(0,${chartHeight})`);

const yAxisGroupRR = svgRR.append('g')
  .attr('class', 'y-axis');

svgRR.append('text')
  .attr('class', 'y-axis-label')
  .attr('transform', 'rotate(-90)')
  .attr('x', -chartHeight / 2)
  .attr('y', -45)
  .attr('text-anchor', 'middle')
  .text('Respiration Rate (breaths/min)');

svgRR.append('text')
  .attr('class', 'x-axis-label')
  .attr('x', chartWidth / 2)
  .attr('y', chartHeight + margin.bottom - 10)
  .attr('text-anchor', 'middle')
  .text('Performance Percentile');

// ─── TOOLTIP ─────────────────────────────────────────────────────────────────
const tooltip = container.append('div')
  .attr('class', 'tooltip')
  .style('display', 'none');

// ─── LOAD & PREPARE DATA ─────────────────────────────────────────────────────
d3.csv(demographicVizPath).then(raw => {
  // 1) Parse numeric fields and normalize “sex” and “bmi_group”
  const data = raw.map(d => ({
    ID_test:   d.ID_test,
    sex:       d.Sex === '1' ? 'Female' : 'Male',
    age_group: d.age_group,
    bmi_group: d.bmi_group.toLowerCase(),  // expect "underweight", "normal", "overweight"
    Speed:     +d.Speed,
    HR:        +d.HR,
    RR:        +d.RR
  }));

  // 2) Group by ID_test to extract each runner’s max Speed
  const maxSpeedByTest = new Map();
  data.forEach(d => {
    const curMax = maxSpeedByTest.get(d.ID_test);
    if (curMax == null || d.Speed > curMax) {
      maxSpeedByTest.set(d.ID_test, d.Speed);
    }
  });

  // 3) Compute global quartiles on those max‐speeds
  const allMaxSpeeds = Array.from(maxSpeedByTest.values()).sort((a,b) => a - b);
  const q1 = d3.quantile(allMaxSpeeds, 0.25);
  const q2 = d3.quantile(allMaxSpeeds, 0.50);
  const q3 = d3.quantile(allMaxSpeeds, 0.75);

  // 4) Assign each ID_test into a performance bin
  const perfBinByTest = new Map();
  maxSpeedByTest.forEach((ms, ID) => {
    let bin;
    if (ms <= q1)      bin = '25%';
    else if (ms <= q2) bin = '50%';
    else if (ms <= q3) bin = '75%';
    else               bin = '100%';
    perfBinByTest.set(ID, bin);
  });

  // 5) Annotate each row with its runner’s performance bin
  data.forEach(d => {
    d.perf_bin = perfBinByTest.get(d.ID_test);
  });

  // Initial draw
  updateCharts(select.property('value'));

  // Redraw on demographic change
  select.on('change', () => updateCharts(select.property('value')));

  // ─── UPDATE FUNCTION ────────────────────────────────────────────────────────
  function updateCharts(demoField) {
    // 6) Aggregate by (demographic, perf_bin) for HR
    const nestedHR = d3.rollup(
      data,
      v => d3.mean(v, d => d.HR),
      d => d[demoField],
      d => d.perf_bin
    );
    // 7) Aggregate by (demographic, perf_bin) for RR
    const nestedRR = d3.rollup(
      data,
      v => d3.mean(v, d => d.RR),
      d => d[demoField],
      d => d.perf_bin
    );

    // 8) Unique demographic groups, in desired order
    let groups = Array.from(new Set(data.map(d => d[demoField])));
    if (demoField === 'bmi_group') {
      // Enforce exactly this ordering (and only if present)
      const order = ['underweight', 'normal', 'overweight'];
      groups = order.filter(o => groups.includes(o));
    } else {
      // Alphabetical for sex/age
      groups.sort();
    }

    // 9) Build tidy arrays for plotting
    const plotDataHR = [];
    const plotDataRR = [];
    groups.forEach(g => {
      performanceBins.forEach(bin => {
        plotDataHR.push({
          group: g,
          bin:   bin,
          value: nestedHR.get(g)?.get(bin) ?? 0
        });
        plotDataRR.push({
          group: g,
          bin:   bin,
          value: nestedRR.get(g)?.get(bin) ?? 0
        });
      });
    });

    // 10) Draw both charts
    drawBarChart(svgHR, xAxisGroupHR, yAxisGroupHR, plotDataHR, groups, 'HR');
    drawBarChart(svgRR, xAxisGroupRR, yAxisGroupRR, plotDataRR, groups, 'RR');
  }

  // ─── DRAW BAR CHART ─────────────────────────────────────────────────────────
  function drawBarChart(svg, xAxisG, yAxisG, plotData, groups, metricKey) {
    // 1) Scales
    const x0 = d3.scaleBand()
      .domain(performanceBins)
      .range([0, chartWidth])
      .paddingInner(0.2);

    const x1 = d3.scaleBand()
      .domain(groups)
      .range([0, x0.bandwidth()])
      .padding(0.1);

    const y = d3.scaleLinear()
      .domain([0, d3.max(plotData, d => d.value) * 1.1])
      .nice()
      .range([chartHeight, 0]);

    const color = d3.scaleOrdinal(d3.schemeCategory10)
      .domain(groups);

    // 2) Axes
    const xAxis = d3.axisBottom(x0);
    const yAxis = d3.axisLeft(y).ticks(5);

    xAxisG.call(xAxis);
    yAxisG.call(yAxis);

    // 3) Remove old bars
    svg.selectAll('.bar-group').remove();

    // 4) Draw new bar groups
    const binGroups = svg.selectAll('.bar-group')
      .data(performanceBins)
      .enter().append('g')
        .attr('class', 'bar-group')
        .attr('transform', d => `translate(${x0(d)},0)`);

    binGroups.selectAll('rect')
      .data(bin => plotData.filter(d => d.bin === bin))
      .enter().append('rect')
        .attr('x', d => x1(d.group))
        .attr('y', d => y(d.value))
        .attr('width', x1.bandwidth())
        .attr('height', d => chartHeight - y(d.value))
        .attr('fill', d => color(d.group))
        .attr('class', 'bar')
        .on('mouseover', (event, d) => {
          tooltip.style('display', 'block')
            .html(`
              <strong>${d.group.replace('_', ' ').toUpperCase()}</strong><br/>
              Perf: ${d.bin}<br/>
              ${metricKey === 'HR' ? 'Heart Rate' : 'Resp Rate'}: ${d3.format('.1f')(d.value)}
            `);
        })
        .on('mousemove', event => {
          const [mx, my] = d3.pointer(event, container.node());
          tooltip.style('left', (mx + 15) + 'px')
                 .style('top',  (my + 15) + 'px');
        })
        .on('mouseout', () => {
          tooltip.style('display', 'none');
        });

    // 5) Legend (one colored box + label per group)
    svg.selectAll('.legend').remove();
    const legend = svg.append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${chartWidth - 80}, -20)`);

    groups.forEach((g, i) => {
      const row = legend.append('g')
        .attr('transform', `translate(0,${i * 20})`);
      row.append('rect')
        .attr('width', 12)
        .attr('height', 12)
        .attr('fill', color(g))
        .attr('stroke', '#333')
        .attr('stroke-width', 1);
      row.append('text')
        .attr('x', 18)
        .attr('y', 10)
        .text(g.replace('_', ' ').toUpperCase())
        .attr('class', 'legend-text');
    });
  }
});
