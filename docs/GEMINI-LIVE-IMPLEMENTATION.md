# Relatório técnico — Gemini Live híbrido

## Análise anterior às alterações

A branch `experiment/gemini-live-hybrid` já tinha o endpoint de token, gates e documentos no PR #25; faltava o cliente. A análise foi feita antes da primeira edição.

- `WakeListener` e `lib/voice/voice-controller.ts`: reconhecimento Web Speech, consentimento, escuta contínua, estados, interrupção e encaminhamento ao callback `onMessage`.
- `JarvisExperience`: sessão OpenAI Realtime/WebRTC, teclado, histórico, projeções e callback compartilhado de conversa; nele estão as intenções locais, status de agentes, propostas/aprovações Codex e `requestAbacus`.
- `speech-output`, `neural-speech-output`, `voicestudio*`: saídas TTS preexistentes. Não usadas como substituto do Gemini nesta sessão.
- `voice-preferences`: volume e evento compartilhados. `barge-in-monitor`: detector legado, não iniciado em paralelo ao Live.
- `jarvis-memory`, `server-memory`, `memory/*`, gateway Abacus e rotas diretor: fontes existentes de contexto, memória e orquestração. Não foi criado banco ou sistema paralelo de memória/agentes.
- `lib/operational/realtime-tool.ts`: ferramentas anteriores de status/pesquisa; optou-se por reutilizar o callback completo Jarvis em vez de duplicar esses roteadores.
- Componentes holográficos, esfera, anéis, partículas, fontes, CSS e marcação visual foram preservados.

## Arquitetura implementada

`microfone → AudioWorklet PCM16 mono 16 kHz / 20 ms → Gemini Live → transcrição + jarvis_conversation → callback Jarvis existente → resultado → Gemini áudio PCM24 kHz → AudioContext/GainNode local`.

O navegador recebe apenas credencial efêmera. `GEMINI_API_KEY` é lida exclusivamente na rota do servidor. O SDK oficial `@google/genai` 2.32.0 implementa o transporte. O modelo consultado na documentação oficial é `gemini-3.8-live`, API `v1beta`. As instruções bloqueadas no token exigem pt-BR e encaminhamento de cada mensagem ao Jarvis.

A ponte não tem argumentos: o Gemini não pode escolher comandos, IDs administrativos, parâmetros nem aprovações. O adaptador usa a transcrição concluída do usuário ou o texto digitado; passa-os ao mesmo callback Jarvis, que mantém suas políticas de execução. Chamadas desconhecidas, argumentos extras, repetição e resultados tardios são rejeitados. Isso não cria capacidades que o Jarvis ainda não possua nem autoriza ações novas.

A sessão de áudio experimental exige a política desktop já calculada por `JarvisExperience`; no celular permanece o teclado, sem iniciar áudio Gemini. O áudio antes da resposta do núcleo é descartado. Todos os blocos de saída são processados e agendados numa fila cancelável; `interrupted` limpa imediatamente fontes e fila e aborta consultas pendentes. A captura solicita AEC, supressão de ruído e AGC; não há monitoramento local do microfone. Não se usa RMS como prova de fala humana nem se desliga a captura durante a resposta.

Reconexão: handle somente em RAM, GoAway, três tentativas com backoff, renovação anterior à expiração e timeout de conexão. Cada reconexão pede token novo com handle bloqueado no servidor e consome orçamento persistente. Perda/expiração de handle que impeça a retomada resulta em erro explícito e reinício manual, não promessa de continuidade perfeita. Ocultar página, trocar operação, navegar ou desligar libera microfone, nós de áudio, socket, timers e requisições.

## Isolamento e segurança

- Opt-in explícito: `/?voice=gemini-live`, botão de escuta e consentimento existentes; sem novo controle/design.
- Sessão Jarvis obrigatória, verificação de origem, gates de recurso/custo e limite persistente preexistente.
- Produção recusada no servidor mesmo que alguém habilite os gates.
- Token de uso único; 60 segundos para iniciar, 30 minutos de validade; configuração de áudio, instruções e ferramenta bloqueada no servidor.
- Respostas sem cache; erros Google sanitizados; nenhum log de chave, token, handle ou áudio.
- Sem env pull, alteração de variáveis Vercel, ativação paga, merge ou deploy de produção.
- O fluxo estável segue disponível sem o parâmetro de opt-in. Durante sessão experimental, teclado usa a mesma ponte e voz Gemini, sem TTS alternativo. Encerrada a sessão, o teclado normal continua intacto.
- A conversa usa serviços Google e o núcleo Jarvis existente; não implica garantia sobre retenção feita pelos provedores. A aplicação não grava áudio bruto.

## Arquivos modificados/adicionados

- `app/api/voice/gemini-token/route.ts`
- `app/components/WakeListener.tsx`
- `app/components/JarvisExperience.tsx`
- `lib/voice/gemini-config.ts`
- `lib/voice/gemini-live-adapter.ts`
- `lib/voice/gemini-audio.ts`
- `public/voice/gemini-capture.js`
- `tests/gemini-live.test.mjs`
- `tests/gemini-token.test.mjs`
- `package.json`, `package-lock.json`
- `docs/GEMINI-LIVE-ENV.md`, `docs/GEMINI-LIVE-HYBRID-EXPERIMENT.md`, este relatório.

## Evidências e limites

- `npm test`: **619 testes aprovados, 0 falhas, 0 ignorados**.
- Testes focados Gemini: **13 aprovados**, com transporte e hardware simulados.
- `npx tsc --noEmit`: aprovado.
- `npm run build`: aprovado (build local, não publicação em produção).
- `git diff --check`: aprovado; nenhum CSS ou componente 3D alterado.
- Busca em `.next/static`: nenhuma referência a `GEMINI_API_KEY` no bundle do navegador.


Os testes funcionais focados usam SDK, microfone e AudioContext simulados: PCM não nulo/little-endian, blocos de 20ms, decode de saída, agendamento, volume/mute, limpeza de fontes, permissão tardia, interrupção, teclado, transcrição parcial/fora de ordem, resposta do núcleo, cancelamento e descarte de resultado tardio, rejeição de ferramentas/argumentos, deduplicação, GoAway/retomada e cancelamento de retries. A rota é exercitada com autenticação/origem/gates/produção/orçamento, token restrito, ausência da chave na resposta e erros sanitizados. Isso não é teste acústico ou chamada real Google.

A chave real não foi lida nem usada. É necessário um teste autenticado no Preview com gates/custo/budget aprovados para comprovar emissão real Google e compatibilidade do modelo com a conta. Depois, testar Windows Chrome/Edge com microfone/alto-falantes reais: fala simultânea, rejeição de eco, pt-BR, latência, reconexão e sessão de pelo menos 30 minutos. AEC solicitado não garante ausência física de eco; fones são recomendados no primeiro teste. O navegador não permite garantir escuta contínua com a aba oculta ou sistema suspenso.

## Referências oficiais consultadas

- https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens
- https://ai.google.dev/gemini-api/docs/live-api/capabilities
- https://ai.google.dev/gemini-api/docs/live-api/best-practices
