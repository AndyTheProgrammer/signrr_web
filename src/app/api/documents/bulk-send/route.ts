import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { inngest } from "@/inngest/client";

const sendItemSchema = z.object({
  documentId: z.string(),
  email: z.string().email("Invalid email address"),
});

const schema = z.object({
  sends: z.array(sendItemSchema).min(1).max(500),
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

    const { sends } = validation.data;

    // Verify ownership of all documents in a single query — fast and secure.
    // We do this here (in the authenticated API route) so the Inngest function
    // can trust the payload it receives without re-checking ownership.
    const { data: documents } = await supabase
      .from("documents")
      .select("id, status, signed_file_path")
      .in("id", sends.map((s) => s.documentId))
      .eq("owner_id", user.id);

    const ownedIds = new Set((documents ?? []).map((d) => d.id));
    const unauthorised = sends.filter((s) => !ownedIds.has(s.documentId));

    if (unauthorised.length > 0) {
      return NextResponse.json(
        { error: "One or more documents were not found or do not belong to you" },
        { status: 403 }
      );
    }

    // Enqueue — Inngest picks this up immediately and runs it in the background.
    // This call returns in milliseconds regardless of how many emails need sending.
    await inngest.send({
      name: "email/bulk.send",
      data: { sends },
    });

    return NextResponse.json({
      queued: true,
      count: sends.length,
      message: `${sends.length} email${sends.length !== 1 ? "s" : ""} queued for delivery`,
    });
  } catch (error) {
    console.error("Error queuing bulk email send:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
