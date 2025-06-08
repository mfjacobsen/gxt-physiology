import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

const runnersDataPath = "./data/personal/runners_data.csv";
const runnersStatsPath = "./data/personal/runners_stats.csv";
const runnersTestsPaths = "./data/personal/runners_tests.csv";

const sexInput = document.getElementById("sex-input");
const ageInput = document.getElementById("age-input");
const heightInput = document.getElementById("height-input");
const weightInput = document.getElementById("weight-input");
const unitsSelect = document.getElementById("units-input");

const numRunners = 5;

let xScaleRunners, yScaleRunners;

const runnersTableMargin = { top: 40, right: 0, bottom: 40, left: 0 };

let vt1Locked = false;
let vt1SelectedTime = null;
let vt2Locked = false;
let vt2SelectedTime = null;

let selectedBarIndex = null;

// Loads and formats the runners demographic data
async function loadRunnersData(path) {
    const data = await d3.csv(path, row => ({
        id_test: row.ID_test,
        sex: row.Sex,
        age: +row.Age,
        height_metric: +row.Height_metric,
        weight_metric: +row.Weight_metric,
        height_imperial: +row.Height_imperial,
        weight_imperial: +row.Weight_imperial,
        age_normal: +row.Age_normal,
        height_normal: +row.Height_normal,
        weight_normal: +row.Weight_normal
    }));

    return data;
}

// Loads and formats runners normalization statistics
async function loadRunnersStats(path) {
    const rows = await d3.csv(path);

    const stats = {};
    rows.forEach(row => {
        const label = row[""];
        stats[label] = {
            height_metric: +row.Height_metric,
            weight_metric: +row.Weight_metric,
            height_imperial: +row.Height_imperial,
            weight_imperial: +row.Weight_imperial,
            age: +row.Age
        };
    });

    return stats;
}

// Loads and formats runners tests data
async function loadRunnersTests(path) {
    const data = await d3.csv(path, row => ({
        id_test: row.ID_test,
        time: +row.time,
        pace_metric: row.pace_metric,
        pace_imperial: row.pace_imperial,
        dist_metric: +row.dist_km,
        dist_imperial: +row.dist_miles,
        speed: +row.Speed,
        hr: +row.HR,
        rr: +row.RR,
        vo2: +row.O2_rate,
        vco2: +row.CO2_rate,
        ve: +row.air_rate
    }));

    return data;
}

