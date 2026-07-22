# Commit Message Instructions

This is a personal **Jekyll blog** (al-folio), not a software project. Commits are mostly
about **content** (posts, notes, pages) and **presentation** (theme, layout, assets) — not
features and bug fixes. Keep messages short, plain, and descriptive.

## Format

```
<type>(<scope>): <emoji> <short description>

<optional longer description>
```

- **Short description**: imperative mood, lowercase, ≤ 60 characters, no trailing period.
  - Good: `post(synthesis): ✍️ add KV-cache deep dive`
  - Avoid: `Added a new post about the KV cache.`
- **scope** *(optional)*: the section or file touched — a post/note slug, `about`,
  `notes`, `navbar`, `home`, `config`, etc. Omit it if the change is site-wide.
- **Longer description** *(optional)*: use it for posts/notes or non-obvious changes to say
  **what** and **why**. Skip it for small tweaks. Reference issues with `Closes #<n>` if any.

## Types

### Content (the main work)

| Type      | Emoji | Use for |
| --------- | ----- | ------- |
| `post`    | ✍️    | New or updated blog post (`_posts/`, "synthesis") |
| `note`    | 🗒️    | New or updated note (`_notes/`) |
| `page`    | 📄    | Page content — about, 404, standalone pages (`_pages/`) |
| `draft`   | 🚧    | Work-in-progress / unpublished content |
| `typo`    | ✏️    | Typo, wording, or grammar fix in content |

### Presentation & assets

| Type      | Emoji | Use for |
| --------- | ----- | ------- |
| `design`  | 💄    | Theme, layout, styling — `_sass/`, `_layouts/`, `_includes/`, UI/UX |
| `media`   | 🖼️    | Images, video, audio, downloads, fonts (`assets/`) |

### Site plumbing

| Type      | Emoji | Use for |
| --------- | ----- | ------- |
| `config`  | ⚙️    | Site configuration — `_config.yml`, front-matter defaults, plugins |
| `seo`     | 🔍    | SEO, metadata, social cards, sitemap, `robots.txt` |
| `fix`     | 🐛    | Broken links, rendering/build errors, layout bugs |
| `deps`    | 📦    | Gem / npm dependency updates (`Gemfile`, `package.json`) |
| `ci`      | 👷    | Deployment, GitHub Actions, build tooling (`.github/`, Docker) |
| `chore`   | 🧹    | Cleanup, file organization, removing unused content |
| `revert`  | ⏪    | Revert a previous commit |

Pick the type that best describes the change; when in doubt between content and design,
choose based on **what the reader notices** (new words → `post`/`note`; new look → `design`).

## Examples

New post:

```
post(synthesis): ✍️ add self-hosted LLM guide

Walkthrough of running an LLM in production on your own hardware:
model choice, VRAM/quantization trade-offs, and serving setup.
```

Small note and a wording fix (no body needed):

```
note(engineering): 🗒️ add note on debugging as thinking
typo(about): ✏️ fix subtitle wording
```

Design tweak:

```
design(navbar): 💄 tighten mobile spacing and active state
```

Housekeeping (e.g. stripping unused theme demo content):

```
chore: 🧹 remove al-folio demo sections

Strip unused academic collections (publications, projects, teaching,
etc.), theme docs, and demo assets — keep only blog, notes, and about.
```
