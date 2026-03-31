import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { mergeSignaturesOntoPdf } from "@/lib/pdf/signer";

const annotationSchema = z.object({
  type: z.enum(["text", "date"]),
  content: z.string(),
  x: z.number(),
  y: z.number(),
  page: z.number(),
  fontSize: z.number().optional(),
});

const selfSignSchema = z.object({
  signature_data: z.string(),
  signature_position: z
    .object({ x: z.number(), y: z.number(), page: z.number(), width: z.number().optional() })
    .optional(),
  annotations: z.array(annotationSchema).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = selfSignSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { signature_data, signature_position, annotations } = validation.data;

    // Verify ownership and status
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (docError || !document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (document.owner_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (document.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft documents can be self-signed" },
        { status: 400 }
      );
    }

    // Ensure no signers have been added
    const { count } = await supabase
      .from("signers")
      .select("id", { count: "exact", head: true })
      .eq("document_id", documentId);

    if (count && count > 0) {
      return NextResponse.json(
        { error: "Document already has signers — use the signing workflow instead" },
        { status: 400 }
      );
    }

    // Merge signature onto PDF
    const serviceClient = createServiceClient();
    let signedFilePath: string | null = null;

    try {
      signedFilePath = await mergeSignaturesOntoPdf(document.file_path, [
        {
          signature_data,
          signature_position: signature_position || null,
          annotations: annotations || [],
          signing_order: 1,
          full_name: user.email || "Owner",
        },
      ]);
    } catch (mergeError) {
      console.error("Error merging signature onto PDF:", mergeError);
    }

    const { error: updateError } = await serviceClient
      .from("documents")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        ...(signedFilePath ? { signed_file_path: signedFilePath } : {}),
      })
      .eq("id", documentId);

    if (updateError) {
      console.error("Error completing document:", updateError);
      return NextResponse.json({ error: "Failed to complete document" }, { status: 500 });
    }

    return NextResponse.json({ message: "Document signed successfully", completed: true });
  } catch (error) {
    console.error("Error in self-sign route:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