// Formats seconds to minutes and seconds
function formatTimeMMSS(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

// Adds units in the input fields
function formatWithUnit(input, unit) {
    const val = input.value.trim();
    if (val && !val.endsWith(unit)) {
        input.value = `${val} ${unit}`;
    }
}

// Removes units from the input fields
function removeUnit(input, unitPattern) {
    input.value = input.value.replace(unitPattern, "").trim();
}

// Normalizes a value based on mean and standard deviation
function normalize(value, mean, std) {
    return (value - mean) / std;
  }

// Computes the normalized distance between a runner's data and the input values
function computeDistance(row, input, stats, isMetric) {
    const features = [];

    if (input.age !== "") {
        const inputAgeNorm = normalize(+input.age, stats.mean.age, stats.std.age);
        features.push(((inputAgeNorm - row.age_normal) ** 2) * 2);
    }

    if (input.height !== "") {
        const mean = isMetric ? stats.mean.height_metric : stats.mean.height_imperial;
        const std = isMetric ? stats.std.height_metric : stats.std.height_imperial;
        const inputHeightNorm = normalize(+input.height, mean, std);
        features.push((inputHeightNorm - row["height_normal"]) ** 2);
    }

    if (input.weight !== "") {
        const mean = isMetric ? stats.mean.weight_metric : stats.mean.weight_imperial;
        const std = isMetric ? stats.std.weight_metric : stats.std.weight_imperial;
        const inputWeightNorm = normalize(+input.weight, mean, std);
        features.push((inputWeightNorm - row["weight_normal"]) ** 2);
    }

    return features.length > 0 ? features.reduce((a, b) => a + b, 0) : Infinity;
  }

// Renders the runners table based on the loaded data and input fields
function renderRunnersTable(data, stats, testsData, initialRender = false) {
    const isMetric = unitsSelect.value === "metric";
    const sex = sexInput.value.trim().toLowerCase();
    const age = ageInput.value.trim();
    const height = heightInput.value.trim();
    const weight = weightInput.value.trim();

    const input = {
        age: age.replace(/[^\d.]/g, ""),
        height: height.replace(/[^\d.]/g, ""),
        weight: weight.replace(/[^\d.]/g, "")
      };

    let filtered = sex
        ? data.filter(d => d.sex.toLowerCase() === sex)
        : data;

    // Compute distances and sort if any input exists
    const anyInput = age !== "" || height !== "" || weight !== "";
    if (anyInput) {
        filtered = filtered
            .map(d => ({
                ...d,
                distance: computeDistance(d, input, stats, isMetric)
            }))
            .sort((a, b) => a.distance - b.distance)
    }

    filtered = filtered.slice(0,numRunners);

    const container = d3.select("#runners-table");
    container.html("");

    container.style("margin-top", `${runnersTableMargin.top}px`)
    container.style("margin-bottom", `${runnersTableMargin.bottom}px`);

    const columns = isMetric
        ? [
            { key: "id_test", label: "Test ID" },
            { key: "sex", label: "Sex (M/F)" },
            { key: "age", label: "Age" },
            { key: "height_metric", label: "Height (cm)" },
            { key: "weight_metric", label: "Weight (kg)" }
        ]
        : [
            { key: "id_test", label: "Test ID" },
            { key: "sex", label: "Sex (M/F)" },
            { key: "age", label: "Age" },
            { key: "height_imperial", label: "Height (in)" },
            { key: "weight_imperial", label: "Weight (lbs)" }
        ];

    const table = container.append("table").attr("class", "d3-table");
    const thead = table.append("thead");
    const tbody = table.append("tbody");

    thead.append("tr")
        .selectAll("th")
        .data(columns)
        .enter()
        .append("th")
        .text(col => col.label); // display label

    const rows = tbody.selectAll("tr")
        .data(filtered)
        .enter()
        .append("tr");

    rows.selectAll("td")
        .data(row => columns.map(col => row[col.key])) // extract by key
        .enter()
        .append("td")
        .text(d => d);

    if (initialRender) {
        renderRunnersPlot();
    }

    updateRunnersPlot(filtered, testsData);
}

// Gets table height for plot layout
function getTableHeights() {
    // Get body height
    const tbody = document.querySelector("#runners-table tbody");
    const bodyHeight = tbody ? tbody.getBoundingClientRect().height : 0;

    // Get header height
    const thead = document.querySelector("#runners-table thead");
    const headerHeight = thead ? thead.getBoundingClientRect().height : 0;

    return { bodyHeight, headerHeight };
}

// Renders the runners bar plot
function renderRunnersPlot(container = "#runners-bar-plot") {

    const { bodyHeight, headerHeight } = getTableHeights();

    const margin = { 
        top: headerHeight + runnersTableMargin.top + 1, 
        right: 20, 
        bottom: runnersTableMargin.bottom, 
        left: 30, 
    };

    const height = bodyHeight + margin.top + margin.bottom;
    const width = document.querySelector(container).getBoundingClientRect().width - 20;

    const usableArea = {
        width: width - margin.left - margin.right,
        height: height - margin.top - margin.bottom,
        top: margin.top,
        right: width - margin.right,
        bottom: height - margin.bottom,
        left: margin.left
    }

    // Create svg element
    const svg = d3
        .select(container)
        .append('svg')
        .attr("viewBox", `0 0 ${width} ${height}`)
        .style("width", "100%")
        .style("height", `${height}px`);

    // Define axis scales  
    xScaleRunners = d3
        .scaleLinear()
        .domain([0, 1100])
        .range([usableArea.left, usableArea.right]);

    yScaleRunners = d3
        .scaleBand()
        .domain(d3.range(numRunners).map(String))
        .range([usableArea.top, usableArea.bottom])
        .padding(0.3);

    // Define axes
    const xAxis = d3
            .axisBottom(xScaleRunners)
            .tickFormat(formatTimeMMSS);
    const yAxis = d3.axisLeft(yScaleRunners)
        .tickFormat("")
        .tickSize(0);

    // Draw axes
    svg
        .append('g')
        .attr('transform', `translate(0, ${usableArea.bottom})`)
        .attr('class', 'x-axis')
        .call(xAxis);
    svg
        .append('g')
        .attr('class', 'y-axis')
        .attr('transform', `translate(${usableArea.left}, 0)`)
        .call(yAxis);

    // Add Title
    svg.append("text")
        .attr("x", width / 2)                  
        .attr("y", margin.top / 2)              
        .attr("text-anchor", "middle")         
        .attr("font-size", "1.5em")             
        .attr("font-weight", "bold")
        .attr("fill", "white")
        .text("Time on Treadmill");

    
    svg.append("g").attr("class", "bars");
}

// Update the runners plot
function updateRunnersPlot(filtered, testsData, container = "#runners-bar-plot") {

    d3.select("#runners-bar-plot svg").selectAll(".vt1-line").remove();
    d3.select("#runners-bar-plot svg").selectAll(".vt2-line").remove();

    // Join: get max test time for each id_test in filtered
    const testMap = d3.group(testsData, d => d.id_test);

    const dataWithTimes = filtered.map((d, i) => {
        const tests = testMap.get(d.id_test) || [];
        const maxTime = d3.max(tests, t => t.time) || 0;

        return {
            id_test: d.id_test,
            index: String(i),              
            distance: d.distance ?? Infinity,
            time: maxTime
        };
    });

    let selectedId = null;
    let locked = false;

    const svg = d3.select(container).select("svg");

    const bars = svg.select("g.bars")
        .selectAll("rect")
        .data(dataWithTimes, d => `${d.id_test}_${d.index}`)
        .join(
            enter => enter.append("rect")
                .attr("x", xScaleRunners(0))
                .attr("y", d => yScaleRunners(d.index))
                .attr("height", yScaleRunners.bandwidth())
                .attr("width", 0)
                .attr("fill", "#4682b4")
                .attr("cursor", "pointer")
                .on("mouseover", function (event, d) {
                    if (locked) return;

                    // Highlight bars
                    svg.select("g.bars").selectAll("rect")
                        .attr("fill", r => r.id_test === d.id_test ? "#1e90ff" : "#a3b2c1");

                    // Highlight row
                    d3.selectAll("#runners-table tbody tr")
                        .classed("runner-row-highlight", (_, i) => filtered[i].id_test === d.id_test);

                    // Redraw threshold plots
                    updateThreshold1Plot(runnersTests, d.id_test);
                    updateThreshold2Plot(runnersTests, d.id_test);

                    // Show tooltip
                    const tooltip = document.getElementById("runner-tooltip");
                    tooltip.textContent = "Select Runner";
                    tooltip.style.left = `${event.pageX + 10}px`;
                    tooltip.style.top = `${event.pageY - 20}px`;
                    tooltip.style.display = "block";
                })

                .on("mouseout", function (event, d) {
                    if (locked) return;

                    svg.select("g.bars").selectAll("rect")
                        .attr("fill", r => {
                            if (locked && selectedId) return r.id_test === selectedId ? "#1e90ff" : "#a3b2c1";
                            return "#4682b4";
                        });

                    d3.selectAll("#runners-table tbody tr")
                        .classed("runner-row-highlight", (_, i) => locked && filtered[i].id_test === selectedId);

                    document.getElementById("runner-tooltip").style.display = "none";

                    renderThreshold1Plot(runnersTests);
                    renderThreshold2Plot(runnersTests);
                })

                .on("click", function (event, d) {
                    if (locked && selectedId === d.id_test) {
                        // Unlock
                        selectedId = null;
                        locked = false;
                        svg.select("g.bars").selectAll("rect")
                            .attr("fill", "#4682b4");

                        d3.selectAll("#runners-table tbody tr")
                            .classed("runner-row-highlight", false);

                        document.getElementById("runner-tooltip").style.display = "block";
                        
                    } else {
                        // Lock to clicked runner
                        selectedId = d.id_test;
                        selectedBarIndex = d.index;
                        locked = true;

                        svg.select("g.bars").selectAll("rect")
                            .attr("fill", r => r.id_test === selectedId ? "#1e90ff" : "#a3b2c1");

                        d3.selectAll("#runners-table tbody tr")
                            .classed("runner-row-highlight", (_, i) => filtered[i].id_test === selectedId);

                        document.getElementById("runner-tooltip").style.display = "none";

                        // Redraw threshold plots
                        updateThreshold1Plot(runnersTests, d.id_test);
                        updateThreshold2Plot(runnersTests, d.id_test);

                    }
                })
                .transition()
                .ease(d3.easeLinear)
                .duration(d => (xScaleRunners(d.time) - xScaleRunners(0)) * 2)
                .attr("width", d => xScaleRunners(d.time) - xScaleRunners(0))
        );

    const labelMap = Object.fromEntries(filtered.map((d, i) => [String(i), d.id_test]));

    svg.select("g.y-axis")
        .call(
            d3.axisLeft(yScaleRunners)
                .tickFormat("") // removes labels
                .tickSize(0)    // removes ticks
        );

    // Make x-axis labels larger
    svg.select("g.x-axis")
        .selectAll(".tick text")
        .style("font-size", "14px");

    // Make y-axis labels larger
    svg.select("g.y-axis")
        .selectAll(".tick text")
        .style("font-size", "14px");

    renderThreshold1Plot(runnersTests);
    renderThreshold2Plot(runnersTests);
}

// Renders the threshold 1 plot for VCO₂ / VO₂ ratio
function renderThreshold1Plot(runnersTests, id_test = "100_1") {
    const container = d3.select("#runner-threshold-1");
    container.html(""); // clear previous

    const raw = runnersTests
        .filter(d => d.id_test === id_test && d.vo2 > 0 && d.vco2 > 0)
        .map(d => ({
            time: d.time,
            ratio: d.vco2 / d.vo2
        }));

    const data = raw.map((d, i) => {
        const window = raw.slice(Math.max(0, i - 9), i + 1);  // rolling window of 10
        const mean = d3.mean(window, e => e.ratio);
        return { time: d.time, ratio: mean };
    });

    const margin = { top: 40, right: 40, bottom: 50, left: 70 };
    const width = 600;
    const height = 300;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = container
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    svg
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("width", "100%")
        .style("height", "auto");

    const x = d3.scaleLinear()
        .domain(d3.extent(data, d => d.time))
        .range([0, innerWidth]);

    const y = d3.scaleLinear()
        .domain(d3.extent(data, d => d.ratio))
        .nice()
        .range([innerHeight, 0]);

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Y gridlines (left-aligned, full width, no labels)
    const yGrid = d3.axisLeft(y)
        .tickSize(-innerWidth)
        .tickFormat("");

    // Remove old grid if present
    g.select(".y-grid").remove();

    // Append new gridlines group
    g.append("g")
        .attr("class", "y-grid")
        .call(yGrid);

    // Axes
    g.append("g")
        .attr("id", "x-axis-threshold-1")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x).tickFormat(formatTimeMMSS));

    g.append("g")
        .attr("id", "y-axis-threshold-1")
        .call(d3.axisLeft(y));

    // Labels
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", 20)
        .attr("text-anchor", "middle")
        .attr("font-size", "18px")
        .attr("font-weight", "bold")
        .attr("fill", "white")
        .html("Identify The <span style='color: limegreen;'>Aerobic</span> Threshold");

    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height-3)
        .attr("text-anchor", "middle")
        .attr("fill", "white")
        .text("Time (s)");

    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", 15)
        .attr("text-anchor", "middle")
        .attr("fill", "white")
        .text("VCO₂ / VO₂");

    // Remove old focus group
    g.selectAll(".focus-threshold1").remove();
}

