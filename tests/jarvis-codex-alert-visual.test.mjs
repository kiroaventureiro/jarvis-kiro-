import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const ui=readFileSync(new URL("../app/components/JarvisExperience.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../app/style.css",import.meta.url),"utf8");
test("Codex notifications give transient visual feedback without permanent status labels",()=>{
 assert.match(ui,/data-codex-alert=\{codexAlertVisual \|\| "none"\}/);
 assert.match(ui,/setCodexAlertVisual\(null\)/);
 assert.match(css,/data-codex-alert="success"/);
 assert.match(css,/data-codex-alert="error"/);
 assert.match(css,/prefers-reduced-motion: no-preference/);
});
