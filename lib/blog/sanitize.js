import sanitizeHtml from "sanitize-html"

// Everything the editor can produce, and nothing else. Anything outside this
// list (scripts, event handlers, styles other than text-align, unknown
// iframes, javascript: links…) is dropped.
const ARTICLE_OPTIONS = {
  allowedTags: [
    "p", "br", "hr", "h1", "h2", "h3", "h4",
    "strong", "b", "em", "i", "u", "s", "sub", "sup",
    "a", "ul", "ol", "li", "blockquote", "pre", "code",
    "img", "figure", "figcaption", "video", "source", "iframe",
    "div", "span",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height", "loading"],
    video: ["src", "controls", "poster", "preload", "playsinline", "width", "height", "loop", "muted"],
    source: ["src", "type"],
    iframe: ["src", "width", "height", "allowfullscreen", "title", "loading"],
    "*": ["style"],
  },
  allowedStyles: {
    "*": { "text-align": [/^(left|right|center|justify)$/] },
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["http", "https"], video: ["http", "https"], source: ["http", "https"], iframe: ["https"] },
  allowProtocolRelative: false,
  // Embeds are limited to video providers that support privacy-friendly players.
  allowedIframeHostnames: ["www.youtube.com", "www.youtube-nocookie.com", "player.vimeo.com"],
  transformTags: {
    a: (tagName, attribs) => {
      const external = /^https?:\/\//i.test(attribs.href || "")
      return {
        tagName,
        attribs: { ...attribs, ...(external ? { target: "_blank" } : {}), rel: "noopener noreferrer nofollow" },
      }
    },
    img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: "lazy" } }),
    iframe: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: "lazy" } }),
    video: (tagName, attribs) => ({ tagName, attribs: { preload: "none", ...attribs, controls: "controls" } }),
  },
}

export function sanitizeArticleHtml(html) {
  return sanitizeHtml(String(html || ""), ARTICLE_OPTIONS)
}

const ENTITIES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&#x27;": "'", "&nbsp;": " " }

function decodeEntities(text) {
  return text.replace(/&(?:amp|lt|gt|quot|#39|#x27|nbsp);/g, (m) => ENTITIES[m] || m)
}

// Plain text of some HTML (used for search, excerpts and reading time).
export function htmlToText(html) {
  const stripped = sanitizeHtml(String(html || ""), { allowedTags: [], allowedAttributes: {} })
  return decodeEntities(stripped).replace(/\s+/g, " ").trim()
}

// Comments are stored and shown as plain text, so "sanitising" is removing
// any markup and normalising whitespace.
export function cleanCommentText(text) {
  const stripped = sanitizeHtml(String(text || ""), { allowedTags: [], allowedAttributes: {} })
  return decodeEntities(stripped)
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}
