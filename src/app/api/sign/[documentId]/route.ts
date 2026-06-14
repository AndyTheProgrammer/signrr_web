import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/resend/client";
import { mergeSignaturesOntoPdf } from "@/lib/pdf/signer";
import { yourTurnToSignEmail, documentCompletedEmail } from "@/lib/resend/templates";

const annotationSchema = z.object({
  type: z.enum(["text", "date"]),
  content: z.string(),
  x: z.number(),
  y: z.number(),
  page: z.number(),
});

const signSchema = z.object({
  token: z.string(),
  signature_data: z.string(),
  signature_position: z
    .object({ x: z.number(), y: z.number(), page: z.number() })
    .optional(),
  annotations: z.array(annotationSchema).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params;
    // Use service client so RLS doesn't block unauthenticated magic-link signers
    const supabase = createServiceClient();

    const body = await request.json();
    const validation = signSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { token, signature_data, signature_position, annotations } =
      validation.data;

    // Find signer by token
    const { data: signer, error: signerError } = await supabase
      .from("signers")
      .select("*")
      .eq("magic_token", token)
      .eq("document_id", documentId)
      .single();

    if (signerError || !signer) {
      return NextResponse.json({ error: "Invalid signing token" }, { status: 404 });
    }

    if (signer.status === "signed") {
      return NextResponse.json({ error: "Document already signed" }, { status: 400 });
    }

    if (new Date(signer.magic_token_expires_at) < new Date()) {
      return NextResponse.json({ error: "Signing link has expired" }, { status: 410 });
    }

    // Get document
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (docError || !document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (signer.signing_order - 1 !== document.current_signer_index) {
      return NextResponse.json({ error: "Not your turn to sign" }, { status: 403 });
    }

    // Save signature + annotations on signer record
    const { error: updateSignerError } = await supabase
      .from("signers")
      .update({
        status: "signed",
        signature_data,
        signature_position: signature_position || null,
        annotations_data: annotations && annotations.length > 0 ? annotations : null,
        signed_at: new Date().toISOString(),
      })
      .eq("id", signer.id);

    if (updateSignerError) {
      console.error("Error updating signer:", updateSignerError);
      return NextResponse.json({ error: "Failed to save signature" }, { status: 500 });
    }

    // Fetch all signers
    const { data: allSigners, error: allSignersError } = await supabase
      .from("signers")
      .select("*")
      .eq("document_id", documentId)
      .order("signing_order", { ascending: true });

    if (allSignersError || !allSigners) {
      return NextResponse.json(
        { error: "Failed to process signing workflow" },
        { status: 500 }
      );
    }

    const nextSignerIndex = document.current_signer_index + 1;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    if (nextSignerIndex < allSigners.length) {
      // ── More signers remain — advance to next ──
      await supabase
        .from("documents")
        .update({ current_signer_index: nextSignerIndex })
        .eq("id", documentId);

      const nextSigner = allSigners[nextSignerIndex];

      // Only email external signers — the owner sees a dashboard prompt
      if (!nextSigner.is_self) {
        const signingUrl = `${appUrl}/sign/${nextSigner.magic_token}`;
        try {
          await sendEmail({
            to: nextSigner.email,
            subject: `Your turn to sign "${document.title}"`,
            html: yourTurnToSignEmail(
              nextSigner.full_name ?? nextSigner.email,
              document.title,
              signingUrl
            ),
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
    } else {
      // ── All signers done — merge PDF ──
      let signedFilePath: string | null = null;
      try {
        const signedSigners = allSigners.map((s) => ({
          signature_data: s.id === signer.id ? signature_data : s.signature_data,
          signature_position:
            s.id === signer.id
              ? signature_position || null
              : s.signature_position || null,
          annotations:
            s.id === signer.id
              ? annotations || []
              : (s.annotations_data as any[]) || [],
          signing_order: s.signing_order,
          full_name: s.full_name,
        }));

        signedFilePath = await mergeSignaturesOntoPdf(document.file_path, signedSigners);
      } catch (mergeError) {
        console.error("Error merging signatures onto PDF:", mergeError);
      }

      await supabase
        .from("documents")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          ...(signedFilePath ? { signed_file_path: signedFilePath } : {}),
        })
        .eq("id", documentId);

      // ── Email document owner ──
      try {
        const { data: ownerProfile } = await supabase
          .from("user_profiles")
          .select("email, full_name")
          .eq("id", document.owner_id)
          .single();

        if (ownerProfile?.email) {
          const dashboardUrl = `${appUrl}/dashboard/documents/${documentId}`;
          await sendEmail({
            to: ownerProfile.email,
            subject: `"${document.title}" has been fully signed`,
            html: documentCompletedEmail(
              ownerProfile.full_name ?? "",
              document.title,
              dashboardUrl
            ),
          });
        }
      } catch (ownerEmailError) {
        console.error("Error sending completion email to owner:", ownerEmailError);
      }

      return NextResponse.json({ message: "Document signed successfully", completed: true });
    }
  } catch (error) {
    console.error("Error in sign route:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
