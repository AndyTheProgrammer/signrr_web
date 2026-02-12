import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find signer records for this user's email
    const { data: signerRecords, error: signerError } = await supabase
      .from("signers")
      .select(
        `
        id,
        email,
        full_name,
        signing_order,
        status,
        signed_at,
        magic_token,
        documents:document_id (
          id,
          title,
          status,
          signing_mode,
          current_signer_index,
          created_at
        )
      `
      )
      .eq("email", user.email)
      .order("signing_order", { ascending: true });

    if (signerError) {
      console.error("Database error:", signerError);
      return NextResponse.json(
        { error: "Failed to fetch documents to sign" },
        { status: 500 }
      );
    }

    // Transform into a cleaner format
    const documentsToSign = (signerRecords || [])
      .map((record) => {
        const doc = Array.isArray(record.documents)
          ? record.documents[0]
          : record.documents;

        if (!doc) return null;

        const isMyTurn =
          record.signing_order - 1 === (doc as any).current_signer_index;

        return {
          id: (doc as any).id,
          title: (doc as any).title,
          document_status: (doc as any).status,
          signing_mode: (doc as any).signing_mode,
          created_at: (doc as any).created_at,
          signer_status: record.status,
          signing_order: record.signing_order,
          signed_at: record.signed_at,
          magic_token: record.magic_token,
          is_my_turn: isMyTurn,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ documents: documentsToSign });
  } catch (error) {
    console.error("Error fetching documents to sign:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}
