import { Router, type IRouter } from "express";
import { db, tagsTable, annotationsTable } from "@workspace/db";
import { CreateTagBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/tags", async (_req, res): Promise<void> => {
  const tags = await db.select().from(tagsTable);

  const annotations = await db.select({ tags: annotationsTable.tags }).from(annotationsTable);

  const countMap: Record<string, number> = {};
  for (const row of annotations) {
    for (const tag of row.tags) {
      countMap[tag] = (countMap[tag] ?? 0) + 1;
    }
  }

  const enriched = tags.map((tag) => ({
    ...tag,
    annotationCount: countMap[tag.name] ?? 0,
  }));

  res.json(enriched);
});

router.post("/tags", async (req, res): Promise<void> => {
  const parsed = CreateTagBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [tag] = await db
    .insert(tagsTable)
    .values({
      name: parsed.data.name,
      color: parsed.data.color ?? "#6366F1",
    })
    .returning();

  res.status(201).json({ ...tag, annotationCount: 0 });
});

export default router;
