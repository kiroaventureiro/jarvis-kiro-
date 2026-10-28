# VoiceStudio no JK

Referência examinada: debpalash/VoiceStudio, revisão ac821cb60c1349ac8ea630c10319a6300a68b67d. Skill oficial `skills/voicestudio` instalada no Codex pelo instalador de skills. A skill fica disponível na próxima interação; não instala aplicativo ou modelos.

## Implementado

- Conector independente de descoberta, baseado no contrato público `voicestudio.speech.v1`, sem copiar código do aplicativo.
- Teste autenticado em Configurações e POST /api/voice/studio, com verificação de origem, sem cache.
- Perguntas sobre VoiceStudio no texto e na ferramenta existente da voz recebem estado real do ambiente, sem recorrer à Abacus para reescrever o resultado.
- Somente duas leituras fixas: `/.well-known/voicestudio-speech` e `/v1/audio/voices`. Limite de seis segundos no conjunto, 64 KiB por resposta e nenhum redirecionamento.
- Conta apenas perfis salvos, excluindo aliases de compatibilidade OpenAI; não retorna áudio, nomes privados, URLs internas ou segredos.
- Estado `read_verified` confirma as duas leituras, não geração, modelo instalado, direito de uso comercial nem idioma disponível. Autenticação configurada não comprova que o backend recusa clientes anônimos.

## Configuração de servidor

`JARVIS_VOICESTUDIO_URL`: endereço do backend, configurado pelo proprietário no servidor. Não há URL arbitrária em parâmetros do usuário.

`JARVIS_VOICESTUDIO_API_KEY`: credencial de servidor, necessária para endpoints remotos; nunca é devolvida ao navegador ou ao modelo.

JK executado localmente pode consultar http://127.0.0.1:3900. Na Vercel, loopback é recusado porque se refere ao servidor da Vercel. Para hospedagem, é necessário um serviço privado acessível por HTTPS e autenticado, com controles de rede próprios; esse serviço não foi provisionado. Não expor a porta 3900 publicamente nem criar túnel sem autorização. Prefixo de caminho de proxy é suportado.

## Ainda pendente

Aplicativo Electron, runtime Python e modelos no computador; pareamento/rota privada ao JK hospedado; geração real, transcrição e dublagem; teste de qualidade pt-BR e latência. Não há mudança automática do provedor de voz atual nem fallback para serviços pagos. O conector desta entrega é de diagnóstico, sem geração ou captura.

A sondagem nesta sessão não encontrou backend na porta 3900. A leitura CIM de RAM/GPU foi bloqueada pelo ambiente; o registro do Windows contém Intel HD Graphics/HD Graphics 3000, o que não comprova aceleração de inferência. A documentação recomenda aproximadamente 5 GiB para ambiente CPU e cerca de 10 GB para app, ambiente e modelos, variando conforme motor. Não foi baixado runtime ou modelo.

O aplicativo informa AGPL-3.0-only; pesos e vozes têm termos separados. LICENSE-NOTICE.md identifica os pesos padrão k2-fsa/OmniVoice como CC-BY-NC, além de termos próprios do tokenizer. Não ativar esse padrão para a KIRO como se houvesse autorização comercial. Escolher um modelo com pt-BR e termos adequados, informar tamanho/licença e obter a autorização de download antes de instalá-lo. Clonagem exige voz autorizada; nenhum perfil foi clonado.

Fontes primárias: [skill](https://github.com/debpalash/VoiceStudio/blob/ac821cb60c1349ac8ea630c10319a6300a68b67d/skills/voicestudio/SKILL.md), [API](https://github.com/debpalash/VoiceStudio/blob/ac821cb60c1349ac8ea630c10319a6300a68b67d/docs/speech-platform.md), [MCP](https://github.com/debpalash/VoiceStudio/blob/ac821cb60c1349ac8ea630c10319a6300a68b67d/docs/mcp.md), [licenças](https://github.com/debpalash/VoiceStudio/blob/ac821cb60c1349ac8ea630c10319a6300a68b67d/LICENSE-NOTICE.md), [Windows](https://github.com/debpalash/VoiceStudio/blob/ac821cb60c1349ac8ea630c10319a6300a68b67d/docs/install/windows.md).
