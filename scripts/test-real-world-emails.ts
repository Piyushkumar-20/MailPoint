import assert from "node:assert";
import {
  sanitizeCssDeclarations,
  sanitizeCssBlock,
  buildEmailDocument,
} from "../src/lib/sanitize-email";

console.log("=== TESTING REAL-WORLD EMAIL STRUCTURES ===");

// 1. Google Security Alert Email Structure
console.log("\n[Structure 1] Google Security Alert Email Structure:");
const googleAlertHtml = `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8f9fa;">
  <tr>
    <td align="center" style="padding: 24px 0;">
      <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border: 1px solid #dadce0; border-radius: 8px; overflow: hidden;">
        <tr>
          <td style="padding: 32px 32px 24px 32px; text-align: center;">
            <img src="https://www.gstatic.com/images/branding/googlelogo/2x/googlelogo_color_74x24dp.png" width="74" height="24" alt="Google" style="display: block; margin: 0 auto 24px auto;" />
            <h1 style="font-family: 'Google Sans', Roboto, sans-serif; font-size: 20px; font-weight: 500; color: #202124; margin: 0 0 16px 0;">
              Security alert for your linked Google Account
            </h1>
            <p style="font-family: Roboto, sans-serif; font-size: 14px; line-height: 1.4285; color: #3c4043; margin: 0 0 24px 0;">
              We noticed a new sign-in to your Google Account on a Windows device. If this was you, you don't need to do anything. If not, we'll help you secure your account.
            </p>
            <table border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto 24px auto;">
              <tr>
                <td align="center" style="background-color: #1a73e8; border-radius: 4px;">
                  <a href="https://myaccount.google.com/notifications" target="_blank" style="font-family: 'Google Sans', Roboto, sans-serif; font-size: 14px; font-weight: 500; color: #ffffff; text-decoration: none; padding: 10px 24px; display: inline-block;">
                    Check activity
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
`;

// Test inline styles sanitization on Google alert
const alertInlineStyle1 = "background-color: #ffffff; border: 1px solid #dadce0; border-radius: 8px; overflow: hidden;";
const cleanAlertStyle1 = sanitizeCssDeclarations(alertInlineStyle1);
assert.ok(cleanAlertStyle1.includes("border-radius: 8px"), "Border radius preserved");
assert.ok(cleanAlertStyle1.includes("border: 1px solid #dadce0"), "Clean card border preserved");
assert.ok(!cleanAlertStyle1.includes("expression"), "No expressions");

const docAlert = buildEmailDocument(googleAlertHtml);
assert.ok(docAlert.includes("googlelogo_color_74x24dp.png"), "Google logo image retained");
assert.ok(docAlert.includes("Check activity"), "Action button text retained");
assert.ok(docAlert.includes("referrer"), "Contains no-referrer meta tag");
console.log("  PASS: Google Security Alert renders cleanly without artificial border resets");

// 2. HTML Newsletter Structure
console.log("\n[Structure 2] Responsive HTML Newsletter Structure:");
const newsletterCss = `
  @media only screen and (max-width: 600px) {
    .full-width { width: 100% !important; height: auto !important; }
    .mobile-padding { padding: 16px !important; }
    .hero-text { font-size: 24px !important; line-height: 1.2 !important; }
  }
`;
const cleanNewsletterCss = sanitizeCssBlock(newsletterCss);
assert.ok(cleanNewsletterCss.includes("@media only screen and (max-width: 600px)"));
assert.ok(cleanNewsletterCss.includes(".mobile-padding { padding: 16px !important }"));
console.log("  PASS: Responsive newsletter CSS rules and media queries preserved");

// 3. Table-heavy Transactional Invoice
console.log("\n[Structure 3] Table-heavy Transactional Invoice:");
const invoiceTableStyles = "width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px;";
const cleanInvoiceStyles = sanitizeCssDeclarations(invoiceTableStyles);
assert.ok(cleanInvoiceStyles.includes("border-collapse: collapse"));
assert.ok(cleanInvoiceStyles.includes("width: 100%"));

const tdNumericStyles = "text-align: right; padding: 8px 12px; border-bottom: 1px solid #eeeeee; font-family: monospace;";
const cleanTdStyles = sanitizeCssDeclarations(tdNumericStyles);
assert.ok(cleanTdStyles.includes("text-align: right"));
assert.ok(cleanTdStyles.includes("font-family: monospace"));
console.log("  PASS: Tabular invoice layout and alignments preserved");

// 4. Email Containing Embedded Images (HTTPS, data-URI, CID)
console.log("\n[Structure 4] Email Containing Embedded Images:");
const imgHttps = "https://cdn.example.com/products/widget.png";
const imgDataUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const imgCid = "cid:header-banner@mail.acme.com";

const styleWithImages = `background-image: url('${imgHttps}'); list-style-image: url('${imgDataUri}');`;
const cleanStyleWithImages = sanitizeCssDeclarations(styleWithImages);
assert.ok(cleanStyleWithImages.includes(imgHttps));
assert.ok(cleanStyleWithImages.includes(imgDataUri));
console.log("  PASS: HTTPS and safe data URIs preserved in styles");

// 5. Quoted / Replied Content Styling
console.log("\n[Structure 5] Quoted / Replied Content Baseline:");
const quotedEmailDoc = buildEmailDocument(`
  <p>Thanks for the quick response!</p>
  <blockquote class="gmail_quote">
    On Sep 12, 2026, at 10:00 AM, Alex wrote:<br>
    Can you confirm the meeting time?
  </blockquote>
`);
assert.ok(quotedEmailDoc.includes(".gmail_quote, blockquote"), "Base styles include quoted styling");
assert.ok(quotedEmailDoc.includes("border-left: 1px #ccc solid"), "Quoted left border styling present");
console.log("  PASS: Quoted and replied email content baseline verified");

console.log("\n=== ALL REAL-WORLD EMAIL STRUCTURE TESTS PASSED ===");
