/**
 * Branded HTML email template for all outbound Pellar emails.
 *
 * Design goals:
 *  - DM Sans via Google Fonts (with safe fallbacks)
 *  - Pellar brand colours: ink (#1C1C1C), forest (#2D5A3D), cream (#F5F0EB)
 *  - Clean, generous whitespace — distinguishable from typical marketing spam
 *  - A subtle top accent bar in forest green
 *  - "PELLAR" wordmark in the footer, not a logo image (avoids spam filters)
 *  - Fully inline styles for email client compatibility
 */

interface EmailTemplateOptions {
  /** The HTML body content — <p> tags, <a> tags, etc. */
  bodyHtml: string;
  /** Sender first name shown in footer. Defaults to "Alex". */
  senderName?: string;
}

export function wrapInBrandedTemplate({
  bodyHtml,
  senderName = "Alex",
}: EmailTemplateOptions): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Pellar</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td { font-family: Arial, sans-serif !important; }
  </style>
  <![endif]-->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #F5F0EB; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
  <!-- Preheader (hidden, helps email clients show a preview) -->
  <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">
    &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F5F0EB;">
    <tr>
      <td align="center" style="padding: 40px 20px 32px;">

        <!-- Card -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 560px; background-color: #FFFFFF; border-radius: 8px; border: 1px solid #E8E4DF;">

          <!-- Forest accent bar -->
          <tr>
            <td style="height: 3px; background-color: #2D5A3D; border-radius: 8px 8px 0 0; font-size: 0; line-height: 0;">
              &nbsp;
            </td>
          </tr>

          <!-- Body content -->
          <tr>
            <td style="padding: 36px 40px 32px; font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.7; color: #1C1C1C;">
              ${bodyHtml}
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <div style="border-top: 1px solid #E8E4DF;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px 32px; font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-size: 11px; font-weight: 600; letter-spacing: 0.15em; color: #2D5A3D; text-transform: uppercase; padding-bottom: 4px;">
                    PELLAR
                  </td>
                </tr>
                <tr>
                  <td style="font-size: 12px; color: #B8B0A8; line-height: 1.5;">
                    ${senderName} &middot; <a href="https://pellar.co.uk" style="color: #7A9E7E; text-decoration: none;">pellar.co.uk</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
        <!-- /Card -->

      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Converts plain body paragraphs (from Claude) into styled <p> tags
 * suitable for embedding inside the branded template.
 *
 * Input can be:
 *  - Already wrapped in <p> tags → re-styles them
 *  - Plain text with newlines → wraps in <p> tags
 */
export function styleParagraphs(html: string): string {
  const pStyle =
    'style="margin: 0 0 14px; padding: 0;"';

  // If content already has <p> tags, add inline styles to them
  if (/<p[\s>]/i.test(html)) {
    return html
      .replace(/<p\s*>/gi, `<p ${pStyle}>`)
      .replace(/<p\s+style="[^"]*">/gi, `<p ${pStyle}>`)
      // Remove empty paragraphs
      .replace(/<p[^>]*>\s*<\/p>/gi, "");
  }

  // Plain text — split on double newlines for paragraphs
  const paragraphs = html
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return paragraphs
    .map((p) => {
      // Convert single newlines to <br> within a paragraph
      const withBreaks = p.replace(/\n/g, "<br />");
      return `<p ${pStyle}>${withBreaks}</p>`;
    })
    .join("\n");
}
