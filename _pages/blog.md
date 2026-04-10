---
layout: default
permalink: /synthesis/
title: synthesis
nav: true
nav_order: 1
pagination:
  enabled: true
  collection: posts
  permalink: /page/:num/
  per_page: 10
  sort_field: date
  sort_reverse: true
  trail:
    before: 1
    after: 3
---

<style>
/* ─── Reset scene ───────────────────────────────────────────────── */
.blob { display: none; }

/* ─── Outer wrapper ─────────────────────────────────────────────── */
.blog-scene {
  margin-left:   calc(50% - 50vw);
  margin-right:  calc(50% - 50vw);
  padding-top:    1.5rem;
  padding-bottom: 4rem;
  padding-left:  max(1.5rem, calc(50vw - 500px));
  padding-right: max(1.5rem, calc(50vw - 500px));
}

/* ─── Page header ──────────────────────────────────────────────── */
.blog-page-header {
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--global-divider-color);
}
.blog-page-title {
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--global-theme-color);
  margin: 0 0 0.2rem;
}
.blog-page-title::before { content: '> '; opacity: 0.5; }
.blog-page-desc {
  font-size: 0.82rem;
  color: var(--global-text-color-light);
  margin: 0;
}

/* ─── Two-column layout ─────────────────────────────────────────── */
.blog-layout {
  display: grid;
  grid-template-columns: 190px 1fr;
  gap: 3rem;
  align-items: start;
}
@media (max-width: 700px) {
  .blog-layout { grid-template-columns: 1fr; gap: 2rem; }
}

/* ─── Sidebar ───────────────────────────────────────────────────── */
.blog-sidebar {
  position: sticky;
  top: 5rem;
}
@media (max-width: 700px) {
  .blog-sidebar {
    position: static;
  }
}
.sidebar-section { margin-bottom: 1.75rem; }
.sidebar-label {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--global-theme-color);
  margin: 0 0 0.6rem;
  padding-bottom: 0.4rem;
  border-bottom: 1px solid var(--global-divider-color);
}
.sidebar-links {
  list-style: none;
  margin: 0;
  padding: 0;
}
.sidebar-links li { margin-bottom: 0.3rem; }
.sidebar-links a {
  font-size: 0.82rem;
  color: var(--global-text-color);
  text-decoration: none;
  transition: color 0.15s;
  display: block;
  padding: 0.1rem 0;
}
.sidebar-links a:hover { color: var(--global-theme-color); }
.sidebar-links a::before {
  content: '# ';
  opacity: 0.35;
  font-size: 0.75rem;
}
.sidebar-links a.is-category::before { content: '› '; }

/* ─── Main content ──────────────────────────────────────────────── */
.blog-main {}

/* ─── Featured / Pinned post ────────────────────────────────────── */
.featured-label {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--global-theme-color);
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.65rem;
}
.featured-label i { color: var(--global-theme-color); }

.featured-card {
  display: block;
  padding: 1.4rem 1.6rem;
  background: var(--global-card-bg-color);
  border: 1px solid var(--global-theme-color);
  border-left: 3px solid var(--global-theme-color);
  margin-bottom: 2.5rem;
  text-decoration: none;
  transition: background 0.15s ease;
}
.featured-card:hover { background: var(--global-surface-color, var(--global-card-bg-color)); text-decoration: none; }
.featured-card .f-tag {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--global-theme-color);
  border: 1px solid var(--global-theme-color);
  padding: 0.1rem 0.5rem;
  display: inline-block;
  margin-bottom: 0.75rem;
}
.featured-card .f-title {
  display: block;
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--global-text-color);
  line-height: 1.35;
  transition: color 0.15s;
  text-decoration: none;
  margin-bottom: 0.5rem;
}
.featured-card:hover .f-title { color: var(--global-theme-color); }
.featured-card .f-desc {
  font-size: 0.85rem;
  color: var(--global-text-color-light);
  line-height: 1.6;
  margin: 0 0 0.75rem;
}
.featured-card .f-meta {
  font-size: 0.72rem;
  color: var(--global-text-color-light);
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: center;
}

/* ─── Section heading ───────────────────────────────────────────── */
.articles-label {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--global-theme-color);
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--global-divider-color);
}

