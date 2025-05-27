import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

const runnersDataPath = "data/personal/runners_data.csv";
const runnersStatsPath = "data/personal/runners_stats.csv";
const runnersTestsPaths = "data/personal/runners_tests.csv";

const sexInput = document.getElementById("sex-input");
const ageInput = document.getElementById("age-input");
const heightInput = document.getElementById("height-input");
const weightInput = document.getElementById("weight-input");
const unitsSelect = document.getElementById("units-input");

const numRunners = 5;

let xScaleRunners, yScaleRunners;

const runnersTableMargin = { top: 40, right: 0, bottom: 40, left: 0 };


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
        ve: +row.Air_rate
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
        features.push((inputAgeNorm - row.age_normal) ** 2);
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
        right: 40, 
        bottom: runnersTableMargin.bottom, 
        left: 60, 
    };

    const height = bodyHeight + margin.top + margin.bottom;
    const width = document.querySelector(container).getBoundingClientRect().width;

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
    const yAxis = d3.axisLeft(yScaleRunners);

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

    const svg = d3.select(container).select("svg");

    svg.select("g.bars")
        .selectAll("rect")
        .data(dataWithTimes)
        .join("rect")
        .attr("x", xScaleRunners(0))
        .attr("y", d => yScaleRunners(d.index))
        .attr("height", yScaleRunners.bandwidth())
        .attr("width", 0)  // start width at 0
        .attr("fill", "#4682b4")
        .transition()
        .ease(d3.easeLinear)
        .duration(d => (xScaleRunners(d.time) - xScaleRunners(0)) * 2)
        .attr("width", d => xScaleRunners(d.time) - xScaleRunners(0));

        const labelMap = Object.fromEntries(filtered.map((d, i) => [String(i), d.id_test]));

        svg.select("g.y-axis")
            .call(d3.axisLeft(yScaleRunners).tickFormat(d => labelMap[d]));

        // Make x-axis labels larger
        svg.select("g.x-axis")
            .selectAll(".tick text")
            .style("font-size", "14px");

        // Make y-axis labels larger
        svg.select("g.y-axis")
            .selectAll(".tick text")
            .style("font-size", "14px");
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







