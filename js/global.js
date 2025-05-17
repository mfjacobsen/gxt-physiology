import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

// Data paths
const main_data_path = "data/plot/main_plot.csv";
const hr_data_path = "data/plot/hr_data.csv";
const rr_data_path = "data/plot/rr_data.csv";
const VO2_data_path = "data/plot/VO2_data.csv";

// Main window dimensions
const main_window_width = 1200
const main_window_height = 700

// Controls flex between main and sub plots
const main_chart_flex = 3
const sub_window_flex = 5
const flex_total = main_chart_flex + sub_window_flex

// Defines main chart and sub window dimensions using above constants
const main_chart_width = main_window_width
const main_chart_height = Math.round(main_window_height * (main_chart_flex / flex_total))
const sub_window_width = main_window_width
const sub_window_height = main_window_height - main_chart_height

// Update div style settings using above constants
const mainWindowDiv = document.getElementById("main-window");
const chartDiv = document.getElementById("chart");
const subWindowDiv = document.getElementById("sub-window");

mainWindowDiv.style.maxWidth = `${main_window_width}px`;
mainWindowDiv.style.height = `${main_window_height}px`;

subWindowDiv.style.maxWidth = `${sub_window_width}px`;
subWindowDiv.style.height = `${sub_window_height}px`;

chartDiv.style.flex = main_chart_flex;
subWindowDiv.style.flex = sub_window_flex;

// Define plot axis scales
let xScale, yScale;
let xScaleHr, yScaleHr
let xScaleRr, yScaleRr
let xScaleVO2, yScaleVO2

// Define subplot domains
const yDomainHr = [0, 200]
const yDomainRr = [0, 80]
const yDomainVO2 = [0, 60]

