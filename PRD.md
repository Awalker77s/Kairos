# Kairo — Product Requirements Document

## 1. Product Vision

Kairo is an AI-powered visualization platform that transforms natural language descriptions of homes and spaces into photorealistic furnished room images through a three-step pipeline: text to 2D floor plan, 2D to 3D walkthrough, and AI-generated furnished room renders. It eliminates the weeks-long gap between initial concept and client-ready visualization for construction, architecture, and interior design professionals.

The tagline: **"From sketch to stunning in seconds."**

---

## 2. Brand Identity & Design System

**Primary Palette:** Orange (#FF6A00) and Black (#0A0A0A) form the core identity — bold, confident, and construction-adjacent. Orange conveys energy, creativity, and innovation. Black grounds it with professionalism and sophistication.

**Supporting Palette:**
- Deep Charcoal (#1A1A1A) for card backgrounds and elevated surfaces
- Warm Gray (#2A2A2A) for secondary containers and input fields
- Soft Amber (#FFB366) for hover states, subtle highlights, and progress indicators
- Off-White (#F5F0EB) for primary text — warm enough to avoid harsh contrast against dark backgrounds
- Muted Stone (#8C8279) for secondary/placeholder text
- Success Green (#4CAF50) for completion states
- Error Red (#E53935) for validation errors

**Design Philosophy:** The UI should feel like a premium creative tool — think the polish of Figma meets the dark, immersive feel of Unreal Engine's editor. Large canvas areas with minimal chrome. The orange acts as an accent and call-to-action color, never overwhelming. Surfaces use subtle gradients and depth (soft shadows, slight glassmorphism on modals) to create a layered, spatial feel that mirrors the 3D nature of the product. Typography should be clean and geometric — Inter or General Sans for UI, with a bolder display weight for headings.

---

## 3. Target Users & Personas

**Persona 1 — The Architect (Primary):** Works at a mid-size firm. Needs to quickly show clients what a space will look like before committing to full CAD modeling. Currently uses SketchUp or Revit, which takes days for a single rendering. Wants speed without sacrificing realism.

**Persona 2 — The Contractor/Developer:** Not a designer. Has floor plans from engineers but needs visual presentations for investors or buyers. Wants a tool that doesn't require design expertise.

**Persona 3 — The Interior Designer:** Focuses on furnishing and styling spaces. Wants to describe a room and see it come to life with different styles, materials, and lighting. Cares deeply about aesthetic accuracy.

**Persona 4 — The DIY Renovator (Secondary):** Homeowner planning a kitchen remodel. Wants to describe their dream space in plain English and see what it could look like. Price-sensitive, needs an intuitive free tier.

---

## 4. Core User Flow — The Three-Step Pipeline

This is the heart of the product. Every interaction funnels through three distinct stages, each clearly represented in the UI with a step indicator (1 → 2 → 3).

### Step 1 — Text to 2D Floor Plan (OpenAI GPT-4o)

The user describes their desired home in plain text (e.g., "a 3-bedroom modern home with an open kitchen and two bathrooms"). GPT-4o processes this prompt and returns structured JSON containing room dimensions, wall segments, door and window placements, and spatial relationships. This JSON is then rendered client-side as a clean 2D floor plan using SVG/Canvas in React.

**User-facing experience:** A text input area with example prompts and a "Generate Floor Plan" button. After generation, the 2D floor plan renders on a canvas with labeled rooms, dimensions, and door/window markers. The user can review and confirm before proceeding, or adjust their prompt and regenerate.

**Structured JSON output includes:**
- Room objects (name, type, x/y position, width, height)
- Wall segments (start point, end point, thickness)
- Door placements (position, width, swing direction, which wall)
- Window placements (position, width, which wall)
- Spatial relationships and adjacency data

### Step 2 — 2D to 3D Walkthrough (Three.js)

The structured JSON from Step 1 is fed into Three.js via @react-three/fiber and @react-three/drei to generate an interactive 3D architectural model. Walls are extruded from the 2D layout data, floors and ceilings are placed as planes, and door/window cutouts are applied programmatically. The user can orbit, pan, and navigate through the space to understand the layout spatially.

**User-facing experience:** The 2D canvas transitions into a full 3D viewer. The model is structural and architectural — clean white/gray walls, basic material shading, proper proportions. This is not the photorealistic step; its purpose is spatial comprehension. Controls include orbit (click + drag), pan (right-click + drag), zoom (scroll), and a first-person walkthrough mode for navigating room to room.

**3D generation logic:**
- Walls extruded to configurable height (default 9 ft residential, 12 ft commercial)
- Floor planes with grid texture for scale reference
- Ceiling planes with basic ambient occlusion
- Door cutouts with frame geometry and optional swing arc visualization
- Window cutouts with glass-like transparent material
- Basic directional lighting to establish depth and shadow

### Step 3 — Furnished Room Images (OpenAI Image Generation)

For each room in the floor plan, a tailored prompt is constructed using the room's type, dimensions, style preferences, and features (e.g., "photorealistic furnished modern master bedroom, 14x12 feet, two windows, hardwood floors, natural light"). OpenAI's image generation API produces photorealistic renders showing each room fully furnished and decorated, giving the user a tangible vision of what their home would look like lived in.

**User-facing experience:** A style selector lets the user choose a design aesthetic (Modern, Scandinavian, Industrial, Mid-Century, Farmhouse, Luxury, Minimalist). Then a "Generate Room Renders" button kicks off image generation for all rooms. A progress indicator shows each room being rendered. Results display in a gallery grid — one or more photorealistic images per room. The user can click into any room image for a full-screen view, regenerate individual rooms with adjusted prompts, or download the full set.

**Prompt construction logic:**
- Room type and label from the JSON (e.g., "master bedroom," "open kitchen")
- Dimensions from the JSON for spatial accuracy in the prompt
- Features detected (number of windows, door count, adjacencies like "connected to living room")
- User-selected style applied as a style modifier
- Optional user refinement text appended (e.g., "with a large bookshelf and warm lighting")

---

## 5. Feature Requirements

### 5.1 — Authentication & Onboarding
- Email/password and Google OAuth sign-up
- Onboarding wizard that asks the user's role (architect, contractor, designer, homeowner) to tailor default style presets and example prompts
- Free tier access with watermarked exports and limited renders per month

### 5.2 — Project Dashboard
- Grid/list view of all saved projects with thumbnail previews (using the first generated room image as the thumbnail)
- Project status indicators showing which step each project is at (Floor Plan → 3D Model → Rendered)
- Folder organization and tagging
- Search and filter by date, status, style, or tag
- Quick-action buttons: Duplicate, Archive, Share, Delete

### 5.3 — Text Input & Prompt System
- Large text area with placeholder examples to guide the user
- Prompt templates/presets (e.g., "Studio Apartment," "Family Home," "Commercial Office") that pre-fill common descriptions
- Character count and complexity indicator (helps the user understand how detailed their prompt is)
- Prompt history so users can revisit and modify previous descriptions
- Validation feedback if the prompt is too vague for reliable generation

### 5.4 — 2D Floor Plan Viewer
- SVG/Canvas rendering of the structured JSON output
- Room labels with dimensions displayed
- Door and window icons/markers on walls
- Zoom and pan controls
- Option to download the 2D floor plan as PNG or SVG
- "Edit Prompt & Regenerate" button to iterate on the layout
- Visual diff overlay if regenerating (highlight what changed)

### 5.5 — 3D Model Viewer
- Three.js scene via @react-three/fiber with orbit, pan, zoom controls
- First-person walkthrough mode with WASD or arrow key navigation
- Room highlighting on hover with name/dimension tooltip
- Measurement tool overlay for verifying distances
- Toggle for ceiling visibility (remove ceiling to see bird's-eye interior view)
- Screenshot capture from any angle
- Export 3D model as GLTF for use in external tools (premium feature)

### 5.6 — AI Room Rendering
- Style selector with visual previews of each aesthetic
- Batch generation for all rooms with per-room progress tracking
- Gallery view of all generated images organized by room
- Full-screen image viewer with zoom
- Per-room regeneration with prompt refinement input
- Before/after toggle (3D structural view vs. furnished render)
- Download individual images or full project set as a ZIP

### 5.7 — Material & Style Customization
- Style presets: Modern, Scandinavian, Industrial, Mid-Century, Farmhouse, Luxury, Minimalist
- Per-room style override (e.g., industrial kitchen but minimalist bedroom)
- Text-based refinement prompts per room for custom tweaks
- Flooring, wall color, and lighting preferences as optional parameters that modify the image generation prompt

### 5.8 — Export & Sharing
- High-resolution image export (up to 4K on premium tiers) in PNG and JPG
- PDF report generation compiling the 2D floor plan, 3D screenshots, and all furnished room images into a client-ready presentation
- Shareable project link (view-only, no account required) that shows the floor plan, 3D model, and room gallery
- Embed code for real estate listing sites

### 5.9 — Collaboration (V2)
- Team workspaces with role-based permissions (Owner, Editor, Viewer)
- Comment and annotation system pinned to specific rooms
- Version history with the ability to restore previous project states
- Real-time collaborative prompt editing

---

## 6. Technical Architecture

### 6.1 — Frontend
- **Framework:** React (Vite) with TypeScript
- **3D Engine:** Three.js via @react-three/fiber and @react-three/drei for the interactive 3D viewer
- **2D Rendering:** SVG or HTML Canvas (via a library like Konva.js or raw SVG elements) for rendering the 2D floor plan from JSON
- **State Management:** Zustand for global state (project data, current pipeline step, generation status, viewer state)
- **Styling:** Tailwind CSS with the custom orange/black design tokens defined as CSS variables
- **Routing:** React Router for dashboard, project editor, and public share pages
- **Hosting:** Vercel or Netlify

### 6.2 — Backend
- **Database & Auth:** Supabase (PostgreSQL for user data, project metadata, and structured floor plan JSON; Supabase Auth for email/password and Google OAuth; Supabase Storage for generated images and exports)
- **AI API Calls:** OpenAI API called from Supabase Edge Functions (keeps API keys server-side)
  - GPT-4o for text-to-JSON floor plan generation (Step 1)
  - OpenAI Image Generation API for furnished room renders (Step 3)
- **Edge Functions handle:**
  - Prompt validation and sanitization
  - Structured JSON parsing and validation of GPT-4o output
  - Image generation prompt construction from JSON + style preferences
  - Rate limiting per user tier
- **File Storage:** Supabase Storage for all generated images, with CDN caching for shared/public project links

### 6.3 — AI Pipeline Detail

**Step 1 — GPT-4o Floor Plan Generation:**
- System prompt instructs GPT-4o to return only valid JSON matching a defined schema (rooms array, walls array, doors array, windows array)
- JSON schema validation on the Edge Function before returning to the client
- Retry logic if the output fails schema validation (re-prompt with error context)
- The structured JSON becomes the single source of truth for Steps 2 and 3

**Step 2 — Three.js 3D Construction (client-side, no AI):**
- Pure algorithmic/procedural generation — no API calls
- The JSON is parsed and each room's walls are extruded into 3D meshes
- Door and window positions are used to create boolean cutouts in wall geometry
- Floor and ceiling planes are generated per room
- Materials are basic: white walls, light gray floors, transparent glass for windows
- Lighting: ambient light + directional light simulating sun position
- All computation happens in the browser via @react-three/fiber

**Step 3 — OpenAI Image Generation:**
- For each room in the JSON, an Edge Function constructs a detailed prompt combining room type, dimensions, features, and the user's selected style
- Prompts are sent to the OpenAI image generation API
- Generated images are stored in Supabase Storage and linked to the project record
- Parallel generation for multiple rooms with individual progress callbacks via Supabase Realtime or polling

### 6.4 — Infrastructure
- **CI/CD:** GitHub Actions for automated deployments
- **Monitoring:** Sentry for error tracking, PostHog for product analytics
- **CDN:** Cloudflare for static assets and generated image delivery
- **Environment:** All secrets (OpenAI API key, Supabase keys) stored as environment variables in Vercel/Supabase, never exposed client-side

---

## 7. Monetization & Pricing Tiers

**Free Tier — Explorer**
- 3 projects per month
- Standard quality room renders (1080p) with Kairo watermark
- 3 style presets (Modern, Scandinavian, Minimalist)
- Single regeneration per room
- Community support

**Pro Tier — $29/month**
- Unlimited projects
- High quality renders (2K), no watermark
- All 7+ style presets
- Unlimited regenerations with prompt refinement
- PDF report export
- Priority rendering queue
- 3D model GLTF export
- Email support

**Studio Tier — $79/month**
- Everything in Pro
- 4K renders
- Team workspace (up to 5 members)
- Shareable interactive project links
- API access for integrations
- Custom style prompt templates
- Priority support

**Enterprise — Custom pricing**
- Unlimited team members
- Custom style libraries with brand-specific furnishing preferences
- SSO and advanced security
- Dedicated rendering capacity
- White-label options for client-facing presentations
- SLA with dedicated account manager

---

## 8. Website Pages & Structure

**Landing Page:** Hero section with a dramatic animation showing a text prompt transforming into a 2D floor plan, then extruding into 3D, then revealing photorealistic room images. Clear three-step value prop. Social proof from target industries. CTA to sign up or try a demo with a pre-filled prompt.

**Product/Features Page:** Deep dive into each step of the pipeline with interactive demos or video walkthroughs.

**Pricing Page:** Tier comparison table with clear CTAs. Annual discount toggle.

**Dashboard (Authenticated):** The main app workspace with project grid, new project flow, and the three-step editor.

**Gallery/Showcase:** Public gallery of rendered projects (with user permission) to demonstrate capability and drive organic traffic.

**Blog:** SEO content targeting "AI floor plan generator," "text to 3D home," "AI interior design visualization," etc.

**Docs/Help Center:** Guides for writing effective prompts, understanding the pipeline, API documentation for Studio/Enterprise tiers.

---

## 9. Success Metrics

- **Activation rate:** Percentage of sign-ups that complete their first full three-step generation within 7 days (target: 40%)
- **Generation completion rate:** Percentage of started projects that reach the rendered stage (target: 70%)
- **Free-to-paid conversion:** Target 5-8% within 30 days
- **Monthly render volume:** Total room images generated across all users (growth indicator)
- **Time-to-first-render:** Average time from prompt entry to first rendered room image (target: under 3 minutes)
- **NPS:** Target 50+ within the first 6 months
