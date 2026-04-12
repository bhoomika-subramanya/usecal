import { Router, type IRouter } from "express";
import { eq, desc, and, sql, or, ilike } from "drizzle-orm";
import { db, annotationsTable } from "@workspace/db";
import {
  ListAnnotationsQueryParams,
  CreateAnnotationBody,
  GetAnnotationParams,
  GetAnnotationResponse,
  UpdateAnnotationParams,
  UpdateAnnotationBody,
  DeleteAnnotationParams,
  ToggleAnnotationPinParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/annotations", async (req, res): Promise<void> => {
  const parsed = ListAnnotationsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { tag, type, search, pinned } = parsed.data;

  const conditions = [];

  if (type) {
    conditions.push(eq(annotationsTable.type, type));
  }

  if (pinned !== undefined) {
    conditions.push(eq(annotationsTable.isPinned, pinned === "true"));
  }

  if (search) {
    conditions.push(
      or(
        ilike(annotationsTable.title, `%${search}%`),
        ilike(annotationsTable.content, `%${search}%`),
      )
    );
  }

  let annotations = await db
    .select()
    .from(annotationsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(annotationsTable.updatedAt));

  if (tag) {
    annotations = annotations.filter((a) => a.tags.includes(tag));
  }

  res.json(annotations);
});

router.post("/annotations", async (req, res): Promise<void> => {
  const parsed = CreateAnnotationBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid annotation body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { type, color, tags, ...rest } = parsed.data;

  const typeColorMap: Record<string, string> = {
    text: "#FACC15",
    highlight: "#4ADE80",
    drawing: "#60A5FA",
    link: "#C084FC",
  };

  const [annotation] = await db
    .insert(annotationsTable)
    .values({
      ...rest,
      type: type ?? "text",
      color: color ?? typeColorMap[type ?? "text"] ?? "#FACC15",
      tags: tags ?? [],
    })
    .returning();

  res.status(201).json(annotation);
});

router.get("/annotations/stats", async (_req, res): Promise<void> => {
  const annotations = await db.select().from(annotationsTable);

  const byType = { text: 0, highlight: 0, drawing: 0, link: 0 };
  let pinned = 0;

  for (const a of annotations) {
    if (a.type in byType) {
      byType[a.type as keyof typeof byType]++;
    }
    if (a.isPinned) pinned++;
  }

  const tagsResult = await db
    .select({ tags: annotationsTable.tags })
    .from(annotationsTable);

  const allTags = new Set<string>();
  for (const row of tagsResult) {
    for (const t of row.tags) allTags.add(t);
  }

  res.json({
    total: annotations.length,
    byType,
    pinned,
    totalTags: allTags.size,
  });
});

router.get("/annotations/recent", async (req, res): Promise<void> => {
  const limitRaw = req.query.limit;
  const limit = limitRaw ? Math.min(parseInt(String(limitRaw), 10) || 10, 50) : 10;

  const annotations = await db
    .select()
    .from(annotationsTable)
    .orderBy(desc(annotationsTable.updatedAt))
    .limit(limit);

  res.json(annotations);
});

router.get("/annotations/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetAnnotationParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [annotation] = await db
    .select()
    .from(annotationsTable)
    .where(eq(annotationsTable.id, params.data.id));

  if (!annotation) {
    res.status(404).json({ error: "Annotation not found" });
    return;
  }

  res.json(GetAnnotationResponse.parse(annotation));
});

router.patch("/annotations/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateAnnotationParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpdateAnnotationBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const updateData: Record<string, unknown> = { ...body.data };
  updateData.updatedAt = new Date();

  const [annotation] = await db
    .update(annotationsTable)
    .set(updateData)
    .where(eq(annotationsTable.id, params.data.id))
    .returning();

  if (!annotation) {
    res.status(404).json({ error: "Annotation not found" });
    return;
  }

  res.json(annotation);
});

router.delete("/annotations/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteAnnotationParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(annotationsTable)
    .where(eq(annotationsTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Annotation not found" });
    return;
  }

  res.sendStatus(204);
});

router.patch("/annotations/:id/pin", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = ToggleAnnotationPinParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(annotationsTable)
    .where(eq(annotationsTable.id, params.data.id));

  if (!existing) {
    res.status(404).json({ error: "Annotation not found" });
    return;
  }

  const [annotation] = await db
    .update(annotationsTable)
    .set({ isPinned: !existing.isPinned, updatedAt: new Date() })
    .where(eq(annotationsTable.id, params.data.id))
    .returning();

  res.json(annotation);
});

export default router;
