import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Magic token is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Find signer by magic token
    const { data: signer, error: signerError } = await supabase
      .from("signers")
      .select(
        `
        *,
        documents:document_id (
          id,
          title,
          file_path,
          status,
          current_signer_index
        )
      `
      )
      .eq("magic_token", token)
      .single();

    if (signerError || !signer) {
      return NextResponse.json(
        { error: "Invalid or expired magic token" },
        { status: 404 }
      );
    }

    // Check if token has expired
    const expiryDate = new Date(signer.magic_token_expires_at);
    if (expiryDate < new Date()) {
      return NextResponse.json(
        { error: "This signing link has expired" },
        { status: 410 }
      );
    }

    // Check if already signed
    if (signer.status === "signed") {
      return NextResponse.json(
        {
          error: "You have already signed this document",
          alreadySigned: true,
        },
        { status: 400 }
      );
    }

    // Get document details
    const document = Array.isArray(signer.documents)
      ? signer.documents[0]
      : signer.documents;

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Check if it's this signer's turn (sequential signing)
    if (signer.signing_order - 1 !== document.current_signer_index) {
      // Get all signers to show order
      const { data: allSigners } = await supabase
        .from("signers")
        .select("*")
        .eq("document_id", document.id)
        .order("signing_order", { ascending: true });

      const currentSigner = allSigners?.[document.current_signer_index];

      return NextResponse.json(
        {
          error: "It's not your turn to sign yet",
          notYourTurn: true,
          currentSignerOrder: document.current_signer_index + 1,
          currentSignerName: currentSigner?.full_name,
          yourOrder: signer.signing_order,
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      signer: {
        id: signer.id,
        email: signer.email,
        full_name: signer.full_name,
        signing_order: signer.signing_order,
      },
      document: {
        id: document.id,
        title: document.title,
        file_path: document.file_path,
      },
    });
  } catch (error) {
    console.error("Error verifying magic token:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
