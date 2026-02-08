"use client";

import { marked } from "marked";
import { useEffect, useRef, useMemo } from "react";

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

export default function MarkdownContent({ content }: { content: string }) {
  const ref = useRef<HTMLDivElement>(null);

  const html = useMemo(() => {
    return marked.parse(content, { renderer }) as string;
  }, [content]);

  // After render, find any mermaid blocks and render them
  useEffect(() => {
    if (!ref.current) return;
    const mermaidBlocks = ref.current.querySelectorAll(".mermaid-block");
    if (mermaidBlocks.length === 0) return;

    async function renderMermaid() {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, theme: "neutral" });
        for (const block of mermaidBlocks) {
          const code = decodeURIComponent(block.getAttribute("data-mermaid") || "");
          if (!code) continue;
          try {
            const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`;
            const { svg } = await mermaid.render(id, code);
            block.innerHTML = svg;
            block.classList.add("flex", "justify-center", "my-4");
          } catch {
            block.innerHTML = `<pre class="bg-gray-50 rounded-lg p-3 text-xs text-gray-500">${code}</pre>`;
          }
        }
      } catch {
        // mermaid failed to load — leave blocks as-is
      }
    }
    renderMermaid();
  }, [html]);

  return (
    <div
      ref={ref}
      className="markdown-content prose prose-sm max-w-none text-nia-dark"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
