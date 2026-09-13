import DOMPurify from "dompurify";

/**
 * Normalizes protocol-relative URLs (//example.com) to secure HTTPS
 * across HTML attributes (src, href) and CSS url() declarations.
 */
export function normalizeProtocolRelativeUrls(html: string): string {
  if (!html || typeof html !== "string") return "";
  return html
    .replace(/\b(src|href)\s*=\s*(["'])\/\/+/gi, "$1=$2https://")
    .replace(/\burl\s*\(\s*(["']?)\/\/+/gi, "url($1https://");
}

/**
 * Validates whether a URL is safe to be loaded as an image or media resource.
 * Supports HTTPS, HTTP, CID, protocol-relative URLs, and safe bitmap data URIs.
 */
export function isSafeMediaUrl(url: string): boolean {
  let trimmed = url.trim();
  if (!trimmed) return false;

  // Normalize protocol-relative URLs (//example.com) to https://
  if (trimmed.startsWith("//")) {
    trimmed = "https:" + trimmed;
  }

  // Allow standard HTTP/HTTPS protocols
  if (/^https?:\/\//i.test(trimmed)) return true;

  // Allow CID (Content-ID for embedded email MIME parts)
  if (/^cid:[^\s"'>]+$/i.test(trimmed)) return true;

  // Allow safe bitmap image data URIs (PNG, JPEG, GIF, WebP) - normalize whitespace/newlines
  const normalizedData = trimmed.replace(/\s+/g, "");
  if (
    /^data:image\/(?:png|jpeg|jpg|gif|webp);base64,[a-zA-Z0-9+/=]+$/i.test(
      normalizedData,
    )
  ) {
    return true;
  }

  return false;
}

/**
 * Validates whether a hyperlink URL is safe for an <a> tag.
 */
export function isSafeLinkUrl(url: string): boolean {
  let trimmed = url.trim();
  if (!trimmed) return false;

  if (trimmed.startsWith("//")) {
    trimmed = "https:" + trimmed;
  }

  // Allow standard web protocols
  if (/^https?:\/\//i.test(trimmed)) return true;

  // Allow mailto and tel
  if (/^(?:mailto|tel):/i.test(trimmed)) return true;

  // Allow in-page anchor links
  if (/^#/i.test(trimmed)) return true;

  return false;
}

/**
 * Normalizes CSS text by removing comments, null bytes, and collapsing whitespace.
 * Prevents comment-splitting bypasses like `exp/*comment*\/ression`.
 */
export function normalizeCssText(css: string): string {
  return css
    .replace(/\0/g, "") // Remove null bytes
    .replace(/\/\*[\s\S]*?\*\//g, "") // Remove CSS comments
    .replace(/<!--[\s\S]*?-->/g, ""); // Remove HTML comments
}

/**
 * Checks if a CSS string contains dangerous keywords or patterns.
 */
export function containsDangerousCss(value: string): boolean {
  const normalized = normalizeCssText(value);

  // Check for dangerous dynamic expressions or script execution
  if (
    /expression\s*\(/i.test(normalized) ||
    /behavior\s*:/i.test(normalized) ||
    /-moz-binding\s*:/i.test(normalized) ||
    /(?:javascript|vbscript|livescript)\s*:/i.test(normalized) ||
    /@import\b/i.test(normalized) ||
    /@charset\b/i.test(normalized) ||
    /@namespace\b/i.test(normalized)
  ) {
    return true;
  }

  // Check all url(...) occurrences for safety
  const urlMatches = normalized.matchAll(/url\s*\(\s*(['"]?)(.*?)\1\s*\)/gi);
  for (const match of urlMatches) {
    let rawUrl = match[2]?.trim() ?? "";
    if (!rawUrl) continue;
    if (rawUrl.startsWith("//")) {
      rawUrl = "https:" + rawUrl;
    }
    if (!isSafeMediaUrl(rawUrl)) {
      return true; // Disallowed URL scheme in CSS
    }
  }

  return false;
}

/**
 * Parses and sanitizes inline CSS declarations (e.g. "color: red; padding: 10px;").
 * Allows safe email styling while removing dangerous properties or values.
 */
export function sanitizeCssDeclarations(styleText: string): string {
  if (!styleText || typeof styleText !== "string") return "";

  const cleanText = normalizeCssText(styleText);
  if (!cleanText.trim()) return "";

  // Split declarations by ';' while respecting quoted strings
  const declarations: string[] = [];
  let current = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let parenDepth = 0;

  for (const char of cleanText) {
    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
    } else if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
    } else if (char === "(" && !inSingleQuote && !inDoubleQuote) {
      parenDepth++;
    } else if (char === ")" && !inSingleQuote && !inDoubleQuote) {
      parenDepth = Math.max(0, parenDepth - 1);
    }

    if (char === ";" && !inSingleQuote && !inDoubleQuote && parenDepth === 0) {
      if (current.trim()) {
        declarations.push(current.trim());
      }
      current = "";
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    declarations.push(current.trim());
  }

  const safeDeclarations: string[] = [];

  for (const decl of declarations) {
    const colonIndex = decl.indexOf(":");
    if (colonIndex === -1) continue;

    const property = decl.slice(0, colonIndex).trim().toLowerCase();
    const value = decl.slice(colonIndex + 1).trim();

    // Property name must only contain lowercase letters, numbers, hyphens, or custom properties
    if (!/^[a-z0-9\-]+$/.test(property)) continue;

    // Reject dangerous property names
    if (
      property === "behavior" ||
      property.includes("binding") ||
      property.startsWith("-ms-behavior")
    ) {
      continue;
    }

    // Reject dangerous values
    if (containsDangerousCss(value)) continue;

    // Sanitize any url() in value to ensure protocol-relative URLs are normalized and safe
    const sanitizedValue = value.replace(
      /url\s*\(\s*(['"]?)(.*?)\1\s*\)/gi,
      (_match, _q, rawUrl: string) => {
        let trimmedUrl = rawUrl.trim();
        if (trimmedUrl.startsWith("//")) {
          trimmedUrl = "https:" + trimmedUrl;
        }
        return isSafeMediaUrl(trimmedUrl) ? `url("${trimmedUrl}")` : "";
      },
    );

    if (sanitizedValue.trim()) {
      safeDeclarations.push(`${property}: ${sanitizedValue}`);
    }
  }

  return safeDeclarations.join("; ");
}

/**
 * Sanitizes the contents of a <style> block.
 * Preserves media queries, nested rules, and child combinators (>) while stripping dangerous at-rules and properties.
 */
export function sanitizeCssBlock(cssText: string): string {
  if (!cssText || typeof cssText !== "string") return "";

  // Normalize comments and remove null bytes
  let css = normalizeCssText(cssText);

  // Strip @import, @charset, @namespace entirely
  css = css.replace(/@import\s+[^;]+;/gi, "");
  css = css.replace(/@charset\s+[^;]+;/gi, "");
  css = css.replace(/@namespace\s+[^;]+;/gi, "");

  // Match CSS rule blocks: selector { declarations }
  // Also supports @media queries: @media ... { rules }
  const resultBlocks: string[] = [];
  let index = 0;

  while (index < css.length) {
    const openBrace = css.indexOf("{", index);
    if (openBrace === -1) break;

    const selector = css.slice(index, openBrace).trim();
    index = openBrace + 1;

    // Find corresponding closing brace, accounting for nested braces (like @media)
    let depth = 1;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let closeBrace = -1;

    for (let i = index; i < css.length; i++) {
      const char = css[i];
      if (char === "'" && !inDoubleQuote) inSingleQuote = !inSingleQuote;
      else if (char === '"' && !inSingleQuote) inDoubleQuote = !inDoubleQuote;
      else if (!inSingleQuote && !inDoubleQuote) {
        if (char === "{") depth++;
        else if (char === "}") {
          depth--;
          if (depth === 0) {
            closeBrace = i;
            break;
          }
        }
      }
    }

    if (closeBrace === -1) break; // Unbalanced braces

    const body = css.slice(index, closeBrace).trim();
    index = closeBrace + 1;

    // Check if it's an @media or @supports block
    if (/^@(media|supports)\b/i.test(selector)) {
      // Recursively sanitize inner rules
      const sanitizedInner = sanitizeCssBlock(body);
      if (sanitizedInner.trim()) {
        resultBlocks.push(`${selector} {\n${sanitizedInner}\n}`);
      }
    } else {
      // Standard rule: selector should not contain '<' (to prevent breaking out of <style>),
      // but child combinator '>' (e.g. table > tbody > tr > td) is fully valid and preserved!
      if (!selector.includes("<") && selector.length < 500) {
        const sanitizedBody = sanitizeCssDeclarations(body);
        if (sanitizedBody) {
          resultBlocks.push(`${selector} { ${sanitizedBody} }`);
        }
      }
    }
  }

  return resultBlocks.join("\n");
}

/**
 * Whitelist of HTML tags for rich email rendering.
 * Preserves complete document structure (html, head, body) and all email layout elements.
 */
const EMAIL_ALLOWED_TAGS = [
  "html",
  "head",
  "body",
  "meta",
  "title",
  "style",
  "a",
  "abbr",
  "address",
  "b",
  "bdi",
  "bdo",
  "big",
  "blockquote",
  "br",
  "caption",
  "center",
  "cite",
  "code",
  "col",
  "colgroup",
  "dd",
  "del",
  "dfn",
  "div",
  "dl",
  "dt",
  "em",
  "font",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "ins",
  "kbd",
  "li",
  "mark",
  "nobr",
  "ol",
  "p",
  "pre",
  "q",
  "rp",
  "rt",
  "ruby",
  "s",
  "samp",
  "small",
  "span",
  "strike",
  "strong",
  "sub",
  "sup",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "time",
  "tr",
  "tt",
  "u",
  "ul",
  "var",
  "wbr",
];

/**
 * Whitelist of HTML attributes for rich email rendering.
 * Preserves legacy and modern email layout and styling attributes.
 */
const EMAIL_ALLOWED_ATTR = [
  "align",
  "alt",
  "background",
  "bgcolor",
  "border",
  "cellpadding",
  "cellspacing",
  "char",
  "charoff",
  "charset",
  "class",
  "clear",
  "color",
  "colspan",
  "compact",
  "content",
  "decoding",
  "dir",
  "face",
  "height",
  "href",
  "hspace",
  "http-equiv",
  "id",
  "lang",
  "loading",
  "name",
  "noshade",
  "nowrap",
  "rel",
  "rowspan",
  "rules",
  "scope",
  "size",
  "start",
  "style",
  "summary",
  "target",
  "title",
  "type",
  "valign",
  "value",
  "vspace",
  "width",
];

/**
 * Strictly forbidden tags that should never be executed in an email.
 */
const EMAIL_FORBID_TAGS = [
  "script",
  "iframe",
  "object",
  "embed",
  "form",
  "input",
  "button",
  "textarea",
  "select",
  "option",
  "optgroup",
  "base",
  "link",
  "canvas",
  "svg",
  "math",
  "applet",
  "dialog",
  "audio",
  "video",
  "track",
  "source",
  "portal",
  "template",
  "noscript",
  "frame",
  "frameset",
];

let hooksConfigured = false;

function ensureSanitizerHooks() {
  if (hooksConfigured || typeof window === "undefined") return;

  // Hook 1: Sanitize <style> elements using explicit CSS block sanitizer
  DOMPurify.addHook("uponSanitizeElement", (node) => {
    if (node.nodeName === "STYLE") {
      const originalCss = node.textContent ?? "";
      const cleanCss = sanitizeCssBlock(originalCss);
      if (!cleanCss.trim()) {
        node.textContent = "";
      } else {
        node.textContent = cleanCss;
      }
    }

    // Strip viewport meta tags because viewport: width=device-width triggers
    // mobile layouts on desktop iframes. Also strip refresh/redirect meta tags.
    if (node instanceof Element && node.nodeName === "META") {
      const name = node.getAttribute("name")?.toLowerCase();
      const httpEquiv = node.getAttribute("http-equiv")?.toLowerCase();
      if (name === "viewport" || (httpEquiv && httpEquiv !== "content-type")) {
        node.remove();
      }
    }
  });

  // Hook 2: Sanitize attributes on all elements
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    // Explicit CSS sanitization layer for inline style attributes
    if (node.hasAttribute("style")) {
      const rawStyle = node.getAttribute("style") ?? "";
      const cleanStyle = sanitizeCssDeclarations(rawStyle);
      if (cleanStyle) {
        node.setAttribute("style", cleanStyle);
      } else {
        node.removeAttribute("style");
      }
    }

    // Enforce safe links
    if (node.nodeName === "A") {
      let href = node.getAttribute("href") ?? "";
      if (href.startsWith("//")) {
        href = "https:" + href;
        node.setAttribute("href", href);
      }

      if (href && !isSafeLinkUrl(href)) {
        node.removeAttribute("href");
      } else {
        // Enforce secure external navigation in new tab
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer nofollow");
      }
    }

    // Enforce safe images and normalize protocol-relative URLs
    if (node.nodeName === "IMG") {
      let src = node.getAttribute("src") ?? "";
      if (src.startsWith("//")) {
        src = "https:" + src;
        node.setAttribute("src", src);
      }

      if (src && !isSafeMediaUrl(src)) {
        node.removeAttribute("src");
        node.removeAttribute("srcset");
      } else {
        node.setAttribute("decoding", "async");
        // Do NOT set loading="lazy" as it defers images in auto-resizing iframes
      }
    }
  });

  hooksConfigured = true;
}

/**
 * Baseline styles injected into email iframe head to provide Gmail-like fallbacks
 * without clobbering authored email typography, box models, or table layouts.
 *
 * CRITICAL: html and body must have height: auto (NEVER min-height: 100%)
 * to allow exact content height measurement without infinite expansion loops!
 */
const BASELINE_EMAIL_HEAD = `
  <meta charset="utf-8">
  <meta name="referrer" content="no-referrer">
  <base target="_blank">
  <style>
    /* Safe fallback baseline - authored email styles take precedence */
    html {
      margin: 0;
      padding: 0;
      height: auto;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    body {
      margin: 0;
      padding: 0;
      height: auto;
      background-color: #ffffff;
      color: #202124;
      font-family: Roboto, RobotoDraft, Helvetica, Arial, sans-serif;
      font-size: 14px;
      line-height: normal;
      overflow-x: auto;
      overflow-y: hidden;
    }
    a {
      color: #1a73e8;
    }
    img {
      border: 0;
      outline: none;
      text-decoration: none;
    }
    .gmail_quote, blockquote {
      margin: 0 0 0 .8ex;
      border-left: 1px #ccc solid;
      padding-left: 1ex;
    }
  </style>
`;

/**
 * Sanitizes untrusted email HTML using DOMPurify with the explicit CSS sanitization layer.
 * Preserves complete document structure, <style> blocks, and body styling.
 */
export function sanitizeEmailHtml(dirtyHtml: string): string {
  if (!dirtyHtml || typeof dirtyHtml !== "string") return "";

  if (typeof window === "undefined") {
    // On SSR, avoid executing DOMPurify without a window object.
    return "";
  }

  ensureSanitizerHooks();

  // Normalize protocol-relative URLs (//) in src/href/url() to https:// before sanitization
  const preProcessedHtml = normalizeProtocolRelativeUrls(dirtyHtml);

  const sanitized = DOMPurify.sanitize(preProcessedHtml, {
    ALLOWED_TAGS: EMAIL_ALLOWED_TAGS,
    ALLOWED_ATTR: EMAIL_ALLOWED_ATTR,
    FORBID_TAGS: EMAIL_FORBID_TAGS,
    FORBID_ATTR: [
      "onerror",
      "onload",
      "onclick",
      "onmouseover",
      "onfocus",
      "onblur",
      "onchange",
      "onsubmit",
      "onkeydown",
      "onkeypress",
      "onkeyup",
      "onmousedown",
      "onmouseup",
      "oncontextmenu",
    ],
    ALLOW_DATA_ATTR: false,
    ADD_DATA_URI_TAGS: ["img"],
    WHOLE_DOCUMENT: true,
  });

  return sanitized;
}

/**
 * Prepares the complete HTML document for rendering inside the sandboxed iframe srcDoc.
 * Injects baseline styles and security meta tags while preserving authored email CSS.
 */
export function buildEmailDocument(sanitizedHtml: string): string {
  if (!sanitizedHtml) return "";

  const trimmed = sanitizedHtml.trim();

  // If DOMPurify preserved or produced a whole document with <head>
  if (/<head\b[^>]*>/i.test(trimmed)) {
    // Inject baseline meta and fallback styles immediately after <head>
    // Authored email <style> blocks in <head> will come after and naturally override fallbacks
    let doc = trimmed.replace(
      /(<head\b[^>]*>)/i,
      `$1\n${BASELINE_EMAIL_HEAD}\n`,
    );

    if (!/^<!doctype\s/i.test(doc)) {
      doc = `<!DOCTYPE html>\n${doc}`;
    }

    return doc;
  }

  // If it's a fragment without <head>, construct the full document
  return `<!DOCTYPE html>
<html>
<head>
${BASELINE_EMAIL_HEAD}
</head>
<body>
  ${trimmed}
</body>
</html>`;
}
