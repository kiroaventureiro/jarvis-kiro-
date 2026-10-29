# Respostas por voz no computador

Implementação de 26/10/2026 na branch feature/diretor-tecnico-agent, sobre a90a8e1aae56cb430dac690867256a14cf1bd408.

## Comportamento

- No computador com ponteiro fino/hover, falas reproduzidas pelo Jarvis ficam ocultas no HUD, inclusive no histórico. O modo também vale para pedidos digitados: tenta a síntese do navegador e mostra o texto se não houver reprodução disponível.
- Sem voz pt-BR, com áudio silenciado, volume da síntese zerado, bloqueio/erro de reprodução ou interrupção, a resposta textual permanece como alternativa.
- No celular, a transcrição continua visível como antes. A identificação considera capacidades do ponteiro e identificação de dispositivos móveis; não depende somente da largura da janela.
- A fala é distinguida dos resultados. Análise de arquivos, relatórios e conteúdo visual existente continuam visíveis. O ajuste não adiciona geradores de vídeos/imagens nem transforma a fala em arquivos; preserva os resultados que o fluxo existente entrega.
- Na sessão OpenAI Realtime, transcrições de áudio seguem a mesma regra e voltam ao texto se a saída falhar ou nenhum fluxo de áudio estiver disponível. Respostas apenas textuais continuam visíveis.
- Nenhuma transcrição é apagada da memória da sessão; a política controla a apresentação. Não há fala escondida no DOM do computador quando a saída por voz está disponível.

## Arquivos

app/components/JarvisExperience.tsx, app/components/WakeListener.tsx, lib/jarvis-realtime.ts, lib/voice/voice-controller.ts e novo lib/response-presentation.ts. Testes: tests/response-presentation.test.mjs, tests/voice-system.test.mjs, tests/browser/voice-smoke.cjs e tests/browser/hud-smoke.cjs.

## Validação

132 testes Node aprovados, zero falhas. TypeScript aprovado. Testes de navegador verificam computador/celular, falha e ausência de voz, áudio silenciado, pedidos digitados, sessão neural com falha de reprodução e preservação dos resultados de análise de arquivos. Os testes usam áudio, respostas e APIs simuladas, sem microfone real ou consumo de serviços pagos.

O build Next.js e as verificações do GitHub são registrados na evidência final desta tarefa. Não houve merge na main nem publicação em produção.