// Formats seconds to minutes and seconds
function formatTimeMMSS(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

// Loads and formats main plot data
async function loadMainData(path) {

    const data = await d3.csv(path, (row) => ({
        ...row,
        time: Number(row.time), 
        speed: Number(row.speed),
        remaining: Number(row.remaining),
        pace:row.pace
    }));

    return data;
}

// Loads and formats heart rate sub plot data
async function loadHrData(path) {

    const data = await d3.csv(path, (row) => ({
        ...row,
        time: Number(row.time),
        quintile: Number(row.max_speed_quintile),
        hr: Number(row.HR),
    }));

    const lastPath = path.replace("hr_data", "last_hr_data");
    const last = await d3.csv(lastPath, (row) => ({
        ...row,
        quintile: Number(row.max_speed_quintile),
        last_hr: Number(row.HR)
    }));

    return [data, last];
}

// Loads and formats respiratory rate sub plot data
async function loadRrData(path) {
    const data = await d3.csv(path, (row) => ({
        ...row,
        time: Number(row.time),
        quintile: Number(row.max_speed_quintile),
        rr: Number(row.RR),
    }));

    const lastPath = path.replace("rr_data", "last_rr_data");
    const last = await d3.csv(lastPath, (row) => ({
        ...row,
        quintile: Number(row.max_speed_quintile),
        last_rr: Number(row.RR)
    }));

    return [data, last];
}

// Loads and formats VO2 sub plot data
async function loadVO2Data(path) {
    const data = await d3.csv(path, (row) => ({
        ...row,
        time: Number(row.time),
        quintile: Number(row.max_speed_quintile),
        VO2: Number(row.O2_rate_rolling),
    }));

    const lastPath = path.replace("VO2_data", "last_VO2_data");
    const last = await d3.csv(lastPath, (row) => ({
        ...row,
        quintile: Number(row.max_speed_quintile),
        last_VO2: Number(row.O2_rate_rolling)
    }));

    return [data, last];
}

// Renders the main plot
function renderMainPlot(data) {

    // Define plot dimenstions
    const width = main_chart_width;
    const height = main_chart_height;

    // Define margins and usable area
    const margin = { 
        top: 30, 
        right: 50, 
        bottom: 80, 
        left: 80
     };
    const usableArea = {
        top: margin.top,
        right: width - margin.right,
        bottom: height - margin.bottom,
        left: margin.left,
        width: width - margin.left - margin.right,
        height: height - margin.top - margin.bottom,
      };

    // Create the SVG element
    const container = d3.select('#chart');
    const svg = container
        .append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .style('width', '100%')
        .style('height', '100%');

    // Create axis scales
    xScale = d3
        .scaleLinear()
        .domain(d3.extent(data, d => d.time))
        .range([usableArea.left, usableArea.right]);
    yScale = d3
        .scaleLinear()
        .domain([0,1000])
        .range([usableArea.bottom, usableArea.top]);

    // Create axes and gridlines
    const xAxis = d3
        .axisBottom(xScale)
        .tickFormat(formatTimeMMSS);
    const yAxis = d3.axisLeft(yScale);

    // Draw gridlines
    const gridlines = svg
        .append('g')
        .attr('class', 'gridlines')
        .attr('transform', `translate(${usableArea.left}, 0)`)
        .call(d3.axisLeft(yScale).tickFormat('').tickSize(-usableArea.width));
    
    // Draw axes
    svg
        .append('g')
        .attr('transform', `translate(0, ${usableArea.bottom})`)
        .call(xAxis);
    svg
        .append('g')
        .attr('transform', `translate(${usableArea.left}, 0)`)
        .call(yAxis);

    // Create and draw plot line 
    const line = d3.line()
        .x(d => xScale(d.time))
        .y(d => yScale(d.remaining));
    svg.append('path')
        .datum(data) 
        .attr('fill', 'none')
        .attr('stroke', 'steelblue')
        .attr('stroke-width', 3)
        .attr('d', line)

    // X-axis label
    svg.append('text')
        .attr('class', 'x axis-label')
        .attr('text-anchor', 'middle')
        .attr('x', usableArea.left + usableArea.width / 2)
        .attr('y', height - margin.bottom / 2 + 5)
        .text('Time Elapsed (min:sec)');

    // Y-axis label
    svg.append('text')
        .attr('class', 'y axis-label')
        .attr('text-anchor', 'middle')
        .attr('transform', 'rotate(-90)')
        .attr('x', -(usableArea.top + usableArea.height / 2))
        .attr('y', margin.left / 2 - 5)
        .text('Runners Remaining');

    // Create focus line
    const focusLine = svg.append('line')
        .attr('stroke', '#999')
        .attr('stroke-width', 1)
        .attr('y1', usableArea.top)
        .attr('y2', usableArea.bottom)
        .attr('visibility', 'hidden');

    // Create focus dot
    const focusDot = svg.append('circle')
        .attr('r', 4)
        .attr('fill', 'steelblue')
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5)
        .attr('visibility', 'hidden');

    // Create tooltip
    const chart = document.getElementById('chart');
    const tooltip = document.createElement('dl');
    tooltip.id = 'main-tooltip';
    tooltip.className = 'info tooltip';
    tooltip.hidden = true;

    // Define tooltip labels and id's
    const tooltipFields = {
        "Runners Remaining:": "people-remaining",
        "Time Elapsed:": "time-elapsed",
        "Treadmill Speed:": "treadmill-speed",
        "Treadmill Pace:": "treadmill-pace"
    };

    // Add tooltip to html
    let html = '';
    for (const [label, id] of Object.entries(tooltipFields)) {
        html += `<dt>${label}</dt><dd id="${id}"></dd>`;
    }
    tooltip.innerHTML = html;
    chart.appendChild(tooltip);

    // Create hidden rectangle to capture mouse movement, fire events on movement
    const overlay = svg.append('rect')
        .attr('x', usableArea.left)
        .attr('y', usableArea.top)
        .attr('width', usableArea.width)
        .attr('height', usableArea.height)
        .style('fill', 'none')
        .style('pointer-events', 'all')
        .on("mouseenter", (event) => {
            updateTooltipVisibility(true);
          })
        .on('mousemove', (event) => {
            const [mx] = d3.pointer(event);
            const x0 = xScale.invert(mx);
            const bisect = d3.bisector(d => d.time).left;
            const i = bisect(data, x0);
            const d0 = data[i - 1];
            const d1 = data[i];
            const d = x0 - d0?.time < d1?.time - x0 ? d0 : d1;

            if (!d) return;

            focusLine
                .attr('x1', xScale(d.time))
                .attr('x2', xScale(d.time))
                .attr('visibility', 'visible');

            focusDot
                .attr('cx', xScale(d.time))
                .attr('cy', yScale(d.remaining))
                .attr('visibility', 'visible');

            renderTooltipContent(d);
            updateTooltipPosition(d, width, height);
            updateHrPlot(d.time);
            updateRrPlot(d.time);
            updateVO2Plot(d.time);
        })
        .on('mouseleave', () => {
        })
        .on('click', () => {
            updateTooltipVisibility();
        });
}

