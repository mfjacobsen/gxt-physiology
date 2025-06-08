// js/demographic.js
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

const PATH_PHYS = './data/plot/demographic_viz.csv';
const PATH_TH   = './data/plot/demographic_viz_th.csv';
const PERF      = ['25%', '50%', '75%', '100%'];

// original size
const M  = { top: 60, right: 20, bottom: 60, left: 60 };
const W  = 800, H = 350;
const CW = W - M.left - M.right;
const CH = H - M.top  - M.bottom;

// build container
const container = d3.select('#demographic-viz-container');

// controls
const ctrl = container.append('div').attr('id','control-div');
ctrl.append('label')
    .attr('for','demo-select')
    .attr('class','control-label')
    .text('Group by:');
const selectGroup = ctrl.append('select')
    .attr('id','demo-select')
    .attr('class','control-select');
['sex','age_group','bmi_group'].forEach(f =>
  selectGroup.append('option')
    .attr('value', f)
    .text(f.replace('_',' ').toUpperCase())
);

ctrl.append('label')
    .attr('for','metric-select')
    .attr('class','control-label')
    .text('Metric:');
const selectMetric = ctrl.append('select')
    .attr('id','metric-select')
    .attr('class','control-select');
[
  {key:'HR',            text:'Heart Rate'},
  {key:'RR',            text:'Respiration Rate'},
  {key:'CO2_vol',       text:'CO₂ Volume'},
  {key:'O2_vol',        text:'O₂ Volume'},
  {key:'time_th1',      text:'Threshold 1 Time'},
  {key:'time_th2',      text:'Threshold 2 Time'},
  {key:'threshold_gap', text:'Threshold Gap'}
].forEach(m =>
  selectMetric.append('option')
    .attr('value', m.key)
    .text(m.text)
);

// svg
const svg = container.append('svg')
    .attr('width', W)
    .attr('height', H)
  .append('g')
    .attr('transform', `translate(${M.left},${M.top})`);

// placeholders
svg.append('text').attr('class','chart-title')
   .attr('x', CW/2).attr('y', -M.top/2)
   .attr('text-anchor','middle');

const xAxisG = svg.append('g')
   .attr('class','x-axis')
   .attr('transform', `translate(0,${CH})`);
const yAxisG = svg.append('g')
   .attr('class','y-axis');

svg.append('text').attr('class','y-axis-label')
   .attr('transform','rotate(-90)')
   .attr('x', -CH/2).attr('y', -45)
   .attr('text-anchor','middle');
svg.append('text').attr('class','x-axis-label')
   .attr('x', CW/2).attr('y', CH + M.bottom - 10)
   .attr('text-anchor','middle')
   .text('Performance Percentile');

// tooltip element
const tooltip = container.append('div')
  .attr('class','tooltip');

