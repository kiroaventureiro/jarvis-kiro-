import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const ui=readFileSync(new URL("../app/components/JarvisExperience.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../app/style.css",import.meta.url),"utf8");
test("Desktop dock is hidden until pointer moves to bottom or focus is inside",()=>{
 assert.match(ui,/jarvis-desktop-focus/);
 assert.match(ui,/jarvis-dock-hotzone/);
 assert.match(css,/@media \(hover: hover\) and \(pointer: fine\) and \(min-width: 851px\)/);
 assert.match(css,/jarvis-dock-hotzone:hover/);
 assert.match(css,/:focus-within/);
});
test("Status stays accessible to assistive tech but not shown as persistent text",()=>{
 // The visible header owns the accessible live status; the old center duplicate is hidden.
 assert.match(ui,/<div role="status" aria-live="polite" aria-atomic="true"/);
 assert.match(ui,/className="state-indicator sr-only" aria-hidden="true"/);
 assert.match(css,/jarvis-desktop-focus \.state-indicator/);
 assert.match(css,/clip: rect\(0,0,0,0\)/);
});
