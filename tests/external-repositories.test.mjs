import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const registry=JSON.parse(readFileSync(new URL("../config/external-repositories.json",import.meta.url),"utf8"));
test("third-party integration registry is an explicit, disabled allowlist",()=>{
  assert.equal(registry.schemaVersion,1);
  assert.equal(registry.policy.automaticInstall,false);
  assert.equal(registry.policy.productionChanges,false);
  assert.equal(registry.repositories.length,10);
  assert.equal(new Set(registry.repositories.map(x=>x.slug)).size,10);
  for(const entry of registry.repositories){
    assert.match(entry.slug,/^[\w.-]+\/[\w.-]+$/);
    assert.equal(entry.url,"https://github.com/"+entry.slug);
    assert.equal(entry.enabled,false);
    assert.equal(entry.requiresReview,true);
    assert.ok(entry.note.length>25);
    assert.ok(entry.license);
  }
});
test("unclear and copyleft licenses cannot be silently embedded",()=>{
  const bySlug=Object.fromEntries(registry.repositories.map(x=>[x.slug,x]));
  assert.equal(bySlug["Comfy-Org/ComfyUI"].license,"GPL-3.0");
  assert.equal(bySlug["melgarafael/james_painel_de_voz"].adoption,"audit-license");
  assert.equal(bySlug["duixcom/Duix-Avatar"].adoption,"isolated-experiment");
  assert.equal(bySlug["Wan-Video/Wan2.1"].enabled,false);
});
