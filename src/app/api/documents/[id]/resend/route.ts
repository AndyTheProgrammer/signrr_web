import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/resend/client";
import { generateMagicToken, getMagicTokenExpiry } from "@/lib/utils/magic-token";
import { signingReminderEmail } from "@/lib/resend/templates";

const resendSchema = z.object({
  signer_id: z.uuid(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params;
    const supabase = await createClient();

    // Verify caller is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify caller owns the document
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("id, title, owner_id, status")
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
        { error: "Can only resend for documents with pending status" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validation = resendSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: "Invalid signer ID" }, { status: 400 });
    }

    const { signer_id } = validation.data;

    // Fetch the signer
    const { data: signer, error: signerError } = await supabase
      .from("signers")
      .select("*")
      .eq("id", signer_id)
      .eq("document_id", documentId)
      .single();

    if (signerError || !signer) {
      return NextResponse.json({ error: "Signer not found" }, { status: 404 });
    }

    if (signer.status === "signed") {
      return NextResponse.json(
        { error: "Signer has already signed" },
        { status: 400 }
      );
    }

    // Guard: is_self signers sign via the dashboard, not email
    if (signer.is_self) {
      return NextResponse.json(
        { error: "This signer uses the dashboard to sign — no email is needed" },
        { status: 400 }
      );
    }

    // Always regenerate — guarantees a fresh 48-hour link and invalidates any
    // previous links the signatory may still have in their inbox.
    const newToken = generateMagicToken();
    const newExpiry = getMagicTokenExpiry();

    // Use the service client for this update: the only RLS UPDATE policy on
    // signers requires email = auth.email() (signer self-update), so the
    // authenticated owner client would silently update 0 rows.
    const serviceSupabase = createServiceClient();
    const { error: updateError } = await serviceSupabase
      .from("signers")
      .update({ magic_token: newToken, magic_token_expires_at: newExpiry })
      .eq("id", signer_id);

    if (updateError) {
      console.error("Error regenerating token:", updateError);
      return NextResponse.json({ error: "Failed to regenerate link" }, { status: 500 });
    }

    // Send email and check the result (sendEmail never throws — it returns success/failure)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const signingUrl = `${appUrl}/sign/${newToken}`;

    const result = await sendEmail({
      to: signer.email,
      subject: `Reminder: Please sign "${document.title}"`,
      html: signingReminderEmail(
        signer.full_name ?? signer.email,
        document.title,
        signingUrl
      ),
    });

    if (!result.success) {
      console.error("Failed to send resend email:", result.error);
      return NextResponse.json(
        { error: "Failed to send email — please try again" },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Signing link resent successfully" });
  } catch (error) {
    console.error("Error in resend route:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
