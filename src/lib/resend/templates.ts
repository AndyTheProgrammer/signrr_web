const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const SIGNRR_LOGO = `${APP_URL}/signrR_Logo_3-1.png`;
const BYTEHUB_LOGO = `${APP_URL}/bytehub-logo.png`;
const YEAR = new Date().getFullYear();

// ── Shared layout helpers ─────────────────────────────────────────────────────

function emailShell(contentRows: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;
             font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,
             'Helvetica Neue',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
         style="background-color:#f3f4f6;padding:40px 16px;">
    <tr>
      <td align="center">

        <table width="560" cellpadding="0" cellspacing="0" role="presentation"
               style="max-width:560px;width:100%;background-color:#ffffff;
                      border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">

          <!-- Logo -->
          <tr>
            <td align="center"
                style="background-color:#ffffff;padding:32px 40px 28px;
                       border-bottom:1px solid #f3f4f6;">
              <img src="${SIGNRR_LOGO}" alt="SignrR" width="150" height="150"
                   style="display:block;width:150px;height:150px;object-fit:contain;" />
            </td>
          </tr>

          ${contentRows}

          <!-- Footer -->
          <tr>
            <td align="center"
                style="background-color:#f9fafb;border-top:1px solid #f3f4f6;
                       padding:20px 40px;">
              <table cellpadding="0" cellspacing="0" role="presentation"
                     style="margin:0 auto 8px;">
                <tr>
                  <td style="vertical-align:middle;padding-right:8px;">
                    <img src="${BYTEHUB_LOGO}" alt="Bytehub" width="30" height="34"
                         style="display:block;width:30px;height:34px;object-fit:contain;" />
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="font-size:12px;color:#9ca3af;letter-spacing:0.3px;">
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

      </td>
    </tr>
  </table>

</body>
</html>`;
}

function ctaButton(label: string, url: string): string {
  return `<div style="text-align:center;margin:32px 0;">
    <a href="${url}"
       style="display:inline-block;background-color:#111827;color:#ffffff;
              font-size:15px;font-weight:600;text-decoration:none;
              padding:14px 32px;border-radius:8px;letter-spacing:0.1px;">
      ${label}
    </a>
  </div>`;
}

function divider(): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td style="border-top:1px solid #f3f4f6;padding-bottom:20px;font-size:0;line-height:0;">&nbsp;</td>
    </tr>
  </table>`;
}

function footNote(text: string): string {
  return `<p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">${text}</p>`;
}

// ── Email templates ───────────────────────────────────────────────────────────

/** Sent to a recipient with a signed PDF attached. Used by single-send and bulk-send. */
export function signedDocumentEmail(documentTitle: string): string {
  return emailShell(`
    <tr>
      <td style="padding:36px 40px 32px;">
        <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;
                   color:#111827;line-height:1.3;letter-spacing:-0.3px;">
          You have received a signed document
        </h1>
        <p style="margin:0 0 28px;font-size:14px;font-weight:600;color:#6b7280;">
          ${documentTitle}
        </p>
        <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.75;">
          A signed copy of
          <strong style="color:#111827;">&ldquo;${documentTitle}&rdquo;</strong>
          has been shared with you. The signed PDF is attached to this email —
          please save it for your records.
        </p>
        <p style="margin:0 0 36px;font-size:14px;color:#9ca3af;line-height:1.7;">
          If you were not expecting this document, you can safely disregard this email.
        </p>
        ${divider()}
        ${footNote(`This document was signed electronically via <a href="${APP_URL}" style="color:#6b7280;text-decoration:none;">SignrR</a>.`)}
      </td>
    </tr>`);
}

/** Initial invitation sent to the first external signer. */
export function signingInvitationEmail(
  signerName: string,
  documentTitle: string,
  signingUrl: string,
  signerOrder: number
): string {
  return emailShell(`
    <tr>
      <td style="padding:36px 40px 32px;">
        <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;
                   color:#111827;line-height:1.3;letter-spacing:-0.3px;">
          You've been invited to sign a document
        </h1>
        <p style="margin:0 0 28px;font-size:14px;font-weight:600;color:#6b7280;">
          ${documentTitle}
        </p>
        <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.75;">
          Hello <strong style="color:#111827;">${signerName}</strong>,
        </p>
        <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.75;">
          You have been invited to sign
          <strong style="color:#111827;">&ldquo;${documentTitle}&rdquo;</strong>.
          You are signer&nbsp;<strong style="color:#111827;">#${signerOrder}</strong>
          in the signing sequence.
        </p>
        <p style="margin:0 0 4px;font-size:14px;color:#9ca3af;line-height:1.7;">
          Click the button below to review and sign the document.
        </p>
        ${ctaButton("Sign Document", signingUrl)}
        <p style="margin:0 0 36px;font-size:14px;color:#9ca3af;line-height:1.7;">
          This link expires in 48 hours. If you were not expecting this request,
          you can safely disregard this email.
        </p>
        ${divider()}
        ${footNote(`Sent via <a href="${APP_URL}" style="color:#6b7280;text-decoration:none;">SignrR</a> — secure electronic document signing.`)}
      </td>
    </tr>`);
}

