# Criador de interfaces nativo do JK

Rota: /criador. Descoberta pelo menu, conversa de texto e ferramenta jarvis_visual_research da sessão neural. Não depende das skills instaladas no computador de desenvolvimento.

## Implementado

- Brief em linhas para estrutura editável, aprovação e protótipo HTML/CSS local.
- PNG/JPEG/WebP de até 1,4 MB para análise visual autenticada via Abacus RouteLLM, após autorização específica na tela e dentro dos limites existentes. Resultado estruturado validado; nunca executar HTML ou JavaScript do modelo. Resposta inválida não gera conteúdo fabricado e não inicia nova tentativa automática.
- Extração local de cabeçalhos, cores, variáveis CSS e seletores a partir de HTML/CSS fornecido, sem executar scripts, navegar em URLs ou carregar os recursos do código importado.
- Revisão da estrutura antes da prévia; aprovação da prévia antes do catálogo. Editar conteúdo invalida aprovações e resultados anteriores.
- Prévia em iframe sem permissões, saída escapada, cores e fonte com valores permitidos, ZIP com caminhos fixos e arquivos index.html, assets/styles.css, tokens.json, wireframe.txt, README.md e design-system.html após aprovação do catálogo.
- Estado em memória da página, cancelamento de análise e proteção contra respostas antigas após nova referência. Não salvar anexos ou rascunhos automaticamente.

## Limites honestos

É uma implementação nativa inspirada nos três fluxos: estrutura, imagem para interface e extração. Não é execução dos arquivos SKILL.md nem reconstrução idêntica da imagem. A extração estática não clona um aplicativo Next.js/React, não conserva automaticamente JavaScript, WebGL ou animações de origem. Não visita sites privados, não importa repositórios nem modifica o próprio JK. Não publica sites. Formulários, autenticação e backends exigem implementação posterior autorizada. O protótipo usa componentes seguros do gerador; o catálogo identifica a origem e as limitações.

Descrição e extração local não chamam modelos. Análise visual usa a autorização e o ledger Abacus existentes, com reserva de tokens que inclui o limite de saída de 1200 tokens. Chamadas já iniciadas podem consumir créditos mesmo quando a resposta falha. A limitação existente é por instância do servidor, não teto financeiro distribuído. Não há fornecedor pago novo.

## Validação

Testes de estrutura, escape, extração, assinatura de imagem, consentimento, ZIP e descoberta de intenção. Navegador com provedor simulado testa fluxo completo, aprovações, arquivos, autenticação, origem, imagem e mobile. Não implica teste pago de geração ou fidelidade visual à referência.
