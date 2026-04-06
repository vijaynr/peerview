# PeerView UI DESIGN.md

## Overview

PeerView is a desktop-first code review workspace. The UI should feel like a focused review console rather than a general productivity app or a marketing surface.

This file is the visual and interaction brief for generating or editing PeerView UI. It is based on the current implementation in `packages/web/src/styles.css` and `packages/web/src/styles.ts`.

## Product Surface

- Primary surface: web dashboard
- Secondary surface: desktop wrapper around the same web UI
- Not in scope for this document: terminal CLI output design

The product supports:

- an overview dashboard
- provider-specific review workspaces
- settings and configuration panels
- diff inspection
- AI review, summary, and chat side panels

## Overall Feel

The interface should feel:

- calm
- technical
- slightly cinematic
- dense but organized
- premium without being flashy

The visual character is dark-forward with layered gradients, soft glassy chrome, restrained motion, compact typography, and high information density.

Avoid:

- bright startup-dashboard aesthetics
- playful consumer-app styling
- oversized rounded shapes
- noisy gradients on every component
- soft pastel UIs with weak contrast

## Themes

PeerView has two themes:

- `cr-black` as the default dark theme
- `cr-light` as the optional light theme

Both themes should preserve the same structure, spacing, and interaction model. Light mode is not a separate aesthetic direction; it is the same product translated into a lighter environment.

## Color System

### Dark Theme

Base colors:

- `--color-base-100: oklch(18.5% 0.008 260)`
- `--color-base-200: oklch(21.5% 0.009 260)`
- `--color-base-300: oklch(25.5% 0.01 260)`
- `--color-base-content: oklch(91% 0.006 260)`

Semantic colors:

- `--color-primary: oklch(68% 0.14 248)`
- `--color-secondary: oklch(66% 0.09 205)`
- `--color-accent: oklch(76% 0.1 95)`
- `--color-info: oklch(72% 0.09 232)`
- `--color-success: oklch(73% 0.11 158)`
- `--color-warning: oklch(80% 0.12 85)`
- `--color-error: oklch(65% 0.17 22)`

Dark theme background:

- top radial blue glow fading into deep blue-black
- linear gradient from `#141822` to `#0c1018`

Dark theme supporting tokens:

- subtle borders from `rgb(255 255 255 / 0.06)` to `rgb(255 255 255 / 0.12)`
- surface overlay `rgb(255 255 255 / 0.03)`
- shadows that stay soft and close to the surface

### Light Theme

Base colors:

- `--color-base-100: oklch(97.8% 0.014 78)`
- `--color-base-200: oklch(95.4% 0.02 85)`
- `--color-base-300: oklch(90.8% 0.03 236)`
- `--color-base-content: oklch(28% 0.03 248)`

Semantic colors:

- `--color-primary: oklch(55% 0.18 255)`
- `--color-secondary: oklch(64% 0.11 196)`
- `--color-accent: oklch(76% 0.14 66)`
- `--color-info: oklch(66% 0.12 240)`
- `--color-success: oklch(67% 0.13 160)`
- `--color-warning: oklch(78% 0.15 78)`
- `--color-error: oklch(63% 0.2 28)`

Light theme background:

- layered radial blue, orange, and teal glows
- warm off-white to cool paper gradient
- overall tone should feel editorial and airy, not stark white

Light theme supporting tokens:

- border system uses cool slate values with blue emphasis for elevated states
- stronger ambient shadows than dark mode, but still soft

## Typography

Primary typeface:

- `Manrope`

Fallback stack:

- `"Avenir Next", "Segoe UI", sans-serif`

Monospace:

- system monospace stack for code, paths, and technical metadata

Typography direction:

- headings are compact, medium-bold to bold, with slightly tight tracking
- body copy is concise and neutral
- labels should be short and operational
- metadata should be smaller and quieter than content

Text styling rules:

- base page typography should use slight negative tracking
- headings should use stronger negative tracking than body copy
- do not use decorative display fonts
- do not use large editorial paragraphs

## Shape and Density

Shape tokens:

- selector radius: `0.35rem`
- field radius: `0.4rem`
- box radius: `0.55rem`

Shape direction:

- corners are rounded, but tightly so
- components should feel precise, not pillowy
- panels and cards should read as structured equipment, not soft tiles

Density direction:

- high information density is desirable
- use spacing to separate groups, not to create large empty zones
- long-form review work should fit naturally in one viewport on desktop

## Elevation, Borders, and Surfaces

Surfaces should rely on:

- gradient-backed canvases
- subtle inner and outer shadows
- low-contrast borders
- occasional glass-like blur in navigation chrome

Use elevation sparingly:

- low elevation for standard cards and tabs
- medium elevation for persistent chrome like the sidebar
- temporary surfaces like toasts can sit above all content, but should remain visually compact

Do not use:

- harsh drop shadows
- floating cards with large gaps between them
- pure flat fills without any tonal modulation

## Layout

The product is desktop-first and panel-oriented.

Primary layout ideas:

- persistent left navigation or sidebar
- main workspace area with nested panels
- side-by-side analysis and code inspection where possible
- stacked cards and summary sections on overview pages

