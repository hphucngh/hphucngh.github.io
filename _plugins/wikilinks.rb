# frozen_string_literal: true

require "json"
require "set"

module Jekyll
  # Generator runs after posts/docs are read, before rendering.
  # This populates site.data["backlinks"] so Liquid can access it.
  class WikilinksGenerator < Generator
    safe true
    priority :high

    def generate(site)
      notes = site.collections["notes"]&.docs || []
      return if notes.empty?

      wl = WikilinksData.new(site, notes)
      wl.build!

      # Store instance for post_render and post_write hooks
      site.data["_wikilinks_instance"] = wl
    end
  end

  # Builds a lookup of notes by slug for wikilink resolution
  class WikilinksData
    attr_reader :notes_by_slug, :graph_nodes, :graph_links

    def initialize(site, notes)
      @site = site
      @notes = notes
      @notes_by_slug = {}
      @backlinks = Hash.new { |h, k| h[k] = [] }
      @graph_nodes = []
      @graph_links = []
    end

    def build!
      # Build slug lookup
      @notes.each do |note|
        slug = note_slug(note)
        @notes_by_slug[slug] = note
      end

      # Build graph nodes
      @notes.each do |note|
        slug = note_slug(note)
        folder = File.dirname(note.relative_path).split("/").last
        folder = nil if folder == "_notes"
        @graph_nodes << {
          id: slug,
          title: note.data["title"] || slug,
          tags: Array(note.data["tags"]),
          url: note.url,
          folder: folder
        }
      end

      # Scan wikilinks and build backlinks + graph links
      @notes.each do |note|
        source_slug = note_slug(note)
        raw = note.content || ""
        extract_wikilink_slugs(raw).each do |target_slug|
          target_note = @notes_by_slug[target_slug]
          if target_note
            @backlinks[target_slug] << {
              slug: source_slug,
              title: note.data["title"] || source_slug,
              url: note.url
            }
          end
          @graph_links << {
            source: source_slug,
            target: target_slug,
            type: "wikilink"
          }
        end
      end

      # Deduplicate backlinks
      @backlinks.each_value { |list| list.uniq! { |bl| bl[:slug] } }

      # Tag-based edges
      tag_groups = Hash.new { |h, k| h[k] = [] }
      @notes.each do |note|
        slug = note_slug(note)
        Array(note.data["tags"]).each { |tag| tag_groups[tag] << slug }
      end
      tag_groups.each do |tag, slugs|
        slugs.combination(2).each do |a, b|
          @graph_links << { source: a, target: b, type: "tag:#{tag}" }
        end
      end

      # Inject backlinks into site.data for Liquid access
      @site.data["backlinks"] = @backlinks.transform_values do |list|
        list.sort_by { |bl| bl[:title].to_s }.map do |bl|
          { "slug" => bl[:slug], "title" => bl[:title], "url" => bl[:url] }
        end
      end
    end

    def graph_json
      {
        nodes: @graph_nodes,
        links: deduplicate_links(@graph_links)
      }.to_json
    end

    private

    def note_slug(note)
      File.basename(note.path, File.extname(note.path))
    end

    def extract_wikilink_slugs(content)
      slugs = []
      stripped = content.gsub(/```[\s\S]*?```/m, "")
      stripped = stripped.gsub(/`[^`]+`/, "")
      stripped.scan(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/) do |match|
        slugs << match[0].strip
      end
      slugs.uniq
    end

    def deduplicate_links(links)
      seen = Set.new
      links.select do |link|
        key = [link[:source], link[:target]].sort.join("--") + "::" + link[:type].to_s.split(":").first
        seen.add?(key)
      end
    end
  end

  # Hook: after documents are rendered, process wikilinks in HTML output
  Jekyll::Hooks.register :documents, :post_render do |doc|
    next unless doc.collection&.label == "notes"

    wl = doc.site.data["_wikilinks_instance"]
    next unless wl

    doc.output = Jekyll.process_wikilinks(doc.output, wl, doc.site)
  end

  # Hook: after site is written, generate graph-data.json
  Jekyll::Hooks.register :site, :post_write do |site|
    wl = site.data["_wikilinks_instance"]
    next unless wl

    output_dir = File.join(site.dest, "assets", "data")
    FileUtils.mkdir_p(output_dir)
    File.write(File.join(output_dir, "graph-data.json"), wl.graph_json)
  end

  def self.process_wikilinks(html, wl, site)
    baseurl = site.config["baseurl"].to_s

    parts = html.split(/(<code[\s>].*?<\/code>|<pre[\s>].*?<\/pre>)/mi)
    parts.map! do |part|
      if part.match?(/\A<(?:code|pre)[\s>]/i)
        part
      else
        part.gsub(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/) do
          slug = Regexp.last_match(1).strip
          display = Regexp.last_match(2)&.strip
          target_note = wl.notes_by_slug[slug]

          if target_note
            title = display || target_note.data["title"] || slug
            url = baseurl + target_note.url
            %(<a href="#{url}" class="wikilink">#{title}</a>)
          else
            title = display || slug
            %(<span class="wikilink-broken" title="Note not found: #{slug}">#{title}</span>)
          end
        end
      end
    end
    parts.join
  end
end
