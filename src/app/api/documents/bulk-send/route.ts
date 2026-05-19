import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/resend/client";

const sendItemSchema = z.object({
  documentId: z.string(),
  email: z.string().email("Invalid email address"),
});

const schema = z.object({
  sends: z.array(sendItemSchema).min(1).max(50),
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
    const serviceClient = createServiceClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // Fetch all referenced documents in one query to verify ownership
    const { data: documents } = await supabase
      .from("documents")
      .select("*")
      .in("id", sends.map((s) => s.documentId))
      .eq("owner_id", user.id);

    const docMap = new Map((documents ?? []).map((d) => [d.id, d]));

    const results: Array<{
      documentId: string;
      email: string;
      success: boolean;
      error?: string;
    }> = [];

    for (const { documentId, email } of sends) {
      const doc = docMap.get(documentId);

      if (!doc) {
        results.push({ documentId, email, success: false, error: "Document not found or access denied" });
        continue;
      }

      if (doc.status !== "completed" || !doc.signed_file_path) {
        results.push({ documentId, email, success: false, error: "Document has no signed PDF" });
        continue;
      }

      try {
        const { data: fileData, error: downloadError } = await serviceClient.storage
          .from("documents")
          .download(doc.signed_file_path);

        if (downloadError || !fileData) {
          throw new Error("Failed to retrieve signed PDF");
        }

        const pdfBuffer = Buffer.from(await fileData.arrayBuffer());
        const safeTitle = doc.title.replace(/[^a-z0-9]/gi, "_");

        await sendEmail({
          to: email,
          subject: `Signed document: "${doc.title}"`,
          html: `
            <!DOCTYPE html>
            <html>
              <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#1a1a1a;">
                <div style="background:#f8f9fa;border-radius:12px;padding:32px;margin-bottom:16px;">
                  <h2 style="margin-top:0;font-size:20px;color:#111;">Signed Document</h2>
                  <p style="font-size:15px;color:#444;margin-bottom:8px;">
                    You've received a signed copy of
                    <strong style="color:#111;">"${doc.title}"</strong>.
                  </p>
                  <p style="font-size:14px;color:#666;margin-bottom:0;">
                    The signed PDF is attached to this email.
                  </p>
                </div>
                <p style="text-align:center;font-size:12px;color:#999;margin:0;">
                  Sent via <a href="${appUrl}" style="color:#666;text-decoration:none;">SignrR</a>
                </p>
              </body>
            </html>
          `,
          attachments: [
            {
              filename: `${safeTitle}_signed.pdf`,
              content: pdfBuffer,
            },
          ],
        });

        results.push({ documentId, email, success: true });
      } catch (err: any) {
        console.error(`Error sending document ${documentId}:`, err);
        results.push({
          documentId,
          email,
          success: false,
          error: err.message ?? "Send failed",
        });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Error in bulk-send route:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
