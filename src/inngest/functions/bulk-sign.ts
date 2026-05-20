import { inngest } from "../client";
import { createServiceClient } from "@/lib/supabase/server";
import { bulkMergeSignatureOnPages, BulkPlacementConfig } from "@/lib/pdf/signer";

const BATCH_SIZE = 5;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

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
    const config: BulkPlacementConfig = { mode: placement_mode, position, placements };
    const batches = chunk(documentIds, BATCH_SIZE);
    const allResults: Array<{ documentId: string; title: string; success: boolean; error?: string }> = [];

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];

      // Sign all docs in this batch concurrently — each is a named step so
      // Inngest checkpoints after every step and can resume on crash.
      const batchResults = await Promise.all(
        batch.map((docId: string) =>
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

      allResults.push(...batchResults);

      // Update progress after each batch — sequential so no race conditions.
      // On Inngest replay this step is memoized and won't double-write.
      await step.run(`progress-batch-${batchIndex}`, async () => {
        await serviceClient
          .from("bulk_sign_jobs")
          .update({ processed: allResults.length })
          .eq("id", jobId);
      });
    }

    // All batches done — store results and mark complete
    await step.run("complete-job", async () => {
      await serviceClient
        .from("bulk_sign_jobs")
        .update({ status: "completed", processed: allResults.length, results: allResults })
        .eq("id", jobId);
    });

    return { jobId, signed: allResults.filter((r) => r.success).length };
  }
);
