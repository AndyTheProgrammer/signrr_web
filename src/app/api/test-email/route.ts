import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/resend/client";

export async function GET() {
  try {
    console.log("Testing email with Resend...");
    console.log("RESEND_API_KEY exists:", !!process.env.RESEND_API_KEY);
    console.log("RESEND_FROM_EMAIL:", process.env.RESEND_FROM_EMAIL);

    const result = await sendEmail({
      to: "wilson.simwanza@byte-hub.co", // Send to yourself for testing
      subject: "Test Email from SignrR",
      html: `
        <h1>Test Email</h1>
        <p>If you're reading this, email sending is working!</p>
        <p>Sent at: ${new Date().toLocaleString()}</p>
      `,
    });

    console.log("Email result:", result);

    return NextResponse.json({
      success: result.success,
      message: result.success ? "Email sent successfully!" : "Email failed to send",
      details: result,
    });
  } catch (error) {
    console.error("Test email error:", error);
    return NextResponse.json(
      { error: "Failed to send test email", details: error },
      { status: 500 }
    );
  }
}
