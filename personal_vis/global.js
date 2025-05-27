import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

const runnersDataPath = "runners_data.csv";
const runnersStatsPath = "runners_stats.csv";
const runnersTestsPaths = "runners_tests.csv";

const sexInput = document.getElementById("sex-input");
const ageInput = document.getElementById("age-input");
const heightInput = document.getElementById("height-input");
const weightInput = document.getElementById("weight-input");
const unitsSelect = document.getElementById("units-input");

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
        time: +row.Time,
        pace_metric: +row.pace_metric,
        pace_imperial: +row.pace_imperial,
        dist_metric: +row.Dist_km,
        dist_imperial: +row.Dist_miles,
        speed: +row.Speed,
        hr: +row.HR,
        rr: +row.RR,
        vo2: +row.O2_rate,
        vco2: +row.CO2_rate,
        ve: +row.Air_rate
    }));

    return data;
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

// Renders the runners table based on the loaded data
function renderRunnersTable(data, stats) {
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

    filtered = filtered.slice(0,10);

    const container = d3.select("#runners-table");
    container.html("");

    const columns = isMetric
        ? [
            { key: "id_test", label: "Test #" },
            { key: "sex", label: "Sex" },
            { key: "age", label: "Age" },
            { key: "height_metric", label: "Height (cm)" },
            { key: "weight_metric", label: "Weight (kg)" }
        ]
        : [
            { key: "id_test", label: "Test #" },
            { key: "sex", label: "Sex" },
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
}

// Gets table row height for table layout
function getTableRowHeight(table_id = "#runners-table tbody tr") {
    const rows = d3.selectAll(table_id).nodes();
    
    const height = rows[0].getBoundingClientRect().height;

    return height 
}

// Renders the runners bar plot
function renderRunnersPlot(data, container) {

}

// Add event listeners to input fields
function addInputEventListeners() {
    
    // Add event listeners for input fields
    // Sex
    sexInput.addEventListener("change", () => renderRunnersTable(runnersData, runnersStats));

    // Age
    ageInput.addEventListener("blur", () => formatWithUnit(ageInput, "years"));
    ageInput.addEventListener("focus", () => removeUnit(ageInput, /\s*years$/));
    ageInput.addEventListener("input", () => {
        ageInput.value = ageInput.value.replace(/\D/g, "");
    });
    ageInput.addEventListener("change", () => renderRunnersTable(runnersData, runnersStats));

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
    heightInput.addEventListener("change", () => renderRunnersTable(runnersData, runnersStats));

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
    weightInput.addEventListener("change", () => renderRunnersTable(runnersData, runnersStats));

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

        renderRunnersTable(runnersData);
    });
}

const runnersData = await loadRunnersData(runnersDataPath);
const runnersStats = await loadRunnersStats(runnersStatsPath);
const runnersTests = await loadRunnersTests(runnersTestsPaths);

addInputEventListeners();
renderRunnersTable(runnersData, runnersStats);

console.log("Table row height:  ", getTableRowHeight());