// Renders heart rate plot
function renderHrPlot() {

    // Define plot dimenstions
    const width = sub_window_width / 3;
    const height = sub_window_height;

    // Define margins and usable area
    const margin = {
        top: 30,
        right: 50,
        bottom: 80,
        left: 80
    };
    const usableArea = {
        top: margin.top,
        right: width - margin.right,
        bottom: height - margin.bottom,
        left: margin.left,
        width: width - margin.left - margin.right,
        height: height - margin.top - margin.bottom,
    };

    // Create the SVG element
    const container = d3.select('#sub-chart-1');

    // Create the SVG element
    const svg = container
        .append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .style('width', '100%')
        .style('height', '100%')

    // Define shared axis scales
    xScaleHr = d3
        .scaleBand()
        .domain([1,2,3,4,5])  // all quintiles
        .range([usableArea.left, usableArea.right])
        .padding(0.2);

    yScaleHr = d3
        .scaleLinear()
        .domain(yDomainHr)  // fixed HR range
        .range([usableArea.bottom, usableArea.top]);

    // Create axes and gridlines
    const xAxis = d3
        .axisBottom(xScaleHr)
        .tickValues([1, 5])
        .tickFormat(d => (d === 1 ? "Slowest" : d === 5 ? "Fastest" : ""));
    const yAxis = d3.axisLeft(yScaleHr);

    // Draw gridlines
    const gridlines = svg
        .append('g')
        .attr('class', 'gridlines')
        .attr('transform', `translate(${usableArea.left}, 0)`)
        .call(d3.axisLeft(yScaleHr).tickFormat('').tickSize(-usableArea.width));

    // Draw axes
    svg
        .append('g')
        .attr('transform', `translate(0, ${usableArea.bottom})`)
        .call(xAxis);
    svg
        .append('g')
        .attr('transform', `translate(${usableArea.left}, 0)`)
        .call(yAxis);

    // X-axis label
    svg.append('text')
        .attr('class', 'x axis-label')
        .attr('text-anchor', 'middle')
        .attr('x', usableArea.left + usableArea.width / 2)
        .attr('y', height - margin.bottom / 2 + 5)
        .text('Performance Quintile');

    // Y-axis label
    svg.append('text')
        .attr('class', 'y axis-label')
        .attr('text-anchor', 'middle')
        .attr('transform', 'rotate(-90)')
        .attr('x', -(usableArea.top + usableArea.height / 2))
        .attr('y', margin.left / 2 - 5)
        .text('Mean Heart Rate');

    svg.append("g").attr("class", "bars");
    
}

