import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

const demographicVizPath = './data/plot/demographic_viz.csv';

// ─── 1) SETUP CONTAINER & DROPDOWN ────────────────────────────────────────────
const container = d3.select('main')
  .append('div')
    .attr('id','demographic-viz-container')
    .style('width','800px')
    .style('margin','40px auto')
    .style('position','relative');

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

['sex','bmi_group','age_group']
  .forEach(bin =>
    select.append('option')
      .attr('value',bin)
      .text(bin.replace('_',' ').toUpperCase())
  );

// three SVGs, stacked
const MARGIN = { top:50, right:150, bottom:50, left:60 };
const WIDTH  = 800 - MARGIN.left - MARGIN.right;
const HEIGHT = 300 - MARGIN.top  - MARGIN.bottom;

function makeSvg(offsetY=0){
  return container.append('svg')
    .style('margin-top', offsetY+'px')
    .attr('width',  WIDTH  + MARGIN.left + MARGIN.right)
    .attr('height', HEIGHT + MARGIN.top  + MARGIN.bottom)
    .append('g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);
}

const svgO2 = makeSvg(0);
const svgHR = makeSvg(20);
const svgRR = makeSvg(20);

// shared tooltip
const tooltip = container.append('div')
  .attr('class','tooltip')
  .style('display','none')
  .style('pointer-events','none')
  .style('z-index','1000');

// ─── 2) LOAD DATA ─────────────────────────────────────────────────────────────
d3.csv(demographicVizPath).then(raw => {
  const data = raw.map(d => ({
    sex:           d.Sex,
    bmi_group:     d.bmi_group,
    age_group:     d.age_group,
    time:          +d.time,
    o2_efficiency: (+d.O2_rate)/(+d.air_rate),
    heartRate:     +d.HR,
    respRate:      +d.RR
  }));

  select.on('change', () => updateAll(select.property('value')));
  updateAll(select.property('value'));

  function updateAll(binField) {
    // clear any old vlines
    d3.selectAll('line.vline').remove();

    // define each chart’s config
    const configs = [
      { svg: svgO2, key: 'o2_efficiency', label: 'O₂ Efficiency (ml/L)',    fmt: d3.format('.2f') },
      { svg: svgHR, key: 'heartRate',      label: 'Avg Heart Rate (bpm)',    fmt: d3.format('.0f') },
      { svg: svgRR, key: 'respRate',       label: 'Avg Resp Rate (breaths/min)', fmt: d3.format('.0f') }
    ];

    // draw them and merge cfg + returned chart internals
    const charts = configs.map(cfg => {
      const chart = drawChart(data, binField, cfg.svg, cfg.key, cfg.label, cfg.fmt);
      return { ...cfg, ...chart };
    });

    // attach mousemove handlers
    charts.forEach(chart => {
      chart.overlay.on('mousemove', event => {
        // find nearest time key
        const [mx] = d3.pointer(event, chart.svg.node());
        const t0 = chart.x.invert(mx);
        let i = d3.bisector(d => d).left(chart.timeKeys, t0);
        if (i === 0) i = 0;
        else if (i === chart.timeKeys.length) i = chart.timeKeys.length - 1;
        else {
          const b = chart.timeKeys[i-1], a = chart.timeKeys[i];
          i = (t0 - b) < (a - t0) ? i - 1 : i;
        }
        const tKey = chart.timeKeys[i];
        const rows = chart.lookup.get(tKey);
        if (!rows) return;

        // show vertical line in all charts
        charts.forEach(c => {
          c.vline
            .attr('x1', c.x(tKey))
            .attr('x2', c.x(tKey))
            .style('opacity', 1);
        });

        // build tooltip content using each chart’s formatter
        let html = `<strong>Time:</strong> ${Math.floor(tKey/60)}:${String(tKey%60).padStart(2,'0')}<br>`;
        rows.forEach(r => {
          html += `${r.group}: ${chart.fmt(r.avg)}<br>`;
        });

        // position and show tooltip
        const [cx, cy] = d3.pointer(event, container.node());
        tooltip.html(html)
          .style('left',  (cx + 10) + 'px')
          .style('top',   (cy + 10) + 'px')
          .style('display','block');
      });
    });

    // hide lines & tooltip on mouse leave
    charts.forEach(chart =>
      chart.svg.on('mouseleave', () => {
        d3.selectAll('line.vline').style('opacity', 0);
        tooltip.style('display','none');
      })
    );
  }
});

// ─── 3) DRAW SINGLE CHART ─────────────────────────────────────────────────────
function drawChart(data, binField, svg, key, yLabel, tickFmt) {
  // group & mean
  const grouped = d3.group(data, d => d[binField], d => d.time);
  const raw = Array.from(grouped, ([g, tmap]) =>
    Array.from(tmap, ([t, vals]) => ({
      group: g, time: +t, avg: d3.mean(vals, v => v[key])
    }))
  ).flat()
   .filter(d => isFinite(d.time) && isFinite(d.avg))
   .sort((a, b) => a.time - b.time);

  // smooth with a sliding window
  const W = 30, smooth = [];
  for (const g of new Set(raw.map(d => d.group))) {
    const pts = raw.filter(d => d.group === g);
    pts.forEach(p => {
      const win = pts.filter(q => Math.abs(q.time - p.time) <= W/2).map(q => q.avg);
      smooth.push({ group: g, time: p.time, avg: d3.mean(win) });
    });
  }
  smooth.sort((a, b) => a.time - b.time);

  // lookup & keys
  const lookup   = d3.group(smooth, d => d.time);
  const timeKeys = Array.from(lookup.keys()).sort((a, b) => a - b);

  // scales
  const x = d3.scaleLinear()
    .domain([ d3.min(data, d => d.time), d3.max(smooth, d => d.time) ])
    .range([0, WIDTH]);
  const y = d3.scaleLinear()
    .domain([0, d3.max(smooth, d => d.avg)]).nice()
    .range([HEIGHT, 0]);

  // clear
  svg.selectAll('*').remove();

  // axes
  svg.append('g')
      .attr('transform', `translate(0,${HEIGHT})`)
      .call(d3.axisBottom(x).tickFormat(t => {
        const m = Math.floor(t/60), s = String(Math.round(t%60)).padStart(2,'0');
        return `${m}:${s}`;
      }))
    .append('text')
      .attr('class','axis-label')
      .attr('x', WIDTH/2).attr('y', 40)
      .text('Time (mm:ss)');

  svg.append('g')
      .call(d3.axisLeft(y).tickFormat(tickFmt))
    .append('text')
      .attr('class','axis-label')
      .attr('transform','rotate(-90)')
      .attr('x', -HEIGHT/2).attr('y', -40)
      .text(yLabel);

  // lines
  const line = d3.line()
    .defined(d => isFinite(d.avg))
    .x(d => x(d.time))
    .y(d => y(d.avg));

  [...new Set(smooth.map(d => d.group))].forEach((g, i) => {
    svg.append('path')
      .datum(smooth.filter(d => d.group === g))
      .attr('class','line')
      .attr('stroke', d3.schemeCategory10[i])
      .attr('fill','none')
      .attr('stroke-width',2)
      .attr('d', line);
  });

  // legend
  const legend = svg.append('g')
    .attr('transform', `translate(${WIDTH + 10},0)`);

  [...new Set(smooth.map(d => d.group))].forEach((g, i) => {
    const row = legend.append('g').attr('transform', `translate(0,${i * 20})`);
    row.append('rect').attr('width',10).attr('height',10).attr('fill', d3.schemeCategory10[i]);
    row.append('text')
  .attr('x',15)
  .attr('y',10)
  .style('fill','#fff')   // force white
  .text(g);

  });

  // vertical line & overlay
  const vline = svg.append('line')
    .attr('class','vline')
    .attr('y1',0).attr('y2',HEIGHT)
    .style('stroke','#333')
    .style('stroke-dasharray','4 2')
    .style('opacity',0);

  const overlay = svg.append('rect')
    .attr('class','overlay')
    .attr('width', WIDTH).attr('height', HEIGHT)
    .style('fill','none').style('pointer-events','all');

  return { svg, x, lookup, timeKeys, vline, overlay };
}
