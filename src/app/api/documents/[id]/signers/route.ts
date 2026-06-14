import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateMagicToken, getMagicTokenExpiry } from "@/lib/utils/magic-token";
import { sendEmail } from "@/lib/resend/client";
import { signingInvitationEmail } from "@/lib/resend/templates";

const signerSchema = z.object({
  email: z.string().email("Invalid email address"),
  full_name: z.string().min(1, "Name is required"),
  is_self: z.boolean().optional().default(false),
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

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    const signersToInsert = signers.map((signer, index) => ({
      document_id: documentId,
      email: signer.email,
      full_name: signer.full_name,
      signing_order: index + 1,
      status: "pending",
      is_self: signer.is_self ?? false,
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

    await supabase
      .from("documents")
      .update({ status: "pending", current_signer_index: 0 })
      .eq("id", documentId);

    // Send invitation email only to the first signer if they are not the owner
    const firstSigner = createdSigners[0];
    if (!firstSigner.is_self) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const signingUrl = `${appUrl}/sign/${firstSigner.magic_token}`;
      try {
        await sendEmail({
          to: firstSigner.email,
          subject: `You've been invited to sign "${document.title}"`,
          html: signingInvitationEmail(
            firstSigner.full_name ?? firstSigner.email,
            document.title,
            signingUrl,
            firstSigner.signing_order
          ),
        });
      } catch (emailError) {
        console.error("Error sending invitation email:", emailError);
      }
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
