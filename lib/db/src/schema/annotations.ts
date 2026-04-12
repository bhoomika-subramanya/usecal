import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const annotationsTable = pgTable("annotations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  type: text("type").notNull().default("text"),
  color: text("color").notNull().default("#FACC15"),
  sourceUrl: text("source_url"),
  sourceTitle: text("source_title"),
  sourceApp: text("source_app"),
  sourceWindowTitle: text("source_window_title"),
  localFilePath: text("local_file_path"),
  osTagsSynced: boolean("os_tags_synced").notNull().default(false),
  isPinned: boolean("is_pinned").notNull().default(false),
  tags: text("tags").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAnnotationSchema = createInsertSchema(annotationsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAnnotation = z.infer<typeof insertAnnotationSchema>;
export type Annotation = typeof annotationsTable.$inferSelect;
