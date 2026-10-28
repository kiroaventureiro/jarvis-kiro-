# JK Experience 3.0 — implementação e validação

Data: 28/10/2026. Branch: feature/diretor-tecnico-agent.

## Integração com o trabalho paralelo

Esta implementação parte de 8e791adf95d95f969329e47f0f657f91e443080c e incorpora a ponte de consultas de desenvolvimento criada no outro chat. A seleção de projeto foi extraída para uma política testável. Um projeto explicitamente solicitado sem autorização nunca é substituído por outro. Recursos com nomes diferentes no GitHub e na Vercel exigem vínculo ao mesmo projeto. Consultas autorizadas registram sucesso ou falha sem armazenar credenciais. O catálogo KIRO e as plataformas existentes foram preservados.

## Experiência implementada

- Narração do navegador coordenada com capítulos visuais: cada demonstração aguarda seu trecho falado e os critérios de leitura. Pausa, retomada, interrupção por nova pergunta, recuperação de falha e continuação sem voz têm estados explícitos. A sincronização é por capítulo, sem promessa de alinhamento palavra a palavra.
- Ao concluir, os resultados se recolhem e o núcleo volta ao repouso. O histórico conserva a apresentação; a preferência de manter o resultado aberto é opcional.
- Mapas, referências visuais e gráficos podem ocupar áreas transparentes e variar de posição. Relatórios mantêm uma superfície legível. O sistema não garante a composição exata de uma imagem conceitual para qualquer pergunta.
- Mapas com 7.272 localidades de referência Natural Earth, continentes por agrupamento de países e regiões brasileiras por estados IBGE. Não são navegação de ruas, Google Maps, geocodificação completa, fronteiras históricas ou dados econômicos ao vivo. Cidades ambíguas precisam de qualificação.
- História do Brasil tem oito capítulos de referência para pedidos aprofundados. Não se declara pesquisa exaustiva ou atualização automática.
- Busca explícita de imagens reais no Wikimedia Commons, com metadados, autor, licença e verificação do arquivo. Falhas ficam visíveis; não há troca silenciosa por imagem sintética. A fonte deve permitir reutilização e permanecer identificada.
- Pedidos conversacionais preparam PDF, PNG, JSON ou WebM; o usuário confirma o download. Salvar ou compartilhar externamente depende de destino, conexão e autorização. PDF e JSON preservam conteúdo e fontes; PNG é estático e WebM é uma recapitulação silenciosa, não um vídeo narrado completo.
- Autodiagnóstico supervisionado usa leituras delimitadas pelos conectores existentes. Modificações continuam pelo plano e aprovação, branch, PR, testes e Preview. Não há execução arbitrária nem autorização implícita para produção.

## Voz e custos

A voz gratuita depende das vozes instaladas/disponibilizadas pelo navegador. Preferências e prévias são locais; gênero não é inferido apenas por nomes desconhecidos. A comparação permite testar vozes existentes, mas não gera amostras pagas.

A arquitetura de sessão de voz OpenAI existente foi preservada. A coordenação detalhada por capítulos desta versão atende speechSynthesis; áudio neural externo mantém a apresentação até concluir, sem a mesma precisão por capítulo. Não foi feita medição subjetiva de naturalidade ou latência no hardware do proprietário.

Alternativas documentadas, sem contratação: Google Chirp 3 HD, Azure Speech e OpenAI Realtime. Google publica preços por caracteres e exige faturamento; Azure depende de camada/região; APIs de voz e modelos podem cobrar independentemente de assinaturas de chat. Os limites existentes, inclusive o orçamento de resposta Abacus, não foram ampliados. Nenhuma chamada paga foi utilizada nos testes.

Fontes: https://cloud.google.com/text-to-speech/pricing ; https://docs.cloud.google.com/text-to-speech/docs/data-logging ; https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts ; https://azure.microsoft.com/en-us/pricing/details/speech/ ; https://developers.openai.com/api/docs/guides/voice-latency-cost?voice-api=realtime .

## Fontes e privacidade

Natural Earth é domínio público: https://www.naturalearthdata.com/about/terms-of-use/ . Proveniência e hashes estão em public/holo-geography-sources.json. O índice é consultado localmente, sem envio da pergunta a um geocodificador.

Commons: https://www.mediawiki.org/wiki/API:Imageinfo e https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia . A consulta explícita de imagem envia os termos públicos ao Commons; anexos privados não iniciam buscas automaticamente. Há validação de hosts, tamanho, tempo, licença e limites locais de chamadas.

O reconhecimento de voz do navegador pode utilizar processamento remoto do fornecedor. Microfone requer consentimento e controle de desligamento. Não há promessa de escuta com página fechada, iPhone bloqueado ou navegador em segundo plano. Chrome/Edge Windows são prioritários; Safari/iOS mantêm alternativa manual.

## Evidências e limites de verificação

305 testes Node passaram, incluindo nove cenários de seleção de projetos, permissões e isolamento. TypeScript e build Next.js passaram. A suíte de navegador 3.0 usa reconhecimento/síntese e respostas controlados para verificar comportamento sem custos; não equivale a teste com microfone físico ou contas reais conectadas. Os resultados detalhados do navegador e exportações ficam nos artefatos locais de validação.

A consulta pública real ao Commons verificou três arquivos JPEG e suas licenças. Isso não valida contas GitHub, Vercel, Supabase ou Abacus do usuário. Operações administrativas e de escrita não foram executadas. Preview protegido exige autenticação normal do proprietário; testes locais não removem autenticação do deployment.

Verificação final no navegador: 22 cenários 3.0, oito cenários de exportação, 12 cenários de voz e quatro cenários de HUD passaram no Chrome com fixtures locais. Nenhum erro não tratado ou chamada de modelo não intencional foi observado nesses cenários.
