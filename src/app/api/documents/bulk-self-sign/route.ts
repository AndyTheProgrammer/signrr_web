import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { inngest } from "@/inngest/client";

const positionSchema = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  width: z.number().min(1).max(100).optional(),
});

const placementSchema = z.object({
  page: z.number().int().positive(),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  width: z.number().min(1).max(100).optional(),
});

const schema = z.object({
  documentIds: z.array(z.string()).min(1).max(500),
  signature_data: z.string().min(1),
  placement_mode: z.enum(["all-pages", "specific-pages"]),
  position: positionSchema.optional(),
  placements: z.array(placementSchema).optional(),
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

    const { documentIds, signature_data, placement_mode, position, placements } =
      validation.data;

    if (placement_mode === "all-pages" && !position) {
      return NextResponse.json(
        { error: "Position required for all-pages mode" },
        { status: 400 }
      );
    }
    if (placement_mode === "specific-pages" && (!placements || placements.length === 0)) {
      return NextResponse.json(
        { error: "At least one placement required for specific-pages mode" },
        { status: 400 }
      );
    }

    // Create a job record — Inngest will update it to 'completed' when done
    const { data: job, error: jobError } = await supabase
      .from("bulk_sign_jobs")
      .insert({ owner_id: user.id, total: documentIds.length })
      .select("id")
      .single();

    if (jobError || !job) {
      console.error("Failed to create bulk sign job:", jobError);
      return NextResponse.json({ error: "Failed to create signing job" }, { status: 500 });
    }

    await inngest.send({
      name: "document/bulk.sign",
      data: {
        jobId: job.id,
        documentIds,
        signature_data,
        placement_mode,
        position,
        placements,
        ownerId: user.id,
      },
    });

    return NextResponse.json({ jobId: job.id, total: documentIds.length });
  } catch (error) {
    console.error("Error queuing bulk sign job:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
