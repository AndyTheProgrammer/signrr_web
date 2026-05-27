import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only fetch signer records where:
    //  - email matches the logged-in user
    //  - the signer hasn't signed yet (status = pending)
    //  - the document is still active (status = pending) via !inner join
    const { data: signerRecords, error: signerError } = await supabase
      .from("signers")
      .select(`
        id,
        email,
        full_name,
        signing_order,
        status,
        signed_at,
        magic_token,
        documents:document_id!inner (
          id,
          title,
          status,
          signing_mode,
          current_signer_index,
          created_at,
          signers (
            id,
            signing_order,
            status,
            full_name,
            email
          )
        )
      `)
      .eq("email", user.email)
      .eq("status", "pending")
      .eq("documents.status", "pending")
      .order("created_at", { ascending: true, referencedTable: "documents" });

    if (signerError) {
      console.error("Database error:", signerError);
      return NextResponse.json({ error: "Failed to fetch documents to sign" }, { status: 500 });
    }

    const documentsToSign = (signerRecords || [])
      .map((record) => {
        const doc = Array.isArray(record.documents) ? record.documents[0] : record.documents;
        if (!doc) return null;

        const allSigners = ((doc as any).signers as any[] || []).sort(
          (a, b) => a.signing_order - b.signing_order
        );
        const currentSignerIndex: number = (doc as any).current_signer_index;
        const isMyTurn = record.signing_order - 1 === currentSignerIndex;
        const currentSigner = allSigners[currentSignerIndex];

        return {
          id: (doc as any).id as string,
          title: (doc as any).title as string,
          signing_mode: (doc as any).signing_mode as string,
          created_at: (doc as any).created_at as string,
          signing_order: record.signing_order as number,
          total_signers: allSigners.length,
          signed_count: allSigners.filter((s) => s.status === "signed").length,
          current_signer_name: (currentSigner?.full_name || currentSigner?.email || null) as string | null,
          magic_token: record.magic_token as string | null,
          is_my_turn: isMyTurn,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ documents: documentsToSign });
  } catch (error) {
    console.error("Error fetching documents to sign:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
