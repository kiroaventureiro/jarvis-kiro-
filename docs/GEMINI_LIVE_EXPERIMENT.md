# Gemini Live — integração experimental

Branch de destino: `integration/gemini-live-on-approved-kiro-20261101`

## Provisionamento implementado

`POST /api/voice/gemini` exige sessão Jarvis válida, origem same-origin e a chave de ativação `JARVIS_GEMINI_LIVE_ENABLED=true`. O servidor lê `GEMINI_API_KEY` (ou `GOOGLE_API_KEY`) e emite token efêmero de uso único, restrito ao modelo Live e a áudio. A chave permanente nunca é enviada ao navegador.

O token tem janela de 60 segundos para iniciar a sessão e expira após 30 minutos. O contexto enviado ao modelo é limitado e montado no servidor com perfil, princípios, memória selecionada e estado operacional resumido.

## Guardrails de custo

- `JARVIS_GEMINI_LIVE_ENABLED=true`
- `JARVIS_GEMINI_LIVE_PAID_ALLOWED=true`
- `JARVIS_GEMINI_LIVE_MAX_CALLS_PER_HOUR`: inteiro de 1 a 120.
- `JARVIS_GEMINI_LIVE_MODEL`: opcional; padrão `gemini-3.8-live`.

O contador é em memória por instância, não um limite financeiro global persistente. Antes de produção, adicionar ledger persistente e telemetria de uso do Google.

## Próxima etapa obrigatória: cliente Live

1. Substituir a sessão WebRTC/OpenAI atual por WebSocket Gemini Live usando o token efêmero.
2. Capturar o microfone somente após gesto explícito do usuário.
3. Converter áudio do microfone para PCM 16 kHz little-endian e enviar em blocos.
4. Decodificar PCM recebido e reproduzir com fila de buffers AudioContext, sem SpeechSynthesis.
5. Tratar áudio, transcrições, `turnComplete`, `interrupted`, `goAway` e atualizações de retomada.
6. Encaminhar chamadas de ferramentas permitidas ao núcleo Jarvis; não conceder execução arbitrária ao modelo.
7. Garantir cancelamento imediato e limpeza de tracks, socket, timers e AudioContext.
8. Testar microfone e alto-falantes físicos no Chrome/Edge Windows.

## Critérios de aceite

- “Respondendo” só aparece quando áudio de saída é recebido/reproduzido.
- Texto e áudio permanecem sincronizados.
- A fala do usuário interrompe a saída em andamento.
- Falhas de token/conexão aparecem como erro real, sem estado falso de resposta.
- O design oficial da home não muda.
- Nenhuma chamada paga ocorre sem autorização server-side.
