"use client";

import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";
import { useEffect, useRef, useMemo, useState, memo } from "react";

// Configure marked for GFM (tables, strikethrough, etc.)
marked.setOptions({
  gfm: true,
  breaks: false,
});

// Custom renderer to handle mermaid code blocks
const renderer = new marked.Renderer();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const originalCode = renderer.code.bind(renderer) as (token: any) => string;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
renderer.code = function (token: any) {
  if (token.lang === "mermaid") {
    return `<div class="mermaid-block" data-mermaid="${encodeURIComponent(token.text)}"></div>`;
  }
  return originalCode(token);
};

const MarkdownContent = memo(function MarkdownContent({ content }: { content: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [rendering, setRendering] = useState(false);

  const html = useMemo(() => {
    const raw = marked.parse(content, { renderer }) as string;
    // Sanitize HTML to prevent XSS — allow mermaid data attributes and class names
    return DOMPurify.sanitize(raw, {
      ADD_ATTR: ["data-mermaid"],
      ADD_TAGS: ["svg", "path", "circle", "rect", "line", "polyline", "polygon", "text", "g", "defs", "marker", "foreignObject"],
    });
  }, [content]);

  // Check if this content has mermaid blocks
  const hasMermaid = content.includes("```mermaid");

  // After render, find any mermaid blocks and render them
  useEffect(() => {
    if (!ref.current) return;

    // Quick check: if no mermaid blocks exist, skip
    const initialBlocks = ref.current.querySelectorAll(".mermaid-block");
    if (initialBlocks.length === 0) return;

    setRendering(true);

    async function renderMermaid() {
      try {
        const mermaid = (await import("mermaid")).default;
        const isDark = document.documentElement.getAttribute("data-theme") === "dark";
        mermaid.initialize({ startOnLoad: false, theme: isDark ? "dark" : "neutral" });

        // Re-query DOM nodes AFTER the async import to avoid stale references
        if (!ref.current) return;
        const mermaidBlocks = ref.current.querySelectorAll(".mermaid-block");

        for (const block of mermaidBlocks) {
          const code = decodeURIComponent(block.getAttribute("data-mermaid") || "");
          if (!code) continue;
          try {
            const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`;
            const { svg } = await mermaid.render(id, code);
            block.innerHTML = svg;
            block.classList.add("flex", "justify-center", "my-4");
          } catch {
            block.innerHTML = `<pre class="bg-surface-hover rounded-lg p-3 text-xs text-text-tertiary">${code}</pre>`;
          }
        }
      } catch {
        // mermaid failed to load — leave blocks as-is
      } finally {
        setRendering(false);
      }
    }
    renderMermaid();
  }, [html]);

  return (
    <div className="relative">
      {/* Loading skeleton while Mermaid renders */}
      {rendering && hasMermaid && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/80 rounded-lg">
          <div className="flex flex-col items-center gap-2">
            <div className="w-48 h-32 rounded-lg skeleton-shimmer" />
            <span className="text-xs text-text-muted">Rendering diagram...</span>
          </div>
        </div>
      )}
      <div
        ref={ref}
        className="markdown-content prose prose-sm max-w-none text-foreground"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
});

export default MarkdownContent;