// Updates the threshold 1 plot based on selected test ID
function updateThreshold1Plot(runnersTests, id_test) {
    vt1Locked = false;
    vt1SelectedTime = null;

    const svg = d3.select("#runner-threshold-1 svg");
    const g = svg.select("g");

    const raw = runnersTests
        .filter(d => d.id_test === id_test && d.vo2 > 0 && d.vco2 > 0)
        .map(d => ({
            time: d.time,
            ratio: d.vco2 / d.vo2
        }));

    const data = raw.map((d, i) => {
        const window = raw.slice(Math.max(0, i - 9), i + 1);
        const mean = d3.mean(window, e => e.ratio);
        return { time: d.time, ratio: mean };
    })

    // Get inner dimensions from existing transform
    const transform = g.attr("transform");
    const marginLeft = +transform.split("(")[1].split(",")[0];
    const marginTop = +transform.split(",")[1].split(")")[0];

    const width = +svg.attr("width");
    const height = +svg.attr("height");
    const innerWidth = width - marginLeft - 40;
    const innerHeight = height - marginTop - 50;

    const x = d3.scaleLinear()
        .domain(d3.extent(data, d => d.time))
        .range([0, innerWidth]);

    const y = d3.scaleLinear()
        .domain(d3.extent(data, d => d.ratio))
        .nice()
        .range([innerHeight, 0]);

    // Y gridlines (left-aligned, full width, no labels)
    const yGrid = d3.axisLeft(y)
        .tickSize(-innerWidth)
        .tickFormat("");

    // Remove old grid if present
    g.select(".y-grid").remove();

    // Append new gridlines group
    g.append("g")
        .attr("class", "y-grid")
        .call(yGrid);

    // Update axes
    g.select("#x-axis-threshold-1")
        .transition()
        .duration(500)
        .call(d3.axisBottom(x).tickFormat(formatTimeMMSS));

    g.select("#y-axis-threshold-1")
        .transition()
        .duration(500)
        .call(d3.axisLeft(y));

    // Update line
    const line = d3.line()
        .x(d => x(d.time))
        .y(d => y(d.ratio));

    // Remove the old line completely
    g.select("path.threshold-line").remove();

    // Add new line with animated draw
    const path = g.append("path")
        .datum(data)
        .attr("class", "threshold-line")
        .attr("fill", "none")
        .attr("stroke", "#1e90ff")
        .attr("stroke-width", 2)
        .attr("d", line);

    // Animate draw from left to right
    const totalLength = path.node().getTotalLength();
    path
        .attr("stroke-dasharray", totalLength)
        .attr("stroke-dashoffset", totalLength)
        .transition()
        .duration(1000)
        .ease(d3.easeLinear)
        .attr("stroke-dashoffset", 0);

    // Remove old focus group
    g.selectAll(".focus-threshold1").remove();

    // Append new focus group
    const focusGroup = g.append("g")
        .attr("class", "focus-threshold1")
        .style("display", "none"); 

    const focusCircle = focusGroup.append("circle")
        .attr("r", 5)
        .attr("fill", "lightgreen");

    const focusVLine = focusGroup.append("line")
        .attr("stroke", "white")
        .attr("stroke-width", 1)
        .attr("y1", 0)
        .attr("y2", innerHeight);

    const focusHLine = focusGroup.append("line")
        .attr("stroke", "white")
        .attr("stroke-width", 1)
        .attr("x1", 0)
        .attr("x2", innerWidth);

    const tooltip = document.getElementById("vt1-tooltip");

    const tipsBox = document.querySelector('#vt1-tips');

    g.append("rect")
        .attr("class", "overlay-threshold1")
        .attr("width", innerWidth)
        .attr("height", innerHeight)
        .attr("fill", "none")
        .attr("pointer-events", "all")
        .on("mousemove", (event) => {
            if (!vt1Locked) {
                const [mx] = d3.pointer(event);
                const nearest = d3.least(data, d => Math.abs(x(d.time) - mx));
                if (!nearest) return;
                const cx = x(nearest.time);
                const cy = y(nearest.ratio);

                focusGroup.style("display", null);
                focusCircle.attr("cx", cx).attr("cy", cy);
                focusVLine.attr("x1", cx).attr("x2", cx).attr("y1", cy).attr("y2", innerHeight);
                focusHLine.attr("x1", 0).attr("x2", cx).attr("y1", cy).attr("y2", cy);

                tooltip.style.left = `${event.pageX + 10}px`;
                tooltip.style.top = `${event.pageY - 20}px`;
                tooltip.style.display = "block";

                focusGroup.style("display", "inline");
                focusVLine.style("display", null);
                focusHLine.style("display", null);
            }
            tipsBox.classList.add('draw-attention-hover')
        })
        .on("mouseleave", () => {
            if (!vt1Locked) {
                focusGroup.style("display", "none");
            }
            tooltip.style.display = "none";
            tipsBox.classList.remove('draw-attention-hover');
        })
        .on("click", (event) => {
            const [mx] = d3.pointer(event);
            const nearest = d3.least(data, d => Math.abs(x(d.time) - mx));
            if (!nearest) return;

            vt1Locked = !vt1Locked;
            vt1SelectedTime = vt1Locked ? nearest.time : null;

            if (vt1Locked) {
                // Lock focus: freeze circle and hide lines
                focusCircle.attr("cx", x(nearest.time)).attr("cy", y(nearest.ratio));
                focusVLine.style("display", "none");
                focusHLine.style("display", "none");

                const barSvg = d3.select("#runners-bar-plot svg");

                barSvg.selectAll(`.vt1-line-${id_test}`).remove();
                barSvg.append("line")
                    .attr("class", `vt1-line vt1-line-${id_test}`)
                    .attr("x1", xScaleRunners(nearest.time))
                    .attr("x2", xScaleRunners(nearest.time))
                    .attr("y1", yScaleRunners(selectedBarIndex))
                    .attr("y2", yScaleRunners(selectedBarIndex) + yScaleRunners.bandwidth())
                    .attr("stroke", "lightgreen")
                    .attr("stroke-width", 2);

                tooltip.style.display = "none";
            } else {
                // Unlock focus: re-enable lines and show hover behavior
                focusGroup.style("display", null);
                focusVLine.style("display", null);
                focusHLine.style("display", null);
                d3.select(`#runners-bar-plot svg .vt1-line-${id_test}`).remove();
                tooltip.style.display = "block";
            }
        });

}

