# Jarvis Kiro — Long Context + recuperação de interface (30/10/2026)

## Diagnóstico baseado no código main
- app/page.tsx renderiza JarvisExperience.
- app/components/CosmicScene.tsx declara "Raster reference with progressive CSS depth. No generated 3D geometry". O visual atual não é a geometria WebGL 3D profissional pedida.
- lib/cognitive/context.ts mantém estado efêmero por 30 minutos e apenas 6 registros.
- lib/server-memory.ts criptografa no Supabase apenas os 20 últimos turnos, até 800 caracteres por turno, se estiver configurado.
- lib/jarvis-memory.ts usa um índice estático curado; não faz busca semântica.
- Existem componentes de holograma e de demonstração, que devem ser reaproveitados e não removidos.

## Abacus Long-Context
O repositório arquivado abacusai/Long-Context pesquisa ampliação da janela de modelos Llama por scaling de RoPE e fine-tuning. Não é SDK de memória persistente, não deve ser colado no Next.js nem promete memória ilimitada. Precisamos selecionar modelo/provedor com limites reais de janela e custo.

## Entrega desta branch
- lib/cognitive/long-context-retrieval.ts: ranqueamento independente de provedor, limites explícitos por fragmento e por orçamento, filtro por projeto e desduplicação. É uma camada inicial, não conectada à API pública nem à base pessoal.
- Não coletar nem sincronizar dados pessoais antes de autorização. A memória precisa de controles de origem, exclusão, expiração e escopo.

## Especificação visual obrigatória
1. Home limpa: apenas núcleo Jarvis tridimensional e menu discreto de três pontos; nenhuma aba administrativa fixa.
2. Recuperar o artefato original do Abacus/DeepAgent ou captura fornecida pelo proprietário e comparar layout pixel a pixel antes de alegar paridade. Atualmente a referência original NÃO está comprovadamente disponível neste repositório.
3. Implementar núcleo 3D real via WebGL (Three.js/React Three Fiber se compatível), com animações por estados idle/listening/thinking/speaking, fallback para baixo desempenho, suporte reduced motion e release de recursos GPU.
4. O núcleo deve reagir a energia de áudio real; não fingir que está ouvindo ou respondendo.
5. Resposta imersiva com cenas contextuais temporárias, HUD legível, rolagem interna em menus, interrupção de fala e retorno ao núcleo.
6. Nunca substituir o hub de conectores, os endpoints Abacus existentes, a memória criptografada ou a funcionalidade de voz sem testes de regressão.

## Próximas integrações
- Indexação por chunks de arquivos, conversas e projetos autorizados no armazenamento persistente.
- Recuperação híbrida (palavras-chave + embeddings), filtro por projeto, citação de origem, orçamento por tokens e compressão.
- Testes 'needle in haystack' para início, meio e fim da janela de contexto; medir latência, custo e precisão.
- Avaliar outros repositórios Abacus pela licença, atividade, dependências, segurança, compatibilidade e benefício comprovado.

## Estado
Diagnóstico confirmado e módulo isolado acrescentado. Não há 3D novo, não há migração Supabase, não há integração do modelo Long-Context ou deploy nesta entrega.