/* ─── Article entry ─────────────────────────────────────────────── */
.article-entry {
  padding: 1.1rem 0 1.1rem 1rem;
  border-bottom: 1px solid var(--global-divider-color);
  border-left: 2px solid transparent;
  margin-left: -1rem;
  transition: background 0.15s ease, border-left-color 0.15s ease;
}
.article-entry:first-child { padding-top: 0; }
.article-entry:hover {
  background: var(--global-card-bg-color);
  border-left-color: var(--global-theme-color);
}
.article-entry:hover .a-title { color: var(--global-theme-color); }

.article-entry .a-tag {
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: var(--global-theme-color);
  border: 1px solid var(--global-theme-color);
  padding: 0.08rem 0.45rem;
  display: inline-block;
  margin-bottom: 0.5rem;
  text-decoration: none;
  transition: background 0.12s, color 0.12s;
}
.article-entry .a-tag:hover {
  background: var(--global-theme-color);
  color: var(--global-hover-text-color);
}

.article-entry .a-title {
  display: block;
  font-size: 1rem;
  font-weight: 600;
  color: var(--global-text-color);
  line-height: 1.4;
  text-decoration: none;
  transition: color 0.15s;
  margin-bottom: 0.3rem;
}
.article-entry .a-title:hover { color: var(--global-theme-color); }

.article-entry .a-desc {
  font-size: 0.82rem;
  color: var(--global-text-color-light);
  line-height: 1.55;
  margin: 0 0 0.5rem;
}

.article-entry .a-meta {
  font-size: 0.7rem;
  color: var(--global-text-color-light);
  letter-spacing: 0.02em;
}
.a-meta .meta-sep { opacity: 0.4; margin: 0 0.25rem; }

/* ─── Pagination ────────────────────────────────────────────────── */
.blog-pagination {
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px solid var(--global-divider-color);
  display: flex;
  justify-content: center;
  gap: 0.3rem;
}
.blog-pagination a,
.blog-pagination span {
  font-size: 0.75rem;
  padding: 0.25rem 0.6rem;
  border: 1px solid var(--global-divider-color);
  color: var(--global-text-color-light);
  text-decoration: none;
  transition: border-color 0.15s, color 0.15s;
}
.blog-pagination a:hover { border-color: var(--global-theme-color); color: var(--global-theme-color); }
.blog-pagination .current-page { border-color: var(--global-theme-color); color: var(--global-theme-color); font-weight: 700; }

/* ─── Empty ─────────────────────────────────────────────────────── */
.blog-empty { color: var(--global-text-color-light); font-style: italic; padding: 2rem 0; }
</style>