// Renders respiratory rate plot
function renderRrPlot() {

    // Define plot dimenstions
    const width = sub_window_width / 3;
    const height = sub_window_height;

    // Define margins and usable area
    const margin = {
        top: 30,
        right: 50,
        bottom: 80,
        left: 80
    };
    const usableArea = {
        top: margin.top,
        right: width - margin.right,
        bottom: height - margin.bottom,
        left: margin.left,
        width: width - margin.left - margin.right,
        height: height - margin.top - margin.bottom,
    };

    // Create the SVG element
    const container = d3.select('#sub-chart-2');

    // Create the SVG element
    const svg = container
        .append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .style('width', '100%')
        .style('height', '100%');

    // Define axis scales
    xScaleRr = d3
        .scaleBand()
        .domain([1, 2, 3, 4, 5])  // all quintiles
        .range([usableArea.left, usableArea.right])
        .padding(0.2);

    yScaleRr = d3
        .scaleLinear()
        .domain(yDomainRr)  // fixed HR range
        .range([usableArea.bottom, usableArea.top]);

    // Create axes and gridlines
    const xAxis = d3
        .axisBottom(xScaleRr)
        .tickValues([1, 5])
        .tickFormat(d => (d === 1 ? "Slowest" : d === 5 ? "Fastest" : ""));
    const yAxis = d3.axisLeft(yScaleRr);

    // Draw gridlines
    const gridlines = svg
        .append('g')
        .attr('class', 'gridlines')
        .attr('transform', `translate(${usableArea.left}, 0)`)
        .call(d3.axisLeft(yScaleRr).tickFormat('').tickSize(-usableArea.width));

    // Draw axes
    svg
        .append('g')
        .attr('transform', `translate(0, ${usableArea.bottom})`)
        .call(xAxis);
    svg
        .append('g')
        .attr('transform', `translate(${usableArea.left}, 0)`)
        .call(yAxis);

    // X-axis label
    svg.append('text')
        .attr('class', 'x axis-label')
        .attr('text-anchor', 'middle')
        .attr('x', usableArea.left + usableArea.width / 2)
        .attr('y', height - margin.bottom / 2 + 5)
        .text('Performance Quintile');

    // Y-axis label
    svg.append('text')
        .attr('class', 'y axis-label')
        .attr('text-anchor', 'middle')
        .attr('transform', 'rotate(-90)')
        .attr('x', -(usableArea.top + usableArea.height / 2))
        .attr('y', margin.left / 2 - 5)
        .text('Mean Respiratory Rate');

    svg.append("g").attr("class", "bars");
}

// Renders VO2 plot
function renderVO2Plot() {

    // Define plot dimenstions
    const width = sub_window_width / 3;
    const height = sub_window_height;

    // Define margins and usable area
    const margin = {
        top: 30,
        right: 50,
        bottom: 80,
        left: 80
    };
    const usableArea = {
        top: margin.top,
        right: width - margin.right,
        bottom: height - margin.bottom,
        left: margin.left,
        width: width - margin.left - margin.right,
        height: height - margin.top - margin.bottom,
    };

    // Create the SVG element
    const container = d3.select('#sub-chart-3');

    // Create the SVG element
    const svg = container
        .append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .style('width', '100%')
        .style('height', '100%')

    // Define shared axis scales
    xScaleVO2 = d3
        .scaleBand()
        .domain([1, 2, 3, 4, 5])  // all quintiles
        .range([usableArea.left, usableArea.right])
        .padding(0.2);

    yScaleVO2 = d3
        .scaleLinear()
        .domain(yDomainVO2)  // fixed HR range
        .range([usableArea.bottom, usableArea.top]);

    // Create axes and gridlines
    const xAxis = d3
        .axisBottom(xScaleVO2)
        .tickValues([1, 5])
        .tickFormat(d => (d === 1 ? "Slowest" : d === 5 ? "Fastest" : ""));
    const yAxis = d3.axisLeft(yScaleVO2);

    // Draw gridlines
    const gridlines = svg
        .append('g')
        .attr('class', 'gridlines')
        .attr('transform', `translate(${usableArea.left}, 0)`)
        .call(d3.axisLeft(yScaleVO2).tickFormat('').tickSize(-usableArea.width));

    // Draw axes
    svg
        .append('g')
        .attr('transform', `translate(0, ${usableArea.bottom})`)
        .call(xAxis);
    svg
        .append('g')
        .attr('transform', `translate(${usableArea.left}, 0)`)
        .call(yAxis);

    // X-axis label
    svg.append('text')
        .attr('class', 'x axis-label')
        .attr('text-anchor', 'middle')
        .attr('x', usableArea.left + usableArea.width / 2)
        .attr('y', height - margin.bottom / 2 + 5)
        .text('Performance Quintile');

    // Y-axis label
    svg.append('text')
        .attr('class', 'y axis-label')
        .attr('text-anchor', 'middle')
        .attr('transform', 'rotate(-90)')
        .attr('x', -(usableArea.top + usableArea.height / 2))
        .attr('y', margin.left / 2 - 5)
        .text('Mean VO2 (ml / min / kg)');

    svg.append("g").attr("class", "bars");

}

