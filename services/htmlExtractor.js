const cheerio = require("cheerio");

const MAX_TEXT_LENGTH = 200000;

function extractText(html) {
  if (!html || typeof html !== "string") {
    return "";
  }

  try {
    const $ = cheerio.load(html);

    // Remove non-visible / non-content elements
    $(
      "script, style, noscript, iframe, svg, canvas, template"
    ).remove();

    // Prefer body, fallback to complete document
    let text = $("body").text();

    if (!text) {
      text = $.root().text();
    }

    text = text
      .replace(/\s+/g, " ")
      .trim();

    // Prevent excessive memory/processing
    if (text.length > MAX_TEXT_LENGTH) {
      text = text.substring(
        0,
        MAX_TEXT_LENGTH
      );
    }

    return text;
  } catch (error) {
    console.error(
      "HTML extraction failed:",
      error.message
    );

    return "";
  }
}

module.exports = extractText;