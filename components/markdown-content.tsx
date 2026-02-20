"use client";

import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";
import { useMemo, memo } from "react";

// Configure marked for GFM (tables, strikethrough, etc.)
marked.setOptions({
  gfm: true,
  breaks: false,
});

const MarkdownContent = memo(function MarkdownContent({ content }: { content: string }) {
  const html = useMemo(() => {
    const raw = marked.parse(content) as string;
    return DOMPurify.sanitize(raw, {
      ADD_TAGS: ["svg", "path", "circle", "rect", "line", "polyline", "polygon", "text", "g", "defs", "marker", "foreignObject"],
    });
  }, [content]);

  return (
    <div
      className="markdown-content prose prose-sm max-w-none text-foreground"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});

export default MarkdownContent;
