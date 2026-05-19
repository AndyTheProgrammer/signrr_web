import fs from "fs";
import path from "path";

// ── Embed logos as base64 so they display in every email client,
//    regardless of whether the app URL is publicly reachable. ──────────────
function loadLogo(filename: string): string {
  try {
    const filePath = path.join(process.cwd(), "public", filename);
    const buffer = fs.readFileSync(filePath);
    return `data:image/png;base64,${buffer.toString("base64")}`;
  } catch {
    return "";
  }
}

const SIGNRR_LOGO = loadLogo("signrR_Logo_3-1.png");
const BYTEHUB_LOGO = loadLogo("bytehub-logo.png");
const YEAR = new Date().getFullYear();
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * Branded plain-paper email for sending a signed document to a recipient.
 * Used by both the single-send and bulk-send flows.
 */
export function signedDocumentEmail(documentTitle: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>Signed Document — ${documentTitle}</title>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;
             font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,
             'Helvetica Neue',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
         style="background-color:#ffffff;padding:48px 24px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" role="presentation"
               style="max-width:560px;width:100%;">

          <!-- ── SignrR logo ── -->
          <tr>
            <td style="padding-bottom:32px;">
              ${SIGNRR_LOGO
                ? `<img src="${SIGNRR_LOGO}" alt="SignrR" width="44" height="44"
                        style="display:block;width:44px;height:44px;object-fit:contain;" />`
                : `<span style="font-size:20px;font-weight:700;color:#111827;">SignrR</span>`}
            </td>
          </tr>

          <!-- ── Divider ── -->
          <tr>
            <td style="border-top:1px solid #e5e7eb;padding-bottom:32px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- ── Heading ── -->
          <tr>
            <td style="padding-bottom:6px;">
              <h1 style="margin:0;font-size:22px;font-weight:700;color:#111827;
                          line-height:1.3;letter-spacing:-0.3px;">
                You have received a signed document
              </h1>
            </td>
          </tr>

          <!-- ── Document name ── -->
          <tr>
            <td style="padding-bottom:28px;">
              <p style="margin:0;font-size:14px;font-weight:600;color:#6b7280;">
                ${documentTitle}
              </p>
            </td>
          </tr>

          <!-- ── Body copy ── -->
          <tr>
            <td style="padding-bottom:16px;">
              <p style="margin:0;font-size:15px;color:#374151;line-height:1.75;">
                A signed copy of
                <strong style="color:#111827;">&ldquo;${documentTitle}&rdquo;</strong>
                has been shared with you. The signed PDF is attached to this email —
                please save it for your records.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding-bottom:40px;">
              <p style="margin:0;font-size:14px;color:#9ca3af;line-height:1.7;">
                If you were not expecting this document, you can safely disregard
                this email.
              </p>
            </td>
          </tr>

          <!-- ── Divider ── -->
          <tr>
            <td style="border-top:1px solid #e5e7eb;padding-bottom:24px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- ── Signed via note ── -->
          <tr>
            <td style="padding-bottom:32px;">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
                This document was signed electronically via
                <a href="${APP_URL}" style="color:#6b7280;text-decoration:none;">SignrR</a>.
              </p>
            </td>
          </tr>

          <!-- ── Powered by Bytehub ── -->
          <tr>
            <td style="padding-bottom:8px;">
              <table cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="vertical-align:middle;padding-right:8px;">
                    ${BYTEHUB_LOGO
                      ? `<img src="${BYTEHUB_LOGO}" alt="Bytehub" width="20" height="22"
                              style="display:block;width:20px;height:22px;object-fit:contain;" />`
                      : ""}
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="font-size:11px;color:#9ca3af;letter-spacing:0.3px;">
                      Powered by&nbsp;<strong style="color:#6b7280;">Bytehub</strong>
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── Copyright ── -->
          <tr>
            <td>
              <p style="margin:0;font-size:11px;color:#d1d5db;">
                &copy; ${YEAR} Bytehub
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
}
