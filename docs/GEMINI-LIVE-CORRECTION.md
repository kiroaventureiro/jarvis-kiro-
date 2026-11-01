# Correção prioritária — Gemini Live / Jarvis Kiro

## Causa raiz e evidências

1. **Gemini não ativado:** metadados CLI do Preview geral mostram `GEMINI_API_KEY` secreta cadastrada e herdada pela branch. A listagem de overrides da branch está vazia (isso NÃO significa que a chave geral esteja ausente). Os três gates `JARVIS_GEMINI_LIVE_ENABLED`, `JARVIS_GEMINI_LIVE_PAID_ALLOWED` e `JARVIS_GEMINI_LIVE_MAX_CALLS_PER_HOUR` não constam no Preview. Com login válido, a primeira rejeição é 403 de feature desativada; sem login, 401. Não foi lida a chave, portanto validade Google/quota ainda não comprovadas.
2. **Entradas divergentes:** o opt-in `?voice=gemini-live` era lido apenas por WakeListener. O microfone principal continuava abrindo OpenAI Realtime. Teclado sem sessão Live ativa continuava pelo fluxo normal e `getVoiceManager().speak()`.
3. **TTS residual confirmado em código:** `speech-output.ts` usa `SpeechSynthesisUtterance` e `speechSynthesis.speak`, escolhendo voz pt-BR do navegador; essa voz pode ser Google, conforme dispositivo/preferência. Não foi encontrada chamada direta a `texttospeech.googleapis.com` nesses caminhos. Não é correto declarar qual voz física foi ouvida só por logs. Havia chamadas no teclado, análise de arquivos e notificações, além de fallback no adaptador neural. Agora BrowserSpeechOutput e NeuralSpeechOutput recusam síntese enquanto Gemini estiver selecionado.
4. **Auto-interrupção:** o modo legado podia iniciar o monitor de energia do microfone durante TTS; energia não identifica locutor e pode disparar com eco. No adaptador Live anterior, qualquer novo fragmento de transcrição também limpava a reprodução, mesmo sem evento VAD `interrupted`. Isso permitia cancelar a própria resposta com transcrição atrasada/vazada. O relato acústico do usuário é compatível com esses caminhos; não há gravação para provar qual deles ocorreu na sessão.
5. **Painel antigo:** experimento baseado em `feature/diretor-tecnico-agent`, não na branch de UI aprovada. Comparação com `feature/approved-ui-plus-long-context-20261030` (`f906ff3`) mostrou `shown.length && !holoSession.current` versus a condição aprovada adicional `(typing || history)`. A condição de diálogo foi restaurada. Não se importou o redesign/3D ou a branch inteira, nem se alteraram CSS, esfera, anéis, partículas ou tipografia.
6. **Diagnóstico oculto:** o cliente substituía 403/503 por uma frase genérica e solicitava microfone antes de saber se a API estava liberada.

A consulta CDN do deployment anterior, entre 16:25 e 16:32 UTC, filtrada por `/api/voice*`, retornou zero registros sem lacunas declaradas. Isso não comprova qual motor o usuário ouviu, nem uma sessão Live bem-sucedida.

## Correções

- Seleção automática **somente** no Preview da branch experimental usando contexto de build; selecionar não ativa áudio nem gastos. Opt-in por URL continua suportado.
- Microfone principal e escuta usam o mesmo adaptador Gemini. Guard adicional impede abrir OpenAI quando Gemini foi selecionado.
- Posse exclusiva de áudio enquanto selecionado, inclusive após erro/stop: nenhum fallback silencioso para TTS de navegador, neural ou VoiceStudio. A voz estável fora do opt-in não foi removida.
- Teclado sem Live conectado preserva a conversa Jarvis somente por texto, com aviso explícito e sem TTS alternativo. Com sessão Live, compartilha a mesma ponte Jarvis.
- Rota devolve HTTP + código sanitizado. Falhas upstream mostram apenas status Google, nunca payload/chave/token. Readiness GET autenticado não cria tokens, não admite sessões e não chama Google. Configuração/autorização são verificadas antes do microfone.
- Limite persistente agora é requisito explícito: sem armazenamento, 503 e nenhuma emissão de token.
- No Live, transcrição sozinha não interrompe a saída. `interrupted` nativo limpa a fila/fontes e aborta consulta pendente. Transcrições durante reprodução sem interrupção não viram comandos Jarvis.
- AEC do navegador + guarda secundária de correlação com a referência PCM realmente reproduzida, após o volume, no mesmo AudioContext. Quadros altamente correlacionados com a saída (atrasos 0–300ms) são substituídos por silêncio; fala não correlacionada/mista segue para VAD Live, sem desligar o microfone ou usar mute de meio-duplex.
- Estado distingue **selecionado/inativo**, conexão, erro e **ativo**; durante reprodução mostra contadores de blocos PCM enviados/recebidos, AEC reportado pelo track e quadros de eco filtrados. Nenhum áudio é armazenado.
- Resposta só recebe marcação de voz disponível após o primeiro bloco de saída PCM; a proveniência da resposta Jarvis é preservada.

## Limites honestos

A guarda de correlação não é identificação biométrica nem um cancelador adaptativo completo de sala. Os testes sintéticos de eco atrasado, near-end e double-talk passaram, mas não provam rejeição de todo eco real/reverberação. A interrupção depende do VAD nativo; latência e fala humana simultânea em alto-falantes precisam de ensaio acústico. Não declarar “sem eco” nem “voz Gemini comprovada por audição” antes disso. Fones são o primeiro teste recomendado.

