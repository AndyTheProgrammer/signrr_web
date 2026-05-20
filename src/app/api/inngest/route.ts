import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { bulkEmailSend } from "@/inngest/functions/bulk-email";
import { bulkSign } from "@/inngest/functions/bulk-sign";

// This route is how Inngest discovers and invokes your functions.
// It must be publicly reachable (no auth middleware blocking it).
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [bulkEmailSend, bulkSign],
});
