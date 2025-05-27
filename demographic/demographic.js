// js/hm.js
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

// ─── CONTAINER & DROPDOWN ────────────────────────────────────────────────────
const container = d3.select('main')
  .append('div')
    .attr('id','demographic-viz-container')
    .style('width','800px')
    .style('margin','0 auto')
    .style('position','relative');

// Bin selector (top-right)
const controlDiv = container.append('div')
  .style('position','absolute')
  .style('top','10px')
  .style('right','10px');

controlDiv.append('label')
  .attr('for','demo-select')
  .text('Bin by: ')
  .style('font-weight','bold')
  .style('margin-right','4px');

const select = controlDiv.append('select')
  .attr('id','demo-select')
  .style('padding','4px 8px')
  .style('font-size','14px');

const bins = ['sex','bmi_group','age_group'];
select.selectAll('option')
  .data(bins)
  .enter().append('option')
    .attr('value', d => d)
    .text(d => d.replace('_',' ').toUpperCase());

// ─── SVG DIMENSIONS ──────────────────────────────────────────────────────────
const margin = { top:50, right:150, bottom:50, left:60 };
const width  = 800 - margin.left - margin.right;
const height = 300 - margin.top  - margin.bottom;

// create three canvases, stacked
const svgO2 = container.append('svg')
    .attr('width',  width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
  .append('g').attr('transform', `translate(${margin.left},${margin.top})`);

const svgHR = container.append('svg')
    .attr('width',  width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .style('margin-top','20px')
  .append('g').attr('transform', `translate(${margin.left},${margin.top})`);

const svgRR = container.append('svg')
    .attr('width',  width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .style('margin-top','20px')
  .append('g').attr('transform', `translate(${margin.left},${margin.top})`);

// shared tooltip
const tooltip = container.append('div')
  .attr('class','tooltip')
  .style('display','none');

// ─── LOAD & PROCESS ─────────────────────────────────────────────────────────
d3.csv('../data/plot/demographic_viz.csv').then(raw => {
  const data = raw.map(d => ({
    sex:           d.Sex,
    bmi_group:     d.bmi_group,
    age_group:     d.age_group,
    time:          +d.time,
    o2_efficiency: (+d.O2_rate)/(+d.air_rate),
    heartRate:     +d.HR,
    respRate:      +d.RR
  }));

  // on bin‐change, redraw all three
  select.on('change', () => updateAll(select.property('value')));
  updateAll(select.property('value'));

  function updateAll(binField) {
    drawChart(svgO2, data, binField, 'o2_efficiency', 'O₂ Efficiency (ml/L)',    d3.format('.2f'));
    drawChart(svgHR, data, binField, 'heartRate',      'Avg Heart Rate (bpm)',    d3.format('.0f'));
    drawChart(svgRR, data, binField, 'respRate',       'Avg Resp Rate (breaths/min)', d3.format('.0f'));
  }
});

// ─── DRAW FUNCTION WITH SMOOTHING ────────────────────────────────────────────
function drawChart(svg, data, binField, key, yLabel, tickFmt) {
  // 1) GROUP & AVERAGE
  const grouped = d3.group(data, d=>d[binField], d=>d.time);
  const rawAvg = Array.from(grouped, ([grp, tmap]) =>
    Array.from(tmap, ([t, vals]) => ({
      group: grp,
      time:  +t,
      avg:   d3.mean(vals, v=>v[key])
    }))
  ).flat()
   .filter(d=>isFinite(d.time) && isFinite(d.avg))
   .sort((a,b)=>a.time-b.time);

  // 2) SMOOTH (30s window)
  const windowSize = 30;
  const smoothed = [];
  for (const grp of d3.group(rawAvg, d=>d.group).keys()) {
    const pts = rawAvg.filter(d=>d.group===grp);
    for (const p of pts) {
      const vals = pts
        .filter(q=>Math.abs(q.time - p.time) <= windowSize/2)
        .map(q=>q.avg);
      smoothed.push({ group: grp, time: p.time, avg: d3.mean(vals) });
    }
  }
  smoothed.sort((a,b)=>a.time-b.time);

  // lookup for tooltip
  const lookup = d3.group(smoothed, d=>d.time);

  // 3) SCALES & AXES
  const x = d3.scaleLinear()
    .domain([ d3.min(data, d=>d.time), d3.max(smoothed, d=>d.time) ])
    .range([0, width]);
  const xAxis = d3.axisBottom(x)
    .tickFormat(t => {
      const m = Math.floor(t/60), s = String(Math.round(t%60)).padStart(2,'0');
      return `${m}:${s}`;
    });

  const y = d3.scaleLinear()
    .domain([0, d3.max(smoothed, d=>d.avg)])
    .nice()
    .range([height, 0]);
  const yAxis = d3.axisLeft(y).tickFormat(tickFmt);

  const color = d3.scaleOrdinal(d3.schemeCategory10)
    .domain([...new Set(smoothed.map(d=>d.group))]);

  // 4) CLEAR & DRAW
  svg.selectAll('*').remove();

  svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(xAxis)
    .append('text')
      .attr('class','axis-label')
      .attr('x', width/2).attr('y', 40)
      .attr('fill','black')
      .text('Time (mm:ss)');

  svg.append('g')
      .call(yAxis)
    .append('text')
      .attr('class','axis-label')
      .attr('transform','rotate(-90)')
      .attr('x', -height/2).attr('y', -40)
      .attr('fill','black')
      .text(yLabel);

  const line = d3.line()
    .defined(d=>isFinite(d.avg))
    .x(d=>x(d.time))
    .y(d=>y(d.avg));

  for (const grp of color.domain()) {
    svg.append('path')
      .datum(smoothed.filter(d=>d.group===grp))
      .attr('class','line')
      .attr('stroke', color(grp))
      .attr('fill','none')
      .attr('stroke-width', 2)
      .attr('d', line);
  }

  const legend = svg.append('g')
    .attr('transform', `translate(${width+10},0)`);
  color.domain().forEach((g,i) => {
    const row = legend.append('g')
      .attr('transform', `translate(0,${i*20})`);
    row.append('rect')
      .attr('width',10).attr('height',10)
      .attr('fill', color(g));
    row.append('text')
      .attr('x',15).attr('y',10)
      .text(g);
  });

  // 5) TOOLTIP OVERLAY
  svg.append('rect')
    .attr('class','overlay')
    .attr('width', width)
    .attr('height', height)
    .style('fill','none')
    .style('pointer-events','all')
    .on('mouseover', () => tooltip.style('display',null))
    .on('mouseout',  () => tooltip.style('display','none'))
    .on('mousemove', event => {
      const [gx] = d3.pointer(event);
      const t = Math.round(x.invert(gx));
      const rows = lookup.get(t);
      if (!rows) return;

      let html = `<strong>Time:</strong> ${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}<br>`;
      rows.forEach(r => html += `${r.group}: ${tickFmt(r.avg)}<br>`);

      const [cx, cy] = d3.pointer(event, container.node());
      tooltip.html(html)
        .style('left', (cx+10)+'px')
        .style('top',  (cy+10)+'px');
    });
}