// Renders the threshold 2 plot for VCO₂ / VO₂ ratio
function renderThreshold2Plot(runnersTests, id_test = "100_1") {
    const container = d3.select("#runner-threshold-2");
    container.html(""); // clear previous

    console.log("Runners Tests Data:", runnersTests);
    const raw = runnersTests
        .filter(d => d.id_test === id_test && d.vco2 > 0 && d.ve > 0)
        .map(d => ({
            time: d.time,
            ratio: d.ve / d.vco2
        }));

    console.log("Raw data for threshold 2:", raw);

    const data = raw.map((d, i) => {
        const window = raw.slice(Math.max(0, i - 9), i + 1);  // rolling window of 10
        const mean = d3.mean(window, e => e.ratio);
        return { time: d.time, ratio: mean };
    });

    console.log("Threshold 2 plot data:", data);

    const margin = { top: 40, right: 40, bottom: 50, left: 70 };
    const width = 600;
    const height = 300;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = container
        .append("svg")
        .attr("width", width)
        .attr("height", height);
    
    svg
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("width", "100%")
        .style("height", "auto");

    const x = d3.scaleLinear()
        .domain(d3.extent(data, d => d.time))
        .range([0, innerWidth]);

    const y = d3.scaleLinear()
        .domain(d3.extent(data, d => d.ratio))
        .nice()
        .range([innerHeight, 0]);

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Y gridlines (left-aligned, full width, no labels)
    const yGrid = d3.axisLeft(y)
        .tickSize(-innerWidth)
        .tickFormat("");

    // Remove old grid if present
    g.select(".y-grid").remove();

    // Append new gridlines group
    g.append("g")
        .attr("class", "y-grid")
        .call(yGrid);

    // Axes
    g.append("g")
        .attr("id", "x-axis-threshold-2")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x).tickFormat(formatTimeMMSS));

    g.append("g")
        .attr("id", "y-axis-threshold-2")
        .call(d3.axisLeft(y));

    // Labels
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", 20)
        .attr("text-anchor", "middle")
        .attr("font-size", "18px")
        .attr("font-weight", "bold")
        .attr("fill", "white")
        .text("Identify The Anaerobic Threshold");

    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height - 3)
        .attr("text-anchor", "middle")
        .attr("fill", "white")
        .text("Time (s)");

    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", 15)
        .attr("text-anchor", "middle")
        .attr("fill", "white")
        .text("VE / VCO₂");

    // Remove old focus group
    g.selectAll(".focus-threshold2").remove();
}

