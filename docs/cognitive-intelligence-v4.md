# JK Cognitive Intelligence 4.0

Data: 28/10/2026. Branch: feature/diretor-tecnico-agent. Base preservada: 91298f83b2ca6f42c657683d5b191ac26a99dc37.

## Fluxo

Voz ou teclado → rota autenticada → intenção estruturada → entidade explícita ou continuação → catálogo de capacidades → validação de escopo → leituras limitadas → interpretação de evidências → registro temporário → fala e demonstração 3.0.

A interface e a sincronização por capítulos da versão 3.0 foram preservadas. Resultados de mapas, pesquisa econômica, imagens e anexos continuam nos respectivos fluxos. Esta entrega acrescenta compreensão e evidências para consultas dos conectores; não substitui todas as ferramentas por um agente irrestrito.

## Componentes

- intent.ts: atos de consulta, diagnóstico, comparação, retomada, modificação e explicação; aliases de fala; profundidades breve, normal, detalhado e aprofundado.
- project-selection.ts: nomes e vínculos autorizados, sem substituição de projeto, sem autorização por substring e sem ignorar vínculo conflitante.
- registry.ts/types.ts: capacidades registradas com provedor, operação, permissões, efeito, parâmetros, custo, limites e interpretação de resultado. A inteligência nunca recebe uma função executável do modelo.
- engine.ts: validação determinística do plano, escopos atuais em cada pergunta, cancelamento, oito operações por consulta, até três recursos por provedor, até 12 segundos por operação e 30 segundos para execução de ferramentas.
- native-catalog.ts: interpreta repositório, commits, checks de um commit, manifesto package.json, deployments, schemas e diagnóstico de segurança. Conteúdo de scripts, descrições e instruções externas não é promovido a comando ou narração.
- context.ts/vault-context.ts: últimas seis consultas por sessão autenticada, expiração após 30 minutos de inatividade, até doze sessões no cofre; registros limitados em tamanho e protegidos contra conclusão fora de ordem. O cofre existente cifra esses registros e aplica controle otimista de concorrência; não houve nova tabela ou migração.
- presentation.ts/narration.ts: observação, sinais, limitações, próximos passos, comparação temporal e roteiro falado separado de IDs, JSON, URLs e datas técnicas. IDs internos ficam no contrato de evidências para rastreabilidade; não são necessários na fala.

## Compreensão sem aumento automático de custos

A classificação padrão é local e usa regras linguísticas e entidades conhecidas. Isso dá comportamento verificável aos cenários implementados, mas não equivale a compreensão semântica universal.

Há um ponto opcional de interpretação semântica pelo RouteLLM, com proposta estruturada validada antes de selecionar ferramentas. Ele permanece DESLIGADO: JARVIS_COGNITIVE_SEMANTIC_ENABLED não é definido por esta entrega. Só funciona com essa opção explícita, autorização de custos já existente, chave no servidor e orçamento disponível. Não recebe credenciais ou resultados brutos. A proposta não amplia permissões nem permite escrita. Não foi feito teste pago desse modo.

Os perfis de profundidade deixam de impor respostas de três frases. Análises locais podem ser longas; o orçamento existente de 350 tokens do provedor permanece preservado. Pedidos gerais que precisem de mais saída continuam sujeitos a esse limite e devem informar quando a resposta é parcial. Não foram adicionadas chamadas automáticas de continuação.

## Evidências e segurança

Cada evidência inclui provedor, recurso, operação, horário, estado, resumo, limites e referência interna. Resultado anterior é apresentado como anterior; uma pergunta de retomada não executa nova consulta silenciosamente. Comparação exige operações e recursos correspondentes em duas amostras. Falha de autenticação, permissão, limite, timeout e indisponibilidade são categorias de operação, não diagnóstico de defeito do projeto.

A leitura anterior é filtrada pelas permissões atuais. A revogação impede recuperar o conteúdo mesmo que o registro temporário ainda exista. Os registros são metadados e observações delimitadas; não guardam áudio, transcrições completas, código-fonte ou credenciais. A expiração é lógica; a limpeza física ocorre na próxima atualização do cofre. Não é memória permanente nem retenção de conversa completa.

Modificações são encaminhadas para preparação e aprovação individual do plano na Central existente. Esta camada não executa escrita, migração, exclusão, merge ou deploy. As gravações internas de contexto/auditoria usam somente o cofre privado já configurado; não alteram os recursos administrativos consultados.

Um novo conector precisa de adaptador, autenticação, escopo, declaração de operações, interpretador e testes. O registro dinâmico só aceita implementações do servidor, não configurações executáveis enviadas pelo navegador ou pelo modelo. Um conector de correio simulado prova a extensão sem modificar engine.ts; isso não significa que um conector de e-mail de produção tenha sido criado.

## Supabase

A memória pessoal continua separada das credenciais administrativas. A leitura de schemas usa o endpoint read-only existente e exige as permissões correspondentes; a documentação oficial o identifica como Beta: https://supabase.com/docs/reference/api/v1-read-only-query . Nenhuma consulta comprova, por si só, funcionamento da memória, RLS ou segurança completa. O changelog Markdown foi tentado, mas a ferramenta web rejeitou seu tipo de conteúdo; a referência oficial da operação foi consultada diretamente.

## Verificação e limitações

Testes próprios cobrem aliases, isolamento, continuidade, revogação, falhas, cancelamento, comparação, narrador, profundidade, novo conector simulado e persistência entre instâncias. Testes de navegador usam o aplicativo e rotas reais com transporte externo e vozes simulados, sem cobrança. A validação real de contas não pode ser inferida desses testes.

A análise técnica é progressiva e delimitada: consulta de estado, leitura de manifesto/commits/checks e apontamentos disponíveis. Não executa testes remotos, comandos, código externo, análise arbitrária de todo o repositório ou correção autônoma. Correlação por projeto não comprova causalidade nem igualdade de versão entre serviços. A qualidade natural da voz depende do mecanismo e ainda deve ser avaliada no dispositivo do proprietário.

Nenhuma dependência paga, mudança de plano, credencial nova, merge na main ou publicação de produção integra esta entrega. Os artefatos de validação registram os testes realmente executados e o Preview do commit final.
