(function () {
  "use strict";

  const CONTAINER_ID = "knowledge-graph";

  function getColors() {
    const style = getComputedStyle(document.documentElement);
    return {
      node: style.getPropertyValue("--global-theme-color").trim() || "#2698BA",
      nodeFill:
        style.getPropertyValue("--global-card-bg-color").trim() || "#ffffff",
      edge: style.getPropertyValue("--global-divider-color").trim() || "#dee2e6",
      text: style.getPropertyValue("--global-text-color").trim() || "#303030",
      textLight:
        style.getPropertyValue("--global-text-color-light").trim() || "#828282",
      bg: style.getPropertyValue("--global-bg-color").trim() || "#ffffff",
      tagEdge:
        style.getPropertyValue("--global-divider-color").trim() || "#dee2e6",
    };
  }

  // Muted categorical palette — distinguishable but restrained, works on both
  // the light and dark terminal backgrounds (no neon).
  const FOLDER_COLORS = {
    ml: "#b56a5a", // clay
    engineering: "#5f8a93", // slate-teal
    thinking: "#7f9668", // sage
    personal: "#c2954e", // ochre
  };
  const DEFAULT_FOLDER_COLOR = "#8a8a82"; // neutral

  function folderColor(folder) {
    return FOLDER_COLORS[folder] || DEFAULT_FOLDER_COLOR;
  }

  function init() {
    const container = document.getElementById(CONTAINER_ID);
    if (!container) return;

    const dataUrl = container.dataset.graphUrl;
    if (!dataUrl) return;

    d3.json(dataUrl).then(function (data) {
      if (!data || !data.nodes || data.nodes.length === 0) {
        container.innerHTML =
          '<p style="text-align:center;color:var(--global-text-color-light);font-style:italic;">No notes yet.</p>';
        return;
      }
      renderGraph(container, data);
    });
  }

  function renderGraph(container, data) {
    const rect = container.getBoundingClientRect();
    const width = rect.width || 600;
    const height = Math.max(350, Math.min(500, width * 0.6));
    const colors = getColors();

    container.innerHTML = "";

    const svg = d3
      .select(container)
      .append("svg")
      .attr("viewBox", [0, 0, width, height])
      .attr("width", "100%")
      .attr("height", height)
      .style("max-width", "100%")
      .style("border", "1px solid " + colors.edge)
      .style("border-radius", "4px")
      .style("background", colors.bg);

    // Arrow marker for directed wikilinks
    svg
      .append("defs")
      .append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 20)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-4L8,0L0,4")
      .attr("fill", colors.edge);

    const g = svg.append("g");

    // Zoom behavior
    const zoom = d3
      .zoom()
      .scaleExtent([0.3, 3])
      .on("zoom", function (event) {
        g.attr("transform", event.transform);
      });
    svg.call(zoom);

    // Simulation
    const simulation = d3
      .forceSimulation(data.nodes)
      .force(
        "link",
        d3
          .forceLink(data.links)
          .id(function (d) {
            return d.id;
          })
          .distance(80),
      )
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(30));

    // Links
    const link = g
      .append("g")
      .selectAll("line")
      .data(data.links)
      .join("line")
      .attr("stroke", function (d) {
        return d.type === "wikilink" ? colors.node : colors.tagEdge;
      })
      .attr("stroke-opacity", function (d) {
        return d.type === "wikilink" ? 0.6 : 0.25;
      })
      .attr("stroke-width", function (d) {
        return d.type === "wikilink" ? 1.5 : 1;
      })
      .attr("stroke-dasharray", function (d) {
        return d.type === "wikilink" ? null : "3,3";
      })
      .attr("marker-end", function (d) {
        return d.type === "wikilink" ? "url(#arrowhead)" : null;
      });

    // Nodes
    const node = g
      .append("g")
      .selectAll("g")
      .data(data.nodes)
      .join("g")
      .style("cursor", "pointer")
      .call(drag(simulation));

    node
      .append("circle")
      .attr("r", 7)
      .attr("fill", function (d) {
        return folderColor(d.folder);
      })
      .attr("stroke", function (d) {
        return folderColor(d.folder);
      })
      .attr("stroke-width", 2)
      .attr("fill-opacity", 0.2);

    node
      .append("text")
      .text(function (d) {
        return d.title.length > 25 ? d.title.slice(0, 23) + "…" : d.title;
      })
      .attr("x", 12)
      .attr("y", 4)
      .attr("font-size", "11px")
      .attr("fill", colors.text)
      .style("pointer-events", "none")
      .style("user-select", "none");

    // Tooltip
    const tooltip = d3
      .select(container)
      .append("div")
      .style("position", "absolute")
      .style("padding", "6px 10px")
      .style("background", colors.bg)
      .style("border", "1px solid " + colors.edge)
      .style("border-radius", "4px")
      .style("font-size", "12px")
      .style("color", colors.text)
      .style("pointer-events", "none")
      .style("opacity", 0)
      .style("z-index", 10)
      .style("max-width", "200px")
      .style("line-height", "1.4");

    node
      .on("mouseover", function (event, d) {
        var tagStr = d.tags && d.tags.length > 0 ? d.tags.join(", ") : "";
        var folderStr = d.folder ? d.folder : "root";
        var html = "<strong>" + d.title + "</strong>";
        html += "<br><span style='color:" + folderColor(d.folder) + "'>● " + folderStr + "</span>";
        if (tagStr) html += "<br><span style='color:" + colors.textLight + "'>" + tagStr + "</span>";
        tooltip.html(html).style("opacity", 1);

        d3.select(this).select("circle").attr("r", 10).attr("stroke-width", 3).attr("fill-opacity", 0.4);
      })
      .on("mousemove", function (event) {
        var containerRect = container.getBoundingClientRect();
        tooltip
          .style("left", event.clientX - containerRect.left + 15 + "px")
          .style("top", event.clientY - containerRect.top - 10 + "px");
      })
      .on("mouseout", function () {
        tooltip.style("opacity", 0);
        d3.select(this).select("circle").attr("r", 7).attr("stroke-width", 2).attr("fill-opacity", 0.2);
      })
      .on("click", function (event, d) {
        if (d.url) window.location.href = d.url;
      });

    // Tick
    simulation.on("tick", function () {
      link
        .attr("x1", function (d) { return d.source.x; })
        .attr("y1", function (d) { return d.source.y; })
        .attr("x2", function (d) { return d.target.x; })
        .attr("y2", function (d) { return d.target.y; });

      node.attr("transform", function (d) {
        return "translate(" + d.x + "," + d.y + ")";
      });
    });

    // Re-render on theme change
    var observer = new MutationObserver(function () {
      var newColors = getColors();
      svg.style("border-color", newColors.edge).style("background", newColors.bg);
      svg.select("#arrowhead path").attr("fill", newColors.edge);
      link
        .attr("stroke", function (d) {
          return d.type === "wikilink" ? newColors.node : newColors.tagEdge;
        });
      node.selectAll("text").attr("fill", newColors.text);
      tooltip.style("background", newColors.bg).style("border-color", newColors.edge).style("color", newColors.text);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    // Responsive resize
    window.addEventListener("resize", function () {
      var newRect = container.getBoundingClientRect();
      var newW = newRect.width || 600;
      var newH = Math.max(350, Math.min(500, newW * 0.6));
      svg.attr("viewBox", [0, 0, newW, newH]).attr("height", newH);
      simulation.force("center", d3.forceCenter(newW / 2, newH / 2));
      simulation.alpha(0.3).restart();
    });
  }

  function drag(simulation) {
    return d3
      .drag()
      .on("start", function (event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", function (event, d) {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", function (event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });
  }

  // Init when DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
