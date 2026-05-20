import { inngest } from "../client";
import { createServiceClient } from "@/lib/supabase/server";
import { bulkMergeSignatureOnPages, BulkPlacementConfig } from "@/lib/pdf/signer";

export const bulkSign = inngest.createFunction(
  {
    id: "bulk-sign",
    triggers: [{ event: "document/bulk.sign" as const }],
    retries: 2,
    concurrency: { limit: 10 },
  },
  async ({ event, step }: { event: { data: any }; step: any }) => {
    const {
      jobId,
      documentIds,
      signature_data,
      placement_mode,
      position,
      placements,
      ownerId,
    } = event.data as {
      jobId: string;
      documentIds: string[];
      signature_data: string;
      placement_mode: "all-pages" | "specific-pages";
      position?: { x: number; y: number; width?: number };
      placements?: { page: number; x: number; y: number; width?: number }[];
      ownerId: string;
    };

    const serviceClient = createServiceClient();

    const config: BulkPlacementConfig = {
      mode: placement_mode,
      position,
      placements,
    };

    // Each document is a named step — Inngest checkpoints after every step,
    // so a crash mid-batch resumes from the last completed step.
    const results = await Promise.all(
      documentIds.map((docId: string) =>
        step.run(`sign-${docId}`, async () => {
          const { data: document } = await serviceClient
            .from("documents")
            .select("id, title, file_path, status")
            .eq("id", docId)
            .eq("owner_id", ownerId)
            .single();

          if (!document) {
            return { documentId: docId, title: "Unknown", success: false, error: "Document not found" };
          }

          if (document.status !== "draft") {
            return {
              documentId: docId,
              title: document.title,
              success: false,
              error: `Skipped — document is ${document.status}`,
            };
          }

          try {
            const signedFilePath = await bulkMergeSignatureOnPages(
              document.file_path,
              signature_data,
              config
            );

            await serviceClient
              .from("documents")
              .update({
                status: "completed",
                completed_at: new Date().toISOString(),
                signed_file_path: signedFilePath,
              })
              .eq("id", docId);

            return { documentId: docId, title: document.title, success: true };
          } catch (err: any) {
            return {
              documentId: docId,
              title: document.title,
              success: false,
              error: err.message ?? "Failed to sign document",
            };
          }
        })
      )
    );

    // Mark the job as completed and store the full results
    await step.run("complete-job", async () => {
      await serviceClient
        .from("bulk_sign_jobs")
        .update({ status: "completed", results })
        .eq("id", jobId);
    });

    return { jobId, signed: results.filter((r: any) => r.success).length };
  }
);