Layout should prioritize:

- quick scanning
- stable context
- minimal page-to-page disorientation

## Navigation

The sidebar is a key visual anchor.

Sidebar character:

- translucent dark layered background
- blur and saturation treatment
- faint blue light wash
- subtle top-left highlight
- internal chrome with compact spacing

Brand area:

- compact mark
- strong title
- small uppercase subtitle

Navigation should feel:

- anchored
- always available
- narrower than a typical consumer app nav

## Tabs

There are two main tab styles.

### Workspace Tab Strip

Used for major workspace modes.

Visual rules:

- dark segmented container
- tight padding
- modest corner radius
- active tab has gradient fill, subtle blue border, and light foreground
- inactive tabs are muted blue-gray

Behavior rules:

- hover should slightly raise contrast
- active state should be visible immediately without needing icons
- keep labels short

### Panel Tabs

Used inside side panels and compact regions.

Visual rules:

- tighter and smaller than workspace tabs
- low-contrast segmented background
- active state uses subtle raised fill and border
- small font with firm weight

## Cards

Cards are the default information container.

Card rules:

- use controlled gradients rather than flat fills
- keep border visibility subtle
- avoid huge radius or oversized padding
- one card should communicate one main idea

Use cards for:

- provider summaries
- stat summaries
- config summaries
- collapsible sections
- auxiliary review context

## Collapsible Cards

Collapsible cards should feel like instrument panels.

Visual rules:

- dark gradient body
- hidden overflow
- summary row acts as the header
- body content scrolls inside a bounded region when needed

Interaction rules:

- summary row highlights on hover
- focus-visible should use a clear blue outline
- the chevron rotates when expanded
- expanded state adds a divider between header and body

## Forms and Inputs

Forms should feel technical and compact.

Rules:

- inherit surrounding typography
- remove heavy default shadows
- use border and background contrast to signal affordance
- spacing between fields should be measured and consistent

Use forms for:

- provider credentials
- runtime settings
- webhook settings
- repository selection and filtering

## Toasts and Notifications

Toasts should be:

- compact
- top-right aligned
- visually distinct without blocking workflow
- quick to appear and disappear

Animation behavior:

- short fade and slight upward scale-in
- no bounce
- no dramatic motion

## Diff Viewer

The diff viewer is a primary surface and should remain visually restrained.

Current highlight model:

- additions use soft green tint
- removals use soft red tint
- headers use muted slate tint
- active line uses a thin blue outline

Rules:

- preserve code readability over decoration
- never oversaturate diff colors
- selected or active states must be visible but not overpowering
- technical text should remain easy to scan for long periods

## Motion

Motion should support orientation and feedback only.

Allowed motion:

- quick fade-in for cards or page content
- small hover lifts on compact chrome controls
- toast entry transitions
- chevron rotation on collapsibles

Avoid:

- long animated transitions
- large slide-ins
- high-bounce motion
- ornamental looping animations

## Accessibility

Accessibility requirements:

- strong contrast in both themes
- visible focus states
- meaningful active states beyond color alone
- restrained transparency where text sits on layered backgrounds
- tab controls and compact buttons must remain legible and tappable

When using low-contrast decorative layers:

- never let them reduce text clarity
- keep operational content on more stable surfaces

## Screen Guidance

### Overview Screen

Purpose:

- summarize readiness and current system state

Should include:

- concise page header
- stats row
- provider summary cards
- configuration summary cards

Tone:

- confident
- at-a-glance
- operational rather than narrative

### Provider Workspace

Purpose:

- work on one provider and one review target at a time

Should include:

- target selection context
- workspace tabs for code and review artifacts
- side analysis region for review, summary, and chat

Tone:

- focused
- technical
- low-distraction

### Settings Screen

Purpose:

- configure integrations and runtime behavior

Should include:

- grouped config sections
- clear save/test affordances
- strong status visibility

Tone:

- trustworthy
- explicit
- not intimidating

## Component Inventory

The current UI language should support these component families:

- app sidebar
- dashboard header
- stat card
- provider card
- provider summary card
- config card
- config input
- request item
- review list
- review panel
- summary panel
- chat panel
- comments workspace
- commits list
- diff viewer
- inline comment popover
- discussion thread
- collapsible card
- toast notification
- theme toggle

New components should visually belong to this family before introducing a new pattern.

## Writing Style in the UI

Copy should be:

- brief
- practical
- technically literate

Prefer:

- “Open workspace”
- “Settings”
- “Providers”
- “Review agents”
- “Loading dashboard…”

Avoid:

- marketing slogans
- vague AI hype
- chatty system messages

## Implementation Notes

This document is grounded in:

- `packages/web/src/styles.css`
- `packages/web/src/styles.ts`

Specific implementation cues already present:

- gradient application background
- dark glass sidebar with blur
- compact segmented tabs
- collapsible cards with internal scroll areas
- restrained toast animation
- muted diff background highlights with blue active-line outline

If the UI evolves, update this file when the visual system changes, not just when a single screen changes.
