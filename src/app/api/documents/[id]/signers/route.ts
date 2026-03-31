import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateMagicToken, getMagicTokenExpiry } from "@/lib/utils/magic-token";
import { sendEmail } from "@/lib/resend/client";

const signerSchema = z.object({
  email: z.string().email("Invalid email address"),
  full_name: z.string().min(1, "Name is required"),
});

const addSignersSchema = z.object({
  signers: z.array(signerSchema).min(1, "At least one signer is required"),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params;
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const validation = addSignersSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { signers } = validation.data;

    // Verify document exists and user is the owner
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .eq("owner_id", user.id)
      .single();

    if (docError || !document) {
      return NextResponse.json(
        { error: "Document not found or unauthorized" },
        { status: 404 }
      );
    }

    // Check if document already has signers
    const { data: existingSigners } = await supabase
      .from("signers")
      .select("id")
      .eq("document_id", documentId);

    if (existingSigners && existingSigners.length > 0) {
      return NextResponse.json(
        { error: "Document already has signers" },
        { status: 400 }
      );
    }

    // Create signer records with magic tokens
    const signersToInsert = signers.map((signer, index) => ({
      document_id: documentId,
      email: signer.email,
      full_name: signer.full_name,
      signing_order: index + 1,
      status: "pending",
      magic_token: generateMagicToken(),
      magic_token_expires_at: getMagicTokenExpiry(),
    }));

    const { data: createdSigners, error: insertError } = await supabase
      .from("signers")
      .insert(signersToInsert)
      .select();

    if (insertError) {
      console.error("Error inserting signers:", insertError);
      return NextResponse.json(
        { error: "Failed to add signers" },
        { status: 500 }
      );
    }

    // Update document status to 'pending'
    const { error: updateError } = await supabase
      .from("documents")
      .update({
        status: "pending",
        current_signer_index: 0,
      })
      .eq("id", documentId);

    if (updateError) {
      console.error("Error updating document:", updateError);
    }

    // Send invitation emails (only to the first signer for sequential signing)
    const firstSigner = createdSigners[0];
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const signingUrl = `${appUrl}/sign/${firstSigner.magic_token}`;

    try {
      await sendEmail({
        to: firstSigner.email,
        subject: `You've been invited to sign "${document.title}"`,
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Document Signature Request</title>
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background-color: #f8f9fa; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
                <h1 style="color: #1a1a1a; margin-top: 0; font-size: 24px;">Document Signature Request</h1>
                <p style="font-size: 16px; margin-bottom: 20px;">
                  Hello ${firstSigner.full_name},
                </p>
                <p style="font-size: 16px; margin-bottom: 20px;">
                  You've been invited to sign the document <strong>"${document.title}"</strong>.
                </p>
                <p style="font-size: 16px; margin-bottom: 30px;">
                  You are signer #${firstSigner.signing_order} in the signing sequence.
                </p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${signingUrl}" style="background-color: #0070f3; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 16px; display: inline-block;">
                    Sign Document
                  </a>
                </div>
                <p style="font-size: 14px; color: #666; margin-top: 30px;">
                  This link will expire in 48 hours.
                </p>
                <p style="font-size: 14px; color: #666; margin-top: 10px;">
                  If you didn't expect this email, you can safely ignore it.
                </p>
              </div>
              <div style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">
                <p>Powered by SignrR - Digital Document Signing</p>
              </div>
            </body>
          </html>
        `,
      });
    } catch (emailError) {
      console.error("Error sending invitation email:", emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      message: "Signers added successfully",
      signers: createdSigners,
    });
  } catch (error) {
    console.error("Error in add signers route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