<div class="blog-scene">

  <!-- Page header -->
  <div class="blog-page-header">
    <h1 class="blog-page-title">synthesis</h1>
    <p class="blog-page-desc">Systems, engineering, AI, and notes from the field.</p>
  </div>

  <div class="blog-layout">

    <!-- ── Sidebar ── -->
    <aside class="blog-sidebar">

      {% if site.display_tags and site.display_tags.size > 0 %}
      <div class="sidebar-section">
        <p class="sidebar-label">topics</p>
        <ul class="sidebar-links">
          {% for tag in site.display_tags %}
            <li><a href="{{ tag | slugify | prepend: '/synthesis/tag/' | relative_url }}">{{ tag }}</a></li>
          {% endfor %}
        </ul>
      </div>
      {% endif %}

      {% if site.display_categories and site.display_categories.size > 0 %}
      <div class="sidebar-section">
        <p class="sidebar-label">categories</p>
        <ul class="sidebar-links">
          {% for cat in site.display_categories %}
            <li><a class="is-category" href="{{ cat | slugify | prepend: '/synthesis/category/' | relative_url }}">{{ cat }}</a></li>
          {% endfor %}
        </ul>
      </div>
      {% endif %}

    </aside>

    <!-- ── Main content ── -->
    <main class="blog-main">

      <!-- Featured / Pinned post -->
      {% assign featured_posts = site.posts | where: "featured", "true" %}
      {% if featured_posts.size > 0 %}
        {% assign fp = featured_posts.first %}
        {% if fp.external_source == blank %}
          {% assign fp_read_time = fp.content | number_of_words | divided_by: 180 | plus: 1 %}
        {% else %}
          {% assign fp_read_time = fp.feed_content | strip_html | number_of_words | divided_by: 180 | plus: 1 %}
        {% endif %}
        {% if fp.redirect == blank %}
          {% assign fp_url = fp.url | relative_url %}
        {% elsif fp.redirect contains '://' %}
          {% assign fp_url = fp.redirect %}
        {% else %}
          {% assign fp_url = fp.redirect | relative_url %}
        {% endif %}

        <div class="featured-label">
          <i class="fa-solid fa-thumbtack fa-xs"></i> featured post
        </div>
        <a class="featured-card" href="{{ fp_url }}"{% if fp.redirect contains '://' %} target="_blank"{% endif %}>
          {% if fp.tags and fp.tags.size > 0 %}
            <span class="f-tag">{{ fp.tags.first }}</span>
          {% elsif fp.categories and fp.categories.size > 0 %}
            <span class="f-tag">{{ fp.categories.first }}</span>
          {% endif %}
          <span class="f-title">{{ fp.title }}</span>
          {% if fp.description %}<p class="f-desc">{{ fp.description }}</p>{% endif %}
          <div class="f-meta">
            <span>{{ fp.date | date: '%B %d, %Y' }}</span>
          </div>
        </a>
      {% endif %}

      <!-- Article list -->
      <p class="articles-label">latest articles</p>

      {% if page.pagination.enabled %}
        {% assign postlist = paginator.posts %}
      {% else %}
        {% assign postlist = site.posts %}
      {% endif %}

      {% if postlist.size == 0 %}
        <p class="blog-empty">No posts yet.</p>
      {% endif %}

      <div class="blog-articles">
        {% for post in postlist %}
          {% if post.external_source == blank %}
            {% assign read_time = post.content | number_of_words | divided_by: 180 | plus: 1 %}
          {% else %}
            {% assign read_time = post.feed_content | strip_html | number_of_words | divided_by: 180 | plus: 1 %}
          {% endif %}
          {% if post.redirect == blank %}
            {% assign post_url = post.url | relative_url %}
          {% elsif post.redirect contains '://' %}
            {% assign post_url = post.redirect %}
          {% else %}
            {% assign post_url = post.redirect | relative_url %}
          {% endif %}

          <div class="article-entry">
            {% if post.tags and post.tags.size > 0 %}
              <a class="a-tag" href="{{ post.tags.first | slugify | prepend: '/synthesis/tag/' | relative_url }}">#{{ post.tags.first }}</a>
            {% elsif post.categories and post.categories.size > 0 %}
              <a class="a-tag" href="{{ post.categories.first | slugify | prepend: '/synthesis/category/' | relative_url }}">{{ post.categories.first }}</a>
            {% endif %}
            <a class="a-title" href="{{ post_url }}"{% if post.redirect contains '://' %} target="_blank"{% endif %}>
              {{ post.title }}
              {% if post.redirect contains '://' %}
                <svg width="0.65em" height="0.65em" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle;margin-left:0.15em">
                  <path d="M17 13.5v6H5v-12h6m3-3h6v6m0-6-9 9" stroke="currentColor" stroke-width="2" fill="none" fill-rule="evenodd" stroke-linecap="round" stroke-linejoin="round"></path>
                </svg>
              {% endif %}
            </a>
            {% if post.description %}<p class="a-desc">{{ post.description }}</p>{% endif %}
            <span class="a-meta">
              {{ post.date | date: '%B %d, %Y' }}
              {% if post.external_source %}
                <span class="meta-sep">&middot;</span>{{ post.external_source }}
              {% endif %}
            </span>
          </div>
        {% endfor %}
      </div>

      <!-- Pagination -->
      {% if page.pagination.enabled and paginator.total_pages > 1 %}
      <div class="blog-pagination">
        {% if paginator.previous_page %}
          <a href="{{ paginator.previous_page_path | relative_url }}">&larr; newer</a>
        {% else %}
          <span>&larr; newer</span>
        {% endif %}
        {% for page_num in (1..paginator.total_pages) %}
          {% if page_num == paginator.page %}
            <span class="current-page">{{ page_num }}</span>
          {% elsif page_num == 1 %}
            <a href="{{ '/synthesis/' | relative_url }}">{{ page_num }}</a>
          {% else %}
            <a href="{{ page_num | prepend: '/synthesis/page/' | append: '/' | relative_url }}">{{ page_num }}</a>
          {% endif %}
        {% endfor %}
        {% if paginator.next_page %}
          <a href="{{ paginator.next_page_path | relative_url }}">older &rarr;</a>
        {% else %}
          <span>older &rarr;</span>
        {% endif %}
      </div>
      {% endif %}

    </main>

  </div><!-- .blog-layout -->
</div><!-- .blog-scene -->