// Update heart rate plot
function updateHrPlot(time) {
    const container = d3.select('#sub-chart-1');
    const svg = container.select("svg");
    const barGroup = svg.select(".bars");

    const raw = hr_data.filter(d => d.time === time);
    const fullData = [1, 2, 3, 4, 5].map(q => {
        const d = raw.find(r => r.quintile === q);
        if (d) {
            return { quintile: q, hr: d.hr, isMissing: false };
        } else {
            const fallback = last_hr.find(r => r.quintile === q);
            return { quintile: q, hr: fallback.last_hr, isMissing: true };
        }
    });

    const bars = barGroup.selectAll("rect").data(fullData, d => d.quintile);

    const colorScale = d3.scaleSequential()
        .domain([1, 5])
        .interpolator(d3.interpolateViridis);

    bars.enter()
        .append("rect")
        .attr("x", d => xScaleHr(d.quintile))
        .attr("width", xScaleHr.bandwidth())
        .attr("y", yScaleHr(yDomainHr[0]))
        .attr("height", 0)
        .attr("fill", d => d.isMissing ? "#ccc" : colorScale(d.quintile))
        .merge(bars)
        .transition()
        .duration(50)
        .attr("x", d => xScaleHr(d.quintile))
        .attr("width", xScaleHr.bandwidth())
        .attr("y", d => yScaleHr(d.hr))
        .attr("height", d => yScaleHr(yDomainHr[0]) - yScaleHr(d.hr))
        .attr("fill", d => colorScale(d.quintile))
        .attr("opacity", d => d.isMissing ? 0.6 : 1);

    bars.exit().remove();
}

// Update respiratory rate plot
function updateRrPlot(time) {
    const container = d3.select('#sub-chart-2');
    const svg = container.select("svg");
    const barGroup = svg.select(".bars");

    const raw = rr_data.filter(d => d.time === time);
    const fullData = [1, 2, 3, 4, 5].map(q => {
        const d = raw.find(r => r.quintile === q);
        if (d) {
            return { quintile: q, rr: d.rr, isMissing: false };
        } else {
            const fallback = last_rr.find(r => r.quintile === q);
            return { quintile: q, rr: fallback.last_rr, isMissing: true };
        }
    });

    const bars = barGroup.selectAll("rect").data(fullData, d => d.quintile);

    const colorScale = d3.scaleSequential()
        .domain([1, 5])
        .interpolator(d3.interpolateViridis);

    bars.enter()
        .append("rect")
        .attr("x", d => xScaleRr(d.quintile))
        .attr("width", xScaleRr.bandwidth())
        .attr("y", yScaleRr(yDomainRr[0]))
        .attr("height", 0)
        .attr("fill", d => d.isMissing ? "#ccc" : colorScale(d.quintile))
        .merge(bars)
        .transition()
        .duration(50)
        .attr("x", d => xScaleRr(d.quintile))
        .attr("width", xScaleRr.bandwidth())
        .attr("y", d => yScaleRr(d.rr))
        .attr("height", d => yScaleRr(yDomainRr[0]) - yScaleRr(d.rr))
        .attr("fill", d => colorScale(d.quintile))
        .attr("opacity", d => d.isMissing ? 0.6 : 1);

    bars.exit().remove();
}

