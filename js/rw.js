import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
const scaleFactor = 800; // adjust this to change overall ribbon thickness

// Load CSV data using d3.csv() - this assumes your CSV file is hosted
d3.csv("data/treadmill/people_at_exact_time.csv").then(function(data) {

  // Process the CSV data into the desired format
  const logPeople = data.map(d => ({
    time: +d.time,               // Convert time to number
    speed: +d.avg_speed,             // Convert speed to number
    people: +d.people_at_exact_time             // Convert count to number
  }));

  // Apply log scaling to people count (log base 10, but avoid log(0))
  logPeople.forEach(d => {
    d.logPeople = d.people / scaleFactor;
  });

  const svg = d3.select("svg");
  const width = +svg.attr("width");
  const height = +svg.attr("height");
  const margin = { top: 20, right: 20, bottom: 40, left: 50 };

  const x = d3.scaleLinear()
    .domain(d3.extent(logPeople, d => d.time))
    .range([margin.left, width - margin.right]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(logPeople, d => d.speed)])
    .range([height - margin.bottom, margin.top]);

  // Axes
  svg.append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(6));

  svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y));

  // Area/ribbon with variable thickness
  const area = d3.area()
    .x(d => x(d.time))
    .y0(d => y(d.speed + d.logPeople)) // top curve
    .y1(d => y(d.speed - d.logPeople)) // bottom curve
    .curve(d3.curveCatmullRom); // smooth

  svg.append("path")
    .datum(logPeople)
    .attr("fill", "steelblue")
    .attr("opacity", 0.5)
    .attr("d", area);

  // Labels
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", height - 5)
    .attr("text-anchor", "middle")
    .text("Time");

  svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", 15)
    .attr("text-anchor", "middle")
    .text("Speed");

});
