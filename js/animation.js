import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

const cleanRunnerPath = "./data/animation/clean_runner_741_1.csv";

let interval;
let step = 0;
let playing = false;
let totalTime, data;

const VT1_TIME = 378;
const VT2_TIME = 705;
let vt1Shown = false;
let vt2Shown = false;
let phase1Shown = false;
let phase2Shown = false;
let phase3Shown = false;

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
    .attr("viewBox", "0 0 880 400")
    .attr("preserveAspectRatio", "xMidYMid meet")
    .style("width", "100%")
    .style("height", "auto")
    .style("background", "black");

  const svg2 = d3.select("#threshold-graph-2").append("svg")
    .attr("viewBox", "0 0 880 400")
    .attr("preserveAspectRatio", "xMidYMid meet")
    .style("width", "100%")
    .style("height", "auto")
    .style("background", "black");

  svg1.append("text")
    .attr("x", 440)
    .attr("y", 30)
    .attr("text-anchor", "middle")
    .attr("font-size", "20px")
    .attr("fill", "white")
    .text("VCO₂ / VO₂ vs Time");

  svg2.append("text")
    .attr("x", 440)
    .attr("y", 30)
    .attr("text-anchor", "middle")
    .attr("font-size", "20px")
    .attr("fill", "white")
    .text("VE / VCO₂ vs Time");

  svg1.append("g").attr("id", "x-axis-1").attr("transform", "translate(0,320)");
  svg1.append("g").attr("id", "y-axis-1").attr("transform", "translate(70,0)");

  svg2.append("g").attr("id", "x-axis-2").attr("transform", "translate(0,320)");
  svg2.append("g").attr("id", "y-axis-2").attr("transform", "translate(70,0)");

  svg1.append("text")
    .attr("x", 440)
    .attr("y", 360)
    .attr("text-anchor", "middle")
    .attr("fill", "white")
    .text("Time (seconds)");

  svg1.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -200)
    .attr("y", 30)
    .attr("dy", "-1em")
    .attr("text-anchor", "middle")
    .attr("fill", "white")
    .text("VCO₂ / VO₂ (L/min)");

  svg2.append("text")
    .attr("x", 440)
    .attr("y", 360)
    .attr("text-anchor", "middle")
    .attr("fill", "white")
    .text("Time (seconds)");

  svg2.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -200)
    .attr("y", 30)
    .attr("dy", "-1em")
    .attr("text-anchor", "middle")
    .attr("fill", "white")
    .text("VE / VCO₂ (L/min)");

  svg1.append("path").attr("id", "vco2-vo2-line").attr("fill", "none").attr("stroke", "white").attr("stroke-width", 3);
  svg2.append("path").attr("id", "ve-vco2-line").attr("fill", "none").attr("stroke", "white").attr("stroke-width", 3);

  svg1.append("line")
    .attr("id", "vt1-line")
    .attr("y1", 40)
    .attr("y2", 320)
    .attr("stroke", "green")
    .attr("stroke-width", 2)
    .style("display", "none");

  svg2.append("line")
    .attr("id", "vt2-line")
    .attr("y1", 40)
    .attr("y2", 320)
    .attr("stroke", "red")
    .attr("stroke-width", 2)
    .style("display", "none");
}

