import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const chat=readFileSync(new URL("../app/components/JarvisExperience.tsx",import.meta.url),"utf8");
const image=readFileSync(new URL("../app/components/JarvisGeneratedImage.tsx",import.meta.url),"utf8");
test("Jarvis attaches only actual locally generated images to the relevant response",()=>{
 assert.match(chat,/holoSession\.rememberMedia\(items\)/);
 assert.match(chat,/setGeneratedImages\(previous=>\[\.\.\.previous\.slice\(-7\),\{messageId:assistantId,file:image\.file,label:image\.label,autoDownloadOnArrival:desktopDownloadCapable && autoDownload\}\]\)/);
 assert.match(chat,/generatedImages\.filter\(image=>image\.messageId === item\.id\)/);
 assert.match(chat,/<JarvisGeneratedImage/);
});
test("Temporary image preview enforces MIME and size and releases browser URL",()=>{
 assert.match(image,/image\/png/);
 assert.match(image,/8_000_000/);
 assert.match(image,/URL\.createObjectURL\(file\)/);
 assert.match(image,/URL\.revokeObjectURL\(objectUrl\)/);
});

test("Generated images survive later chat turns within an eight-image memory bound",()=>{
 assert.match(chat,/previous\.slice\(-7\)/);
 assert.doesNotMatch(chat,/setGeneratedImage\(null\)/);
});

test("Generated images can be saved locally using temporary object URLs",()=>{
 assert.match(image,/aria-label="Salvar imagem gerada"/);
 assert.match(image,/download=/);
 assert.match(image,/file\.size\s*===\s*0/);
 assert.doesNotMatch(image,/localStorage|dangerouslySetInnerHTML/);
});

test("Auto download opt-in only applies to images generated after enabling",()=>{
 assert.match(chat,/autoDownloadOnArrival:desktopDownloadCapable && autoDownload/);
 assert.match(chat,/autoDownload=\{image\.autoDownloadOnArrival\}/);
 assert.match(image,/claimAutomaticDownload\(id\)/);
});
