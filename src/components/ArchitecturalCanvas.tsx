import { useEffect, useRef } from "react";

// ── Types ────────────────────────────────────────────────────────────
interface FloatingElement {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
  opacityDir: number;
  scale: number;
  depth: number; // 0 = far (slow), 1 = near (faster)
  type: ElementType;
}

type ElementType =
  | "floorplan"
  | "wireframe"
  | "boundary"
  | "compass"
  | "silhouette";

const ELEMENT_TYPES: ElementType[] = [
  "floorplan",
  "wireframe",
  "boundary",
  "compass",
  "silhouette",
];
const MAX_ELEMENTS = 22;
const GOLD_COLOR = "rgba(201, 168, 76,";

// ── Drawing helpers ──────────────────────────────────────────────────

function drawFloorPlan(ctx: CanvasRenderingContext2D, s: number) {
  // Simple rectangular room layout with internal walls
  ctx.beginPath();
  ctx.rect(-30 * s, -20 * s, 60 * s, 40 * s);
  // internal walls
  ctx.moveTo(0, -20 * s);
  ctx.lineTo(0, 10 * s);
  ctx.moveTo(0, 10 * s);
  ctx.lineTo(30 * s, 10 * s);
  ctx.moveTo(-10 * s, -20 * s);
  ctx.lineTo(-10 * s, 0);
  // door arc
  ctx.moveTo(0, 10 * s);
  ctx.arc(0, 10 * s, 8 * s, -Math.PI / 2, 0);
  ctx.stroke();
}

function drawWireframe(ctx: CanvasRenderingContext2D, s: number) {
  // Isometric box outline
  const w = 25 * s,
    h = 15 * s,
    d = 12 * s;
  ctx.beginPath();
  // front face
  ctx.rect(-w, -h, w * 2, h * 2);
  // top receding lines
  ctx.moveTo(-w, -h);
  ctx.lineTo(-w + d, -h - d);
  ctx.moveTo(w, -h);
  ctx.lineTo(w + d, -h - d);
  // back top
  ctx.moveTo(-w + d, -h - d);
  ctx.lineTo(w + d, -h - d);
  // right side receding
  ctx.moveTo(w, h);
  ctx.lineTo(w + d, h - d);
  ctx.moveTo(w + d, h - d);
  ctx.lineTo(w + d, -h - d);
  ctx.stroke();
}

function drawBoundary(ctx: CanvasRenderingContext2D, s: number) {
  // Irregular polygon plot outline
  ctx.beginPath();
  ctx.moveTo(-20 * s, -15 * s);
  ctx.lineTo(15 * s, -18 * s);
  ctx.lineTo(25 * s, -5 * s);
  ctx.lineTo(20 * s, 15 * s);
  ctx.lineTo(-5 * s, 20 * s);
  ctx.lineTo(-25 * s, 10 * s);
  ctx.closePath();
  ctx.stroke();
  // measurement tick
  ctx.beginPath();
  ctx.moveTo(-20 * s, -15 * s);
  ctx.lineTo(-22 * s, -17 * s);
  ctx.moveTo(15 * s, -18 * s);
  ctx.lineTo(17 * s, -20 * s);
  ctx.stroke();
}

function drawCompass(ctx: CanvasRenderingContext2D, s: number) {
  const r = 16 * s;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  // cross hairs
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.2);
  ctx.lineTo(0, r * 1.2);
  ctx.moveTo(-r * 1.2, 0);
  ctx.lineTo(r * 1.2, 0);
  ctx.stroke();
  // N arrow
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.2);
  ctx.lineTo(-3 * s, -r * 0.8);
  ctx.moveTo(0, -r * 1.2);
  ctx.lineTo(3 * s, -r * 0.8);
  ctx.stroke();
}

function drawSilhouette(ctx: CanvasRenderingContext2D, s: number) {
  // Small house line-art silhouette
  ctx.beginPath();
  // base
  ctx.rect(-18 * s, 0, 36 * s, 20 * s);
  // roof
  ctx.moveTo(-22 * s, 0);
  ctx.lineTo(0, -16 * s);
  ctx.lineTo(22 * s, 0);
  // door
  ctx.moveTo(-4 * s, 20 * s);
  ctx.lineTo(-4 * s, 10 * s);
  ctx.lineTo(4 * s, 10 * s);
  ctx.lineTo(4 * s, 20 * s);
  // window
  ctx.rect(10 * s, 5 * s, 8 * s, 8 * s);
  ctx.moveTo(14 * s, 5 * s);
  ctx.lineTo(14 * s, 13 * s);
  ctx.moveTo(10 * s, 9 * s);
  ctx.lineTo(18 * s, 9 * s);
  ctx.stroke();
}

