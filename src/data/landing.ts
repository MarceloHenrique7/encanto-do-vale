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
    id: 'bolo-aniversario-brigadeiro',
    name: 'Bolo de Aniversario Brigadeiro Supremo',
    description:
      'Massa macia de chocolate, recheio intenso de brigadeiro e acabamento festivo pensado para mesas de aniversario cheias de destaque.',
    price: 'R$ A partir de 109,90',
    basePrice: 109.9,
    imageSrc: 'https://i.ibb.co/XxD5M1jS/Brigadeiro-Supremo-um-bolo-irresist-vel.png',
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
    id: 'torta-morango-ninho',
    name: 'Torta de Morango com Ninho',
    description:
      'Base delicada, recheio cremoso e morangos frescos para uma sobremesa leve e marcante.',
    price: 'R$ 89,90',
    basePrice: 89.9,
    imageSrc: 'https://i.ibb.co/5xgW4ynn/Torta-de-morango-com-Ninho.png',
    fulfillmentType: 'encomenda',
    isAvailable: true,
    isFeatured: true,
    isPromo: false,
    primaryCategoryLabel: 'Tortas',
    categoryIds: ['tortas'],
  },
  {
    id: 'bolo-chocolate-glace',
    name: 'Bolo de chocolate com glace',
    description:
      'Massa intensa de chocolate, cobertura brilhante e acabamento pensado para mesa de festa.',
    price: 'R$ 44,90',
    basePrice: 44.9,
    imageSrc: 'https://i.ibb.co/k647n2gs/Chat-GPT-Image-5-de-abr-de-2026-15-38-29.png',
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
    imageSrc: 'https://i.ibb.co/67LKGD2S/Bolo-de-Oreo-com-recheio-Ninho.png',
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
    imageSrc: 'https://i.ibb.co/RGf2xRyb/Bolo-de-chocolate-em-ambiente-acolhedor.png',
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
    imageSrc: 'https://i.ibb.co/0jG3SyPf/Bolo-de-milho-no-campo.png',
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
    imageSrc: 'https://i.ibb.co/WQJnmnq/Chat-GPT-Image-5-de-abr-de-2026-15-40-38.png',
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
