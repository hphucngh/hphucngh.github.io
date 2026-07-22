// Add a terminal-style header (language label + copy button) to code blocks.
var codeBlocks = document.querySelectorAll("pre");
codeBlocks.forEach(function (codeBlock) {
  if (
    (codeBlock.querySelector("pre:not(.lineno)") || codeBlock.querySelector("code")) &&
    codeBlock.querySelector("code:not(.language-chartjs)") &&
    codeBlock.querySelector("code:not(.language-diff2html)") &&
    codeBlock.querySelector("code:not(.language-echarts)") &&
    codeBlock.querySelector("code:not(.language-geojson)") &&
    codeBlock.querySelector("code:not(.language-mermaid)") &&
    codeBlock.querySelector("code:not(.language-plotly)") &&
    codeBlock.querySelector("code:not(.language-vega_lite)")
  ) {
    // derive the language label from the nearest `language-xxx` ancestor
    var langLabel = "code";
    var langHost = codeBlock.closest('[class*="language-"]');
    if (langHost) {
      var match = langHost.className.match(/language-([\w+#-]+)/);
      if (match && match[1] && match[1] !== "plaintext") {
        langLabel = match[1];
      }
    }

    // create copy button
    var copyButton = document.createElement("button");
    copyButton.className = "copy";
    copyButton.type = "button";
    copyButton.ariaLabel = "Copy code to clipboard";
    copyButton.innerHTML = '<i class="fa-solid fa-clipboard"></i> copy';

    // get code from code block and copy to clipboard
    copyButton.addEventListener("click", function () {
      // check if code block has line numbers
      // i.e. `kramdown.syntax_highlighter_opts.block.line_numbers` set to true in _config.yml
      // or using `jekyll highlight` liquid tag with `linenos` option
      if (codeBlock.querySelector("pre:not(.lineno)")) {
        // get code from code block ignoring line numbers
        var code = codeBlock.querySelector("pre:not(.lineno)").innerText.trim();
      } else {
        // get code from code block when line numbers are not displayed
        var code = codeBlock.querySelector("code").innerText.trim();
      }
      window.navigator.clipboard.writeText(code);
      copyButton.innerHTML = '<i class="fa-solid fa-clipboard-check"></i> copied';
      var waitFor = 2500;

      setTimeout(function () {
        copyButton.innerHTML = '<i class="fa-solid fa-clipboard"></i> copy';
      }, waitFor);
    });

    // build header bar: language label (left) + copy button (right)
    var header = document.createElement("div");
    header.className = "code-header";
    var langSpan = document.createElement("span");
    langSpan.className = "code-lang";
    langSpan.textContent = langLabel;
    header.appendChild(langSpan);
    header.appendChild(copyButton);

    // create wrapper div and assemble
    var wrapper = document.createElement("div");
    wrapper.className = "code-display-wrapper";
    const parent = codeBlock.parentElement;
    parent.insertBefore(wrapper, codeBlock);
    wrapper.append(header);
    wrapper.append(codeBlock);
  }
});
