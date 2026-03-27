import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/resend/client";
import crypto from "crypto";

const resendSchema = z.object({
  signer_id: z.string().uuid(),
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

    // Generate fresh token with 48h expiry
    const newToken = crypto.randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    const { error: updateError } = await supabase
      .from("signers")
      .update({
        magic_token: newToken,
        magic_token_expires_at: expiresAt,
      })
      .eq("id", signer_id);

    if (updateError) {
      console.error("Error updating token:", updateError);
      return NextResponse.json({ error: "Failed to regenerate link" }, { status: 500 });
    }

    // Send email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const signingUrl = `${appUrl}/sign/${newToken}`;

    await sendEmail({
      to: signer.email,
      subject: `Reminder: Please sign "${document.title}"`,
      html: `
        <body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
          <div style="background:#f8f9fa;border-radius:8px;padding:30px;">
            <h2 style="margin-top:0;">Signing Reminder</h2>
            <p>Hello ${signer.full_name},</p>
            <p>You have been sent a new signing link for <strong>"${document.title}"</strong>.</p>
            <div style="text-align:center;margin:30px 0;">
              <a href="${signingUrl}" style="background:#111;color:white;padding:14px 28px;text-decoration:none;border-radius:6px;font-weight:500;">
                Sign Document Now
              </a>
            </div>
            <p style="font-size:13px;color:#666;">This link expires in 48 hours. Any previous links are now invalid.</p>
          </div>
        </body>`,
    });

    return NextResponse.json({ message: "Signing link resent successfully" });
  } catch (error) {
    console.error("Error in resend route:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
