import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/resend/client";
import { signedDocumentEmail } from "@/lib/resend/templates";

const schema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params;
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

    const { email } = validation.data;

    // Verify the document exists and belongs to the user
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .eq("owner_id", user.id)
      .single();

    if (docError || !document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (document.status !== "completed" || !document.signed_file_path) {
      return NextResponse.json(
        { error: "Only completed documents with a signed PDF can be sent" },
        { status: 400 }
      );
    }

    // Download the signed PDF using the service client (bypasses Storage RLS)
    const serviceClient = createServiceClient();
    const { data: fileData, error: downloadError } = await serviceClient.storage
      .from("documents")
      .download(document.signed_file_path);

    if (downloadError || !fileData) {
      console.error("Storage download error:", downloadError);
      return NextResponse.json(
        { error: "Failed to retrieve the signed PDF" },
        { status: 500 }
      );
    }

    const pdfBuffer = Buffer.from(await fileData.arrayBuffer());
    const safeTitle = document.title.replace(/[^a-z0-9]/gi, "_");

    const result = await sendEmail({
      to: email,
      subject: `Signed document: "${document.title}"`,
      html: signedDocumentEmail(document.title),
      attachments: [
        {
          filename: `${safeTitle}_signed.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    if (!result.success) {
      console.error("Resend error:", result.error);
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
    }

    return NextResponse.json({ message: "Document sent successfully" });
  } catch (error) {
    console.error("Error in send route:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
