import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const source=fs.readFileSync("lib/connectors/provider-speech.ts","utf8");
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {normalizeProviderSpeech}=await import("data:text/javascript;base64,"+Buffer.from(code).toString("base64"));
test("corrige nomes de serviços transcritos na fala",()=>{
 assert.match(normalizeProviderSpeech("Entre no Kit Hub e liste os repositórios"),/GitHub/);
 assert.match(normalizeProviderSpeech("Verifique meu sofá base"),/Supabase/);
 assert.match(normalizeProviderSpeech("Mostre a versel"),/Vercel/);
 assert.match(normalizeProviderSpeech("Veja o Russell e seus deployments"),/Vercel/);
});
test("não interpreta Russell sem indício técnico",()=>{
 assert.equal(normalizeProviderSpeech("Converse com Russell"),"Converse com Russell");
});
test("resolve Russell pelo contexto da conversa",()=>{
 assert.equal(normalizeProviderSpeech("E o Russell?",[{role:"user",content:"Me mostre a Vercel"}]),"E o Vercel?");
});
test("não modifica solicitações de terceiros sem referência",()=>{
 assert.equal(normalizeProviderSpeech("Compre um sofá para a base"),"Compre um sofá para a base");
});
