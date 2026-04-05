import type { Category, Product, Stat } from '@/types/landing'

export const highlights: string[] = [
  'Organize processos e atendimento em um so lugar',
  'Acompanhe metricas e resultados em tempo real',
  'Transforme visitantes em contatos qualificados',
]

export const categories: Category[] = [
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
    id: 'taca-ninho-chocolate',
    name: 'Taca de Ninho com Chocolate',
    description:
      'Camadas cremosas de leite em po, brigadeiro intenso e finalizacao elegante para servir gelada.',
    price: 'R$ 18,90',
    imageSrc: 'https://i.ibb.co/8gSY1vj8/Sobremesa-de-chocolate-e-Ninho-elegante.png',
    fulfillmentType: 'entrega-pronta',
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
    imageSrc: 'https://i.ibb.co/s98VxTkL/Sobremesa-deliciosa-com-Nutella-e-chocolate.png',
    fulfillmentType: 'entrega-pronta',
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
    imageSrc: 'https://i.ibb.co/5xgW4ynn/Torta-de-morango-com-Ninho.png',
    fulfillmentType: 'encomenda',
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
    price: 'R$ 74,90',
    imageSrc: 'https://i.ibb.co/k647n2gs/Chat-GPT-Image-5-de-abr-de-2026-15-38-29.png',
    fulfillmentType: 'encomenda',
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
    price: 'R$ 82,90',
    imageSrc: 'https://i.ibb.co/67LKGD2S/Bolo-de-Oreo-com-recheio-Ninho.png',
    fulfillmentType: 'encomenda',
    isFeatured: true,
    isPromo: true,
    primaryCategoryLabel: 'Bolos',
    categoryIds: ['bolos'],
  },
  {
    id: 'brigadeiros-caixas',
    name: 'Brigadeiros em caixas',
    description:
      'Selecao artesanal em caixa presenteavel, ideal para mimo, festas e lembrancas doces.',
    price: 'R$ 36,90',
    imageSrc: 'https://i.ibb.co/WQJnmnq/Chat-GPT-Image-5-de-abr-de-2026-15-40-38.png',
    fulfillmentType: 'entrega-pronta',
    isFeatured: true,
    isPromo: false,
    primaryCategoryLabel: 'Destaques',
    categoryIds: ['tacas', 'copos', 'tortas', 'bolos'],
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
