import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Token is required" },
        { status: 400 }
      );
    }

    // Use service client to bypass RLS (guest signers aren't authenticated)
    const supabase = createServiceClient();

    // Find signer by magic token
    const { data: signer, error: signerError } = await supabase
      .from("signers")
      .select("document_id")
      .eq("magic_token", token)
      .single();

    if (signerError || !signer) {
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 404 }
      );
    }

    // Get document file path
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("file_path")
      .eq("id", signer.document_id)
      .single();

    if (docError || !document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Generate signed URL
    const { data: signedUrl, error: urlError } = await supabase.storage
      .from("documents")
      .createSignedUrl(document.file_path, 3600);

    if (urlError || !signedUrl) {
      return NextResponse.json(
        { error: "Failed to generate PDF URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: signedUrl.signedUrl });
  } catch (error) {
    console.error("Error in sign pdf-url route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
