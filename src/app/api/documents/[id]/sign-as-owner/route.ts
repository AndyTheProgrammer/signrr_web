import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/resend/client";
import { mergeSignaturesOntoPdf } from "@/lib/pdf/signer";

const annotationSchema = z.object({
  type: z.enum(["text", "date"]),
  content: z.string(),
  x: z.number(),
  y: z.number(),
  page: z.number(),
});

const schema = z.object({
  signature_data: z.string(),
  signature_position: z
    .object({ x: z.number(), y: z.number(), page: z.number() })
    .optional(),
  annotations: z.array(annotationSchema).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params;
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

    const { signature_data, signature_position, annotations } = validation.data;

    // Use service client for the DB writes (mirrors sequential sign route)
    const serviceSupabase = createServiceClient();

    // Verify document exists and user is the owner
    const { data: document, error: docError } = await serviceSupabase
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

    if (document.status !== "pending") {
      return NextResponse.json(
        { error: "Document is not pending signatures" },
        { status: 400 }
      );
    }

    // Fetch all signers
    const { data: allSigners, error: allSignersError } = await serviceSupabase
      .from("signers")
      .select("*")
      .eq("document_id", documentId)
      .order("signing_order", { ascending: true });

    if (allSignersError || !allSigners) {
      return NextResponse.json(
        { error: "Failed to fetch signers" },
        { status: 500 }
      );
    }

    const currentSigner = allSigners[document.current_signer_index];

    if (!currentSigner) {
      return NextResponse.json(
        { error: "No current signer found" },
        { status: 400 }
      );
    }

    // Verify this slot belongs to the owner
    if (!currentSigner.is_self) {
      return NextResponse.json(
        { error: "It is not your turn to sign in the sequence" },
        { status: 403 }
      );
    }

    if (currentSigner.status === "signed") {
      return NextResponse.json(
        { error: "You have already signed this document" },
        { status: 400 }
      );
    }

    // Save owner's signature
    const { error: updateError } = await serviceSupabase
      .from("signers")
      .update({
        status: "signed",
        signature_data,
        signature_position: signature_position || null,
        annotations_data: annotations && annotations.length > 0 ? annotations : null,
        signed_at: new Date().toISOString(),
      })
      .eq("id", currentSigner.id);

    if (updateError) {
      console.error("Error saving owner signature:", updateError);
      return NextResponse.json({ error: "Failed to save signature" }, { status: 500 });
    }

    const nextSignerIndex = document.current_signer_index + 1;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    if (nextSignerIndex < allSigners.length) {
      // Advance to next signer
      await serviceSupabase
        .from("documents")
        .update({ current_signer_index: nextSignerIndex })
        .eq("id", documentId);

      const nextSigner = allSigners[nextSignerIndex];

      // Only email if next signer is an external signer
      if (!nextSigner.is_self) {
        const signingUrl = `${appUrl}/sign/${nextSigner.magic_token}`;
        try {
          await sendEmail({
            to: nextSigner.email,
            subject: `Your turn to sign "${document.title}"`,
            html: `
              <body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
                <div style="background:#f8f9fa;border-radius:8px;padding:30px;">
                  <h2 style="margin-top:0;">It's Your Turn to Sign</h2>
                  <p>Hello ${nextSigner.full_name},</p>
                  <p>The previous signer has completed their signature. Please sign <strong>"${document.title}"</strong> now.</p>
                  <div style="text-align:center;margin:30px 0;">
                    <a href="${signingUrl}" style="background:#111;color:white;padding:14px 28px;text-decoration:none;border-radius:6px;font-weight:500;">
                      Sign Document Now
                    </a>
                  </div>
                  <p style="font-size:13px;color:#666;">This link expires in 48 hours.</p>
                </div>
              </body>`,
          });
        } catch (emailError) {
          console.error("Error sending email to next signer:", emailError);
        }
      }

      return NextResponse.json({
        message: "Signature saved successfully",
        nextSigner: nextSigner.is_self
          ? { order: nextSigner.signing_order, name: nextSigner.full_name, isSelf: true }
          : { order: nextSigner.signing_order, name: nextSigner.full_name },
      });
    }

    // All signers done — merge PDF
    let signedFilePath: string | null = null;
    try {
      const signedSigners = allSigners.map((s) => ({
        signature_data:
          s.id === currentSigner.id ? signature_data : s.signature_data,
        signature_position:
          s.id === currentSigner.id
            ? signature_position || null
            : s.signature_position || null,
        annotations:
          s.id === currentSigner.id
            ? annotations || []
            : (s.annotations_data as any[]) || [],
        signing_order: s.signing_order,
        full_name: s.full_name,
      }));
      signedFilePath = await mergeSignaturesOntoPdf(document.file_path, signedSigners);
    } catch (mergeError) {
      console.error("Error merging signatures onto PDF:", mergeError);
    }

    await serviceSupabase
      .from("documents")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        ...(signedFilePath ? { signed_file_path: signedFilePath } : {}),
      })
      .eq("id", documentId);

    // Email owner about completion (they may have been mid-sequence)
    try {
      const { data: ownerProfile } = await serviceSupabase
        .from("user_profiles")
        .select("email, full_name")
        .eq("id", document.owner_id)
        .single();

      if (ownerProfile?.email) {
        const dashboardUrl = `${appUrl}/dashboard/documents/${documentId}`;
        await sendEmail({
          to: ownerProfile.email,
          subject: `"${document.title}" has been fully signed`,
          html: `
            <body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
              <div style="background:#f8f9fa;border-radius:8px;padding:30px;">
                <h2 style="margin-top:0;">Document Fully Signed ✓</h2>
                <p>Hello ${ownerProfile.full_name || "there"},</p>
                <p>All signers have completed their signatures on <strong>"${document.title}"</strong>.</p>
                <div style="text-align:center;margin:30px 0;">
                  <a href="${dashboardUrl}" style="background:#111;color:white;padding:14px 28px;text-decoration:none;border-radius:6px;font-weight:500;">
                    Download Signed Document
                  </a>
                </div>
              </div>
            </body>`,
        });
      }
    } catch (ownerEmailError) {
      console.error("Error sending completion email:", ownerEmailError);
    }

    return NextResponse.json({
      message: "Document signed successfully",
      completed: true,
    });
  } catch (error) {
    console.error("Error in sign-as-owner route:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
