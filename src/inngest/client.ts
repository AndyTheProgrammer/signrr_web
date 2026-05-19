import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "signrr-web",
  // INNGEST_EVENT_KEY is read automatically from the environment in production.
  // In local dev, the Inngest Dev Server handles key verification for you.
});
