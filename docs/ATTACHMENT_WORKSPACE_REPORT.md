# Jarvis Kiro — home como área holográfica de arquivos

Data: 26/10/2026
Branch: feature/diretor-tecnico-agent
Base: ec238983c0513e4388ec363d54b4a4c341faa512

## Entrega

Toda a home aceita arquivos arrastados, inclusive sobre cabeçalho, núcleo, HUD e controles. Uma camada holográfica de recepção surge apenas durante o gesto. Não há botão de inserir arquivos.

Os arquivos aparecem em um HUD com nome, tamanho, prévia das imagens e remoção individual. Soltar arquivos prepara a fila local; não inicia transmissão para o provedor. O campo de orientação abre automaticamente. O usuário escreve o pedido ou grava sua orientação pelo microfone. A resposta aparece progressivamente no HUD existente.

Com arquivos anexados, o microfone grava uma orientação de até 45 segundos e a envia para transcrição e análise. Sem arquivos, o motor de conversa de voz anterior permanece em uso. Após remover os anexos, uma nova chamada de voz pode receber o resumo da análise como contexto; não recebe o arquivo original.

A página também aceita colagem de arquivos/imagens e de texto fora do campo de mensagem. Texto colado dentro do campo continua sendo uma mensagem normal.

## Formatos implementados

- Imagens: PNG, JPG/JPEG e WEBP.
- PDF.
- Word: DOC/DOCX, RTF e ODT.
- Apresentações: PPT/PPTX.
- Planilhas: XLS/XLSX, CSV e TSV.
- Texto UTF-8, Markdown, JSON, XML, HTML, CSS, código-fonte, logs, legendas e outros formatos textuais listados em lib/attachment-policy.ts.

Formatos não suportados, arquivos vazios, assinaturas incompatíveis e limites excedidos produzem aviso no HUD. Pastas, executáveis, ZIP, vídeos, HEIC e arquivos genéricos sem formato reconhecido não são tratados como se tivessem sido analisados. Código-fonte é conteúdo textual; nunca é executado.

Limites atuais:
- Até 8 anexos.
- Até 3 MiB somados por análise.
- Até 512 KiB de orientação gravada, com limite de 45 segundos.
- Até 4 MiB para o corpo completo da requisição.
- Instrução de até 8.000 caracteres.
- Histórico enviado limitado a 8 trechos de até 4.000 caracteres.
- Resposta do provedor limitada a 4.000 tokens.
- Tempo máximo interno de análise: 110 segundos, com cancelamento.

## Backend

Novo endpoint POST /api/analyze:
1. Verifica autenticação antes de ler anexos ou credenciais.
2. Rejeita origem externa e tipo de requisição inválido.
3. Limita o corpo durante a leitura, inclusive sem Content-Length.
4. Valida quantidade, tamanhos, extensões, assinaturas e texto UTF-8.
5. Quando há orientação gravada, usa /v1/audio/transcriptions.
6. Envia documentos e imagens à Responses API.
7. Transmite etapas reais e fragmentos de resposta em NDJSON.
8. Marca conclusão somente depois do evento de resposta completa do provedor.

OPENAI_API_KEY permanece no servidor. O modelo de análise usa JARVIS_ANALYSIS_MODEL ou gpt-4.1-mini como padrão; a transcrição usa gpt-4o-mini-transcribe. Nenhuma variável ou credencial foi criada ou alterada.

A chamada usa store:false e não cria arquivos permanentes pela Files API. A aplicação não grava anexos em disco, banco ou localStorage. Isso não equivale a uma garantia de retenção zero pelo provedor: aplicam-se as políticas da conta e do serviço.

Os anexos e trechos anteriores são tratados como conteúdo não confiável. O endpoint não fornece ferramentas de execução, publicação ou alteração externa ao modelo. Segue a personalidade e os limites de aprovação existentes.

## Interface e estados

- Recepção holográfica na tela inteira.
- HUD de arquivos e miniaturas.
- Campo de pedido sem botão de anexar.
- Estados: aguardando orientação, enviando, transcrevendo, analisando, construindo resposta, concluído e erro.
- Interrupção da análise com AbortController.
- Resposta incompleta não é anunciada como concluída.
- Remoção de arquivos libera URLs de prévia.
- Encerramento da página libera gravação, trilhas e transporte.
- Camada de arrastar não intercepta cliques e respeita redução de movimento.
- Painéis móveis sem rolagem horizontal na página, com rolagem interna quando necessária.

## Arquivos desta evolução

Modificados:
- app/components/JarvisExperience.tsx
- app/style.css
- package.json

Adicionados:
- app/components/AttachmentHUD.tsx
- app/components/useFileWorkspace.ts
- app/api/analyze/route.ts
- lib/attachment-policy.ts
- lib/attachment-analysis.ts
- tests/attachment-analysis.test.mjs
- tests/browser/attachments-smoke.cjs
- docs/ATTACHMENT_WORKSPACE_REPORT.md

Os endpoints e módulos anteriores de voz, memória, autenticação, passkeys e aprovação não foram alterados.

## Validação

- 105 testes de lógica e segurança: passaram.
- TypeScript: sem erros.
- Testes de navegador para desktop 1440x1000, iPhone 390x844 e celular estreito 320x740: arrastar, colar, fila, resposta, instrução por voz, remoção e erro de autorização.
- Teste adicional de cancelamento: resposta atrasada ignorada.
- Regressão da conversa anterior, navegação e páginas privadas: passou nos três tamanhos.
- Testes de provedor e microfone usam mocks controlados; nenhuma chamada paga nem envio de documentos reais foi realizado.
- Build Next.js verificado após as alterações; o ambiente Windows pode exigir preparar diretórios de saída devido ao erro EPERM intermitente já identificado anteriormente.

Comandos de teste:
```
npm test
npx tsc --noEmit
npm run build
npm start -- --port 3147
npm run test:ui
npm run test:files
```
Os testes de navegador usam Playwright e aceitam TEST_BASE_URL, TEST_OUTPUT_DIR e CHROME_PATH.

## Limites do processamento e pendências

Documentos não PDF têm extração textual e podem perder imagens ou gráficos incorporados. Planilhas passam pelo processamento do provedor, que pode considerar as primeiras 1.000 linhas por aba. Para auditorias completas ou transformações executáveis de planilhas, será necessária uma ferramenta específica posterior. Arquivos protegidos por senha, malformados ou rejeitados pelo provedor exibem falha, sem simular leitura.

Referências oficiais:
- [Entradas de arquivos](https://developers.openai.com/api/docs/guides/file-inputs)
- [Imagens e visão](https://developers.openai.com/api/docs/guides/images-vision)
- [Transcrição de áudio](https://developers.openai.com/api/docs/guides/speech-to-text)
- [Respostas em fluxo](https://developers.openai.com/api/docs/guides/streaming-responses)

A interface e o backend estão implementados. O uso real continua dependendo de sessão autorizada, chave válida no servidor e disponibilidade dos modelos na conta existente. Nenhuma configuração privada foi solicitada nesta etapa.

Nenhum merge em main, migração, instalação de agente local ou publicação em produção foi executado.
