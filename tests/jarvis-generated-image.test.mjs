import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const chat=readFileSync(new URL("../app/components/JarvisExperience.tsx",import.meta.url),"utf8");
const image=readFileSync(new URL("../app/components/JarvisGeneratedImage.tsx",import.meta.url),"utf8");
test("Jarvis attaches only actual locally generated images to the relevant response",()=>{
 assert.match(chat,/holoSession\.rememberMedia\(items\)/);
 assert.match(chat,/setGeneratedImage\(\{messageId:assistantId,file:image\.file,label:image\.label\}\)/);
 assert.match(chat,/generatedImage\?\.messageId === item\.id/);
 assert.match(chat,/<JarvisGeneratedImage/);
});
test("Temporary image preview enforces MIME and size and releases browser URL",()=>{
 assert.match(image,/image\/png/);
 assert.match(image,/8_000_000/);
 assert.match(image,/URL\.createObjectURL\(file\)/);
 assert.match(image,/URL\.revokeObjectURL\(objectUrl\)/);
});
