import type { Category, Product, ShowcaseSlide, Stat } from '@/types/landing'

export const highlights: string[] = [
  'Organize processos e atendimento em um so lugar',
  'Acompanhe metricas e resultados em tempo real',
  'Transforme visitantes em contatos qualificados',
]

export const categories: Category[] = [
  {
    id: 'aniversario',
    name: 'Aniversario',
    shortLabel: 'bolos para celebrar',
  },
  {
    id: 'casamento',
    name: 'Casamento',
    shortLabel: 'projetos elegantes',
  },
  {
    id: 'empresarial',
    name: 'Empresarial',
    shortLabel: 'eventos e marcas',
  },
  {
    id: 'destaques',
    name: 'Destaques da semana',
    shortLabel: '6 selecoes especiais',
  },
  {
    id: 'dia-das-maes',
    name: 'Dia das Maes',
    shortLabel: 'cestas, chocolates e presentes',
  },
  {
    id: 'cestas',
    name: 'Cestas',
    shortLabel: 'presentes especiais',
  },
  {
    id: 'tortas',
    name: 'Tortas',
    shortLabel: 'camadas e recheios',
  },
  {
    id: 'copos',
    name: 'Copos da Felicidade',
    shortLabel: 'praticos e cremosos',
  },
  {
    id: 'bolos',
    name: 'Bolos',
    shortLabel: 'fatias e celebracoes',
  },
  {
    id: 'tacas',
    name: 'Tacas Doces',
    shortLabel: 'sobremesa para impressionar',
  },
]


