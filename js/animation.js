import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

const cleanRunnerPath = "./data/animation/clean_runner_840.csv";

let interval;
let step = 0;
let playing = false;
let totalTime, data;

const VT1_TIME = 187;
const VT2_TIME = 356;
let vt1Shown = false;
let vt2Shown = false;

const barWidth = 600;
const intervalMs = 10;
const fill = d3.select(".bar-fill");
const timeLabel = d3.select("#time-label");

function showThresholdMessage(html) {
  clearInterval(interval);
  playing = false;
  d3.select("#runner-animated").style("display", "none");
  d3.select("#runner-static").style("display", "block");

  const sideBox = document.getElementById("threshold-side-message");
  document.getElementById("threshold-text").innerHTML = html;
  sideBox.style.display = "block";

  const continueBtn = document.getElementById("continue-btn");
  const continueHandler = () => {
    sideBox.style.display = "none";
    continueBtn.removeEventListener("click", continueHandler);
    d3.select("#runner-static").style("display", "none");
    d3.select("#runner-animated").style("display", "block");
    interval = setInterval(updateFrame, intervalMs);
    playing = true;
  };

  continueBtn.addEventListener("click", continueHandler);
}

function drawThresholdMarkers() {
  const svg = d3.select("svg");
  const x1 = (VT1_TIME / totalTime) * barWidth;
  const x2 = (VT2_TIME / totalTime) * barWidth;

  svg.append("line")
    .attr("x1", x1)
    .attr("y1", 5)
    .attr("x2", x1)
    .attr("y2", 35)
    .attr("stroke", "#A020F0")
    .attr("stroke-width", 2)
    .attr("stroke-dasharray", "4 2");

  svg.append("line")
    .attr("x1", x2)
    .attr("y1", 5)
    .attr("x2", x2)
    .attr("y2", 35)
    .attr("stroke", "#f44336")
    .attr("stroke-width", 2)
    .attr("stroke-dasharray", "4 2");
}

function initThresholdGraphs() {
  const svg1 = d3.select("#threshold-graph-1").append("svg")
    .attr("width", 720)
    .attr("height", 480)
    .style("background", "black")
    .style("margin-right", "10px");

  const svg2 = d3.select("#threshold-graph-2")
    .style("margin-left", "-120px")
    .append("svg")
    .attr("width", 720)
    .attr("height", 480)
    .style("background", "black");

  svg1.append("text")
    .attr("x", 360)
    .attr("y", 30)
    .attr("text-anchor", "middle")
    .attr("font-size", "20px")
    .attr("fill", "white")
    .text("VCO₂ vs VO₂");

  svg2.append("text")
    .attr("x", 360)
    .attr("y", 30)
    .attr("text-anchor", "middle")
    .attr("font-size", "20px")
    .attr("fill", "white")
    .text("VE vs VCO₂");

  svg1.append("g").attr("id", "x-axis-1").attr("transform", "translate(0,440)");
  svg1.append("g").attr("id", "y-axis-1").attr("transform", "translate(50,0)");

  svg2.append("g").attr("id", "x-axis-2").attr("transform", "translate(0,440)");
  svg2.append("g").attr("id", "y-axis-2").attr("transform", "translate(50,0)");

  // Axis labels with spacing fixes
  svg1.append("text")
    .attr("x", 360)
    .attr("y", 470)
    .attr("text-anchor", "middle")
    .attr("fill", "white")
    .text("VO₂ (L/min)");

  svg1.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -240)
    .attr("y", 10)
    .attr("dy", "-1em")
    .attr("text-anchor", "middle")
    .attr("fill", "white")
    .text("VCO₂ (L/min)");

  svg2.append("text")
    .attr("x", 360)
    .attr("y", 470)
    .attr("text-anchor", "middle")
    .attr("fill", "white")
    .text("VCO₂ (L/min)");

  svg2.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -240)
    .attr("y", 10)
    .attr("dy", "-1em")
    .attr("text-anchor", "middle")
    .attr("fill", "white")
    .text("VE (L/min)");

  svg1.append("path").attr("id", "vco2-vo2-line").attr("fill", "none").attr("stroke", "white").attr("stroke-width", 3);
  svg2.append("path").attr("id", "ve-vco2-line").attr("fill", "none").attr("stroke", "white").attr("stroke-width", 3);

  svg1.append("line")
    .attr("id", "vt1-line")
    .attr("y1", 40)
    .attr("y2", 440)
    .attr("stroke", "green")
    .attr("stroke-width", 2)
    .style("display", "none");

  svg2.append("line")
    .attr("id", "vt2-line")
    .attr("y1", 40)
    .attr("y2", 440)
    .attr("stroke", "red")
    .attr("stroke-width", 2)
    .style("display", "none");
}

