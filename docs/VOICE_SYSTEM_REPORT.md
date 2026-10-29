# Sistema de voz inteligente — Jarvis Kiro

Data: 26/10/2026. Branch exclusiva: feature/diretor-tecnico-agent. Base auditada: 4b19261497b166eb53034627a9669187b136b6d7.

## Resultado

Implementado o modo de escuta autorizado, ativação por Jarvis, respostas locais a cumprimentos e navegação, conversa via Abacus autenticada, síntese pt-BR configurável e integração com o núcleo holográfico. Não houve merge na main, publicação em produção, instalação de agente Windows, criação de credenciais ou habilitação de serviços pagos.

## Auditoria e compatibilidade preservada

A cópia de trabalho foi comparada com a árvore da branch antes das alterações e novamente antes da entrega. Foram inspecionados JarvisExperience, WakeListener, as rotas voice e director/abacus, abacus-routellm, jarvis-realtime, configurações, autenticação e testes existentes. As mudanças recentes de OwnerLogin, lib/auth, roteamento de IA e integração textual Abacus foram preservadas. Não houve alteração em lib/auth, OwnerLogin, lib/jarvis-realtime ou na política já existente de provedores gratuitos. A sessão OpenAI Realtime mantém sua arquitetura, memória de contexto, modelo e configuração vocal próprios, com novo bloqueio de custo antes da criação de sessão.

## Fluxo de uso

1. Na home, escolher Ativar escuta por Jarvis e aceitar o aviso explícito de microfone. A permissão do navegador continua obrigatória. A autorização não é persistida entre carregamentos.
2. Dizer Jarvis, Bom dia Jarvis, Boa noite Jarvis ou Jarvis seguido do pedido. O chamado isolado responde Estou ouvindo. O que você precisa? Cumprimentos recebem resposta local.
3. Após uma interação, comandos sem repetir Jarvis são aceitos durante 60 segundos. Depois, volta a aguardar a palavra de ativação. Em modo contínuo compatível, não exige novo clique a cada resposta.
4. Jarvis abra meus projetos e navegação equivalente usam uma lista explícita de páginas internas, sem execução arbitrária. Ao sair da home, a escuta é encerrada.
5. Desligar escuta contínua interrompe reconhecimento, fala, timers e pedidos pendentes; respostas tardias são descartadas. Página oculta também desliga a escuta. O próximo início exige ação do usuário.
6. Em Configurações, selecionar uma voz pt-BR, ouvir a prévia e ajustar velocidade, tom e volume. O usuário pode confirmar que a voz ouvida é masculina e adequada.

## Arquitetura implementada

VoiceController possui estados off, waiting, command, processing, speaking, resuming e error. O reconhecimento é encerrado antes de processar e durante toda a síntese. A retomada aguarda 450 ms após a fala. Há deduplicação de comandos por 3 segundos, somente uma instância ativa, cancelamento por AbortSignal e proteção contra resultados antigos. Falhas temporárias têm no máximo três recuperações consecutivas, além de dez inícios por minuto; permissão negada, falhas permanentes, erro de provedor ou síntese interrompem o modo sem repetição ilimitada.

BrowserSpeechOutput implementa uma interface substituível para futuros provedores. Usa speechSynthesis, espera carregamento assíncrono de vozes, limita trechos e trata término, erro, cancelamento e timeout. As preferências locais contêm somente voz, confirmação vocal, controles e preferência de continuidade; não contêm gravações ou credenciais. Quando localStorage não está disponível, as preferências ficam em memória da sessão.

O HUD apresenta resposta textual e estados do microfone. O núcleo usa animação representativa durante escuta/fala; não mede amplitude real, pois o reconhecimento e a síntese do navegador não expõem esse sinal nesta implementação. Essa limitação está informada nas configurações. O arraste de arquivos em toda a home e a conversa por teclado continuam funcionando. Escuta por palavra-chave, gravação de instruções sobre anexos e sessão neural são coordenadas para evitar uso simultâneo.

## Custos e segurança

As rotas continuam autenticadas antes de consultar credenciais, ler o pedido ou chamar provedores. Abacus verifica origem, limita o corpo a 8 KiB e a mensagem a 1.500 caracteres. As chaves permanecem exclusivamente no servidor. O adaptador mantém timeout de 20 segundos, teto de 350 tokens e propaga cancelamento.

Novas chamadas Abacus e criação de sessões OpenAI são bloqueadas por padrão, mesmo se já existir chave. O servidor somente admite uso quando houver autorização explícita e limite válido entre 1 e 120 chamadas/hora:

- JARVIS_ABACUS_PAID_ALLOWED e JARVIS_ABACUS_MAX_CALLS_PER_HOUR.
- JARVIS_OPENAI_VOICE_PAID_ALLOWED e JARVIS_OPENAI_VOICE_MAX_CALLS_PER_HOUR.