// Update VO2 plot
function updateVO2Plot(time) {
    const container = d3.select('#sub-chart-3');
    const svg = container.select("svg");
    const barGroup = svg.select(".bars");

    const raw = VO2_data.filter(d => d.time === time);
    const fullData = [1, 2, 3, 4, 5].map(q => {
        const d = raw.find(r => r.quintile === q);
        if (d) {
            return { quintile: q, VO2: d.VO2, isMissing: false };
        } else {
            const fallback = last_VO2.find(r => r.quintile === q);
            return { quintile: q, VO2: fallback.last_VO2, isMissing: true };
        }
    });

    const bars = barGroup.selectAll("rect").data(fullData, d => d.quintile);

    const colorScale = d3.scaleSequential()
        .domain([1, 5])
        .interpolator(d3.interpolateViridis);

    bars.enter()
        .append("rect")
        .attr("x", d => xScaleVO2(d.quintile))
        .attr("width", xScaleVO2.bandwidth())
        .attr("y", yScaleVO2(yDomainVO2[0]))
        .attr("height", 0)
        .attr("fill", d => d.isMissing ? "#ccc" : colorScale(d.quintile))
        .merge(bars)
        .transition()
        .duration(50)
        .attr("x", d => xScaleVO2(d.quintile))
        .attr("width", xScaleVO2.bandwidth())
        .attr("y", d => yScaleVO2(d.VO2))
        .attr("height", d => yScaleVO2(yDomainVO2[0]) - yScaleVO2(d.VO2))
        .attr("fill", d => colorScale(d.quintile))
        .attr("opacity", d => d.isMissing ? 0.6 : 1);

    bars.exit().remove();
}
// Updates tooltip position
function updateTooltipPosition(d, width, height) {
    const tooltip = document.getElementById('main-tooltip');
    const chartRect = document.querySelector('#chart svg').getBoundingClientRect();

    const scaleX = chartRect.width / width;
    const scaleY = chartRect.height / height;

    const x = xScale(d.time) * scaleX + chartRect.left + window.scrollX;

    // Vertically center relative to the SVG in document space
    const y = chartRect.top + window.scrollY + chartRect.height / 2;

    // Flip tooltip if near right edge
    const horizontalOffset = (chartRect.right - (x - window.scrollX) < tooltip.offsetWidth + 50)
        ? -tooltip.offsetWidth - 20
        : 20;

    tooltip.style.left = `${x + horizontalOffset}px`;
    tooltip.style.top = `${y - 40 - tooltip.offsetHeight / 2}px`;  // Vertically centered
}

// Renders main plot tool tip
function renderTooltipContent(row) {
    const remaining = document.getElementById('people-remaining');
    const time = document.getElementById('time-elapsed');
    const speed = document.getElementById('treadmill-speed');
    const pace = document.getElementById('treadmill-pace');

    if (Object.keys(row).length === 0) return;

    remaining.textContent = row.remaining
    time.textContent = formatTimeMMSS(row.time)
    speed.textContent = `${row.speed} kph`
    pace.textContent = `${row.pace} / mile`
}

// Updates tooltip visibility
function updateTooltipVisibility(isVisible) {
    const tooltip = document.getElementById('main-tooltip');

    if (typeof isVisible === 'boolean') {
        tooltip.hidden = !isVisible;
    } else {
        tooltip.hidden = !tooltip.hidden;
    }
}

let main_data = await loadMainData(main_data_path);
let [hr_data, last_hr] = await loadHrData(hr_data_path);
let [rr_data, last_rr] = await loadRrData(rr_data_path);
let [VO2_data, last_VO2] = await loadVO2Data(VO2_data_path);

renderMainPlot(main_data);
renderHrPlot(hr_data);
renderRrPlot(rr_data);
renderVO2Plot(VO2_data);


