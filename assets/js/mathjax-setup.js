window.MathJax = {
  tex: {
    tags: "ams",
    inlineMath: [
      ["$", "$"],
      ["\\(", "\\)"],
    ],
  },
  options: {
    renderActions: {
      addCss: [
        200,
        function (doc) {
          const style = document.createElement("style");
          style.innerHTML = `
          .mjx-container {
            color: inherit;
          }
        `;
          document.head.appendChild(style);
        },
        "",
      ],
    },
  },
  startup: {
    // Once MathJax has typeset the page, shrink any display equation that is
    // wider than its box so it fits on narrow screens.
    pageReady: function () {
      return window.MathJax.startup.defaultPageReady().then(fitDisplayMath);
    },
  },
};

/**
 * Scale wide equations down so they never overflow on narrow screens.
 *
 * A long formula on a phone would otherwise stretch past the text column: a
 * display equation gets clipped at the right edge, and a long *inline* formula
 * pushes the whole page sideways. Instead of shrinking every equation's font,
 * we measure each one and scale ONLY the ones that don't fit. Short equations
 * keep their normal, readable size.
 */
var MATH_MIN_SCALE = 0.5; // don't shrink past this; below it, let it scroll

function fitDisplayMath() {
  // Block equations: scale the inner mjx-math so the full-width box + centering
  // are kept and the formula stays whole (never clipped).
  document
    .querySelectorAll('.post-content mjx-container[jax="CHTML"][display="true"]')
    .forEach(function (m) {
      var math = m.querySelector("mjx-math");
      if (!math) return;
      math.style.zoom = ""; // reset before measuring natural width
      var cs = getComputedStyle(m);
      var inner =
        m.clientWidth -
        parseFloat(cs.paddingLeft || 0) -
        parseFloat(cs.paddingRight || 0);
      var natural = math.getBoundingClientRect().width;
      // guard: only scale when the box has a real, measurable width — otherwise
      // (layout not ready / element hidden) we'd wrongly shrink everything.
      if (inner > 40 && natural > inner + 0.5) {
        math.style.zoom = Math.max((inner / natural) * 0.98, MATH_MIN_SCALE);
      }
    });

  // Inline equations: a long inline formula can't wrap, so scale the whole
  // container down to the width of its text column when it would overflow.
  document
    .querySelectorAll(
      '.post-content mjx-container[jax="CHTML"]:not([display="true"])',
    )
    .forEach(function (m) {
      m.style.zoom = ""; // reset before measuring
      var block = m.closest("p, li, td, th, blockquote, figcaption, div");
      if (!block) return;
      var avail = block.clientWidth;
      var natural = m.getBoundingClientRect().width;
      if (avail > 40 && natural > avail + 0.5) {
        m.style.zoom = Math.max((avail / natural) * 0.98, MATH_MIN_SCALE);
      }
    });
}

// Re-fit on width changes (rotation, window resize) — debounced.
var _mathFitTimer;
window.addEventListener("resize", function () {
  clearTimeout(_mathFitTimer);
  _mathFitTimer = setTimeout(fitDisplayMath, 150);
});
// Re-fit once everything (fonts, layout) has settled, to correct any early
// measurement taken before the page was fully laid out.
window.addEventListener("load", function () {
  setTimeout(fitDisplayMath, 0);
});
