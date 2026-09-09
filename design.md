---
version: "alpha"
name: "HR SaaS Hero"
description: "Minimalist white SaaS hero with background video vertically flipped scaleY(-1) and white gradient overlay (transparent at 26.4% to white at 66.9%). Ideal for saas de rh, gestão de equipes remotas, ferramentas de colaboração, plataformas de onboarding. AI-ready template."
colors:
  primary: "#FFFFFF"
  secondary: "#1A1A1A"
  tertiary: "#373a46"
  neutral: "#fcfcfc"
typography:
  h1:
    fontFamily: Geist
    fontSize: 2.5rem
    fontWeight: 700
  body-md:
    fontFamily: Geist
    fontSize: 1rem
    fontWeight: 400
rounded:
  sm: 40px
  md: 80px
  lg: 120px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral}"
    rounded: "{rounded.sm}"
    padding: 12px
---

## Overview

Minimalist white SaaS hero with background video vertically flipped scaleY(-1) and white gradient overlay (transparent at 26.4% to white at 66.9%). Ideal for saas de rh, gestão de equipes remotas, ferramentas de colaboração, plataformas de onboarding. AI-ready template. The Swiss International Style didn't survive six decades by accident. Its obsession with grid systems, negative space, and typographic hierarchy created a visual language so disciplined that it still outperforms most contemporary approaches — especially in enterprise software where cognitive load is the real enemy. HR platforms inherited the worst habits of early SaaS: cramped layouts, gratuitous gradients, stock photography of people high-fiving in conference rooms. The minimalist white hero emerged as a direct rejection of that visual noise.

Inverted video as a hero element traces back to editorial design's use of reversed-out imagery — high contrast, immediate focal point, zero decoration. When applied to SaaS landing pages, it creates an arresting moment without resorting to illustration or photography that dates within months. The technique works because it treats motion as typography: communicative, not decorative.

What makes this pattern specifically potent for HR software is the implicit message. White space signals confidence. A company selling people management tools needs to communicate clarity and calm — the opposite of the chaos their product resolves. The restraint IS the selling point.

- Density: 3/10 — Airy
- Variance: 2/10 — Structured
- Motion: 8/10 — Cinematic

- **Style:** SaaS, Minimalist White, Flipped Video, Geist Font, Multi-Layer Button, Editorial Spacing
- **Keywords:** SaaS, minimalista branco, vídeo invertido, Geist font, Instrument Serif italic, botão multi-camada, espaçamento editorial, gradient overlay branco, input email, social proof
- **Era:** 2024-2026 SaaS Minimalist White
- **Light/Dark:** ✓ Full / ✗ Not Recommended

## Colors

