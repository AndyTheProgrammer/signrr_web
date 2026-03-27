import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("id, owner_id, status")
      .eq("id", documentId)
      .single();

    if (docError || !document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (document.owner_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (document.status !== "pending") {
      return NextResponse.json(
        { error: "Only pending documents can be cancelled" },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from("documents")
      .update({ status: "cancelled" })
      .eq("id", documentId);

    if (updateError) {
      console.error("Error cancelling document:", updateError);
      return NextResponse.json({ error: "Failed to cancel document" }, { status: 500 });
    }

    return NextResponse.json({ message: "Document cancelled successfully" });
  } catch (error) {
    console.error("Error in cancel route:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
