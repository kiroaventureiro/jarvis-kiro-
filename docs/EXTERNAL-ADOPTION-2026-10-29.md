# Council e dez referências anteriores — implementação e verificação

Data: 29/10/2026. Branch: `feature/diretor-tecnico-agent`.

Este trabalho preserva as mudanças do Navi até `19afa2e5327a8f89a546843fa6bdb5471fa2a988` e continua a Issue #2. Instalar uma skill no Codex não instala um modelo nem disponibiliza automaticamente o recurso no servidor do JK.

## Codex deste computador

- `i-have-adhd`: skill MIT instalada da revisão `1ecea1993b7fce257ffbd686c070948b5e07eda6`. No JK, aproveitamos clareza e ação principal primeiro, sem presumir diagnóstico do proprietário ou limitar toda resposta a um formato fixo.
- EGM: plugin oficial `egm@egm`, versão 0.1.0, instalado com marketplace fixado em `f0ba151b252c9abf1318d9fe857a43265d06de89`. Inclui skills, agentes e documentação. A instalação não significa que uma revisão Goldfish já tenha sido executada. Uma nova sessão pode ser necessária para atualizar o catálogo de skills do Codex.
- `jk-council`: skill própria instalada e validada, com comparação de alternativas, revisão de objeções e síntese baseada em evidências. Não representa uma alteração no modelo base do Codex nem uma consulta já realizada a vários modelos.

## Implementação no JK

`lib/orchestration/council.ts` implementa um fluxo independente: duas perspectivas, duas revisões de candidatos identificados como A/B e uma síntese. O segundo autor não recebe a primeira proposta. Cada etapa é sequencial, cancelável e sujeita ao orçamento existente da Abacus. Há no máximo cinco chamadas, prazo global de 45 segundos, pergunta até 500 caracteres e prompts limitados ao contrato atual do provedor. Falhas e limites encerram o fluxo sem repetir chamadas ou inventar uma síntese.

O acionamento é explícito: `Conselho: compare as opções para...`. Uma pergunta comum contendo a palavra conselho não inicia esse fluxo. A execução permanece desativada por padrão: exige `JARVIS_COUNCIL_ENABLED=true`, credencial Abacus no servidor e autorização/orçamento já existentes. Essa entrega não habilitou a variável nem executou testes pagos. O servidor da ferramenta de voz explica essa limitação e não inicia deliberações adicionais.

As perspectivas usam a RouteLLM existente. O resultado registra os nomes retornados pelo provedor e `independentModelsVerified=false`: não promete diversidade de modelos ou consenso independente. O código original do Council não foi incorporado; a raiz examinada não apresentou licença. Não adicionamos OpenRouter nem transferimos credenciais.

## Matriz dos onze repositórios

