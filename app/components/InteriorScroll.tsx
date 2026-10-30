"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Applies reversible scroll reveals ONLY to the function pages reached from
 * the Jarvis menu. Home '/' stays untouched, with no extra controls or text.
 * Pure presentation: screen readers and keyboard navigation retain all content.
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
    main.classList.add("jk-interior-scroll");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    const targets = new Set<HTMLElement>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const node = entry.target as HTMLElement;
        node.classList.toggle("jk-visible", entry.isIntersecting);
      }
    }, { threshold: 0.08, rootMargin: "0px 0px -7% 0px" });
    const register = () => {
      const selectors = ":scope > section, :scope > article, :scope > div, :scope > details";
      main.querySelectorAll<HTMLElement>(selectors).forEach((node) => {
        if (targets.has(node)) return;
        targets.add(node);
        node.classList.add("jk-reveal");
        if (reduce.matches) node.classList.add("jk-visible");
        else observer.observe(node);
      });
    };
    register();
    const changes = new MutationObserver(register);
    changes.observe(main, { childList: true });
    const update = () => {
      if (reduce.matches) targets.forEach((node) => node.classList.add("jk-visible"));
      else targets.forEach((node) => observer.observe(node));
    };
    reduce.addEventListener("change", update);
    return () => {
      changes.disconnect();
      observer.disconnect();
      reduce.removeEventListener("change", update);
      targets.forEach((node) => {
        node.classList.remove("jk-reveal", "jk-visible");
      });
      main.classList.remove("jk-interior-scroll");
    };
  }, [pathname]);
  return null;
}
