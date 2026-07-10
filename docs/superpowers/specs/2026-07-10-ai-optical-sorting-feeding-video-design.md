# AI Optical Sorting Feeding Video Design

## Goal

Replace the `Feeding` placeholder in the `Process Overview` section of the AI optical sorting product page with the supplied video at `public/assets/video/AI上料.mp4`.

## Scope

- Update only the `Feeding` media in `public/products/ai-optical-sorting.html`.
- Keep the existing process timeline layout, text, and all other video placeholders unchanged.
- Use the page-relative source `../assets/video/AI上料.mp4`.

## Playback

Render a native HTML `<video>` with browser controls and `playsinline`. Playback starts only after user interaction; the video will not autoplay or loop.

## Presentation And Accessibility

- Preserve the current `process-timeline-media` frame and dimensions.
- Give the figure a descriptive `aria-label` instead of placeholder wording.
- Provide fallback text for browsers that cannot play the video.
- Add narrowly scoped CSS only if needed to make the video fill the existing frame without distorting the layout.

## Verification

- Add a static regression check that finds the `Feeding` process step and verifies its video source and playback attributes.
- Run the check and verify the referenced MP4 exists.
- Serve the static site locally and confirm the product route loads the video without layout overlap at desktop and mobile widths.
