import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/resend/client";

const signSchema = z.object({
  token: z.string(),
  signature_data: z.string(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params;
    const supabase = await createClient();

    // Parse and validate request body
    const body = await request.json();
    const validation = signSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { token, signature_data } = validation.data;

    // Find signer by token
    const { data: signer, error: signerError } = await supabase
      .from("signers")
      .select("*")
      .eq("magic_token", token)
      .eq("document_id", documentId)
      .single();

    if (signerError || !signer) {
      return NextResponse.json(
        { error: "Invalid signing token" },
        { status: 404 }
      );
    }

    // Check if already signed
    if (signer.status === "signed") {
      return NextResponse.json(
        { error: "Document already signed" },
        { status: 400 }
      );
    }

    // Check if token expired
    const expiryDate = new Date(signer.magic_token_expires_at);
    if (expiryDate < new Date()) {
      return NextResponse.json(
        { error: "Signing link has expired" },
        { status: 410 }
      );
    }

    // Get document
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (docError || !document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Verify it's this signer's turn
    if (signer.signing_order - 1 !== document.current_signer_index) {
      return NextResponse.json(
        { error: "Not your turn to sign" },
        { status: 403 }
      );
    }

    // Update signer record
    const { error: updateSignerError } = await supabase
      .from("signers")
      .update({
        status: "signed",
        signature_data,
        signed_at: new Date().toISOString(),
      })
      .eq("id", signer.id);

    if (updateSignerError) {
      console.error("Error updating signer:", updateSignerError);
      return NextResponse.json(
        { error: "Failed to save signature" },
        { status: 500 }
      );
    }

    // Get all signers to check if there are more
    const { data: allSigners, error: allSignersError } = await supabase
      .from("signers")
      .select("*")
      .eq("document_id", documentId)
      .order("signing_order", { ascending: true });

    if (allSignersError || !allSigners) {
      console.error("Error fetching signers:", allSignersError);
      return NextResponse.json(
        { error: "Failed to process signing workflow" },
        { status: 500 }
      );
    }

    const nextSignerIndex = document.current_signer_index + 1;

    // Check if there are more signers
    if (nextSignerIndex < allSigners.length) {
      // Move to next signer
      const { error: updateDocError } = await supabase
        .from("documents")
        .update({
          current_signer_index: nextSignerIndex,
        })
        .eq("id", documentId);

      if (updateDocError) {
        console.error("Error updating document:", updateDocError);
      }

      // Send email to next signer
      const nextSigner = allSigners[nextSignerIndex];
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const signingUrl = `${appUrl}/sign/${nextSigner.magic_token}`;

      try {
        await sendEmail({
          to: nextSigner.email,
          subject: `Your turn to sign "${document.title}"`,
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
                  <h1 style="color: #1a1a1a; margin-top: 0; font-size: 24px;">It's Your Turn to Sign!</h1>
                  <p style="font-size: 16px; margin-bottom: 20px;">
                    Hello ${nextSigner.full_name},
                  </p>
                  <p style="font-size: 16px; margin-bottom: 20px;">
                    The previous signer has completed their signature. It's now your turn to sign <strong>"${document.title}"</strong>.
                  </p>
                  <p style="font-size: 16px; margin-bottom: 30px;">
                    You are signer #${nextSigner.signing_order} in the signing sequence.
                  </p>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${signingUrl}" style="background-color: #0070f3; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 16px; display: inline-block;">
                      Sign Document Now
                    </a>
                  </div>
                  <p style="font-size: 14px; color: #666; margin-top: 30px;">
                    This link will expire in 48 hours.
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
        console.error("Error sending email to next signer:", emailError);
      }

      return NextResponse.json({
        message: "Signature saved successfully",
        nextSigner: {
          order: nextSigner.signing_order,
          name: nextSigner.full_name,
        },
      });
    } else {
      // All signers have signed - mark document as completed
      const { error: completeDocError } = await supabase
        .from("documents")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", documentId);

      if (completeDocError) {
        console.error("Error completing document:", completeDocError);
      }

      // TODO: Send completion emails to all signers and document owner

      return NextResponse.json({
        message: "Document signed successfully",
        completed: true,
      });
    }
  } catch (error) {
    console.error("Error in sign route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
