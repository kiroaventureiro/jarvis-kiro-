# Estudo tecnico: memoria por topicos

Referencia: https://api.abacus.ai/help/abacusai-desktop/memory

A documentacao da Abacus apresenta um indice pequeno de memoria e arquivos de assuntos carregados conforme a necessidade.

Estado Jarvis: lib/server-memory.ts guarda ate 20 turnos cifrados no Supabase. O indice por assunto ainda nao foi implementado.

Proposta: criar indice cifrado, selecionar poucos assuntos por pergunta, respeitar permissoes, permitir exclusao e manter fallback para a memoria existente. Medir latencia e recuperacao. Evitar enviar historico completo e dados sensiveis a cada pergunta.

Outra referencia: https://abacus.ai/help/python-sdk/genai/ai-workflows descreve grafos de agentes com funcoes e entradas e saidas verificadas. Adaptar a arquitetura em TypeScript com autorizacao e confirmacao para operacoes de escrita.

SDK oficial para estudo: https://github.com/abacusai/api-python . Conferir licenca de cada modulo antes de reutilizar codigo.

Este documento nao executa chamadas pagas, nao muda a interface e nao conecta agentes privados.