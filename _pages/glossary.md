---
layout: page
permalink: /notes/glossary/
title: glossary
nav: false
description: A running glossary of the technical terms used across the posts.
_styles: >
  .gloss-search { width: 100%; max-width: 26rem; font-family: var(--font-mono); font-size: .85rem; padding: .5rem .7rem; margin: 0 0 2rem; color: var(--global-text-color); background: var(--global-surface-color); border: 1px solid var(--global-divider-color); border-radius: 5px; }
  .gloss-search:focus-visible { outline: 2px solid var(--global-theme-color); outline-offset: 2px; }
  .gloss-cat-h { font-family: var(--font-mono); font-size: .68rem; letter-spacing: .16em; text-transform: uppercase; color: var(--global-theme-color); margin: 2.4rem 0 .9rem; padding-bottom: .4rem; border-bottom: 1px solid var(--global-divider-color); }
  .gloss-cat-h::before { content: "// "; opacity: .5; }
  .gloss-entry { padding: 1rem 0 1rem 1rem; border-left: 2px solid transparent; margin-left: -1rem; scroll-margin-top: 5rem; }
  .gloss-entry:target { border-left-color: var(--global-signal); background: color-mix(in srgb, var(--global-signal) 8%, transparent); }
  .gloss-term { font-family: var(--font-mono); font-size: 1rem; font-weight: 700; color: var(--global-text-color); margin: 0 0 .35rem; display: flex; align-items: baseline; gap: .8ch; flex-wrap: wrap; }
  .gloss-term .anchor { color: var(--global-text-color-light); text-decoration: none; opacity: 0; font-weight: 400; }
  .gloss-entry:hover .gloss-term .anchor { opacity: .6; }
  .gloss-en { margin: 0 0 .3rem; color: var(--global-text-color); }
  .gloss-vi { margin: 0 0 .5rem; color: var(--global-text-color-light); font-size: .92rem; }
  .gloss-vi::before { content: "VI  "; font-family: var(--font-mono); font-size: .6rem; letter-spacing: .1em; color: var(--global-signal); vertical-align: 1px; }
  .gloss-meta { margin: 0; font-family: var(--font-mono); font-size: .72rem; color: var(--global-text-color-light); display: flex; gap: 1.2rem; flex-wrap: wrap; }
  .gloss-meta a { color: var(--global-theme-color); text-decoration: none; }
  .gloss-meta a:hover { text-decoration: underline; }
  .gloss-rel a::before { content: "#"; opacity: .5; }
  .gloss-empty { color: var(--global-text-color-light); font-style: italic; }
---

<input type="search" class="gloss-search" id="glossSearch" placeholder="Filter terms…  (e.g. cache, attention)" aria-label="Filter glossary terms" autocomplete="off">

<div id="glossList">
{% assign groups = site.data.glossary | group_by: "category" %}
{% for group in groups %}
<h2 class="gloss-cat-h">{{ group.name }}</h2>
{% for t in group.items %}
<article class="gloss-entry" id="{{ t.slug }}" data-search="{{ t.term | downcase }} {{ t.en | downcase }} {{ t.vi | downcase }} {{ t.slug }}">
  <h3 class="gloss-term">{{ t.term }} <a class="anchor" href="#{{ t.slug }}" aria-label="Link to {{ t.term }}">#</a></h3>
  <p class="gloss-en">{{ t.en }}</p>
  <p class="gloss-vi">{{ t.vi }}</p>
  <p class="gloss-meta">
    {% if t.related %}<span class="gloss-rel">related: {% for r in t.related %}<a href="#{{ r }}">{{ r }}</a>{% unless forloop.last %} {% endunless %}{% endfor %}</span>{% endif %}
    {% if t.note %}<a href="{{ t.note | relative_url }}">deep dive ↗</a>{% endif %}
  </p>
</article>
{% endfor %}
{% endfor %}
</div>

<p class="gloss-empty" id="glossEmpty" hidden>No term matches that filter.</p>

<script>
  (function () {
    var input = document.getElementById("glossSearch");
    var entries = [].slice.call(document.querySelectorAll(".gloss-entry"));
    var heads = [].slice.call(document.querySelectorAll(".gloss-cat-h"));
    var empty = document.getElementById("glossEmpty");
    if (!input) return;
    input.addEventListener("input", function () {
      var q = input.value.trim().toLowerCase();
      var shown = 0;
      entries.forEach(function (el) {
        var hit = !q || el.dataset.search.indexOf(q) !== -1;
        el.hidden = !hit;
        if (hit) shown++;
      });
      // hide category headers with no visible entry
      heads.forEach(function (h) {
        var any = false, n = h.nextElementSibling;
        while (n && !n.classList.contains("gloss-cat-h")) {
          if (n.classList.contains("gloss-entry") && !n.hidden) { any = true; break; }
          n = n.nextElementSibling;
        }
        h.hidden = !any;
      });
      empty.hidden = shown !== 0;
    });
  })();
</script>
