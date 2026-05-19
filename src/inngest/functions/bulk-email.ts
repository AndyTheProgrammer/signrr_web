import { inngest } from "../client";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/resend/client";
import { signedDocumentEmail } from "@/lib/resend/templates";

export const bulkEmailSend = inngest.createFunction(
  {
    id: "bulk-email-send",
    triggers: [{ event: "email/bulk.send" as const }],
    retries: 3,
    // Process up to 5 emails concurrently — fast but stays within Resend Pro limits
    concurrency: {
      limit: 5,
    },
  },
  async ({ event, step }: { event: { data: { sends: Array<{ documentId: string; email: string }> } }; step: any }) => {
    const { sends } = event.data;
    const serviceClient = createServiceClient();

    // Each email runs as its own named step.
    // Inngest checkpoints after every step, so a crash mid-batch resumes from
    // the last completed step rather than restarting from scratch.
    const results = await Promise.all(
      sends.map(({ documentId, email }: { documentId: string; email: string }) =>
        step.run(`send-${documentId}`, async () => {
          // 1. Fetch document
          const { data: doc, error: docError } = await serviceClient
            .from("documents")
            .select("title, signed_file_path, status")
            .eq("id", documentId)
            .single();

          if (docError || !doc) {
            // Permanent failure — return, don't throw (retrying won't help)
            return { documentId, email, success: false, error: "Document not found" };
          }

          if (doc.status !== "completed" || !doc.signed_file_path) {
            return { documentId, email, success: false, error: "No signed PDF available" };
          }

          // 2. Download signed PDF from Supabase Storage
          const { data: fileData, error: downloadError } = await serviceClient.storage
            .from("documents")
            .download(doc.signed_file_path);

          if (downloadError || !fileData) {
            // Transient failure — throw so Inngest retries this step
            throw new Error(`Storage download failed: ${downloadError?.message}`);
          }

          const pdfBuffer = Buffer.from(await fileData.arrayBuffer());
          const safeTitle = doc.title.replace(/[^a-z0-9]/gi, "_");

          // 3. Send email with PDF attached
          const result = await sendEmail({
            to: email,
            subject: `Signed document: "${doc.title}"`,
            html: signedDocumentEmail(doc.title),
            attachments: [{ filename: `${safeTitle}_signed.pdf`, content: pdfBuffer }],
          });

          if (!result.success) {
            // Resend API error — throw so Inngest retries
            throw new Error("Email delivery failed");
          }

          return { documentId, email, success: true };
        })
      )
    );

    return { results };
  }
);
