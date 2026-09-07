import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface MarkdownRendererProps {
  content: string
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none text-foreground break-words overflow-hidden">
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node, ...props }) => (
            <a {...props} className="text-primary underline decoration-primary/50 hover:decoration-primary underline-offset-4" target="_blank" rel="noreferrer" />
          ),
          img: ({ node, ...props }) => (
            <img {...props} className="rounded-md max-w-full h-auto border border-border my-2" loading="lazy" />
          ),
          p: ({ node, ...props }) => (
            <p {...props} className="leading-relaxed mb-2 last:mb-0" />
          ),
          ul: ({ node, ...props }) => (
            <ul {...props} className="list-disc pl-5 mb-2 last:mb-0" />
          ),
          ol: ({ node, ...props }) => (
            <ol {...props} className="list-decimal pl-5 mb-2 last:mb-0" />
          ),
          li: ({ node, ...props }) => (
            <li {...props} className="mb-1" />
          ),
          pre: ({ node, ...props }) => (
            <pre {...props} className="bg-muted p-2 rounded-md overflow-x-auto my-2 border border-border text-xs" />
          ),
          code: ({ node, inline, ...props }: any) => 
            inline ? (
              <code {...props} className="bg-muted px-1.5 py-0.5 rounded-md text-[13px] font-mono border border-border" />
            ) : (
              <code {...props} className="font-mono" />
            ),
          blockquote: ({ node, ...props }) => (
            <blockquote {...props} className="border-l-2 border-primary/50 pl-4 italic text-muted-foreground my-2" />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