// Updates the threshold 2 plot based on selected test ID
function updateThreshold2Plot(runnersTests, id_test) {
    vt2Locked = false;
    vt2SelectedTime = null;

    const svg = d3.select("#runner-threshold-2 svg");
    const g = svg.select("g");

    const raw = runnersTests
        .filter(d => d.id_test === id_test && d.ve > 0 && d.vco2 > 0)
        .map(d => ({
            time: d.time,
            ratio: d.ve / d.vco2
        }));

    const data = raw.map((d, i) => {
        const window = raw.slice(Math.max(0, i - 9), i + 1);
        const mean = d3.mean(window, e => e.ratio);
        return { time: d.time, ratio: mean };
    })

    // Get inner dimensions from existing transform
    const transform = g.attr("transform");
    const marginLeft = +transform.split("(")[1].split(",")[0];
    const marginTop = +transform.split(",")[1].split(")")[0];

    const width = +svg.attr("width");
    const height = +svg.attr("height");
    const innerWidth = width - marginLeft - 40;
    const innerHeight = height - marginTop - 50;

    const x = d3.scaleLinear()
        .domain(d3.extent(data, d => d.time))
        .range([0, innerWidth]);

    const y = d3.scaleLinear()
        .domain(d3.extent(data, d => d.ratio))
        .nice()
        .range([innerHeight, 0]);

    // Y gridlines (left-aligned, full width, no labels)
    const yGrid = d3.axisLeft(y)
        .tickSize(-innerWidth)
        .tickFormat("");

    // Remove old grid if present
    g.select(".y-grid").remove();

    // Append new gridlines group
    g.append("g")
        .attr("class", "y-grid")
        .call(yGrid);

    // Update axes
    g.select("#x-axis-threshold-2")
        .transition()
        .duration(500)
        .call(d3.axisBottom(x).tickFormat(formatTimeMMSS));

    g.select("#y-axis-threshold-2")
        .transition()
        .duration(500)
        .call(d3.axisLeft(y));

    // Update line
    const line = d3.line()
        .x(d => x(d.time))
        .y(d => y(d.ratio));

    // Remove the old line completely
    g.select("path.threshold-line").remove();

    // Add new line with animated draw
    const path = g.append("path")
        .datum(data)
        .attr("class", "threshold-line")
        .attr("fill", "none")
        .attr("stroke", "#1e90ff")
        .attr("stroke-width", 2)
        .attr("d", line);

    // Animate draw from left to right
    const totalLength = path.node().getTotalLength();
    path
        .attr("stroke-dasharray", totalLength)
        .attr("stroke-dashoffset", totalLength)
        .transition()
        .duration(1000)
        .ease(d3.easeLinear)
        .attr("stroke-dashoffset", 0);

    // Remove old focus group
    g.selectAll(".focus-threshold2").remove();

    // Append new focus group
    const focusGroup = g.append("g")
        .attr("class", "focus-threshold2")
        .style("display", "none");

    const focusCircle = focusGroup.append("circle")
        .attr("r", 5)
        .attr("fill", "red");

    const focusVLine = focusGroup.append("line")
        .attr("stroke", "white")
        .attr("stroke-width", 1)
        .attr("y1", 0)
        .attr("y2", innerHeight);

    const focusHLine = focusGroup.append("line")
        .attr("stroke", "white")
        .attr("stroke-width", 1)
        .attr("x1", 0)
        .attr("x2", innerWidth);

    const tooltip = document.getElementById("vt2-tooltip");

    const tipsBox = document.querySelector('#vt2-tips');

    g.append("rect")
        .attr("class", "overlay-threshold2")
        .attr("width", innerWidth)
        .attr("height", innerHeight)
        .attr("fill", "none")
        .attr("pointer-events", "all")
        .on("mousemove", (event) => {
            if (!vt2Locked) {
                const [mx] = d3.pointer(event);
                const nearest = d3.least(data, d => Math.abs(x(d.time) - mx));
                if (!nearest) return;
                const cx = x(nearest.time);
                const cy = y(nearest.ratio);

                focusGroup.style("display", null);
                focusCircle.attr("cx", cx).attr("cy", cy);
                focusVLine.attr("x1", cx).attr("x2", cx).attr("y1", cy).attr("y2", innerHeight);
                focusHLine.attr("x1", 0).attr("x2", cx).attr("y1", cy).attr("y2", cy);

                tooltip.style.left = `${event.pageX + 10}px`;
                tooltip.style.top = `${event.pageY - 20}px`;
                tooltip.style.display = "block";

                focusGroup.style("display", "inline");
                focusVLine.style("display", null);
                focusHLine.style("display", null);
            }
            tipsBox.classList.add('draw-attention-hover');
        })
        .on("mouseleave", () => {
            if (!vt2Locked) {
                focusGroup.style("display", "none");
            }
            tooltip.style.display = "none";
            tipsBox.classList.remove('draw-attention-hover');
        })
        .on("click", (event) => {
            const [mx] = d3.pointer(event);
            const nearest = d3.least(data, d => Math.abs(x(d.time) - mx));
            if (!nearest) return;

            vt2Locked = !vt2Locked;
            vt2SelectedTime = vt2Locked ? nearest.time : null;

            if (vt2Locked) {
                // Lock focus: freeze circle and hide lines
                focusCircle.attr("cx", x(nearest.time)).attr("cy", y(nearest.ratio));
                focusVLine.style("display", "none");
                focusHLine.style("display", "none");

                const barSvg = d3.select("#runners-bar-plot svg");
                
                barSvg.selectAll(`.vt2-line-${id_test}`).remove();
                barSvg.append("line")
                    .attr("class", `vt2-line vt2-line-${id_test}`)
                    .attr("x1", xScaleRunners(nearest.time))
                    .attr("x2", xScaleRunners(nearest.time))
                    .attr("y1", yScaleRunners(selectedBarIndex))
                    .attr("y2", yScaleRunners(selectedBarIndex) + yScaleRunners.bandwidth())
                    .attr("stroke", "red")
                    .attr("stroke-width", 2);

                tooltip.style.display = "none";
            } else {
                // Unlock focus: re-enable lines and show hover behavior
                focusGroup.style("display", null);
                focusVLine.style("display", null);
                focusHLine.style("display", null);
                d3.select(`#runners-bar-plot svg .vt2-line-${id_test}`).remove();

                tooltip.style.display = "block";
            }
        });
}