function updateThresholdGraphs(currentTime) {
  const dataSoFar = data
    .filter(d => d.time <= currentTime)
    .map(d => ({
      time: d.time,
      ratio1: d.VO2_rate !== 0 ? d.CO2_rate / d.O2_rate : 0,
      ratio2: d.CO2_rate !== 0 ? d.air_rate / d.CO2_rate : 0
    }));

  const x = d3.scaleLinear()
    .domain(d3.extent(dataSoFar, d => d.time))
    .range([70, 680]);

  const y1 = d3.scaleLinear()
    .domain(d3.extent(dataSoFar, d => d.ratio1))
    .range([320, 40]);

  const y2 = d3.scaleLinear()
    .domain(d3.extent(dataSoFar, d => d.ratio2))
    .range([320, 40]);

  const line1 = d3.line()
    .x(d => x(d.time))
    .y(d => y1(d.ratio1));

  const line2 = d3.line()
    .x(d => x(d.time))
    .y(d => y2(d.ratio2));

  d3.select("#vco2-vo2-line").datum(dataSoFar).attr("d", line1);
  d3.select("#ve-vco2-line").datum(dataSoFar).attr("d", line2);

  d3.select("#x-axis-1").call(d3.axisBottom(x).tickSizeOuter(0)).selectAll("path,line,text").attr("stroke", "white").attr("fill", "white");
  d3.select("#y-axis-1").call(d3.axisLeft(y1).tickSizeOuter(0)).selectAll("path,line,text").attr("stroke", "white").attr("fill", "white");

  d3.select("#x-axis-2").call(d3.axisBottom(x).tickSizeOuter(0)).selectAll("path,line,text").attr("stroke", "white").attr("fill", "white");
  d3.select("#y-axis-2").call(d3.axisLeft(y2).tickSizeOuter(0)).selectAll("path,line,text").attr("stroke", "white").attr("fill", "white");

  if (currentTime >= VT1_TIME) {
    d3.select("#vt1-line")
      .attr("x1", x(VT1_TIME))
      .attr("x2", x(VT1_TIME))
      .style("display", "block");
  }

  if (currentTime >= VT2_TIME) {
    d3.select("#vt2-line")
      .attr("x1", x(VT2_TIME))
      .attr("x2", x(VT2_TIME))
      .style("display", "block");
  }
}

function updateGraphs(currentTime) {
  updateThresholdGraphs(currentTime);
}

function updateFrame() {
  const currentTime = (step * intervalMs) / 1000 * 50;
  const percent = currentTime / totalTime;
  fill.attr("width", percent * barWidth);

  const minutes = Math.floor(currentTime / 60);
  const seconds = Math.floor(currentTime % 60);
  timeLabel.text(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);

  updateGraphs(currentTime);

  if (!phase1Shown && currentTime >= 10 && currentTime < VT1_TIME) {
    phase1Shown = true;
    showThresholdMessage(`🟦 <strong>Phase 1: Light Effort</strong><br>You’re warming up. Breathing and heart rate are rising gradually.`);
    return;
  }

  if (vt1Shown && !phase2Shown && currentTime > VT1_TIME + 3 && currentTime < VT2_TIME) {
    phase2Shown = true;
    showThresholdMessage(`🟧 <strong>Phase 2: Moderate Effort</strong><br>You're past your first threshold. Breathing is heavier but controlled.`);
    return;
  }

  if (vt2Shown && !phase3Shown && currentTime > VT2_TIME + 3) {
    phase3Shown = true;
    showThresholdMessage(`🟥 <strong>Phase 3: Intense Effort</strong><br>You’re pushing to your limit. Breathing is sharp and rapid.`);
    return;
  }

  if (!vt1Shown && currentTime >= VT1_TIME) {
    vt1Shown = true;
    showThresholdMessage(`🟢 <strong>VT1 Reached</strong><br>Your body needs more energy than oxygen can provide.<br>It starts using a backup system that creates acid.<br>Your body makes extra CO₂ while trying to neutralize it.`);
    return;
  }

  if (!vt2Shown && currentTime >= VT2_TIME) {
    vt2Shown = true;
    showThresholdMessage(`🔴 <strong>VT2 Reached</strong><br>The acid is building up too fast to handle.<br>Your body starts breathing much harder to get rid of CO₂.<br>This helps stop your blood from getting too acidic.`);
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
  phase1Shown = false;
  phase2Shown = false;
  phase3Shown = false;
  fill.attr("width", 0);
  timeLabel.text("00:00");

  d3.select("#runner-static").style("display", "none");
  d3.select("#runner-animated").style("display", "block");
  document.getElementById("threshold-side-message").style.display = "none";

  d3.select("#vt1-line").style("display", "none");
  d3.select("#vt2-line").style("display", "none");

  updateGraphs(0);

  interval = setInterval(updateFrame, intervalMs);
  playing = true;
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