function updateThresholdGraphs(currentTime) {
  const dataSoFar = data.filter(d => d.time <= currentTime);

  const x1 = d3.scaleLinear().domain(d3.extent(data, d => d.O2_rate)).range([50, 680]);
  const y1 = d3.scaleLinear().domain(d3.extent(data, d => d.CO2_rate)).range([440, 40]);

  const x2 = d3.scaleLinear().domain(d3.extent(data, d => d.CO2_rate)).range([50, 680]);
  const y2 = d3.scaleLinear().domain(d3.extent(data, d => d.air_rate)).range([440, 40]);

  const line1 = d3.line().x(d => x1(d.O2_rate)).y(d => y1(d.CO2_rate));
  const line2 = d3.line().x(d => x2(d.CO2_rate)).y(d => y2(d.air_rate));

  d3.select("#vco2-vo2-line").datum(dataSoFar).attr("d", line1);
  d3.select("#ve-vco2-line").datum(dataSoFar).attr("d", line2);

  d3.select("#x-axis-1").call(d3.axisBottom(x1).tickSizeOuter(0)).selectAll("path,line,text").attr("stroke", "white").attr("fill", "white");
  d3.select("#y-axis-1").call(d3.axisLeft(y1).tickSizeOuter(0)).selectAll("path,line,text").attr("stroke", "white").attr("fill", "white");

  d3.select("#x-axis-2").call(d3.axisBottom(x2).tickSizeOuter(0)).selectAll("path,line,text").attr("stroke", "white").attr("fill", "white");
  d3.select("#y-axis-2").call(d3.axisLeft(y2).tickSizeOuter(0)).selectAll("path,line,text").attr("stroke", "white").attr("fill", "white");

  const vt1 = data.find(d => Math.floor(d.time) === VT1_TIME);
  const vt2 = data.find(d => Math.floor(d.time) === VT2_TIME);

  if (currentTime >= VT1_TIME && vt1) {
    d3.select("#vt1-line")
      .attr("x1", x1(vt1.O2_rate))
      .attr("x2", x1(vt1.O2_rate))
      .style("display", "block");
  }

  if (currentTime >= VT2_TIME && vt2) {
    d3.select("#vt2-line")
      .attr("x1", x2(vt2.CO2_rate))
      .attr("x2", x2(vt2.CO2_rate))
      .style("display", "block");
  }
}

function updateGraphs(currentTime) {
  updateThresholdGraphs(currentTime);
}

function updateFrame() {
  const currentTime = (step * intervalMs) / 1000 * 10;
  const percent = currentTime / totalTime;
  fill.attr("width", percent * barWidth);

  const minutes = Math.floor(currentTime / 60);
  const seconds = Math.floor(currentTime % 60);
  timeLabel.text(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);

  updateGraphs(currentTime);

  if (!vt1Shown && currentTime >= VT1_TIME) {
    vt1Shown = true;
    showThresholdMessage(`
      🟢 <strong>Aerobic Threshold Reached</strong><br>
      The body starts producing energy anaerobically.<br>
      Extra CO₂ is generated from acid buffering.
    `);
    return;
  }

  if (!vt2Shown && currentTime >= VT2_TIME) {
    vt2Shown = true;
    showThresholdMessage(`
      🔴 <strong>Anaerobic Threshold Reached</strong><br>
      Buffering is maxed out. Hyperventilation begins.<br>
      The body is nearing full exertion.
    `);
    return;
  }

  if (currentTime >= totalTime) {
    clearInterval(interval);
    playing = false;
    d3.select("#runner-animated").style("display", "none");
    d3.select("#runner-static").style("display", "block");
  }

  step++;
}

document.getElementById("play-btn").onclick = () => {
  if (playing) return;
  playing = true;
  d3.select("#runner-static").style("display", "none");
  d3.select("#runner-animated").style("display", "block");
  interval = setInterval(updateFrame, intervalMs);
};

document.getElementById("pause-btn").onclick = () => {
  clearInterval(interval);
  playing = false;
  d3.select("#runner-animated").style("display", "none");
  d3.select("#runner-static").style("display", "block");
};

document.getElementById("reset-btn").onclick = () => {
  clearInterval(interval);
  step = 0;
  playing = false;
  vt1Shown = false;
  vt2Shown = false;
  fill.attr("width", 0);
  timeLabel.text("00:00");

  d3.select("#runner-animated").style("display", "none");
  d3.select("#runner-static").style("display", "block");
  document.getElementById("threshold-side-message").style.display = "none";

  d3.select("#vt1-line").style("display", "none");
  d3.select("#vt2-line").style("display", "none");

  updateGraphs(0);
};

d3.csv(cleanRunnerPath).then(csvData => {
  data = csvData.map(d => ({
    time: +d.time,
    O2_rate: +d.O2_rate,
    CO2_rate: +d.CO2_rate,
    HR: +d.HR,
    RR: +d.RR,
    air_rate: +d.air_rate,
    dist_km: +d.dist_km,
    Age: +d.Age,
    Weight: +d.Weight,
    Height: +d.Height,
    ID_test: d.ID_test,
    Sex: d.Sex
  }));

  data.sort((a, b) => a.time - b.time);
  totalTime = d3.max(data, d => d.time);

  const info = data[0];
  d3.select("#runner-id").text(info.ID_test);
  d3.select("#runner-age").text(info.Age);
  d3.select("#runner-sex").text(info.Sex === "0" ? "Male" : "Female");
  d3.select("#runner-weight").text(info.Weight);
  d3.select("#runner-height").text(info.Height);

  initThresholdGraphs();
  drawThresholdMarkers();
});
