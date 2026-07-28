/* -----------------------------------------------------------------------------
 * Knowledge graph — 3D renderer (three.js + 3d-force-graph).
 *
 *   · Real 3D scene: drag to rotate the camera, scroll/pinch to zoom.
 *   · One geometry per folder — the shape reads even before the colour does:
 *       ml          → tetrahedron  (red)
 *       engineering → cube         (teal)
 *       thinking    → octahedron   (green)
 *       personal    → icosahedron  (amber)
 *   · Nodes are solid emissive meshes wrapped in a wireframe overlay, so they
 *     read as glowing hollow shells the way Neo4j Bloom does.
 *   · Node size scales with connection degree.
 *   · Uppercase mono label under each node, in its folder colour.
 *   · Directional particles crawl along wikilink edges — subtle motion cue.
 *   · Slow auto-rotate stops the first time the user grabs the camera.
 *
 * Deps arrive on `window.__kgDeps` from the ESM import-map loader in
 * _includes/note-graph.liquid (esm.sh dedups a single three instance across
 * all three packages). We wait for the `kg-deps-ready` event.
 * -------------------------------------------------------------------------- */

(function () {
  "use strict";

  const CONTAINER_ID = "knowledge-graph";

  const FOLDER_COLORS = {
    ml:          "#e74c3c",
    engineering: "#2698BA",
    thinking:    "#27ae60",
    personal:    "#f39c12",
  };
  const DEFAULT_COLOR = "#8a8a82";

  function colorOf(folder) {
    return FOLDER_COLORS[folder] || DEFAULT_COLOR;
  }

  function bgColor() {
    return (
      getComputedStyle(document.documentElement)
        .getPropertyValue("--global-bg-color")
        .trim() || "#0e1315"
    );
  }

  function init() {
    const container = document.getElementById(CONTAINER_ID);
    if (!container) return;
    const url = container.dataset.graphUrl;
    if (!url) return;

    // The ESM loader in note-graph.liquid publishes deps on window.__kgDeps
    // then fires 'kg-deps-ready'. If we arrive first, wait for the event.
    if (!window.__kgDeps || !window.__kgDeps.ForceGraph3D) {
      window.addEventListener("kg-deps-ready", init, { once: true });
      return;
    }

    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data || !data.nodes || !data.nodes.length) {
          container.innerHTML =
            '<p style="text-align:center;color:var(--global-text-color-light);font-style:italic;">No notes yet.</p>';
          return;
        }
        render(container, data);
      });
  }

  function computeDegree(links) {
    const m = new Map();
    links.forEach(function (l) {
      const s = typeof l.source === "object" ? l.source.id : l.source;
      const t = typeof l.target === "object" ? l.target.id : l.target;
      m.set(s, (m.get(s) || 0) + 1);
      m.set(t, (m.get(t) || 0) + 1);
    });
    return m;
  }

  function geometryFor(folder, size) {
    const T = window.__kgDeps.THREE;
    if (folder === "ml") return new T.TetrahedronGeometry(size);
    if (folder === "engineering")
      return new T.BoxGeometry(size * 1.3, size * 1.3, size * 1.3);
    if (folder === "thinking") return new T.OctahedronGeometry(size);
    if (folder === "personal") return new T.IcosahedronGeometry(size);
    return new T.SphereGeometry(size, 16, 12);
  }

  function render(container, data) {
    const T = window.__kgDeps.THREE;
    const degree = computeDegree(data.links);

    const rect = container.getBoundingClientRect();
    const width = rect.width || 640;
    const height = Math.max(500, Math.min(720, width * 0.62));

    container.style.height = height + "px";
    container.style.border = "1px solid var(--global-divider-color)";
    container.style.borderRadius = "5px";
    container.style.overflow = "hidden";
    container.style.position = "relative";

    function nodeSize(d) {
      return 5 + Math.sqrt(degree.get(d.id) || 0) * 2.5;
    }

    const Graph = window.__kgDeps
      // Orbit controls (not the default trackball) so we get camera autoRotate.
      // Trackball has no autoRotate at all, which is why the graph looked
      // stuck even after we set the flag. The option must be passed to the
      // factory call, not chained as a method.
      .ForceGraph3D({ controlType: "orbit" })(container)
      .backgroundColor(bgColor())
      .width(width)
      .height(height)
      .graphData(data)
      .nodeThreeObject(function (d) {
        const s = nodeSize(d);
        const color = colorOf(d.folder);
        const group = new T.Group();

        // Solid emissive mesh — the glowing "body" of the node.
        const body = new T.Mesh(
          geometryFor(d.folder, s),
          new T.MeshLambertMaterial({
            color: color,
            transparent: true,
            opacity: 0.55,
            emissive: color,
            emissiveIntensity: 0.7,
          })
        );
        group.add(body);

        // Wireframe overlay slightly larger than the body — reads as a hollow
        // ring/shell around the coloured core.
        const wire = new T.Mesh(
          geometryFor(d.folder, s * 1.05),
          new T.MeshBasicMaterial({
            color: color,
            wireframe: true,
            transparent: true,
            opacity: 0.8,
          })
        );
        group.add(wire);

        // Label sprite (uppercase mono, folder colour) under the node.
        if (typeof window.__kgDeps.SpriteText !== "undefined") {
          const t = d.title.length > 22 ? d.title.slice(0, 20) + "…" : d.title;
          const label = new window.__kgDeps.SpriteText(t.toUpperCase());
          label.color = color;
          label.textHeight = 3.5;
          label.fontFace = "JetBrains Mono, ui-monospace, monospace";
          label.fontWeight = "700";
          label.strokeWidth = 0;
          label.padding = 0;
          label.position.set(0, -(s + 5), 0);
          group.add(label);
        }

        return group;
      })
      // Rich tooltip on hover — 3d-force-graph renders whatever HTML we
      // return here in a floating panel next to the cursor.
      .nodeLabel(function (d) {
        const c = colorOf(d.folder);
        const esc = function (s) {
          return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
        };
        const title = esc(d.title || "");
        const folder = esc(d.folder || "root");
        const desc = d.description
          ? '<div style="font-size:.78rem; color:#9fb0ab; margin-top:6px; max-width:240px; line-height:1.5;">' +
            esc(d.description) +
            "</div>"
          : "";
        const tags =
          d.tags && d.tags.length
            ? '<div style="font-size:.7rem; color:#9fb0ab; margin-top:6px; letter-spacing:.04em;">' +
              d.tags.map(function (t) { return "#" + esc(t); }).join("&nbsp;&nbsp;") +
              "</div>"
            : "";
        return (
          '<div style="padding:.55rem .8rem; background:rgba(20,28,30,.96); border:1px solid #2b3436; border-left:3px solid ' +
          c +
          '; border-radius:4px; font-family:\'JetBrains Mono\',ui-monospace,monospace; color:#e6e6e6; box-shadow:0 10px 28px rgba(0,0,0,.65); max-width:280px;">' +
          '<div style="font-weight:700; color:' + c + '; font-size:.9rem; line-height:1.35;">' + title + "</div>" +
          '<div style="font-size:.62rem; color:' + c + '; margin-top:5px; letter-spacing:.14em; text-transform:uppercase; opacity:.92;">● ' + folder + "</div>" +
          desc +
          tags +
          '<div style="font-size:.58rem; color:#7a8580; margin-top:.55rem; padding-top:.4rem; border-top:1px solid #2b3436; letter-spacing:.14em; text-transform:uppercase;">click to open →</div>' +
          "</div>"
        );
      })
      // Subtle emphasis when hovering — bump the ring stroke of the hovered
      // node's mesh so the pointer target reads clearly.
      .onNodeHover(function (node) {
        container.style.cursor = node ? "pointer" : "grab";
      })
      .linkColor(function (l) {
        // Wikilinks inherit the source folder's hue → each cluster's outgoing
        // edges read as its own colour. Tag edges stay neutral.
        if (l.type !== "wikilink") return "#3a4245";
        const src = typeof l.source === "object" ? l.source : { folder: null };
        return colorOf(src.folder);
      })
      .linkOpacity(0.4)
      .linkWidth(function (l) {
        return l.type === "wikilink" ? 0.6 : 0.3;
      })
      .linkDirectionalParticles(function (l) {
        return l.type === "wikilink" ? 2 : 0;
      })
      .linkDirectionalParticleWidth(1.4)
      .linkDirectionalParticleSpeed(0.006)
      .onNodeClick(function (d) {
        if (d.url) window.location.href = d.url;
      })
      .showNavInfo(false)
      // Slow the alpha decay + skip past the initial "everything at the
      // origin" period with a synchronous pre-tick, so the graph opens with
      // nodes already spread out instead of collapsing on the first frame.
      .d3AlphaDecay(0.012)
      .d3VelocityDecay(0.35)
      .warmupTicks(60);

    // Set charge/link strength AFTER the constructor chain returns — inlining
    // these before graphData is applied can null out `_forceSimulation` before
    // the first tick, producing the "reading 'tick'" crash inside rAF.
    Promise.resolve().then(function () {
      try {
        const chargeForce = Graph.d3Force && Graph.d3Force("charge");
        if (chargeForce && chargeForce.strength) {
          // Weaker repulsion + shorter reach → cluster stays tighter, no lone
          // node drifts off into space to blow up the fit-bbox.
          chargeForce.strength(-180).distanceMax(300);
        }
        const linkForce = Graph.d3Force && Graph.d3Force("link");
        if (linkForce && linkForce.distance) {
          linkForce.distance(70);
        }
        // A gentle centering force pulls disconnected / loosely-linked notes
        // back toward the middle so the graph doesn't sprawl.
        const centerForce = Graph.d3Force && Graph.d3Force("center");
        if (centerForce && centerForce.strength) {
          centerForce.strength(0.6);
        }
      } catch (e) {
        if (window.console) console.warn("kg: force tuning skipped", e);
      }
    });

    // Expose for interactive debugging.
    window.__kgGraph = Graph;

    // Camera behaviour ------------------------------------------------------
    // • Fit the whole graph on-screen once, after the initial layout settles,
    //   and never again — refitting every time the sim ticks was making the
    //   view visibly shrink after a while.
    // • Then keep the camera slowly auto-rotating until the user grabs it.
    let didFit = false;
    let userGrabbed = false;

    function fitOnce() {
      if (didFit) return;
      didFit = true;
      // Tight margin — a small padding pulls the camera close so the graph
      // fills the canvas instead of sitting as a tiny cluster in the middle.
      Graph.zoomToFit(500, 20);
      // The zoom transition briefly overrides autoRotate; re-arm it once the
      // transition ends so the graph keeps drifting on its own.
      setTimeout(function () {
        if (!userGrabbed && typeof Graph.controls === "function") {
          Graph.controls().autoRotate = true;
        }
      }, 620);
    }
    Graph.onEngineStop(fitOnce);
    // Belt-and-braces: if the sim never fires `end`, still fit after 2 s.
    setTimeout(fitOnce, 2000);

    // Gentle auto-rotate — slow enough to read labels as they drift past.
    // Only stops on a real interaction (drag / scroll / touch), not just
    // moving the mouse over a node.
    if (typeof Graph.controls === "function") {
      const ctrl = Graph.controls();
      ctrl.autoRotate = true;
      ctrl.autoRotateSpeed = 0.6; // ~3.5°/s — steady, easy on the eye
      ctrl.enableDamping = true;
      ctrl.dampingFactor = 0.08;
      container.style.cursor = "grab";
      const stopAutoRotate = function () {
        userGrabbed = true;
        ctrl.autoRotate = false;
      };
      ["mousedown", "touchstart", "wheel"].forEach(function (ev) {
        container.addEventListener(ev, stopAutoRotate, { once: true });
      });
    }

    // Debounced resize.
    let resizeTimer;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        const r = container.getBoundingClientRect();
        const w = r.width || 640;
        const h = Math.max(500, Math.min(720, w * 0.62));
        container.style.height = h + "px";
        Graph.width(w).height(h);
      }, 200);
    });

    // Follow the light/dark theme toggle.
    new MutationObserver(function () {
      Graph.backgroundColor(bgColor());
    }).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
