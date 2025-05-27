import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

// animation.js
let interval;
let step = 0;
let playing = false;
let totalTime, data;

const VT1_TIME = 190; // replace with real value
const VT2_TIME = 450; // replace with real value
let vt1Shown = false;
let vt2Shown = false;
const messageBox = document.getElementById("threshold-message");

const barWidth = 600;
const intervalMs = 10;
const fill = d3.select(".bar-fill");
const timeLabel = d3.select("#time-label");

function showThresholdMessage(html) {
  clearInterval(interval);
  playing = false;
  messageBox.innerHTML = html + "<br><br><em>Click to continue</em>";
  messageBox.style.display = "block";
  d3.select("#runner-animated").style("display", "none");
  d3.select("#runner-static").style("display", "block");

  const continueHandler = () => {
    messageBox.style.display = "none";
    messageBox.removeEventListener("click", continueHandler);
    d3.select("#runner-static").style("display", "none");
    d3.select("#runner-animated").style("display", "block");
    interval = setInterval(updateFrame, intervalMs);
    playing = true;
  };

  messageBox.addEventListener("click", continueHandler);
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

function updateFrame() {
  const currentTime = (step * intervalMs) / 1000 * 10;
  const percent = currentTime / totalTime;
  fill.attr("width", percent * barWidth);

  const minutes = Math.floor(currentTime / 60);
  const seconds = Math.floor(currentTime % 60);
  timeLabel.text(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);

  const closest = data.find(d => Math.floor(d.time) === Math.floor(currentTime));
  if (closest) {
    d3.select("#hr").text(closest.HR);
    d3.select("#o2").text(closest.O2_rate.toFixed(0));
    d3.select("#co2").text(closest.CO2_rate.toFixed(0));
    d3.select("#rr").text(closest.RR);
    d3.select("#ve").text(closest.air_rate.toFixed(1));
    d3.select("#dist").text(closest.dist_km.toFixed(2));
  }

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

  d3.select("#hr").text("--");
  d3.select("#o2").text("--");
  d3.select("#co2").text("--");
  d3.select("#rr").text("--");
  d3.select("#ve").text("--");
  d3.select("#dist").text("--");

  d3.select("#runner-animated").style("display", "none");
  d3.select("#runner-static").style("display", "block");
  messageBox.style.display = "none";
};

d3.csv("clean_runner_840.csv").then(csvData => {
  data = csvData;
  data.forEach(d => {
    d.time = +d.time;
    d.O2_rate = +d.O2_rate;
    d.CO2_rate = +d.CO2_rate;
    d.HR = +d.HR;
    d.RR = +d.RR;
    d.air_rate = +d.air_rate;
    d.dist_km = +d.dist_km;
    d.Age = +d.Age;
    d.Weight = +d.Weight;
    d.Height = +d.Height;
  });

  data.sort((a, b) => a.time - b.time);
  totalTime = d3.max(data, d => d.time);

  const info = data[0];
  d3.select("#runner-id").text(info.ID_test);
  d3.select("#runner-age").text(info.Age);
  d3.select("#runner-sex").text(info.Sex === "0" ? "Male" : "Female");
  d3.select("#runner-weight").text(info.Weight);
  d3.select("#runner-height").text(info.Height);

  drawThresholdMarkers();
});