// Renders the identifying 1 plot for VCO₂ / VO₂ ratio
function renderIdentifying1Plot(runnersTests, id_test = "639_1") {
    const container = d3.select("#identifying-threshold-1");
    let id_vt1Locked = false;
    let id_vt1SelectedTime = null;

    container.html(""); // clear previous

    const raw = runnersTests
        .filter(d => d.id_test === id_test && d.vo2 > 0 && d.vco2 > 0)
        .map(d => ({
            time: d.time,
            ratio: d.vco2 / d.vo2
        }));

    const data = raw.map((d, i) => {
        const window = raw.slice(Math.max(0, i - 9), i + 1);  // rolling window of 10
        const mean = d3.mean(window, e => e.ratio);
        return { time: d.time, ratio: mean };
    });

    const margin = { top: 40, right: 40, bottom: 50, left: 70 };
    const width = 600;
    const height = 300;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = container
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    svg
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("width", "100%")
        .style("height", "auto");

    const x = d3.scaleLinear()
        .domain(d3.extent(data, d => d.time))
        .range([0, innerWidth]);

    const y = d3.scaleLinear()
        .domain(d3.extent(data, d => d.ratio))
        .nice()
        .range([innerHeight, 0]);

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Y gridlines (left-aligned, full width, no labels)
    const yGrid = d3.axisLeft(y)
        .tickSize(-innerWidth)
        .tickFormat("");

    // Remove old grid if present
    g.select(".y-grid").remove();

    // Append new gridlines group
    g.append("g")
        .attr("class", "y-grid")
        .call(yGrid);

    // Axes
    g.append("g")
        .attr("id", "x-axis-identifying-1")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x).tickFormat(formatTimeMMSS));

    g.append("g")
        .attr("id", "y-axis-identifying-1")
        .call(d3.axisLeft(y));

    // Labels
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", 20)
        .attr("text-anchor", "middle")
        .attr("font-size", "18px")
        .attr("font-weight", "bold")
        .attr("fill", "white")
        .text("Identify The Aerobic Threshold");

    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height - 3)
        .attr("text-anchor", "middle")
        .attr("fill", "white")
        .text("Time (s)");

    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", 15)
        .attr("text-anchor", "middle")
        .attr("fill", "white")
        .text("VCO₂ / VO₂");

    // Update line
    const line = d3.line()
        .x(d => x(d.time))
        .y(d => y(d.ratio));

    // Add new line with animated draw
    const path = g.append("path")
        .datum(data)
        .attr("class", "threshold-line")
        .attr("fill", "none")
        .attr("stroke", "#1e90ff")
        .attr("stroke-width", 2)
        .attr("d", line);

    // Animate draw from left to right
    const totalLength = path.node().getTotalLength();
    path
        .attr("stroke-dasharray", totalLength)
        .attr("stroke-dashoffset", totalLength)
        .transition()
        .duration(1000)
        .ease(d3.easeLinear)
        .attr("stroke-dashoffset", 0);

    // Append new focus group
    const focusGroup = g.append("g")
        .attr("class", "focus-threshold1")
        .style("display", "none");

    const focusCircle = focusGroup.append("circle")
        .attr("r", 5)
        .attr("fill", "lightgreen");

    const focusVLine = focusGroup.append("line")
        .attr("stroke", "white")
        .attr("stroke-width", 1)
        .attr("y1", 0)
        .attr("y2", innerHeight);

    const focusHLine = focusGroup.append("line")
        .attr("stroke", "white")
        .attr("stroke-width", 1)
        .attr("x1", 0)
        .attr("x2", innerWidth);

    const tooltip = document.getElementById("id-vt1-tooltip");

    g.append("rect")
        .attr("class", "overlay-threshold1")
        .attr("width", innerWidth)
        .attr("height", innerHeight)
        .attr("fill", "none")
        .attr("pointer-events", "all")
        .on("mousemove", (event) => {
            if (!id_vt1Locked) {
                const [mx] = d3.pointer(event);
                const nearest = d3.least(data, d => Math.abs(x(d.time) - mx));
                if (!nearest) return;
                const cx = x(nearest.time);
                const cy = y(nearest.ratio);

                focusGroup.style("display", null);
                focusCircle.attr("cx", cx).attr("cy", cy);
                focusVLine.attr("x1", cx).attr("x2", cx).attr("y1", cy).attr("y2", innerHeight);
                focusHLine.attr("x1", 0).attr("x2", cx).attr("y1", cy).attr("y2", cy);

                tooltip.style.left = `${event.pageX + 10}px`;
                tooltip.style.top = `${event.pageY - 20}px`;
                tooltip.style.display = "block";

                focusGroup.style("display", "inline");
                focusVLine.style("display", null);
                focusHLine.style("display", null);
            }
        })
        .on("mouseleave", () => {
            if (!id_vt1Locked) {
                focusGroup.style("display", "none");
                tooltip.style.display = "none";
            }
        })
        .on("click", (event) => {
            const [mx] = d3.pointer(event);
            const nearest = d3.least(data, d => Math.abs(x(d.time) - mx));
            if (!nearest) return;

            id_vt1Locked = !id_vt1Locked;
            id_vt1SelectedTime = id_vt1Locked ? nearest.time : null;

            if (id_vt1Locked) {
                // Lock focus: freeze circle, hide hover lines, hide tooltip
                focusCircle.attr("cx", x(nearest.time)).attr("cy", y(nearest.ratio));
                focusVLine.style("display", "none");
                focusHLine.style("display", "none");
                tooltip.style.display = "none";

                // Draw green vertical line at 2:30 (150s), animated from bottom up
                const targetTime = 150;
                const nearest150 = d3.least(data, d => Math.abs(d.time - targetTime));
                if (nearest150) {
                    const cx = x(nearest150.time);
                    const cy = y(nearest150.ratio);

                    // Remove existing line if any
                    g.select("#locked-threshold1-line").remove();

                    // Remove existing line and label if any
                    g.select("#locked-threshold1-line").remove();
                    g.select("#locked-threshold1-label").remove();

                    // Append and animate vertical line
                    const greenLine = g.append("line")
                        .attr("id", "locked-threshold1-line")
                        .attr("x1", cx)
                        .attr("x2", cx)
                        .attr("y1", innerHeight)
                        .attr("y2", innerHeight)
                        .attr("stroke", "limegreen")
                        .attr("stroke-width", 2)
                        .attr("stroke-dasharray", "4,2");

                    greenLine.transition()
                        .duration(800)
                        .attr("y2", cy);

                    // Add explanatory label text
                    g.append("text")
                        .attr("x", cx + 8)
                        .attr("y", cy)
                        .attr("fill", "white")
                        .attr("font-size", "16px")
                        .attr("id", "locked-threshold1-label")
                        .attr("opacity", 0)
                        .selectAll("tspan")
                        .data([
                            "Close! This runner's aerobic",
                            "threshold happened around 2:30"
                        ])
                        .enter()
                        .append("tspan")
                        .attr("x", cx + 20)          // reset x for each line
                        .attr("dy", (d, i) => i === 0 ? 0 : "1.2em")  // line spacing
                        .text(d => d);

                    // Fade in transition
                    d3.select("#locked-threshold1-label")
                        .transition()
                        .delay(800)
                        .duration(500)
                        .attr("opacity", 1);
                }

            } else {
                // Unlock focus: re-enable hover lines, tooltip, and remove green line
                focusGroup.style("display", null);
                focusVLine.style("display", null);
                focusHLine.style("display", null);
                tooltip.style.display = "block";

                g.select("#locked-threshold1-line").remove();
            }
        });

}

