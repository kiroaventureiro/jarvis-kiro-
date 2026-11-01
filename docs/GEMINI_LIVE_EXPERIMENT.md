# Gemini Live — integração experimental

Branch: `feature/gemini-live-voice-experimental`

## Objetivo desta etapa

Adicionar o provisionamento seguro de tokens efêmeros Gemini Live sem expor a chave permanente no navegador. A integração de áudio no cliente permanece uma etapa separada; esta entrega não declara o fluxo de voz como concluído.

## Endpoint

`POST /api/voice/gemini`

- Exige sessão Jarvis válida e origem same-origin.
- Lê `GEMINI_API_KEY` (ou `GOOGLE_API_KEY`) exclusivamente no servidor.
- Emite token efêmero de uso único, com janela de 60 segundos para iniciar e expiração de 30 minutos.
- Restringe o token ao modelo `gemini-3.8-live` e modalidade de áudio.
- Inclui transcrição de entrada/saída e retomada de sessão.
- Nunca retorna a chave permanente.
- Bloqueia consumo até autorização explícita e limite por hora.

## Variáveis de ambiente

- `GEMINI_API_KEY`: chave permanente no ambiente server-side da Vercel.
- `JARVIS_GEMINI_LIVE_PAID_ALLOWED=true`: habilita provisionamento pago.
- `JARVIS_GEMINI_LIVE_MAX_CALLS_PER_HOUR`: inteiro entre 1 e 120.
- `JARVIS_GEMINI_LIVE_MODEL`: opcional; padrão `gemini-3.8-live`.

O contador atual é em memória por instância, portanto não equivale a um limite financeiro global persistente. Antes de produção, implementar ledger persistente e telemetria de uso do Google.

## Próxima etapa obrigatória: cliente Live

1. Trocar a sessão WebRTC/OpenAI atual por WebSocket Gemini Live com o token efêmero.
2. Capturar microfone apenas após gesto explícito do usuário.
3. Converter áudio para PCM 16 kHz little-endian e enviar em blocos.
4. Decodificar áudio PCM recebido e reproduzir com fila de buffers AudioContext, sem SpeechSynthesis.
5. Tratar `serverContent.modelTurn.parts[].inlineData`, transcrições, `turnComplete`, `interrupted`, `goAway` e `sessionResumptionUpdate`.
6. Encaminhar chamadas de ferramentas permitidas ao núcleo Jarvis; não conceder execução arbitrária ao modelo.
7. Garantir cancelamento imediato, limpeza de tracks, socket, timers e AudioContext.
8. Testar áudio físico no Chrome/Edge Windows; mocks não contam como prova de som real.

## Critérios de aceite

- O Jarvis só entra em “Respondendo” quando áudio de saída é recebido/reproduzido.
- Texto e áudio permanecem sincronizados.
- A fala do usuário interrompe a saída em andamento.
- Falhas de conexão/token aparecem como erro real, sem estado falso de resposta.
- O design aprovado da home não muda.
- Nenhuma chamada paga ocorre sem autorização server-side.