export const products: Product[] = [
  {
    id: 'cesta-mae-afeto',
    name: 'Cesta Mae Afeto Doce',
    description:
      `
      🎁 Cesta “Você é Especial” – Versão Delicada

        Às vezes, um gesto simples…
        é o que mais marca. ❤️

        Essa cesta é perfeita pra quem quer surpreender com carinho, sem exagero — mas com muito significado.

        ✨ O que acompanha:

        🧸 Pelúcia fofa e delicada
        🍫 Mix de chocolates (Prestígio, Baton, Serenata de Amor, Talento e mais)
        🌹 Arranjo de rosas artificiais (visual elegante e romântico)
        🎁 Caixa MDF com a frase “Você é Especial”
        🌾 Acabamento com palha decorativa (estilo rústico e aconchegante)
      `,
    price: 'A partir de R$ 129,99',
    basePrice: 129.9,
    imageSrc: 'https://i.ibb.co/jkBnvKCp/tradu-o-texto-202604191651.jpg',
    fulfillmentType: 'encomenda',
    isAvailable: true,
    isFeatured: false,
    isPromo: true,
    primaryCategoryLabel: 'Cestas',
    categoryIds: ['cestas', 'dia-das-maes'],
  },
  {
    id: 'cesta-mae-chocolate',
    name: 'Cesta Mae Chocolates Especiais',
    description:
      `
        Tem presentes…
          e tem aqueles que fazem a pessoa parar, olhar… e se emocionar. 💛

          Essa cesta foi criada pra isso.

          Cada detalhe aqui não é por acaso — é pra transformar um simples momento em uma lembrança que fica pra sempre.

          ✨ O que acompanha:

          🧸 Pelúcia com coração “Eu te amo”
          🍫 Seleção premium de chocolates (KitKat, Ouro Branco, BIS, Laka, trufas e mais)
          🍬 Caixa especial com doces finos
          📸 6 fotos personalizadas (memórias que contam uma história)
          💡 Iluminação delicada em LED (efeito encantador)
          🎁 Caixa MDF com a frase “Te Amo”
          🌹 Pétalas decorativas para um toque ainda mais especial
      `,
    price: 'A partir de R$ 170,99',
    basePrice: 170.99,
    imageSrc: 'https://i.ibb.co/8L04fDY8/Gemini-Generated-Image-zg1wv2zg1wv2zg1w.png',
    fulfillmentType: 'encomenda',
    isAvailable: true,
    isFeatured: false,
    isPromo: true,
    primaryCategoryLabel: 'Cestas',
    categoryIds: ['cestas', 'dia-das-maes'],
  },
  {
    id: 'cesta-mae-encanto',
    name: 'Cesta Mae Encanto do Vale',
    description:
      `Uma surpresa que fala por você… 💛  

Essa cesta foi pensada para transformar um simples presente em um momento inesquecível. Com um toque delicado e cheio de carinho, ela reúne tudo que emociona e encanta logo no primeiro olhar.  

✨ O que acompanha:  

🧸 Pelúcia charmosa com mensagem “Eu te amo”  
🍫 Seleção de chocolates (Sonho de Valsa, Ouro Branco, etc.)  
🍰 Doce especial da Encanto do Vale  
🌹 Pétalas decorativas para um toque romântico  
🎁 Caixa MDF elegante com a frase “Você é Especial”  

💝 Perfeita para:  
Surpreender no Dia das Mães, aniversários ou qualquer momento que mereça um gesto cheio de amor.  

💬 Porque mais do que um presente…  
é uma forma de dizer: “eu pensei em você em cada detalhe.”`,
    price: 'A partir de R$ 234.9',
    basePrice: 234.9,
    imageSrc: 'https://i.ibb.co/ZRv9d29Y/Gemini-Generated-Image-t1u2z0t1u2z0t1u2.png',
    fulfillmentType: 'encomenda',
    isAvailable: true,
    isFeatured: false,
    isPromo: false,
    primaryCategoryLabel: 'Cestas',
    categoryIds: ['cestas', 'dia-das-maes'],
  },
  {
    id: 'cesta-mae-premium',
    name: 'Cesta Mae Premium com Chocolates',
    description:
      `
        Mais do que um presente… uma lembrança que fica pra sempre. 💛

        Essa cesta foi criada pra emocionar de verdade. Cada detalhe foi pensado pra transformar um momento simples em algo inesquecível — principalmente pelas fotos que contam uma história única.

        ✨ O que acompanha:

        🧸 Pelúcia delicada e aconchegante
        🍫 Chocolates selecionados (KitKat, Alpino, Ferrero Rocher, Serenata de Amor e outros)
        📸 6 fotos personalizadas presas na tampa (estilo varal de memórias)
        🎁 Caixa MDF premium com a frase “Você é Especial”
        🌾 Acabamento rústico elegante com palha decorativa
      `,
    price: 'A partir de R$ 149,99',
    basePrice: 149.9,
    imageSrc: 'https://i.ibb.co/qY1hKJTg/crie-um-combo-202604191706-1.jpg',
    fulfillmentType: 'encomenda',
    isAvailable: true,
    isFeatured: false,
    isPromo: false,
    primaryCategoryLabel: 'Cestas',
    categoryIds: ['cestas', 'dia-das-maes'],
  },
  {
    id: 'bolo-aniversario-brigadeiro',
    name: 'Bolo de Aniversario Brigadeiro Supremo',
    description:
      'Massa macia de chocolate, recheio intenso de brigadeiro e acabamento festivo pensado para mesas de aniversario cheias de destaque.',
    price: 'A partir de R$ 109,90',
    basePrice: 109.9,
    imageSrc: 'https://i.ibb.co/0yLVK114/TROQUE-O-RECHEIO-202604191752.jpg',
    fulfillmentType: 'encomenda',
    isAvailable: true,
    isFeatured: true,
    isPromo: false,
    primaryCategoryLabel: 'Aniversario',
    categoryIds: ['aniversario'],
  },
  {
    id: 'bolo-casamento-branco-dourado',
    name: 'Bolo de Casamento Branco Dourado',
    description:
      'Projeto elegante com visual refinado, camadas delicadas e acabamento sofisticado para celebrar com presenca e leveza.',
    price: 'A partir de R$ 289,90',
    basePrice: 289.9,
    imageSrc: 'https://i.ibb.co/kV9XWFPr/Bolo-de-casamento-dourado-e-elegante.png',
    fulfillmentType: 'encomenda',
    isAvailable: true,
    isFeatured: true,
    isPromo: false,
    primaryCategoryLabel: 'Casamento',
    categoryIds: ['casamento'],
  },

  {
    id: 'taca-ninho-chocolate',
    name: 'Taca de Ninho com Chocolate',
    description:
      'Camadas cremosas de leite em po, brigadeiro intenso e finalizacao elegante para servir gelada.',
    price: 'R$ 18,90',
    basePrice: 18.9,
    imageSrc: 'https://i.ibb.co/8gSY1vj8/Sobremesa-de-chocolate-e-Ninho-elegante.png',
    fulfillmentType: 'entrega-pronta',
    isAvailable: false,
    isFeatured: true,
    isPromo: false,
    primaryCategoryLabel: 'Tacas Doces',
    categoryIds: ['tacas'],
  },
  {
    id: 'copo-felicidade-nutella',
    name: 'Copo da Felicidade com Nutella',
    description:
      'Montagem generosa com creme aveludado, bolo fofinho e Nutella em cada colherada.',
    price: 'R$ 16,90',
    basePrice: 16.9,
    imageSrc: 'https://i.ibb.co/s98VxTkL/Sobremesa-deliciosa-com-Nutella-e-chocolate.png',
    fulfillmentType: 'entrega-pronta',
    isAvailable: false,
    isFeatured: true,
    isPromo: true,
    primaryCategoryLabel: 'Copos da Felicidade',
    categoryIds: ['copos'],
  },
  {
    id: 'bolo-morango-ninho',
    name: 'Bolo de Morango com Ninho',
    description:
      'Base delicada, recheio cremoso e morangos frescos para uma sobremesa leve e marcante.',
    price: 'R$ 89,90',
    basePrice: 89.9,
    imageSrc: 'https://i.ibb.co/ymRnfCRy/CRIE-UM-BOLO-202604191801.jpg',
    fulfillmentType: 'encomenda',
    isAvailable: true,
    isFeatured: true,
    isPromo: false,
    primaryCategoryLabel: 'Tortas',
    categoryIds: ['tortas', 'dia-das-maes'],
  },
  {
    id: 'bolo-chocolate-glace',
    name: 'Bolo de chocolate com glace',
    description:
      'Massa intensa de chocolate, cobertura brilhante e acabamento pensado para mesa de festa.',
    price: 'R$ 44,90',
    basePrice: 44.9,
    imageSrc: 'https://i.ibb.co/chFPfxyZ/COLOQUEO-NO-PRATO-202604191815.jpg',
    fulfillmentType: 'encomenda',
    isAvailable: true,
    isFeatured: true,
    isPromo: false,
    primaryCategoryLabel: 'Bolos',
    categoryIds: ['bolos'],
  },
  {
    id: 'bolo-oreo-ninho',
    name: 'Bolo de Oreo com Ninho',
    description:
      'Recheio cremoso, crocancia de biscoito e visual sofisticado para encomendas especiais.',
    price: 'R$ 89,90',
    basePrice: 89.9,
    imageSrc: 'https://i.ibb.co/yBRcqBPz/COLOQUE-NO-PRATO-202604191755.jpg',
    fulfillmentType: 'encomenda',
    isAvailable: true,
    isFeatured: true,
    isPromo: true,
    primaryCategoryLabel: 'Bolos',
    categoryIds: ['bolos'],
  },
  {id: 'bolo-cenoura-chocolate',
    name: 'Bolo de cenoura com Chocolate',
    description:
      'Massa intensa de cenoura, cobertura de chocolate perfeito para tardes.',
    price: 'R$ 44,90',
    basePrice: 44.9,
    imageSrc: 'https://i.ibb.co/BKnkFySX/COLOQUEO-NO-PRATO-202604191807.jpg',
    fulfillmentType: 'encomenda',
    isAvailable: true,
    isFeatured: true,
    isPromo: false,
    primaryCategoryLabel: 'Bolos',
    categoryIds: ['bolos'],
  },
  {id: 'bolo-milho-campo',
    name: 'Bolo de milho',
    description:
      'Massa intensa de milho, Perfeito para acompanhar cafe da tarde ou celebrar momentos simples com sabor caseiro.',
    price: 'R$ 44,90',
    basePrice: 44.9,
    imageSrc: 'https://i.ibb.co/Xf2DFsvs/CRIE-UM-BOLO-202604191804.jpg',
    fulfillmentType: 'encomenda',
    isAvailable: true,
    isFeatured: true,
    isPromo: false,
    primaryCategoryLabel: 'Bolos',
    categoryIds: ['bolos'],
  },
  {
    id: 'brigadeiros-caixas',
    name: 'Brigadeiros em caixas',
    description:
      'Selecao artesanal em caixa presenteavel, ideal para mimo, festas e lembrancas doces.',
    price: 'A partir de R$ 10,00',
    basePrice: 10,
    imageSrc: 'https://i.ibb.co/ymvJsq63/TROQUE-A-CAIXA-202604191819.jpg',
    fulfillmentType: 'encomenda',
    isAvailable: true,
    isFeatured: true,
    isPromo: false,
    primaryCategoryLabel: 'Destaques',
    categoryIds: ['tacas', 'copos', 'tortas', 'bolos'],
    options: [
      {
        id: 'caixa-4',
        label: 'Caixa com 4 brigadeiros',
        quantityLabel: '4 brigadeiros',
        price: 10,
      },
      {
        id: 'caixa-8',
        label: 'Caixa com 8 brigadeiros',
        quantityLabel: '8 brigadeiros',
        price: 18,
      },
      {
        id: 'caixa-12',
        label: 'Caixa com 12 brigadeiros',
        quantityLabel: '12 brigadeiros',
        price: 26,
      },
      {
        id: 'caixa-16',
        label: 'Caixa com 16 brigadeiros',
        quantityLabel: '16 brigadeiros',
        price: 34,
      },
      {
        id: 'caixa-20',
        label: 'Caixa com 20 brigadeiros',
        quantityLabel: '20 brigadeiros',
        price: 42,
      },
      {
        id: 'caixa-24',
        label: 'Caixa com 24 brigadeiros',
        quantityLabel: '24 brigadeiros',
        price: 50,
      },
    ],
  },
]

export const stats: Stat[] = [
  {
    value: '+120%',
    label: 'mais clareza na comunicacao da proposta',
  },
  {
    value: '3 blocos',
    label: 'essenciais ja montados para acelerar o inicio',
  },
  {
    value: '100% responsiva',
    label: 'base preparada para desktop e mobile',
  },
]
