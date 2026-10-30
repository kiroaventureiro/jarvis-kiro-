"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Reveals content within the function pages, never the Jarvis home.
 * The InternalPage wrapper is structural: reveal its individual sections,
 * not the entire content column as a single oversized block.
 */
export default function InteriorScroll() {
  const pathname = usePathname();
  useEffect(() => {
    const internal = pathname !== "/" && [
      "/integracoes", "/conexoes", "/resultados", "/criador", "/memoria",
      "/projetos", "/controle", "/diagnostico", "/configuracoes",
    ].some((route) => pathname === route || pathname.startsWith(route + "/"));
    if (!internal) return;
    const main = document.querySelector("main");
    if (!main) return;

    const selectors = main.classList.contains("internal-page")
      ? ":scope > .internal-content > section, :scope > .internal-content > article, :scope > .internal-content > details, :scope > .internal-content > div"
      : ":scope > section, :scope > article, :scope > details, :scope > div";
    main.classList.add("jk-interior-scroll");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    const targets = new Set<HTMLElement>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const node = entry.target as HTMLElement;
        node.classList.add("jk-visible");
        observer.unobserve(node);
      }
    }, { threshold: 0, rootMargin: "0px 0px -7% 0px" });

    const register = () => {
      for (const node of targets) {
        if (!main.contains(node)) {
          observer.unobserve(node);
          targets.delete(node);
        }
      }
      main.querySelectorAll<HTMLElement>(selectors).forEach((node) => {
        if (targets.has(node)) return;
        targets.add(node);
        node.classList.add("jk-reveal");
        if (reduce.matches) node.classList.add("jk-visible");
        else observer.observe(node);
      });
    };
    register();
    // Sections may mount after an async connector read; observe nested inserts
    // without animating every individual card or changing the home.
    const changes = new MutationObserver(register);
    changes.observe(main, { childList: true, subtree: true });
    const update = () => {
      if (reduce.matches) {
        targets.forEach((node) => {
          node.classList.add("jk-visible");
          observer.unobserve(node);
        });
      } else {
        targets.forEach((node) => {
          if (!node.classList.contains("jk-visible")) observer.observe(node);
        });
      }
    };
    const revealFocused = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const node = target.closest<HTMLElement>(".jk-reveal");
      if (node && main.contains(node)) {
        node.classList.add("jk-visible");
        observer.unobserve(node);
      }
    };
    main.addEventListener("focusin", revealFocused);
    reduce.addEventListener("change", update);
    return () => {
      changes.disconnect();
      observer.disconnect();
      reduce.removeEventListener("change", update);
      main.removeEventListener("focusin", revealFocused);
      targets.forEach((node) => node.classList.remove("jk-reveal", "jk-visible"));
      main.classList.remove("jk-interior-scroll");
    };
  }, [pathname]);
  return null;
}
