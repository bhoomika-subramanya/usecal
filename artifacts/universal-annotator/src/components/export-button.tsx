import { useState } from "react";
import { Download, FileText, FileSpreadsheet, File } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { jsPDF } from "jspdf";

export function ExportButton() {
  const [isExporting, setIsExporting] = useState(false);

  const fetchAnnotations = async () => {
    const res = await fetch("http://localhost:3001/api/annotations");
    if (!res.ok) throw new Error("Failed to fetch notes for export");
    return res.json();
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const data = await fetchAnnotations();
      if (!data || data.length === 0) return;
      
      const headers = ["id", "title", "type", "content", "tags", "sourceUrl", "createdAt"];
      let csv = headers.join(",") + "\n";
      
      data.forEach((note: any) => {
        const row = headers.map(header => {
          let val = note[header] || "";
          if (Array.isArray(val)) val = val.join("; ");
          // Escape quotes and wrap in quotes to handle commas/newlines in content
          return `"${String(val).replace(/"/g, '""')}"`;
        });
        csv += row.join(",") + "\n";
      });
      
      downloadFile(csv, "notes_export.csv", "text/csv");
    } catch (err) {
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportMarkdown = async () => {
    setIsExporting(true);
    try {
      const data = await fetchAnnotations();
      if (!data || data.length === 0) return;
      let md = "# My Annotations & Notes\n\n";
      data.forEach((note: any) => {
        md += `## ${note.title || "Untitled"}\n`;
        md += `**Type:** ${note.type} | **Date:** ${new Date(note.createdAt).toLocaleString()}\n`;
        if (note.sourceUrl) md += `**Source:** [${note.sourceTitle || note.sourceUrl}](${note.sourceUrl})\n`;
        if (note.tags && note.tags.length > 0) md += `**Tags:** ${note.tags.join(", ")}\n`;
        md += `\n${note.content}\n\n---\n\n`;
      });
      downloadFile(md, "notes_export.md", "text/markdown");
    } catch (err) {
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const data = await fetchAnnotations();
      if (!data || data.length === 0) return;
      
      const doc = new jsPDF();
      let yOffset = 10;
      const pageHeight = doc.internal.pageSize.height;

      doc.setFontSize(18);
      doc.text("My Annotations", 10, yOffset);
      yOffset += 10;

      doc.setFontSize(12);
      data.forEach((note: any) => {
        if (yOffset > pageHeight - 20) {
          doc.addPage();
          yOffset = 10;
        }
        
        doc.setFontSize(14);
        doc.text(note.title || "Untitled", 10, yOffset);
        yOffset += 6;
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Type: ${note.type} | Tags: ${note.tags?.join(", ") || "none"}`, 10, yOffset);
        yOffset += 6;
        doc.setTextColor(0);
        
        // Content
        const splitText = doc.splitTextToSize(note.content || "", 180);
        doc.text(splitText, 10, yOffset);
        yOffset += (splitText.length * 5) + 10;
      });

      doc.save("notes_export.pdf");
    } catch (err) {
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" disabled={isExporting} title="Export Notes">
          <Download className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleExportCSV} className="cursor-pointer">
          <FileSpreadsheet className="w-4 h-4 mr-2" /> Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportMarkdown} className="cursor-pointer">
          <FileText className="w-4 h-4 mr-2" /> Export as Markdown
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportPDF} className="cursor-pointer">
          <File className="w-4 h-4 mr-2" /> Export as PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
