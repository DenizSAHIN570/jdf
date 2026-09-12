import { For, createEffect } from "solid-js";
import type { JdfDocument } from "@jdf/core";
import { PageRenderer } from "./PageRenderer";

interface DocumentViewerProps {
  document: JdfDocument;
  zoom: number;
  currentPage: number;
  editable: boolean;
  onPageChange: (page: number) => void;
}

export function DocumentViewer(props: DocumentViewerProps) {
  let containerRef!: HTMLDivElement;
  // Page index we last reported *from* a user scroll. When that value comes
  // back through `props.currentPage` we must not scroll-snap to it — doing so
  // yanked the viewport to the page top every time the user crossed the
  // detection threshold, and froze detection for the smooth-scroll window.
  let reportedFromScroll = -1;
  let suppressScrollUntil = 0;

  createEffect(() => {
    const target = props.currentPage;
    if (!containerRef) return;
    if (target === reportedFromScroll) { reportedFromScroll = -1; return; }
    const pageEl = containerRef.querySelector(`[data-page-index="${target}"]`) as HTMLElement | null;
    if (pageEl) {
      suppressScrollUntil = Date.now() + 700;
      pageEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  function handleScroll() {
    if (!containerRef || Date.now() < suppressScrollUntil) return;
    // Compare *rendered* geometry (getBoundingClientRect) rather than layout
    // offsets — the two diverge as soon as the page stack is zoomed.
    const probeY = containerRef.getBoundingClientRect().top + containerRef.clientHeight / 3;
    const pages = containerRef.querySelectorAll("[data-page-index]");
    let closest = 0;
    let closestDist = Infinity;
    pages.forEach((el) => {
      const idx = Number(el.getAttribute("data-page-index"));
      const dist = Math.abs(el.getBoundingClientRect().top - probeY);
      if (dist < closestDist) { closestDist = dist; closest = idx; }
    });
    if (closest !== props.currentPage) {
      reportedFromScroll = closest;
      props.onPageChange(closest);
    }
  }

  return (
    <div ref={containerRef} class={`h-full overflow-auto bg-gray-100 dark:bg-slate-900 transition-colors ${props.editable ? "edit-mode" : ""}`} onScroll={handleScroll}>
      {/*
        CSS `zoom` (not `transform: scale`) so the scaled size takes part in
        layout: the scroll container grows with the pages, the left edge stays
        reachable at zoom > 1, and page detection sees real coordinates.
      */}
      <div class="flex flex-col items-center gap-8 py-8" style={{ zoom: String(props.zoom) } as any}>
        <For each={props.document.pages}>
          {(page, index) => (
            <div data-page-index={index()}>
              <PageRenderer
                page={page}
                pageIndex={index()}
                totalPages={props.document.pages.length}
                document={props.document}
                styles={props.document.styles || {}}
                onNavigatePage={props.onPageChange}
              />
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
