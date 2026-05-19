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
<body style="margin:0;padding:0;background-color:#f3f4f6;
             font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,
             'Helvetica Neue',Arial,sans-serif;">

  <!-- Outer wrapper on gray background -->
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
         style="background-color:#f3f4f6;padding:40px 16px;">
    <tr>
      <td align="center">

        <!-- ── White card ── -->
        <table width="560" cellpadding="0" cellspacing="0" role="presentation"
               style="max-width:560px;width:100%;background-color:#ffffff;
                      border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">

          <!-- ── Logo section ── -->
          <tr>
            <td align="center"
                style="background-color:#ffffff;padding:32px 40px 28px;
                       border-bottom:1px solid #f3f4f6;">
              ${SIGNRR_LOGO
                ? `<img src="${SIGNRR_LOGO}" alt="SignrR" width="150" height="150"
                        style="display:block;width:150px;height:150px;object-fit:contain;" />`
                : `<span style="font-size:22px;font-weight:700;color:#111827;">SignrR</span>`}
            </td>
          </tr>

          <!-- ── Content section ── -->
          <tr>
            <td style="padding:36px 40px 32px;">

              <!-- Heading -->
              <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;
                          color:#111827;line-height:1.3;letter-spacing:-0.3px;">
                You have received a signed document
              </h1>

              <!-- Document name -->
              <p style="margin:0 0 28px;font-size:14px;font-weight:600;color:#6b7280;">
                ${documentTitle}
              </p>

              <!-- Body copy -->
              <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.75;">
                A signed copy of
                <strong style="color:#111827;">&ldquo;${documentTitle}&rdquo;</strong>
                has been shared with you. The signed PDF is attached to this email —
                please save it for your records.
              </p>

              <p style="margin:0 0 36px;font-size:14px;color:#9ca3af;line-height:1.7;">
                If you were not expecting this document, you can safely disregard
                this email.
              </p>

              <!-- Divider -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="border-top:1px solid #f3f4f6;padding-bottom:20px;
                              font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>

              <!-- Signed via note -->
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
                This document was signed electronically via
                <a href="${APP_URL}" style="color:#6b7280;text-decoration:none;">SignrR</a>.
              </p>

            </td>
          </tr>

          <!-- ── Footer section ── -->
          <tr>
            <td align="center"
                style="background-color:#f9fafb;border-top:1px solid #f3f4f6;
                       padding:20px 40px;">
              <table cellpadding="0" cellspacing="0" role="presentation"
                     style="margin:0 auto 8px;">
                <tr>
                  <td style="vertical-align:middle;padding-right:7px;">
                    ${BYTEHUB_LOGO
                      ? `<img src="${BYTEHUB_LOGO}" alt="Bytehub" width="18" height="20"
                              style="display:block;width:18px;height:20px;object-fit:contain;" />`
                      : ""}
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="font-size:11px;color:#9ca3af;letter-spacing:0.3px;">
                      Powered by&nbsp;<strong style="color:#6b7280;">Bytehub</strong>
                    </span>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:11px;color:#d1d5db;">
                &copy; ${YEAR} Bytehub
              </p>
            </td>
          </tr>

        </table>
        <!-- ── End white card ── -->

      </td>
    </tr>
  </table>

</body>
</html>`;
}