## Variáveis necessárias (Preview experimental apenas)

| Variável | Requisito/estado observado |
|---|---|
| `GEMINI_API_KEY` | Secret servidor; cadastrada no Preview geral, herdada; valor não lido |
| `JARVIS_GEMINI_LIVE_ENABLED` | `true` apenas para ensaio autorizado; ausente |
| `JARVIS_GEMINI_LIVE_PAID_ALLOWED` | `true` apenas após aprovação de custo; ausente |
| `JARVIS_GEMINI_LIVE_MAX_CALLS_PER_HOUR` | inteiro 1–120 aprovado; ausente |
| `JARVIS_SESSION_SECRET` | sessão privada existente; nunca expor |
| `JARVIS_CONNECTOR_STORE_URL/KEY`, `JARVIS_CONNECTOR_ENCRYPTION_KEY` | infraestrutura existente de limite persistente; não alterar credenciais |

Limite de sessões por hora NÃO é teto monetário. É preciso definir orçamento Google e limite de sessões antes de liberar uso pago. Nenhuma dessas variáveis foi alterada; Production não foi tocada; nenhum merge.

## Procedimento de teste

1. Abrir o novo Preview no computador, sem necessidade de parâmetro nessa branch. Confirmar **Gemini Live selecionado / inativo / TTS bloqueado**. Não confundir seleção com transporte ativo.
2. Usar qualquer botão de microfone: ambos abrem consentimento Gemini, não sessão OpenAI.
3. Clicar **Verificar endpoint Gemini sem consumo**. Sem login: 401 `AUTH_REQUIRED`. Autenticar pelo fluxo existente do Jarvis e repetir: gates ausentes dão 403 `LIVE_DISABLED`. O diagnóstico não usa a chave Google.
4. Depois de orçamento monetário e limite de sessões definidos/aprovados, configurar gates apenas no Preview experimental e gerar um novo Preview. Alterações de env não modificam deployments anteriores.
5. Ativar: Network deve mostrar POST `/api/voice/gemini-token` 200 e WebSocket Live Google; o status mostra ativo após conexão e contadores PCM após envio/saída. Se HTTP não for 200 ou WebSocket falhar, status mostra erro e não há voz alternativa. Nenhuma requisição OpenAI Realtime ou `/api/voice/neural` deve ser iniciada.
6. Verificar que teclado sem conexão funciona somente por texto com aviso de TTS bloqueado; conectado usa Jarvis → ferramenta Gemini sem argumentos → áudio Live. Nenhum `speechSynthesis.speak` deve ocorrer no modo Gemini.
7. Com fones, depois alto-falantes: falar durante resposta, conferir descarte imediato da fila ao evento `interrupted`, nenhuma retomada de bloco antigo, nenhuma repetição da própria fala como pedido. Aumentar volume controladamente e registrar contadores AEC/eco, latência e quedas; testar 30 minutos, GoAway, expiração e desconexão.
8. Confirmar painel recolhido durante voz, disponível ao abrir teclado/histórico, e esfera/anéis/partículas inalterados.
9. Fechar/ocultar aba encerra captura e socket. Não fazer merge ou ativar Production sem nova autorização.

## Arquivos da correção

- `app/page.tsx`
- `app/components/JarvisExperience.tsx`
- `app/components/WakeListener.tsx`
- `app/api/voice/gemini-token/route.ts`
- `lib/voice/audio-owner.ts`
- `lib/voice/speech-output.ts`
- `lib/voice/neural-speech-output.ts`
- `lib/voice/voice-types.ts`
- `lib/voice/gemini-live-adapter.ts`
- `lib/voice/gemini-audio.ts`
- `public/voice/gemini-capture.js`
- `public/voice/gemini-echo-guard.js`
- `tests/gemini-live.test.mjs`
- `tests/gemini-token.test.mjs`
- `tests/integration/gemini-endpoint-http.cjs`
- `docs/GEMINI-LIVE-ENV.md`
- este relatório.

## Validação executada

- `npm test`: 624 testes aprovados, zero falhas/ignorados.
- Testes focados Gemini: 18 aprovados, incluindo falhas HTTP sem abrir microfone, bloqueio exclusivo, transcrição atrasada, eco atrasado sintético e fala simultânea.
- TypeScript e build Next local aprovados. A regressão focada ampliada de voz/HUD/VoiceStudio também passou: 54 testes.
- Teste HTTP com processo Next real (`node tests/integration/gemini-endpoint-http.cjs`), sessão LOCAL gerada em RAM e nenhuma credencial de produção: GET e POST para 401 `AUTH_REQUIRED`, 403 `LIVE_DISABLED`, 503 `KEY_MISSING`, 403 `COST_NOT_APPROVED`, 503 `SESSION_BUDGET_INVALID`, 503 `PERSISTENT_LIMIT_UNAVAILABLE`, 403 `PRODUCTION_BLOCKED`; origem externa rejeitada em todos os cenários. Não usa mocks do handler. Usa `localhost`, origem canônica do servidor Next local; `127.0.0.1` difere dessa origem e foi corretamente rejeitado no ensaio inicial.
- Nenhuma chamada Google Live paga foi executada. Teste acústico real e emissão Google autenticada permanecem pendentes dos gates/orçamento e de microfone físico.

## Referências

Google: https://ai.google.dev/gemini-api/docs/live-api/capabilities e https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens .
Vercel: https://vercel.com/docs/environment-variables (herança, overrides e aplicação apenas em novos deployments).