Nenhuma dessas autorizações foi habilitada nesta entrega. O orçamento conta tentativas e também limita seis chamadas/minuto por provedor. O contador é temporário e por instância: reinícios ou múltiplas instâncias impedem tratá-lo como teto financeiro global. Limites financeiros persistentes e leitura real de créditos permanecem para integração futura. O status consultável não faz chamada externa e informa saldo desconhecido. A assinatura ChatLLM/Abacus não implica gratuidade da API. Não há fallback pago automático. A política acima se aplica à conversa Abacus e à sessão de voz; o fluxo de análise de anexos existente foi preservado e não é acionado automaticamente pela escuta.

## Testes e evidências

- Suíte Node completa: 128 testes aprovados, zero falhas, incluindo 16 testes comportamentais novos de voz/gateway.
- TypeScript: tsc --noEmit aprovado.
- Next.js 15.5.28: build otimizado aprovado. No Windows houve falha inicial EPERM na criação concorrente de diretórios de saída; a repetição usou um auxiliar temporário fora do código-fonte para preparar essas pastas. Nenhuma configuração do aplicativo foi alterada para contornar isso.
- Teste de voz no Chrome, contra a versão local compilada: desktop e layout de iPhone, ativação, cumprimento, follow-up, bloqueio de eco, deduplicação, teclado, seleção/prévia/persistência de voz e autenticação. Cenários adicionais: desligar durante fala, página oculta, navegador sem suporte, permissão negada, falha Abacus sem retry pago e modo iOS manual.
- Regressões do HUD: desktop, iPhone e telefone estreito; transcrições, sessão neural simulada, navegação e rejeição 401.
- Regressões de anexos: arrastar, colar, análise, orientação falada, cancelamento tardio, limpeza e falha de autenticação, em três tamanhos de tela.

Os testes de áudio e respostas usam mocks: não abrem microfone real, não reproduzem voz real e não consomem APIs pagas. A rejeição de sessão não autenticada foi verificada também na rota real local. Resultados e capturas estão em outputs/jarvis-voz na área desta tarefa.

## Limitações e pendências

- A identidade masculina depende das vozes disponíveis e da seleção no dispositivo. Não é possível garantir timbre adulto/médio-grave, expressividade neural ou a mesma voz entre Windows e iPhone usando apenas Web Speech. Não há inferência de gênero pelo nome. Se não houver voz pt-BR, a resposta permanece textual e o erro orienta o usuário.
- Chrome/Edge são os alvos prioritários no Windows; esta rodada automatizada executou Chrome. Edge e microfone/alto-falante físicos ainda exigem validação no dispositivo.
- iPhone usa modo manual conservador. Layout e decisão de modo foram testados no Chromium com dimensões/identificação iOS; isso não substitui Safari/iPhone físico. Restrições de gesto e reprodução do navegador podem exigir nova interação.
- Reconhecimento pode usar processamento remoto do fabricante. O Jarvis não grava áudio persistentemente por padrão, mas isso não equivale a afirmar que o reconhecimento do navegador é local ou privado.
- A página precisa estar visível e ativa. Não há garantia com navegador fechado, aparelho bloqueado ou execução em segundo plano.
- O contrato Windows é somente preparação tipada: nenhum agente instalado, acesso permanente ao microfone ou transporte remoto habilitado.
- Conversação real com Abacus/OpenAI só deve ser validada após autorização de custo e configuração pelo responsável. Não foram solicitadas chaves nem senhas.

## Arquivos alterados

Integração: app/components/JarvisExperience.tsx, app/components/WakeListener.tsx, app/components/VoiceSettings.tsx (novo), app/configuracoes/page.tsx, app/style.css.

Voz modular (novos): lib/voice/voice-types.ts, voice-preferences.ts, wake-word-policy.ts, voice-controller.ts, speech-output.ts, cost-policy.ts, abacus-gateway.ts, windows-wake-contract.ts.

Servidor: app/api/director/abacus/route.ts, app/api/voice/route.ts, lib/abacus-routellm.ts.

Validação: package.json (script test:voice), tests/voice-system.test.mjs (novo), tests/browser/voice-smoke.cjs (novo), tests/browser/hud-smoke.cjs, tests/abacus-routellm.test.mjs, tests/hud-abacus-text.test.mjs, tests/wake-listener.test.mjs e tests/jarvis-voice-memory.test.mjs. Os testes antigos foram ajustados para o roteamento Abacus atual e para tolerar formatação, preservando as verificações de autenticação e memória.

Documentação: docs/VOICE_SYSTEM_REPORT.md.