| Fonte | Aproveitamento efetivo nesta entrega | Componente externo ainda necessário |
|---|---|---|
| [karpathy/llm-council](https://github.com/karpathy/llm-council) | Skill própria e deliberação nativa com opt-in no JK | Habilitação de consumo específica; diversidade de modelos não verificada |
| [ayghri/i-have-adhd](https://github.com/ayghri/i-have-adhd) | Skill instalada no Codex e princípios adaptados ao protocolo cognitivo | Nenhum modelo adicional; não é diagnóstico clínico |
| [openai/math](https://github.com/openai/math) | Referência de pesquisa registrada | Repositório de manuscritos e artefatos de provas, não uma API ou motor matemático instalável |
| [google/elephant-goldfish-model](https://github.com/google/elephant-goldfish-model) | Plugin completo no Codex; separação entre planejamento, execução e verificação no protocolo JK | Revisão independente deve ser realmente executada e registrada quando solicitada |
| [microsoft/JARVIS](https://github.com/microsoft/JARVIS) | Princípios de planejamento e seleção de ferramentas adaptados | Stack HuggingGPT de pesquisa e modelos não instalados; avaliar requisitos e provedores antes de adotar |
| [melgarafael/james_painel_de_voz](https://github.com/melgarafael/james_painel_de_voz) | Referência auditada | Widget depende de ElevenLabs; métricas de CPU/RAM do exemplo são simuladas. Licença não estabelecida na raiz examinada; código não copiado |
| [duixcom/Duix-Avatar](https://github.com/duixcom/Duix-Avatar) | Catálogo e avaliação de requisitos | Runtime próprio, modelos e licença comunitária DUIX com condições específicas. Não foi instalado nem gerou avatar |
| [Wan-Video/Wan2.1](https://github.com/Wan-Video/Wan2.1) | Catálogo e avaliação de requisitos | Worker e pesos compatíveis com GPU; o modelo 1.3B documenta cerca de 8,19 GB de VRAM. Nenhum vídeo gerado |
| [Comfy-Org/ComfyUI](https://github.com/Comfy-Org/ComfyUI) | Serviço externo previsto e riscos de custom nodes identificados | Backend isolado e workflows autorizados. GPL-3.0; nós de parceiros podem ter custo. Não foi executado |
| [JustVugg/colibri](https://github.com/JustVugg/colibri) | Avaliação de viabilidade local | Engine C com streaming de experts; README indica ao menos 8 GB de RAM e cerca de 22 GB de modelo. Não foi instalado nem medido neste PC |
| [leacho73/panalume](https://github.com/leacho73/panalume) | Referência de interface, sem novo painel administrativo no JK | É um dashboard Home Assistant; entidades, autenticação e escopos reais seriam necessários |

`config/external-repositories.json` registra os onze com runtime externo desativado. Isso não desativa a implementação independente do Council, que tem seu próprio controle. Artcraft foi enviado em outro pedido e permanece no backlog separado; não faz parte dos dez enumerados na Issue #2.

## Correções de continuidade conciliadas com o Navi

- Texto e ferramenta de voz encaminham histórico limitado ao resolvedor determinístico de projetos. Histórico resolve identidade; não concede permissões. O cofre continua sendo a autoridade sobre recursos e operações.
- Perguntas como “E na Vercel?” preservam o projeto anterior; nomes explícitos, projetos desconhecidos e mudanças de assunto impedem substituição silenciosa por Jarvis ou Origem.
- Um autodiagnóstico solicita leituras dos conectores autorizados. Os resultados incluem descobertas dos provedores, em vez de apenas contar chamadas. Isso é diagnóstico limitado às operações consultadas, não uma auditoria completa do código.
- Uma leitura autorizada bem-sucedida registra evidência recente com operação e data. Não renova credenciais, não aumenta escopos e não equivale a validar memória, migrações ou gravações no Supabase.
- Cancelamento acompanha as leituras. Identificação dos quatro detalhes GitHub preserva as correções do Navi; sanitização de caracteres de controle não remove mais letras comuns de títulos e mensagens.

## Verificação e limites

Verificação local concluída: **429 testes automatizados passaram**, TypeScript `--noEmit` sem erros e build Next.js 15.5.28 concluído. Os testes usam respostas simuladas e verificam custos bloqueados, etapas, cancelamento, falhas, prompts limitados, deduplicação, continuidade, isolamento de projetos e atualização de evidência.

`node tests/integration/council-context-http.cjs` também passou. Ele inicia um servidor Next em loopback com transportes simulados e testa as rotas reais: autenticação do proprietário, cofre e escopos de leitura, continuidade por texto e pesquisa de voz, rejeição de projeto desconhecido e histórico forjado, autodiagnóstico e Council desativado. Nenhum teste simulado comprova acesso à conta privada ou operação de um engine externo. Esses testes não usam microfone ou iPhone físico.

Continuam pendentes: teste físico de interrupção e retomada no iPhone, continuidade de tarefas do agente ChatLLM, ponte entre o JK hospedado e o VoiceStudio do PC e testes reais de síntese local. O diagnóstico local do VoiceStudio nesta sessão não encontrou API em `127.0.0.1:3900`; não reinstalamos nem baixamos novamente as vozes relatadas pelo proprietário. Não houve alteração de produção, merge ou contratação de serviços.
