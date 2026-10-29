import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
import vm from "node:vm";
const src=readFileSync(new URL("../lib/downloads/automatic.ts",import.meta.url),"utf8");
const exp={};
vm.runInNewContext(ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exp});
test("Automatic downloads are opt-in and disabled on mobile",()=>{
 const storage={value:null,getItem(){return this.value},setItem(k,v){this.value=v}};
 assert.equal(exp.readAutoDownloadPreference(storage),false);
 assert.equal(exp.desktopDownloadsSupported("Mozilla/5.0 (iPhone)",false),false);
 assert.equal(exp.desktopDownloadsSupported("Mozilla/5.0 (Windows NT 10.0)",false),true);
 assert.equal(exp.saveAutoDownloadPreference(storage,true),true);
 assert.equal(exp.readAutoDownloadPreference(storage),true);
});
test("Auto-download identity is deduplicated and rejects invalid ids",()=>{
 assert.equal(exp.claimAutomaticDownload("short"),false);
 assert.equal(exp.claimAutomaticDownload("generatedImage123456"),true);
 assert.equal(exp.claimAutomaticDownload("generatedImage123456"),false);
 exp.releaseAutomaticDownload("generatedImage123456");
 assert.equal(exp.claimAutomaticDownload("generatedImage123456"),true);
});