- **Branco** (#FFFFFF) — Light surface, card backgrounds
- **Preto Texto** (#1A1A1A) — Dark surface, primary background
- **Cinza Slate** (#373a46) — Secondary text, borders, muted elements
- **Cinza Input** (#fcfcfc) — Secondary text, borders, muted elements
- **Sombra Input** (rgba(194,194,194,0.25)) — Extended palette, decorative use
- **Sombra Botão Interna** (rgba(201,201,201,0.08)) — Extended palette, decorative use
- **Sombra Botão Escura** (rgba(29,29,29,0.24)) — Extended palette, decorative use
- **Borda Sutil** (rgba(0,0,0,0.08)) — Extended palette, decorative use


## Typography

- **Display / Hero:** Geist — Weight 700, tight tracking, used for headline impact
- **Accent:** Instrument Serif — Used for decorative or emphasis text
- **Body:** Geist — Weight 400, 16px/1.6 line-height, max 72ch per line
- **UI Labels / Captions:** Geist — 0.875rem, weight 500, slight letter-spacing
- **Monospace:** JetBrains Mono — Used for code, metadata, and technical values

Scale:
- Hero: clamp(2.5rem, 5vw, 4rem)
- H1: 2.25rem
- H2: 1.5rem
- Body: 1rem / 1.6
- Small: 0.875rem


## Layout

- **Grid:** CSS Grid primary. Max-width containment: 1280px centered with 1.5rem side padding.
- **Spacing rhythm:** Balanced. Base unit: 0.5rem (8px).
- **Section vertical gaps:** clamp(4rem, 8vw, 8rem).
- **Hero layout:** Split-screen (text left, visual right).
- **Feature sections:** Zig-zag alternating text+image rows. No 3-equal-columns.
- **Mobile collapse:** All multi-column layouts collapse below 768px. No horizontal overflow.
- **z-index contract:** base (0) / sticky-nav (100) / overlay (200) / modal (300) / toast (500).


## Elevation & Depth

VÍDEO: Vídeo abstrato com tons claros e suaves, possivelmente cenas de natureza, nuvens ou formas orgânicas em movimento lento. Invertido verticalmente via CSS scaleY(-1) para criar efeito visual único. Gradient overlay branco (from transparent at 26.4% to white at 66.9%) funde suavemente o vídeo no fundo branco da página, criando uma transição etérea entre o vídeo e o conteúdo minimalista. | EFEITOS CSS: Vídeo de fundo invertido verticalmente (scaleY(-1)) com object-cover, gradient overlay branco (from transparent at 26.4% to white at 66.9%), espaçamento editorial pesado (290px top padding), headline 80px Geist medium tracking -0.04em com palavra em Instrument Serif italic 100px, input email arredondado 40px com sombra suave, botão CTA escuro multi-camada com inner shadow complexo, social proof com badge de reviews, animações staggered fade+slide-up via Motion

- **Physics:** Spring — stiffness 120, damping 20. Confident, weighted transitions.
- **Entry animations:** Fade + translate-Y (16px → 0) over 540ms ease-out. Staggered cascades for lists: 120ms between items.
- **Hover states:** Scale(1.03) + shadow lift over 200ms.
- **Page transitions:** Fade + slide (300ms).
- **Performance:** Only transform and opacity animated. No layout-triggering properties.


## Shapes

Base corner radius: 40px. See rounded tokens in front matter for the full scale.


## Components

- **Primary Button:** Rounded (40px input) shape. Accent color fill. Hover: 8% darken + subtle lift shadow. Active: -1px translate tactile press. Font weight 600. No outer glows.
- **Secondary / Ghost Button:** Outline variant. 1.5px border in muted color. Text in primary color. Hover: subtle background fill.
- **Cards:** Rounded (40px input) corners. Surface background. Subtle shadow (0 2px 12px rgba(0,0,0,0.06)). 1px border stroke.
- **Inputs:** Label above input. 1px border stroke. Focus ring: 2px accent color offset 2px. Error text below in semantic red. No floating labels.
- **Navigation:** Primary surface background. Active item: accent color indicator. Font weight 500 when active.
- **Skeletons:** Shimmer animation matching component dimensions. No circular spinners.
- **Empty States:** Icon-based composition with descriptive text and action button.


## Do's and Don'ts

- No emojis in UI — use icon system only (Lucide, Heroicons)
- No decorative gradients — flat color only
- No shadows heavier than 0 2px 8px rgba(0,0,0,0.08)
- No pure black (#000000) — use off-black or charcoal variants
- No oversaturated accent colors (saturation cap: 80%)
- No 3-column equal-width feature layouts — use zig-zag or asymmetric grid
- No `h-screen` — use `min-h-[100dvh]`
- No AI copywriting clichés: "Elevate", "Seamless", "Unleash", "Next-Gen"
- No broken external image links — use picsum.photos or inline SVG
- No generic lorem ipsum in demos

- Do Vídeo invertido scaleY(-1) gradient overlay branco
- Do Padding top 290px
- Do Headline 80px Geist + 100px Instrument Serif italic
- Do Input email arredondado 40px sombra
- Do Botão CTA inner shadows complexos
- Do Social proof badge reviews
- Do Animações staggered
- Do Descrição 18px opacity 80%
- Do Responsivo


## Use Case

SaaS de RH, Gestão de equipes remotas, Tools de colaboração, Platforms de onboarding

<!-- Source: https://designmd.app/library/hr-saas-hero · designmd.app -->
