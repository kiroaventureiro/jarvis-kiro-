export const BRAZIL_CHAPTERS = [
  {
    when: "Antes de 1500",
    label: "Povos originários",
    detail:
      "Diversos povos indígenas já ocupavam o território, com línguas, formas de organização e relações próprias com o ambiente. A história não começa com a chegada europeia.",
  },
  {
    when: "Séculos XVI e XVII",
    label: "Colonização e Nordeste",
    detail:
      "A colonização portuguesa se consolidou com a ocupação do litoral, a produção açucareira no Nordeste, disputas territoriais e a escravização de indígenas e africanos. Resistência e negociação também marcaram esse processo.",
  },
  {
    when: "Século XVIII a 1808",
    label: "Interiorização e Rio de Janeiro",
    detail:
      "A mineração ampliou a ocupação do interior e as redes comerciais. Em 1808, a transferência da corte portuguesa para o Rio de Janeiro transformou a administração e as relações econômicas da colônia.",
  },
  {
    when: "1822 a 1888",
    label: "Independência e Império",
    detail:
      "A independência em 1822 formou um Estado monárquico. A Constituição de 1824 organizou o poder imperial, em meio a conflitos regionais e participação política restrita. A escravidão permaneceu até a abolição, em 1888.",
  },
  {
    when: "1889 a 1930",
    label: "Primeira República",
    detail:
      "A proclamação da República, em 1889, substituiu a monarquia. O novo regime combinou federalismo, domínio de elites regionais, exclusões políticas e conflitos sociais. Urbanização e mudanças no trabalho alteraram a sociedade.",
  },
  {
    when: "1930 a 1964",
    label: "Estado, indústria e disputas políticas",
    detail:
      "O período reuniu centralização política, industrialização, legislação trabalhista, o Estado Novo e a experiência democrática iniciada em 1945. Transformações econômicas conviveram com desigualdades e intensas disputas políticas.",
  },
  {
    when: "1964 a 1985",
    label: "Ditadura e resistência",
    detail:
      "O regime militar restringiu direitos políticos e civis, praticou censura e repressão e promoveu mudanças econômicas. Movimentos sociais, culturais e políticos participaram da resistência e da redemocratização.",
  },
  {
    when: "1988 em diante",
    label: "Constituição e democracia",
    detail:
      "A Constituição de 1988 ampliou direitos e consolidou instituições democráticas. A história recente envolve disputas sobre cidadania, desigualdade, economia e ambiente; um panorama não esgota essas experiências.",
  },
];
export const BRAZIL_EXPLANATION =
  "Vamos organizar a história do Brasil em capítulos. Este é um panorama aprofundado de processos essenciais, não uma exposição exaustiva de todos os povos, lugares e acontecimentos. " +
  BRAZIL_CHAPTERS.map((x) => x.when + ". " + x.label + ". " + x.detail).join(
    "\n\n",
  ) +
  "\n\nO mapa utiliza limites estaduais atuais apenas para localizar regiões mencionadas. Esses limites não representam as fronteiras dos períodos históricos. As referências de estudo incluem o Atlas Histórico do Brasil da FGV e o texto da Constituição de 1988 da Câmara dos Deputados.";
