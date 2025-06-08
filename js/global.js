function updateProgress() {
  // how far we've scrolled
  const scrollTop = window.scrollY || window.pageYOffset;
  
  // total document height (takes both <html> and <body> into account)
  const docHeight = Math.max(
    document.body.scrollHeight,
    document.documentElement.scrollHeight
  );
  
  // viewport height
  const winHeight = window.innerHeight;
  
  // the total “scrollable” distance
  const scrollable = docHeight - winHeight;
  
  // guard against zero
  const pct = scrollable > 0
    ? (scrollTop / scrollable) * 100
    : 0;
  
  document
    .getElementById("reading-progress__bar")
    .style.width = pct + "%";
}


document.addEventListener("DOMContentLoaded", () => {
  window.addEventListener("scroll", updateProgress, { passive: true });
  window.addEventListener("resize", updateProgress);
  updateProgress();  // initial
});
