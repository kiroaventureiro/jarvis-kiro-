import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const source=fs.readFileSync("lib/connectors/write-intent.ts","utf8");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {parseGitHubWriteIntent:parse}=await import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
test("recognizes explicit Portuguese GitHub file creation",()=>{
  const intent=parse("Jarvis, crie no GitHub do projeto Jarvis Kiro um arquivo docs/ensaio.md com o conteúdo: teste");
  assert.deepEqual(intent,{kind:"create_file",path:"docs/ensaio.md",content:"teste"});
});
test("does not treat a general request as a file write",()=>{
  assert.equal(parse("Como estão meus repositórios GitHub?"),null);
  assert.equal(parse("Crie uma história sobre o GitHub"),null);
});
test("rejects oversized uploads",()=>{
  assert.equal(parse("Crie no GitHub o arquivo a.md com o conteúdo: "+ "x".repeat(25000)),null);
});

test("recognizes creating a GitHub folder as a gitkeep file",()=>{
  const result=parse("Jarvis, crie uma pasta docs/relatorios no projeto Jarvis Kiro");
  assert.deepEqual(result,{kind:"create_folder",path:"docs/relatorios/.gitkeep",content:""});
});
test("recognizes a spoken directory request",()=>{
  const result=parse("Crie um diretório chamado testes no repositório GitHub");
  assert.deepEqual(result,{kind:"create_folder",path:"testes/.gitkeep",content:""});
});
test("rejects directory traversal",()=>{
  assert.equal(parse("Crie a pasta ../segredos no projeto Jarvis Kiro"),null);
});

test("understands folder requests when GitHub is in conversation history",()=>{
 const result=parse("Jarvis, crie uma pasta chamada testes-kiro", "Estávamos trabalhando no GitHub do projeto Jarvis Kiro");
 assert.deepEqual(result,{kind:"create_folder",path:"testes-kiro/.gitkeep",content:""});
});
