# wshobson/agents no Codex e no JK

Revisão examinada e fixada: `0874a27b17a22e2b7c2e2bcd725768e0803cad06`.
Fonte: [wshobson/agents](https://github.com/wshobson/agents/tree/0874a27b17a22e2b7c2e2bcd725768e0803cad06).

## Codex

O marketplace oficial do projeto, `claude-code-workflows`, foi registrado pelo CLI do Codex. Foram instalados e conferidos:

| Plugin | Versão | Skills locais |
|---|---|---:|
| developer-essentials | 1.0.4 | 11 |
| javascript-typescript | 1.2.3 | 4 |
| security-scanning | 1.3.2 | 5 |

Os diretórios estão em `C:\Users\natos\.codex\plugins\cache\claude-code-workflows`. O catálogo completo fica disponível no marketplace; os demais plugins não foram instalados. A instalação nativa expõe skills. Agentes TOML e comandos convertidos exigem o caminho separado de geração descrito pelo projeto; não foram registrados como agentes ativos nesta entrega. Nenhuma equipe paralela foi iniciada.

O projeto informa que skills nativas acima do limite de tamanho do Codex podem ser truncadas. Instalar o manifesto não valida a execução de todas as instruções. Os arquivos de referência acompanham os plugins. As novas skills ficam disponíveis no próximo turno, sujeito à atualização do catálogo da sessão.

## JK

`lib/cognitive/specialist-guidance.ts` adapta princípios de revisão, depuração, testes, JavaScript/TypeScript e segurança. O seletor determinístico injeta no máximo dois perfis quando a mensagem trata de código, APIs, repositórios ou software. Perguntas cotidianas não ganham um roteiro de engenharia. A mensagem original permanece no papel de usuário: o seletor inclui somente textos predefinidos, sem promover conteúdo do pedido ao sistema.

O protocolo cognitivo existente utiliza essas orientações nas conversas da Abacus e na pesquisa que já usa esse protocolo. A sessão neural é criada antes de conhecer a pergunta: recebe uma orientação condicional compacta, sem alegar que o seletor determinístico executou por turno. O classificador mantém seu contrato anterior.

Esses perfis orientam o modelo existente. Não são ferramentas executoras, modelos novos, scanners instalados ou agentes independentes. Não criam conectores, não ampliam escopos e não iniciam uma segunda chamada a provedores. A orientação adiciona texto ao prompt existente; o consumo efetivo continua sujeito ao provedor e ao orçamento vigente. A execução de tarefas depende das ferramentas e permissões disponíveis.

Exemplos: “Depure o erro na API TypeScript”, “Revise a segurança deste repositório” e “Prepare testes de regressão com Playwright”. O JK deve distinguir observação, hipótese, resultado simulado e resultado verificado, preservando a voz e o HUD complementar.

## Verificação

Os testes verificam seleção por objetivo, limite de dois perfis, ausência de ativação para assuntos cotidianos, injeção no plano real da Abacus, orientação condicional da voz, preservação do classificador e isolamento de texto malicioso. Os resultados da suíte, TypeScript e build são informados na entrega. Não foram feitas chamadas pagas ou validações com microfone físico para esse recurso.

## Atribuição

Princípios adaptados de `code-review-excellence`, `debugging-strategies` e `javascript-testing-patterns`, com textos próprios ajustados ao JK. Licença do projeto:

MIT License

Copyright (c) 2024 Seth Hobson

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
