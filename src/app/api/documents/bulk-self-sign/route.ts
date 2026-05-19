import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { bulkMergeSignatureOnPages } from "@/lib/pdf/signer";

const positionSchema = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  width: z.number().min(1).max(100).optional(),
});

const placementSchema = z.object({
  page: z.number().int().positive(),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  width: z.number().min(1).max(100).optional(),
});

const schema = z.object({
  documentIds: z.array(z.string()).min(1).max(50),
  signature_data: z.string().min(1),
  placement_mode: z.enum(["all-pages", "specific-pages"]),
  position: positionSchema.optional(),
  placements: z.array(placementSchema).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = schema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { documentIds, signature_data, placement_mode, position, placements } =
      validation.data;

    if (placement_mode === "all-pages" && !position) {
      return NextResponse.json(
        { error: "Position required for all-pages mode" },
        { status: 400 }
      );
    }
    if (placement_mode === "specific-pages" && (!placements || placements.length === 0)) {
      return NextResponse.json(
        { error: "At least one placement required for specific-pages mode" },
        { status: 400 }
      );
    }

    const { data: documents, error: docsError } = await supabase
      .from("documents")
      .select("*")
      .in("id", documentIds)
      .eq("owner_id", user.id);

    if (docsError) {
      return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 });
    }

    const serviceClient = createServiceClient();
    const results: Array<{
      documentId: string;
      title: string;
      success: boolean;
      error?: string;
    }> = [];

    for (const docId of documentIds) {
      const document = (documents ?? []).find((d) => d.id === docId);

      if (!document) {
        results.push({
          documentId: docId,
          title: "Unknown",
          success: false,
          error: "Document not found or access denied",
        });
        continue;
      }

      if (document.status !== "draft") {
        results.push({
          documentId: docId,
          title: document.title,
          success: false,
          error: `Skipped — document is ${document.status} (only drafts can be signed)`,
        });
        continue;
      }

      try {
        const signedFilePath = await bulkMergeSignatureOnPages(
          document.file_path,
          signature_data,
          { mode: placement_mode, position, placements }
        );

        await serviceClient
          .from("documents")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            signed_file_path: signedFilePath,
          })
          .eq("id", docId);

        results.push({ documentId: docId, title: document.title, success: true });
      } catch (err: any) {
        console.error(`Error signing document ${docId}:`, err);
        results.push({
          documentId: docId,
          title: document.title,
          success: false,
          error: err.message ?? "Failed to sign document",
        });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Error in bulk-self-sign route:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
