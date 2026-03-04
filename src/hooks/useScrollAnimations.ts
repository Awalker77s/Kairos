import { useEffect } from "react";

/**
 * Observes elements with `data-animate` attribute and adds `data-visible`
 * when they scroll into view. Child elements are staggered by 100ms each.
 */
export function useScrollAnimations() {
  useEffect(() => {
    // Respect reduced motion
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // Make everything visible immediately
      document.querySelectorAll("[data-animate]").forEach((el) => {
        (el as HTMLElement).dataset.visible = "true";
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            el.dataset.visible = "true";

            // Stagger children with data-animate-child
            const children = el.querySelectorAll("[data-animate-child]");
            children.forEach((child, i) => {
              (child as HTMLElement).style.transitionDelay = `${i * 100}ms`;
              (child as HTMLElement).dataset.visible = "true";
            });

            observer.unobserve(el);
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );

    document.querySelectorAll("[data-animate]").forEach((el) => {
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);
}