Promise.all([
  d3.csv(PATH_PHYS),
  d3.csv(PATH_TH)
]).then(([rawPhys, rawTh]) => {
  // parse phys data
  const dataPhys = rawPhys.map(d => ({
    ID_test:   d.ID_test,
    sex:       d.Sex==='1'?'Female':'Male',
    age_group: d.age_group,
    bmi_group: d.bmi_group.toLowerCase(),
    Speed:     +d.Speed,
    HR:        +d.HR,
    RR:        +d.RR,
    CO2_vol:   +d.CO2_vol,
    O2_vol:    +d.O2_vol
  }));

  // compute max‐speed bins
  const maxBy = new Map();
  dataPhys.forEach(d => {
    const m = maxBy.get(d.ID_test);
    if (!m || d.Speed > m) maxBy.set(d.ID_test, d.Speed);
  });
  const allMax = Array.from(maxBy.values()).sort((a,b)=>a-b);
  const [q1,q2,q3] = [0.25,0.5,0.75].map(q=>d3.quantile(allMax,q));
  const perfBin = new Map();
  maxBy.forEach((ms,id) => {
    let bin = '100%';
    if (ms <= q1)      bin = '25%';
    else if (ms <= q2) bin = '50%';
    else if (ms <= q3) bin = '75%';
    perfBin.set(id, bin);
  });
  dataPhys.forEach(d => d.perf_bin = perfBin.get(d.ID_test));

  // parse threshold data (sec→min)
  const dataTh = rawTh.map(d => ({
    ID_test:      d.ID_test,
    sex:          d.Sex==='1'?'Female':'Male',
    age_group:    d.age_group,
    bmi_group:    d.bmi_group.toLowerCase(),
    threshold:    +d.threshold,
    time:         +d.time/60,
    threshold_gap:+d.threshold_gap/60,
    perf_bin:     perfBin.get(d.ID_test)
  }));

  const yLabelMap = {
    'HR':            'Heart Rate (bpm)',
    'RR':            'Respiration Rate (breaths/min)',
    'CO2_vol':       'CO₂ Volume',
    'O2_vol':        'O₂ Volume',
    'time_th1':      'Time (min)',
    'time_th2':      'Time (min)',
    'threshold_gap': 'Gap (min)'
  };

  // set defaults
  selectGroup.property('value','age_group');
  selectMetric.property('value','threshold_gap');

  // hooks
  selectGroup.on('change', update);
  selectMetric.on('change', update);

  // initial draw
  update();

  function update() {
    const field  = selectGroup.property('value');
    const metric = selectMetric.property('value');
    const metricText = selectMetric.select(`option[value="${metric}"]`).text();
    const yLabel    = yLabelMap[metric];

    // choose dataset & accessor
    let subData, accessor;
    if (['HR','RR','CO2_vol','O2_vol'].includes(metric)) {
      subData = dataPhys;
      accessor = d => d[metric];
    } else if (metric==='time_th1') {
      subData = dataTh.filter(d=>d.threshold===1);
      accessor = d => d.time;
    } else if (metric==='time_th2') {
      subData = dataTh.filter(d=>d.threshold===2);
      accessor = d => d.time;
    } else {
      subData = dataTh.filter(d=>d.threshold===1);
      accessor = d => d.threshold_gap;
    }

    // rollup average
    const roll = d3.rollup(
      subData,
      v => d3.mean(v, accessor),
      d => d[field],
      d => d.perf_bin
    );

    // determine groups
    let groups = Array.from(new Set(dataPhys.map(d=>d[field])));
    if (field==='bmi_group') {
      groups = ['underweight','normal','overweight']
        .filter(g=>groups.includes(g));
    } else {
      groups.sort();
    }

    // flatten
    const arr = [];
    groups.forEach(g => {
      PERF.forEach(bin => {
        arr.push({
          group: g,
          bin:   bin,
          value: roll.get(g)?.get(bin) ?? 0
        });
      });
    });

    draw(arr, groups, metricText, yLabel);
  }

  function capitalize(str){
    str = str.toLowerCase();
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function draw(arr, groups, metricText, yLabel) {
    // scales
    const x0 = d3.scaleBand()
      .domain(PERF)
      .range([0, CW])
      .padding(0.4);
    const vals = arr.map(d=>d.value);
    const y = d3.scaleLinear()
      .domain([d3.min(vals)*0.9, d3.max(vals)*1.1])
      .nice()
      .range([CH, 0]);

    // axes
    xAxisG.call(d3.axisBottom(x0).tickSizeOuter(0));
    yAxisG.call(d3.axisLeft(y).ticks(6).tickSizeOuter(0));

    // clear old
    svg.selectAll('.dot-group').remove();
    svg.selectAll('.legend').remove();

    // one g per percentile, centered
    const dg = svg.selectAll('.dot-group')
      .data(PERF)
      .enter().append('g')
        .attr('class','dot-group')
        .attr('transform', d=>`translate(${x0(d)+x0.bandwidth()/2},0)`);

    // circles + tooltip
    const circles = dg.selectAll('circle')
      .data(bin=>arr.filter(d=>d.bin===bin))
      .enter().append('circle')
        .attr('cx', 0)
        .attr('cy', CH)
        .attr('r', 6)
        .attr('fill', d=>d3.schemeCategory10[groups.indexOf(d.group)%10])
        .on('mouseover', (e,d) => {
          tooltip
            .style('display','block')
            .html(`
              <strong>${capitalize(d.group)}</strong><br/>
              Perf: ${d.bin}<br/>
              ${metricText}: ${d3.format('.2f')(d.value)}
            `);
        })
        .on('mousemove', e => {
          const [mx,my] = d3.pointer(e, container.node());
          tooltip
            .style('left', `${mx+15}px`)
            .style('top',  `${my+15}px`);
        })
        .on('mouseout', () => {
          tooltip.style('display','none');
        });

    // animate up
    circles.transition()
      .duration(800)
      .attr('cy', d=>y(d.value));

    // update text
    svg.select('.chart-title')
      .text(`${metricText} by ${selectGroup.property('value').replace('_',' ')} & Performance`);
    svg.select('.y-axis-label').text(yLabel);

    // legend (left & down a bit)
    const leg = svg.append('g')
      .attr('class','legend')
      .attr('transform', `translate(${CW-200}, -10)`);

    groups.forEach((g,i) => {
      const row = leg.append('g').attr('transform',`translate(0,${i*20})`);
      row.append('rect')
        .attr('width', 12)
        .attr('height', 12)
        .attr('fill', d3.schemeCategory10[i%10]);
      row.append('text')
        .attr('x', 18)
        .attr('y', 10)
        .text(capitalize(g));
    });
  }
});
