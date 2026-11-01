# Gemini Live — experimento híbrido do Jarvis Kiro

**Status:** adaptador híbrido implementado; experimento isolado, não habilitado em produção. Consulte [relatório de implementação](GEMINI-LIVE-IMPLEMENTATION.md).
**Branch:** `experiment/gemini-live-hybrid`  
**Base:** `feature/diretor-tecnico-agent`  
**Regra principal:** não alterar o HUD, a home, os estados visuais, os conectores existentes nem substituir o OpenAI Realtime durante a avaliação.

## Decisão arquitetural

Gemini Live será somente o transporte/modelo de conversação por voz em tempo real. O Jarvis continua sendo o produto, o orquestrador e a fonte de verdade para identidade, memória, contexto operacional, agentes, permissões e integrações.

Fluxo proposto:

1. O cliente Jarvis autentica-se no backend já existente.
2. Uma rota experimental protegida emite um token efêmero Gemini de uso único, com expiração curta e configuração Live bloqueada no servidor.
3. O navegador conecta-se diretamente ao Gemini Live usando o token efêmero; a chave permanente Google nunca chega ao cliente.
4. O cliente transmite áudio PCM em blocos pequenos e reproduz os blocos PCM de saída com buffer cancelável.
5. Chamadas de função do Gemini são encaminhadas para um adaptador Jarvis, que valida allowlist, argumentos, permissões e aprovação antes de chamar ferramentas existentes.
6. Os resultados das ferramentas retornam ao Gemini para a resposta falada.
7. Eventos de fala, interrupção, erro, conclusão e reconexão são normalizados para o contrato de estados já usado pelo HUD.

## Limites do experimento

- O experimento fica atrás de `JARVIS_GEMINI_LIVE_ENABLED=false` por padrão.
- O OpenAI Realtime permanece intacto e selecionável como fallback.
- Nenhuma alteração de interface, CSS, animação, layout ou design é permitida nesta etapa.
- Nenhuma chave permanente, token efêmero ou segredo pode ser registrado em logs.
- Não habilitar gravação, retenção de áudio ou retomada de sessão sem decisão explícita de privacidade.
- Não enviar todo o histórico privado ao Google. O backend constrói um resumo mínimo e contextual, limitado ao necessário para a sessão.
- Chamadas de ferramentas nunca executam diretamente por instrução do modelo: o adaptador Jarvis valida e aplica as mesmas regras de autorização já existentes.
- Operações de escrita, publicação, compra, envio, exclusão e outras ações consequenciais continuam exigindo aprovação explícita.
- A voz do Gemini deve ser avaliada por audição real em pt-BR. Não prometer clonagem ou imitação de ator/dublador. VoiceStudio e Browser Speech permanecem independentes.

## Componentes do experimento

### Backend
- `app/api/voice/gemini-token/route.ts`: autenticação Jarvis, feature gate, orçamento/limite, emissão de token efêmero Google com `uses: 1`, expiração curta e `liveConnectConstraints` fixadas.
- Configuração permitida definida no servidor: modelo aprovado, áudio como modalidade de resposta, idioma/instruções Jarvis e ferramentas allowlisted.
- Erros upstream normalizados sem expor resposta sensível do Google.
- Contabilização de sessão e falha sem registrar payloads de áudio ou tokens.

### Cliente
- Adaptador `GeminiLiveVoiceAdapter` separado do controlador atual.
- Captura de microfone com `getUserMedia`, cancelamento de eco e supressão de ruído solicitados ao navegador.
- Conversão/resampling de entrada para PCM 16 kHz little-endian; saída PCM 24 kHz.
- Buffer de reprodução com descarte imediato quando chegar evento `interrupted`.
- Tratamento de reconexão, `goAway`, `sessionResumptionUpdate`, encerramento e expiração.
- Normalização de eventos para os estados Jarvis existentes: connecting, listening, processing, responding, idle e error.
- Alternância experimental somente em preferências ocultas já existentes; sem controles persistentes na home.

### Orquestração
- Criar uma ponte de ferramentas Gemini → Jarvis para as capacidades já implementadas.
- A implementação usa uma única ponte `jarvis_conversation` sem argumentos: encaminha a transcrição original ao callback Jarvis já existente, incluindo memória, agentes e suas autorizações. Não recebe planos ou aprovações gerados pelo Gemini.
- Status/pesquisa e demais capacidades continuam no fluxo Jarvis existente; não duplicar lógica nem conceder ferramentas administrativas ao Gemini.
- Preservar memória Jarvis e contexto operacional como fonte de verdade; Gemini recebe apenas o contexto mínimo de sessão.
- Não confundir memória de sessão Live com memória persistente Jarvis.

## Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Eco da própria voz disparar interrupção | Preferir VAD/interrupção nativos do Live; testar AEC no Chrome/Edge e não usar o detector RMS experimental como única proteção |
| Cortes ou áudio atrasado | PCM em blocos de 20–40 ms, buffer limitado e descarte em interrupção |
| Sessão cair após ~10 min | Implementar reconexão e retomada; tratar GoAway e validade do token |
| Contexto crescer e encarecer | Compressão/resumo e limite de contexto; não retransmitir áudio/histórico sem necessidade |
| Modelo tentar executar ação indevida | Allowlist no backend, validação de schema, autorização e aprovação humana |
| Alterar o design aprovado | Nenhuma alteração visual nesta branch experimental |

## Plano de validação

1. Token: autenticação, feature gate desligado, token único, expiração e ausência da chave permanente no navegador.
2. Áudio: captura e reprodução pt-BR, qualidade, latência de primeiro áudio e estabilidade por 30 minutos.
3. Interrupção: falar durante a resposta; áudio anterior deve parar sem atraso perceptível e sem eco auto-interromper.
4. Continuidade: reconexão/retomada sem perder o contexto essencial.
5. Ferramentas: status e pesquisa de leitura com resultados confirmados; testar argumentos inválidos e tentativas de ferramentas não permitidas.
6. Memória: verificar que o Jarvis continua consultando a própria memória e não inventa persistência no Gemini.
7. Custos/privacidade: registrar métricas agregadas de duração/tokens, nunca áudio ou segredos; validar limites e desligamento.
8. Compatibilidade: Windows Chrome, Windows Edge e iPhone Safari separadamente.
9. Regressão: todos os testes atuais de voz e HUD passam; a experiência OpenAI continua funcional.

## Critérios para sair do modo experimental

- Aprovação do proprietário após teste auditivo.
- Latência, interrupção, qualidade pt-BR e estabilidade dentro das metas acordadas.
- Testes automatizados e smoke tests aprovados.
- Orçamento, limites, privacidade e chave Google configurados conscientemente.
- Revisão do diff e aprovação explícita antes de qualquer ativação em produção.

## Documentação oficial de referência

- Live API capabilities: https://ai.google.dev/gemini-api/docs/live-api/capabilities
- Ephemeral tokens: https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens
- Session management: https://ai.google.dev/gemini-api/docs/live-api/session-management
- Best practices: https://ai.google.dev/gemini-api/docs/live-api/best-practices
- Pricing: https://ai.google.dev/gemini-api/docs/pricing

**Nota de versão:** o modelo documentado como `gemini-3.8-live` e os campos do SDK devem ser confirmados novamente no momento da implementação e dos testes, pois a Live API está em preview e pode mudar.
