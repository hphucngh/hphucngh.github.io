---
layout: page
title: notes
permalink: /notes/
description: Personal thoughts, reflections, and short notes.
nav: true
nav_order: 6
_styles: >
  /* ── Ẩn post-header mặc định ── */
  .post-header { display: none; }

  /* ── Xoá margin-top của container ── */
  .container.mt-5 { margin-top: 0 !important; padding-top: 0 !important; }
  .post > article  { margin-top: 0; padding-top: 0; }

  /* ── Remove gradient, blobs ── */
  body { background-image: none !important; }
---

<style>
/* ─── Scene ────────────────────────────────────────────────────── */
.notes-scene {
  position: relative;
  margin-left:   calc(50% - 50vw);
  margin-right:  calc(50% - 50vw);
  padding-top:    1.5rem;
  padding-bottom: 4rem;
  padding-left:  max(1.5rem, calc(50vw - 465px));
  padding-right: max(1.5rem, calc(50vw - 465px));
}

/* ─── Hide blobs ───────────────────────────────────────────────── */
.blob { display: none; }

/* ─── Page header ──────────────────────────────────────────────── */
.notes-page-header {
  position: relative;
  z-index: 1;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--global-divider-color);
}
.notes-page-title {
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--global-theme-color);
  margin: 0 0 0.2rem;
  letter-spacing: 0;
}
.notes-page-title::before { content: '> '; opacity: 0.5; }
.notes-page-desc {
  font-size: 0.82rem;
  color: var(--global-text-color-light);
  margin: 0;
}

/* ─── Timeline spine ───────────────────────────────────────────── */
.notes-timeline {
  position: relative;
  padding-left: 1.5rem;
  z-index: 1;
}
.notes-timeline::before {
  content: '';
  position: absolute;
  left: 7px; top: 0.5rem; bottom: 0.5rem;
  width: 1px;
  background: var(--global-divider-color);
}

/* ─── Year label ────────────────────────────────────────────────── */
.timeline-year {
  display: inline-flex;
  align-items: center;
  margin: 2rem 0 0.75rem -1.5rem;
  padding: 0.15rem 0.65rem;
  border-radius: 0;
  background: var(--global-card-bg-color);
  border: 1px solid var(--global-theme-color);
  box-shadow: none;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--global-theme-color);
  position: relative;
  z-index: 2;
}

/* ─── Row ──────────────────────────────────────────────────────── */
.timeline-row {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.75rem;
  align-items: flex-start;
  position: relative;
}
.timeline-row::before {
  content: '';
  position: absolute;
  left: calc(-1.5rem + 4.5px);
  top: 1.05rem;
  width: 6px;
  height: 6px;
  border-radius: 0;
  background: transparent;
  border: 1px solid var(--global-theme-color);
  z-index: 2;
  transition: background 0.15s ease;
}
.timeline-row:hover::before {
  background: var(--global-theme-color);
}

/* ─── Date ─────────────────────────────────────────────────────── */
.note-date {
  font-size: 0.75rem;
  color: var(--global-text-color-light);
  white-space: nowrap;
  min-width: 4.2rem;
  padding-top: 0.65rem;
  flex-shrink: 0;
}

/* ─── Terminal card ─────────────────────────────────────────────── */
.glass-card {
  flex: 1;
  padding: 0.75rem 1rem;
  border-radius: 0;
  background: var(--global-card-bg-color);
  border: 1px solid var(--global-divider-color);
  border-left: 2px solid var(--global-theme-color);
  box-shadow: none;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.glass-card:hover {
  background: var(--global-surface-color, var(--global-card-bg-color));
  border-color: var(--global-theme-color);
  box-shadow: none;
}

/* ─── Card content ─────────────────────────────────────────────── */
.glass-card .note-title {
  display: block;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--global-text-color);
  text-decoration: none;
  line-height: 1.4;
  transition: color 0.15s;
}
.glass-card .note-title:hover {
  color: var(--global-theme-color);
  text-decoration: none;
}
.glass-card .note-desc {
  margin: 0.25rem 0 0;
  font-size: 0.8rem;
  color: var(--global-text-color-light);
  line-height: 1.5;
}
.glass-card .note-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-top: 0.5rem;
}

/* ─── Tags ──────────────────────────────────────────────────────── */
.note-tag {
  font-size: 0.68rem;
  padding: 0.1rem 0.45rem;
  border-radius: 2px;
  background: transparent;
  color: var(--global-theme-color);
  border: 1px solid var(--global-theme-color);
  letter-spacing: 0.03em;
}

/* ─── Empty state ──────────────────────────────────────────────── */
.notes-empty {
  color: var(--global-text-color-light);
  font-style: italic;
  padding: 2rem 0;
}
</style>

<div class="notes-scene">
  <div class="notes-page-header">
    <h1 class="notes-page-title">notes</h1>
    <p class="notes-page-desc">Personal thoughts, reflections, and short notes.</p>
  </div>

  <div class="notes-timeline">
    {% assign notes_sorted = site.notes | sort: "date" | reverse %}

    {% if notes_sorted.size == 0 %}
      <p class="notes-empty">No notes yet.</p>
    {% endif %}

    {% assign current_year = "" %}
    {% for note in notes_sorted %}
      {% assign note_year = note.date | date: "%Y" %}
      {% if note_year != current_year %}
        {% assign current_year = note_year %}
        <div class="timeline-year">{{ current_year }}</div>
      {% endif %}

      <div class="timeline-row">
        <span class="note-date">{{ note.date | date: "%b %d" }}</span>
        <div class="glass-card">
          <a class="note-title" href="{{ note.url | relative_url }}">{{ note.title }}</a>
          {% if note.description %}
            <p class="note-desc">{{ note.description }}</p>
          {% endif %}
          {% if note.tags and note.tags.size > 0 %}
            <div class="note-tags">
              {% for tag in note.tags %}
                <span class="note-tag">{{ tag }}</span>
              {% endfor %}
            </div>
          {% endif %}
        </div>
      </div>
    {% endfor %}
  </div>
</div>
