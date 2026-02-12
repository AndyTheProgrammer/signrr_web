import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params;
    const supabase = await createClient();

    const { searchParams } = request.nextUrl;
    const version = searchParams.get("version"); // "signed" or "original"

    // Get document
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("file_path, signed_file_path, status")
      .eq("id", documentId)
      .single();

    if (docError || !document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Use signed version if available and requested (or if completed)
    const filePath =
      version === "signed" && document.signed_file_path
        ? document.signed_file_path
        : document.signed_file_path && document.status === "completed"
          ? document.signed_file_path
          : document.file_path;

    // Generate a signed URL (valid for 1 hour)
    const { data: signedUrl, error: urlError } = await supabase.storage
      .from("documents")
      .createSignedUrl(filePath, 3600);

    if (urlError || !signedUrl) {
      console.error("Error generating signed URL:", urlError);
      return NextResponse.json(
        { error: "Failed to generate PDF URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: signedUrl.signedUrl });
  } catch (error) {
    console.error("Error in pdf-url route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