// Renders the identifying 2 plot for VCO₂ / VO₂ ratio
function renderIdentifying2Plot(runnersTests, id_test = "639_1") {
    const container = d3.select("#identifying-threshold-2");
    container.html(""); // clear previous

    let id_vt2Locked = false;
    let id_vt2SelectedTime = null;

    console.log("Runners Tests Data:", runnersTests);
    const raw = runnersTests
        .filter(d => d.id_test === id_test && d.vco2 > 0 && d.ve > 0)
        .map(d => ({
            time: d.time,
            ratio: d.ve / d.vco2
        }));

    const data = raw.map((d, i) => {
        const window = raw.slice(Math.max(0, i - 9), i + 1);  // rolling window of 10
        const mean = d3.mean(window, e => e.ratio);
        return { time: d.time, ratio: mean };
    });

    const margin = { top: 40, right: 40, bottom: 50, left: 70 };
    const width = 600;
    const height = 300;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = container
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    svg
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("width", "100%")
        .style("height", "auto");

    const x = d3.scaleLinear()
        .domain(d3.extent(data, d => d.time))
        .range([0, innerWidth]);

    const y = d3.scaleLinear()
        .domain(d3.extent(data, d => d.ratio))
        .nice()
        .range([innerHeight, 0]);

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Y gridlines (left-aligned, full width, no labels)
    const yGrid = d3.axisLeft(y)
        .tickSize(-innerWidth)
        .tickFormat("");

    // Append new gridlines group
    g.append("g")
        .attr("class", "y-grid")
        .call(yGrid);

    // Axes
    g.append("g")
        .attr("id", "x-axis-identifying-2")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x).tickFormat(formatTimeMMSS));

    g.append("g")
        .attr("id", "y-axis-identifying-2")
        .call(d3.axisLeft(y));

    // Labels
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", 20)
        .attr("text-anchor", "middle")
        .attr("font-size", "18px")
        .attr("font-weight", "bold")
        .attr("fill", "white")
        .text("Identify The Anaerobic Threshold");

    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height - 3)
        .attr("text-anchor", "middle")
        .attr("fill", "white")
        .text("Time (s)");

    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", 15)
        .attr("text-anchor", "middle")
        .attr("fill", "white")
        .text("VE / VCO₂");

    // Update line
    const line = d3.line()
        .x(d => x(d.time))
        .y(d => y(d.ratio));

    // Add new line with animated draw
    const path = g.append("path")
        .datum(data)
        .attr("class", "threshold-line")
        .attr("fill", "none")
        .attr("stroke", "#1e90ff")
        .attr("stroke-width", 2)
        .attr("d", line);

    // Animate draw from left to right
    const totalLength = path.node().getTotalLength();
    path
        .attr("stroke-dasharray", totalLength)
        .attr("stroke-dashoffset", totalLength)
        .transition()
        .duration(1000)
        .ease(d3.easeLinear)
        .attr("stroke-dashoffset", 0);

    // Append new focus group
    const focusGroup = g.append("g")
        .attr("class", "focus-threshold1")
        .style("display", "none");

    const focusCircle = focusGroup.append("circle")
        .attr("r", 5)
        .attr("fill", "red");

    const focusVLine = focusGroup.append("line")
        .attr("stroke", "white")
        .attr("stroke-width", 1)
        .attr("y1", 0)
        .attr("y2", innerHeight);

    const focusHLine = focusGroup.append("line")
        .attr("stroke", "white")
        .attr("stroke-width", 1)
        .attr("x1", 0)
        .attr("x2", innerWidth);

    const tooltip = document.getElementById("id-vt2-tooltip");

    g.append("rect")
        .attr("class", "overlay-threshold1")
        .attr("width", innerWidth)
        .attr("height", innerHeight)
        .attr("fill", "none")
        .attr("pointer-events", "all")
        .on("mousemove", (event) => {
            if (!id_vt2Locked) {
                const [mx] = d3.pointer(event);
                const nearest = d3.least(data, d => Math.abs(x(d.time) - mx));
                if (!nearest) return;
                const cx = x(nearest.time);
                const cy = y(nearest.ratio);

                focusGroup.style("display", null);
                focusCircle.attr("cx", cx).attr("cy", cy);
                focusVLine.attr("x1", cx).attr("x2", cx).attr("y1", cy).attr("y2", innerHeight);
                focusHLine.attr("x1", 0).attr("x2", cx).attr("y1", cy).attr("y2", cy);

                tooltip.style.left = `${event.pageX + 10}px`;
                tooltip.style.top = `${event.pageY - 20}px`;
                tooltip.style.display = "block";

                focusGroup.style("display", "inline");
                focusVLine.style("display", null);
                focusHLine.style("display", null);
            }
        })
        .on("mouseleave", () => {
            if (!id_vt2Locked) {
                focusGroup.style("display", "none");
                tooltip.style.display = "none";
            }
        })
        .on("click", (event) => {
            const [mx] = d3.pointer(event);
            const nearest = d3.least(data, d => Math.abs(x(d.time) - mx));
            if (!nearest) return;

            id_vt2Locked = !id_vt2Locked;
            id_vt2SelectedTime = id_vt2Locked ? nearest.time : null;

            if (id_vt2Locked) {
                // Lock focus: freeze circle, hide hover lines, hide tooltip
                focusCircle.attr("cx", x(nearest.time)).attr("cy", y(nearest.ratio));
                focusVLine.style("display", "none");
                focusHLine.style("display", "none");
                tooltip.style.display = "none";

                // Draw red vertical line at 5:50 (350s), animated from bottom up
                const targetTime = 350;
                const nearest350 = d3.least(data, d => Math.abs(d.time - targetTime));
                if (nearest350) {
                    const cx = x(nearest350.time);
                    const cy = y(nearest350.ratio);

                    // Remove existing line if any
                    g.select("#locked-threshold2-line").remove();

                    // Remove existing line and label if any
                    g.select("#locked-threshold2-line").remove();
                    g.select("#locked-threshold2-label").remove();

                    // Append and animate vertical line
                    const redLine = g.append("line")
                        .attr("id", "locked-threshold2-line")
                        .attr("x1", cx)
                        .attr("x2", cx)
                        .attr("y1", innerHeight)
                        .attr("y2", innerHeight)
                        .attr("stroke", "red")
                        .attr("stroke-width", 2)
                        .attr("stroke-dasharray", "4,2");

                    redLine.transition()
                        .duration(800)
                        .attr("y2", cy);

                    // Add explanatory label text
                    g.append("text")
                        .attr("x", cx + 8)
                        .attr("y", cy - 125)
                        .attr("fill", "white")
                        .attr("font-size", "16px")
                        .attr("id", "locked-threshold2-label")
                        .attr("opacity", 0)
                        .selectAll("tspan")
                        .data([
                            "The aerobic threshold is harder to spot...",
                            "This one likely happened around 5:50"
                        ])
                        .enter()
                        .append("tspan")
                        .attr("x", cx - 250)          // reset x for each line
                        .attr("dy", (d, i) => i === 0 ? 0 : "1.2em")  // line spacing
                        .text(d => d);

                    // Fade in transition
                    d3.select("#locked-threshold2-label")
                        .transition()
                        .delay(800)
                        .duration(500)
                        .attr("opacity", 1);
                }

            } else {
                // Unlock focus: re-enable hover lines, tooltip, and remove red line
                focusGroup.style("display", null);
                focusVLine.style("display", null);
                focusHLine.style("display", null);
                tooltip.style.display = "block";

                g.select("#locked-threshold2-line").remove();
            }
        });

    
}

function renderInstructions1Plot() {
    const container = d3.select("#instructions-vt1-plot");

    const margin = { top: 40, right: 40, bottom: 50, left: 70 };
    const width = 600;
    const height = 300;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const thresholdTime = 200;
    const thresholdRatio = 0.84;

    const svg = container
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    svg
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("width", "100%")
        .style("height", "auto");

    const timeRange = d3.range(0, 601, 10);
    const data = timeRange.map(t => ({
        time: t,
        ratio: t < 200 ? thresholdRatio : thresholdRatio + 0.0008 * (t - thresholdTime)  // flat, then slope
    }));

    const x = d3.scaleLinear()
        .domain([0, 600])
        .range([0, innerWidth]);

    const y = d3.scaleLinear()
        .domain([0.7, 1.2])  // cover flat + sloped region
        .range([innerHeight, 0]);

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Axes
    g.append("g")
        .attr("id", "x-axis-instructions-1")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x).tickFormat(x => {}));

    g.append("g")
        .attr("id", "y-axis-instructions-1")
        .call(d3.axisLeft(y).tickFormat(x => {}));

    // Labels
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", 20)
        .attr("text-anchor", "middle")
        .attr("font-size", "18px")
        .attr("font-weight", "bold")
        .attr("fill", "white")
        .text("Shape for Identifying The Aerobic Threshold");

    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height - 3)
        .attr("text-anchor", "middle")
        .attr("fill", "white")
        .text("Time (s)");

    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", 15)
        .attr("text-anchor", "middle")
        .attr("fill", "white")
        .text("VCO₂ / VO₂");

    const line = d3.line()
        .x(d => x(d.time))
        .y(d => y(d.ratio));

    g.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", "#1e90ff")
        .attr("stroke-width", 2)
        .attr("d", line);

    g.append("line")
        .attr("x1", x(thresholdTime))
        .attr("x2", x(thresholdTime))
        .attr("y1", y(thresholdRatio))
        .attr("y2", innerHeight)
        .attr("stroke", "limegreen")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "4,2");

    g.append("circle")
        .attr("cx", x(thresholdTime))
        .attr("cy", y(thresholdRatio))
        .attr("r", 5)
        .attr("fill", "limegreen");
}

