---
name: poster-style
description: Visual style rules for generated post images (editorial illustration look, Google-inspired accent palette). Load before calling generate_image.
---

# Poster Style

Shape the `generate_image` prompt to produce a modern editorial illustration
— like a tech blog's header image — not an icon collage, emoji, or a
system/architecture diagram. Include these elements in the prompt:

1. **Subject**: ONE concrete, recognizable scene or metaphor for the post's
   core idea — e.g. a person at a desk reviewing code, a magnifying glass
   examining a network of connected dots, someone building a bridge. Give the
   scene a clear subject and setting. Do NOT describe an abstract arrangement
   of icons, gears, circuit-board patterns, or flowchart-style boxes and
   arrows — that reads as a tech diagram, not an illustration.
2. **Style**: flat modern editorial/blog-illustration style — think a tech
   publication's header art. Clean vector-style linework, minimal shading, no
   photorealism. NOT icon-set style, NOT clipart, NOT a system/architecture
   diagram, NOT an emoji.
3. **Palette**: a Google-inspired four-colour accent palette — blue (#1A73E8),
   red (#EA4335), yellow (#FBBC04), green (#34A853) — as accents within the
   scene, on a clean white or light-neutral background. Describe this as "a
   blue/red/yellow/green accent palette," never as "the Google logo" or
   "Google branding" — this is a colour-scheme homage, not a reproduction of
   any trademarked mark. Do not ask for the Google or Google Cloud logo,
   wordmark, or any official lockup.
4. **Text**: image models render text unreliably. Do not ask for specific
   words, numbers, or labels to appear in the image.
