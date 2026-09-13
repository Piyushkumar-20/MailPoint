import assert from "node:assert";
import {
  isSafeMediaUrl,
  isSafeLinkUrl,
  normalizeCssText,
  containsDangerousCss,
  sanitizeCssDeclarations,
  sanitizeCssBlock,
  buildEmailDocument,
} from "../src/lib/sanitize-email";

console.log("=== RUNNING EMAIL RENDERER & CSS SANITIZATION TEST SUITE ===");

// 1. Media URL Tests
console.log("\n[Test 1] Media URL Validation:");
assert.strictEqual(isSafeMediaUrl("https://example.com/logo.png"), true);
assert.strictEqual(isSafeMediaUrl("http://example.com/logo.png"), true);
assert.strictEqual(isSafeMediaUrl("cid:part1.12345@domain.com"), true);
assert.strictEqual(isSafeMediaUrl("data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=="), true);
assert.strictEqual(isSafeMediaUrl("data:image/jpeg;base64,/9j/4AAQSkZJRg=="), true);
assert.strictEqual(isSafeMediaUrl("data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), true);
// Protocol-relative URLs are normalized to https:// and allowed
assert.strictEqual(isSafeMediaUrl("//www.gstatic.com/images/branding/googlelogo/2x/googlelogo_color_74x24dp.png"), true);
// Malicious/dangerous URLs
assert.strictEqual(isSafeMediaUrl("javascript:alert(1)"), false);
assert.strictEqual(isSafeMediaUrl("data:text/html,<script>alert(1)</script>"), false);
assert.strictEqual(isSafeMediaUrl("data:image/svg+xml;base64,PHN2Zz4="), false); // SVG data URIs forbidden
assert.strictEqual(isSafeMediaUrl("vbscript:msgbox(1)"), false);
console.log("  PASS: Media URLs properly validated");

// 2. Hyperlink URL Tests
console.log("\n[Test 2] Link URL Validation:");
assert.strictEqual(isSafeLinkUrl("https://mail.google.com/alert"), true);
assert.strictEqual(isSafeLinkUrl("http://subdomain.example.org/path?q=1&b=2"), true);
assert.strictEqual(isSafeLinkUrl("//www.google.com"), true);
assert.strictEqual(isSafeLinkUrl("mailto:support@example.com"), true);
assert.strictEqual(isSafeLinkUrl("tel:+1234567890"), true);
assert.strictEqual(isSafeLinkUrl("#anchor-details"), true);
// Malicious link URLs
assert.strictEqual(isSafeLinkUrl("javascript:alert(document.cookie)"), false);
assert.strictEqual(isSafeLinkUrl("data:text/html;base64,PHNjcmlwdD4="), false);
assert.strictEqual(isSafeLinkUrl("vbscript:execute"), false);
console.log("  PASS: Link URLs properly validated");

// 3. Comment Normalization & Obfuscation
console.log("\n[Test 3] CSS Obfuscation & Comment Normalization:");
const obfuscated1 = "exp/*comment*/ression(alert(1))";
assert.strictEqual(containsDangerousCss(obfuscated1), true);

const obfuscated2 = "java/*test*/script:alert(1)";
assert.strictEqual(containsDangerousCss(obfuscated2), true);

const nullByte = "javascript\0:alert(1)";
assert.strictEqual(containsDangerousCss(nullByte), true);
console.log("  PASS: Obfuscation properly detected and neutralized");

// 4. Inline CSS Declarations Sanitization
console.log("\n[Test 4] Inline Style Sanitization:");
// Standard legitimate email inline styles (such as Google Security Alert)
const googleAlertStyles = "background-color: #ffffff; border-radius: 8px; padding: 24px; font-family: 'Google Sans', Roboto, sans-serif; font-size: 14px; line-height: 1.4285; color: #3c4043;";
const cleanGoogleAlertStyles = sanitizeCssDeclarations(googleAlertStyles);
assert.ok(cleanGoogleAlertStyles.includes("background-color: #ffffff"));
assert.ok(cleanGoogleAlertStyles.includes("border-radius: 8px"));
assert.ok(cleanGoogleAlertStyles.includes("padding: 24px"));
assert.ok(cleanGoogleAlertStyles.includes("font-size: 14px"));
assert.ok(cleanGoogleAlertStyles.includes("color: #3c4043"));
console.log("  PASS: Legitimate email styles preserved accurately");

// Legitimate image background in CSS with protocol-relative URL
const safeBgStyle = "background-image: url('//ci3.googleusercontent.com/proxy/banner.png'); color: #000;";
const cleanSafeBg = sanitizeCssDeclarations(safeBgStyle);
assert.ok(cleanSafeBg.includes("background-image: url(\"https://ci3.googleusercontent.com/proxy/banner.png\")"));
console.log("  PASS: Safe background image URLs preserved");

// Dangerous CSS injections in inline styles
const evilStyle1 = "color: red; width: expression(alert('XSS')); font-weight: bold;";
const cleanEvil1 = sanitizeCssDeclarations(evilStyle1);
assert.ok(!cleanEvil1.includes("expression"));
assert.ok(cleanEvil1.includes("color: red"));
assert.ok(cleanEvil1.includes("font-weight: bold"));
console.log("  PASS: expression() dropped while keeping safe properties");

const evilStyle2 = "background: url(javascript:alert(1)); padding: 10px;";
const cleanEvil2 = sanitizeCssDeclarations(evilStyle2);
assert.ok(!cleanEvil2.includes("javascript"));
assert.ok(cleanEvil2.includes("padding: 10px"));
console.log("  PASS: javascript: in url() dropped");

const evilStyle3 = "behavior: url(exploit.htc); -moz-binding: url(xbl.xml); margin: 5px;";
const cleanEvil3 = sanitizeCssDeclarations(evilStyle3);
assert.ok(!cleanEvil3.includes("behavior"));
assert.ok(!cleanEvil3.includes("-moz-binding"));
assert.ok(cleanEvil3.includes("margin: 5px"));
console.log("  PASS: behavior and -moz-binding dropped");

// 5. CSS Block Sanitization (<style> tags)
console.log("\n[Test 5] <style> Block Sanitization:");
const sampleStyleBlock = `
  @import url('https://evil.com/malicious.css');
  @charset "UTF-8";
  @namespace "http://www.w3.org/1999/xhtml";

  body {
    margin: 0;
    padding: 0;
    background-color: #f8f9fa;
  }

  .alert-card > table {
    border: 1px solid #dadce0;
    border-radius: 8px;
    background: #ffffff;
    width: expression(alert(1));
  }

  .action-btn {
    background-color: #1a73e8;
    color: #ffffff;
    border-radius: 4px;
    padding: 10px 24px;
    text-decoration: none;
    display: inline-block;
  }

  @media only screen and (max-width: 600px) {
    .container {
      width: 100% !important;
      padding: 12px !important;
    }
  }
`;

const cleanCssBlock = sanitizeCssBlock(sampleStyleBlock);
// Verify @import is completely gone
assert.ok(!cleanCssBlock.includes("@import"), "@import must be stripped");
assert.ok(!cleanCssBlock.includes("@charset"), "@charset must be stripped");
assert.ok(!cleanCssBlock.includes("@namespace"), "@namespace must be stripped");
assert.ok(!cleanCssBlock.includes("expression"), "expression() inside rules must be stripped");

// Verify child combinator '>' is preserved
assert.ok(cleanCssBlock.includes(".alert-card > table"), "Child combinator > preserved");

// Verify legitimate rules and media queries are preserved
assert.ok(cleanCssBlock.includes(".action-btn"), ".action-btn rule preserved");
assert.ok(cleanCssBlock.includes("background-color: #1a73e8"), "action button styling preserved");
assert.ok(cleanCssBlock.includes("@media only screen and (max-width: 600px)"), "@media query preserved");
assert.ok(cleanCssBlock.includes(".container"), "media query rules preserved");
console.log("  PASS: <style> block properly sanitized and responsive rules preserved");

// 6. Email Document Structure
console.log("\n[Test 6] Email Document Generation:");
const doc = buildEmailDocument("<p>Hello World</p>");
assert.ok(doc.startsWith("<!DOCTYPE html>"), "Contains DOCTYPE");
assert.ok(doc.includes("<base target=\"_blank\">"), "Contains base target=_blank");
assert.ok(doc.includes("<meta name=\"referrer\" content=\"no-referrer\">"), "Contains no-referrer meta");
assert.ok(doc.includes("overflow-x: auto"), "Contains overflow-x auto for wide email tables");
assert.ok(doc.includes("<p>Hello World</p>"), "Contains email content");
console.log("  PASS: Email document structure valid");

// 7. Whole Document Preservation Test
console.log("\n[Test 7] Whole Document Header Injection:");
const fullHtml = `<html><head><style>.test { color: blue; }</style></head><body style="margin:0;"><p>Full</p></body></html>`;
const fullDoc = buildEmailDocument(fullHtml);
assert.ok(fullDoc.includes("<meta name=\"referrer\" content=\"no-referrer\">"), "Injected baseline into existing head");
assert.ok(fullDoc.includes(".test { color: blue; }"), "Preserved authored stylesheet in head");
assert.ok(fullDoc.includes("<body style=\"margin:0;\">"), "Preserved body tag and inline attributes");
console.log("  PASS: Existing document <head> and <body> structure preserved");

console.log("\n=== ALL 7 TEST SUITES PASSED SUCCESSFULLY ===");
