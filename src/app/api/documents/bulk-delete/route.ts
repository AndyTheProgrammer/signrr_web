import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(request: NextRequest) {
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
    const { ids } = body as { ids?: string[] };

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids must be a non-empty array." }, { status: 400 });
    }

    // Fetch matching documents owned by the user to get file paths
    const { data: docs, error: fetchError } = await supabase
      .from("documents")
      .select("id, file_path")
      .in("id", ids)
      .eq("owner_id", user.id);

    if (fetchError) {
      console.error("Database error:", fetchError);
      return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 });
    }

    if (!docs || docs.length === 0) {
      return NextResponse.json({ deleted: 0 });
    }

    // Delete files from storage
    const filePaths = docs.map((d) => d.file_path).filter(Boolean);
    if (filePaths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from("documents")
        .remove(filePaths);
      if (storageError) {
        console.error("Storage error:", storageError);
      }
    }

    // Delete from database (cascades to signers)
    const ownedIds = docs.map((d) => d.id);
    const { error: deleteError } = await supabase
      .from("documents")
      .delete()
      .in("id", ownedIds)
      .eq("owner_id", user.id);

    if (deleteError) {
      console.error("Database error:", deleteError);
      return NextResponse.json({ error: "Failed to delete documents" }, { status: 500 });
    }

    return NextResponse.json({ deleted: docs.length });
  } catch (error) {
    console.error("Error in bulk delete:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