/** Sent to the next signer in a sequential workflow when the previous signer completes. */
export function yourTurnToSignEmail(
  signerName: string,
  documentTitle: string,
  signingUrl: string
): string {
  return emailShell(`
    <tr>
      <td style="padding:36px 40px 32px;">
        <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;
                   color:#111827;line-height:1.3;letter-spacing:-0.3px;">
          It's your turn to sign
        </h1>
        <p style="margin:0 0 28px;font-size:14px;font-weight:600;color:#6b7280;">
          ${documentTitle}
        </p>
        <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.75;">
          Hello <strong style="color:#111827;">${signerName}</strong>,
        </p>
        <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.75;">
          The previous signer has completed their signature on
          <strong style="color:#111827;">&ldquo;${documentTitle}&rdquo;</strong>.
          It's now your turn to review and sign.
        </p>
        ${ctaButton("Sign Document Now", signingUrl)}
        <p style="margin:0 0 36px;font-size:14px;color:#9ca3af;line-height:1.7;">
          This link expires in 48 hours. If you were not expecting this request,
          you can safely disregard this email.
        </p>
        ${divider()}
        ${footNote(`Sent via <a href="${APP_URL}" style="color:#6b7280;text-decoration:none;">SignrR</a> — secure electronic document signing.`)}
      </td>
    </tr>`);
}

/** Sent to the document owner once all signers have completed. */
export function documentCompletedEmail(
  ownerName: string,
  documentTitle: string,
  dashboardUrl: string
): string {
  return emailShell(`
    <tr>
      <td style="padding:36px 40px 32px;">
        <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;
                   color:#111827;line-height:1.3;letter-spacing:-0.3px;">
          Document fully signed
        </h1>
        <p style="margin:0 0 28px;font-size:14px;font-weight:600;color:#6b7280;">
          ${documentTitle}
        </p>
        <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.75;">
          Hello <strong style="color:#111827;">${ownerName || "there"}</strong>,
        </p>
        <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.75;">
          All signers have completed their signatures on
          <strong style="color:#111827;">&ldquo;${documentTitle}&rdquo;</strong>.
          The fully signed document is ready for you to download.
        </p>
        ${ctaButton("Download Signed Document", dashboardUrl)}
        <p style="margin:0 0 36px;font-size:14px;color:#9ca3af;line-height:1.7;">
          Log in to your SignrR dashboard at any time to manage your documents.
        </p>
        ${divider()}
        ${footNote(`Sent via <a href="${APP_URL}" style="color:#6b7280;text-decoration:none;">SignrR</a> — secure electronic document signing.`)}
      </td>
    </tr>`);
}

/** Resend / reminder — always carries a freshly generated link. */
export function signingReminderEmail(
  signerName: string,
  documentTitle: string,
  signingUrl: string
): string {
  return emailShell(`
    <tr>
      <td style="padding:36px 40px 32px;">
        <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;
                   color:#111827;line-height:1.3;letter-spacing:-0.3px;">
          Signing reminder
        </h1>
        <p style="margin:0 0 28px;font-size:14px;font-weight:600;color:#6b7280;">
          ${documentTitle}
        </p>
        <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.75;">
          Hello <strong style="color:#111827;">${signerName}</strong>,
        </p>
        <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.75;">
          This is a reminder that your signature is still required on
          <strong style="color:#111827;">&ldquo;${documentTitle}&rdquo;</strong>.
          A fresh link has been generated for you — any previous links are no longer valid.
        </p>
        ${ctaButton("Sign Document Now", signingUrl)}
        <p style="margin:0 0 36px;font-size:14px;color:#9ca3af;line-height:1.7;">
          This link expires in 48 hours. If you were not expecting this request,
          you can safely disregard this email.
        </p>
        ${divider()}
        ${footNote(`Sent via <a href="${APP_URL}" style="color:#6b7280;text-decoration:none;">SignrR</a> — secure electronic document signing.`)}
      </td>
    </tr>`);
}