const DRAW_FNS: Record<
  ElementType,
  (ctx: CanvasRenderingContext2D, s: number) => void
> = {
  floorplan: drawFloorPlan,
  wireframe: drawWireframe,
  boundary: drawBoundary,
  compass: drawCompass,
  silhouette: drawSilhouette,
};

// ── Element factory ──────────────────────────────────────────────────

function createFloatingElement(w: number, h: number): FloatingElement {
  const depth = 0.2 + Math.random() * 0.8;
  const speed = 0.15 + depth * 0.25;
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * speed,
    vy: (Math.random() - 0.5) * speed,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 0.003,
    opacity: Math.random() * 0.12 + 0.03,
    opacityDir: Math.random() > 0.5 ? 1 : -1,
    scale: 0.6 + depth * 0.8,
    depth,
    type: ELEMENT_TYPES[Math.floor(Math.random() * ELEMENT_TYPES.length)],
  };
}

// ── Component ────────────────────────────────────────────────────────

export function ArchitecturalCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const elementsRef = useRef<FloatingElement[]>([]);
  const scrollYRef = useRef(0);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = mq.matches;
    const handler = (e: MediaQueryListEvent) => {
      reducedMotionRef.current = e.matches;
    };
    mq.addEventListener("change", handler);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Resize handler
    function resize() {
      const dpr = window.devicePixelRatio || 1;
      canvas!.width = window.innerWidth * dpr;
      canvas!.height = window.innerHeight * dpr;
      canvas!.style.width = `${window.innerWidth}px`;
      canvas!.style.height = `${window.innerHeight}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    // Scroll tracking (passive for perf)
    function onScroll() {
      scrollYRef.current = window.scrollY;
    }
    window.addEventListener("scroll", onScroll, { passive: true });

    // Seed initial elements
    elementsRef.current = Array.from({ length: MAX_ELEMENTS }, () =>
      createFloatingElement(window.innerWidth, window.innerHeight)
    );

    // ── Render loop ────────────────────────────────────────────────
    function animate() {
      if (!ctx || !canvas) return;

      // Pause when tab not visible
      if (document.visibilityState === "hidden") {
        animFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      // If reduced motion, draw once statically then stop updating positions
      const reduced = reducedMotionRef.current;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const scrollY = scrollYRef.current;

      ctx.clearRect(0, 0, w, h);

      // Subtle gradient overlay that deepens with scroll
      const scrollRatio = Math.min(scrollY / (document.body.scrollHeight - h || 1), 1);
      const gradAlpha = 0.03 + scrollRatio * 0.06;
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, `rgba(240, 234, 224, 0)`);
      grad.addColorStop(1, `rgba(240, 234, 224, ${gradAlpha})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      for (const el of elementsRef.current) {
        if (!reduced) {
          // Update position
          el.x += el.vx;
          el.y += el.vy;
          el.rotation += el.rotationSpeed;

          // Fade in/out
          el.opacity += el.opacityDir * 0.0004;
          if (el.opacity > 0.15) {
            el.opacity = 0.15;
            el.opacityDir = -1;
          } else if (el.opacity < 0.03) {
            el.opacity = 0.03;
            el.opacityDir = 1;
          }

          // Wrap around edges with padding
          const pad = 60;
          if (el.x < -pad) el.x = w + pad;
          if (el.x > w + pad) el.x = -pad;
          if (el.y < -pad) el.y = h + pad;
          if (el.y > h + pad) el.y = -pad;
        }

        // Parallax: elements at different depths move at different speeds
        const parallaxOffset = scrollY * (0.1 + el.depth * 0.2);

        ctx.save();
        ctx.translate(el.x, el.y - parallaxOffset % (h + 120));
        ctx.rotate(el.rotation);
        ctx.globalAlpha = el.opacity;
        ctx.strokeStyle = `${GOLD_COLOR} ${el.opacity})`;
        ctx.lineWidth = 0.8;
        DRAW_FNS[el.type](ctx, el.scale);
        ctx.restore();
      }

      animFrameRef.current = requestAnimationFrame(animate);
    }

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", onScroll);
      mq.removeEventListener("change", handler);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0"
      aria-hidden="true"
    />
  );
}