function renderInstructions2Plot() {
    const container = d3.select("#instructions-vt2-plot");

    const margin = { top: 40, right: 40, bottom: 50, left: 70 };
    const width = 600;
    const height = 300;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const thresholdTime = 400;
    const thresholdRatio = 0.84;

    const svg = container
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    svg
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("width", "100%")
        .style("height", "auto");

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
        .domain([0, 600])
        .range([0, innerWidth]);

    const y = d3.scaleLinear()
        .domain([0.7, 1.2])
        .range([innerHeight, 0]);

    const timeRange = d3.range(0, 601, 10);
    const data = timeRange.map(t => ({
        time: t,
        ratio: t < thresholdTime ? thresholdRatio : thresholdRatio + 0.0008 * (t - thresholdTime)
    }));

    const tGuide = 200;
    const yGuide = data.find(d => d.time === tGuide).ratio;

    // === GUIDE LINES ===

    // Horizontal dashed blue line from (0, yGuide) to (200, yGuide)
    g.append("line")
        .attr("x1", x(0))
        .attr("y1", y(yGuide))
        .attr("x2", x(tGuide))
        .attr("y2", y(yGuide))
        .attr("stroke", "#1e90ff")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "4,4");

    const slope = -0.3; // slope in data units
    const yStart = yGuide - slope;

    g.append("line")
        .attr("x1", x(0))
        .attr("y1", y(yStart))
        .attr("x2", x(tGuide))
        .attr("y2", y(yGuide))
        .attr("stroke", "#1e90ff")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "4,4");

    // === ACTUAL DATA TRACE AFTER 200 ===
    const postGuideData = data.filter(d => d.time >= tGuide);

    const line = d3.line()
        .x(d => x(d.time))
        .y(d => y(d.ratio));

    g.append("path")
        .datum(postGuideData)
        .attr("fill", "none")
        .attr("stroke", "#1e90ff")
        .attr("stroke-width", 2)
        .attr("d", line);

    // === THRESHOLD MARKER ===
    g.append("line")
        .attr("x1", x(thresholdTime))
        .attr("x2", x(thresholdTime))
        .attr("y1", y(thresholdRatio))
        .attr("y2", innerHeight)
        .attr("stroke", "red")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "4,2");

    g.append("circle")
        .attr("cx", x(thresholdTime))
        .attr("cy", y(thresholdRatio))
        .attr("r", 5)
        .attr("fill", "red");

    // === AXES ===
    g.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x).tickFormat(x => { }));

    g.append("g")
        .call(d3.axisLeft(y).tickFormat(x => { }));

    // === LABELS ===
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", 20)
        .attr("text-anchor", "middle")
        .attr("font-size", "18px")
        .attr("font-weight", "bold")
        .attr("fill", "white")
        .text("Shape For Identifying The Anaerobic Threshold");

    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height - 3)
        .attr("text-anchor", "middle")
        .attr("fill", "white")
        .text("Time (s)");

    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", 15)
        .attr("text-anchor", "middle")
        .attr("fill", "white")
        .text("VE / VCO₂");
}


// Add event listeners to input fields
function addInputEventListeners() {
    
    // Add event listeners for input fields
    // Sex
    sexInput.addEventListener("change", () => renderRunnersTable(runnersData, runnersStats, runnersTests));

    // Age
    ageInput.addEventListener("blur", () => formatWithUnit(ageInput, "years"));
    ageInput.addEventListener("focus", () => removeUnit(ageInput, /\s*years$/));
    ageInput.addEventListener("input", () => {
        ageInput.value = ageInput.value.replace(/\D/g, "");
    });
    ageInput.addEventListener("change", () => renderRunnersTable(runnersData, runnersStats, runnersTests));

    // Height
    heightInput.addEventListener("blur", () => {
        const unit = unitsSelect.value === "metric" ? "cm" : "in";
        formatWithUnit(heightInput, unit);
    });
    heightInput.addEventListener("focus", () =>
        removeUnit(heightInput, /\s*(cm|in)$/)
    );
    heightInput.addEventListener("input", () => {
        heightInput.value = heightInput.value.replace(/\D/g, "");
    });
    heightInput.addEventListener("change", () => renderRunnersTable(runnersData, runnersStats, runnersTests));

    // Weight
    weightInput.addEventListener("blur", () => {
        const unit = unitsSelect.value === "metric" ? "kg" : "lbs";
        formatWithUnit(weightInput, unit);
    });
    weightInput.addEventListener("focus", () =>
        removeUnit(weightInput, /\s*(kg|lbs)$/)
    );
    weightInput.addEventListener("input", () => {
        weightInput.value = weightInput.value.replace(/\D/g, "");
    });
    weightInput.addEventListener("change", () => renderRunnersTable(runnersData, runnersStats, runnersTests));

    // Change units from imperial to metric
    unitsSelect.addEventListener("change", () => {
        const isMetric = unitsSelect.value === "metric";

        // Update placeholders
        heightInput.placeholder = isMetric
            ? "Enter Height (cm) ..."
            : "Enter Height (in) ...";

        weightInput.placeholder = isMetric
            ? "Enter Weight (kg) ..."
            : "Enter Weight (lbs) ...";

        // Clear values
        heightInput.value = "";
        weightInput.value = "";

        renderRunnersTable(runnersData, runnersStats);
    });
}

const runnersData = await loadRunnersData(runnersDataPath);
const runnersStats = await loadRunnersStats(runnersStatsPath);
const runnersTests = await loadRunnersTests(runnersTestsPaths);

addInputEventListeners();
renderRunnersTable(runnersData, runnersStats, runnersTests, true);
renderIdentifying1Plot(runnersTests);
renderIdentifying2Plot(runnersTests);
renderInstructions1Plot();
renderInstructions2Plot();
renderThreshold1Plot(runnersTests);
renderThreshold2Plot(runnersTests);







