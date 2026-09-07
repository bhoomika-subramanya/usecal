import { Router, type Request, type Response } from "express";
import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

const router = Router();

// Initialize the Gemini client
// It automatically picks up GEMINI_API_KEY from process.env
let ai: GoogleGenAI | null = null;
try {
  ai = new GoogleGenAI();
} catch (err) {
  console.warn("Failed to initialize GoogleGenAI. Is GEMINI_API_KEY set?");
}

router.post("/tags", async (req: Request, res: Response) => {
  if (!ai) {
    return res.status(500).json({ error: "AI is not configured. Please set GEMINI_API_KEY." });
  }

  try {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ error: "Content is required" });
    }

    const prompt = `Analyze the following text and generate 1 to 5 relevant, concise tags (one or two words each). Return ONLY a JSON array of strings. No markdown formatting, no explanation, just the raw JSON array. \n\nText: ${content}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const text = response.text || "[]";
    // Strip markdown formatting if the model still returns it
    const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const tags = JSON.parse(cleanText);

    res.json({ tags });
  } catch (error) {
    console.error("Auto-tag error:", error);
    res.status(500).json({ error: "Failed to generate tags" });
  }
});

router.post("/summarize", async (req: Request, res: Response) => {
  if (!ai) {
    return res.status(500).json({ error: "AI is not configured. Please set GEMINI_API_KEY." });
  }

  try {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ error: "Content is required" });
    }

    const prompt = `Summarize the following text in 1-2 concise, clear sentences. \n\nText: ${content}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    res.json({ summary: response.text?.trim() });
  } catch (error) {
    console.error("Summarize error:", error);
    res.status(500).json({ error: "Failed to generate summary" });
  }
});

export default router;
