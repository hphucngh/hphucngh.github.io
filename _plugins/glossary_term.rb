# frozen_string_literal: true

# ---------------------------------------------------------------------------
# {% term slug %}  or  {% term slug Custom display text %}
#
# Renders a technical term as a `.term` link whose tooltip (data-vi) and target
# are pulled from _data/glossary.yml — so a term is defined in exactly one place.
#   {% term kv-cache %}            → <a class="term" ...>KV cache</a>
#   {% term gqa Grouped-Query %}   → <a class="term" ...>Grouped-Query</a>
# ---------------------------------------------------------------------------
module Jekyll
  class GlossaryTermTag < Liquid::Tag
    def initialize(tag_name, text, tokens)
      super
      raw = text.strip.gsub(/\A['"]|['"]\z/, "") # allow optional quotes
      @slug, @display = raw.split(/\s+/, 2)
    end

    def render(context)
      site = context.registers[:site]
      glossary = site.data["glossary"] || []
      entry = glossary.find { |e| e["slug"] == @slug }
      label = @display || (entry && entry["term"]) || @slug

      unless entry
        Jekyll.logger.warn "Glossary:", "unknown term '#{@slug}' — add it to _data/glossary.yml"
        return %(<span class="term term--missing" title="term not in glossary">#{label}</span>)
      end

      esc = lambda { |s| s.to_s.gsub("&", "&amp;").gsub('"', "&quot;").gsub("<", "&lt;") }
      en = esc.call(entry["en"])
      vi = esc.call(entry["vi"])
      base = site.config["baseurl"].to_s
      href = "#{base}/notes/glossary/##{@slug}"
      %(<a class="term" href="#{href}" data-en="#{en}" data-vi="#{vi}">#{label}</a>)
    end
  end
end

Liquid::Template.register_tag("term", Jekyll::GlossaryTermTag)
