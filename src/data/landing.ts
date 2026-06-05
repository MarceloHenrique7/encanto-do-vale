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
    "id": "cesta-mae-afeto",
    "name": "Cesta Mae Afeto Doce",
    "description": "🎁 Cesta “Você é Especial” – Versão Delicada\n\n        Às vezes, um gesto simples…\n        é o que mais marca. ❤️\n\n        Essa cesta é perfeita pra quem quer surpreender com carinho, sem exagero — mas com muito significado.\n\n        ✨ O que acompanha:\n\n        🧸 Pelúcia fofa e delicada\n        🍫 Mix de chocolates (Prestígio, Baton, Serenata de Amor, Talento e mais)\n        🌹 Arranjo de rosas artificiais (visual elegante e romântico)\n        🎁 Caixa MDF com a frase “Você é Especial”\n        🌾 Acabamento com palha decorativa (estilo rústico e aconchegante)",
    "price": "A partir de R$ 0,90",
    "basePrice": 0.9,
    "imageSrc": "https://i.ibb.co/jkBnvKCp/tradu-o-texto-202604191651.jpg",
    "fulfillmentType": "encomenda",
    "isAvailable": true,
    "isFeatured": false,
    "isPromo": true,
    "primaryCategoryLabel": "Cestas",
    "categoryIds": [
      "cestas",
      "dia-das-maes"
    ]
  },
  {
    "id": "cesta-mae-chocolate",
    "name": "Cesta Mae Chocolates Especiais",
    "description": "\n        Tem presentes…\n          e tem aqueles que fazem a pessoa parar, olhar… e se emocionar. 💛\n\n          Essa cesta foi criada pra isso.\n\n          Cada detalhe aqui não é por acaso — é pra transformar um simples momento em uma lembrança que fica pra sempre.\n\n          ✨ O que acompanha:\n\n          🧸 Pelúcia com coração “Eu te amo”\n          🍫 Seleção premium de chocolates (KitKat, Ouro Branco, BIS, Laka, trufas e mais)\n          🍬 Caixa especial com doces finos\n          📸 6 fotos personalizadas (memórias que contam uma história)\n          💡 Iluminação delicada em LED (efeito encantador)\n          🎁 Caixa MDF com a frase “Te Amo”\n          🌹 Pétalas decorativas para um toque ainda mais especial\n      ",
    "price": "A partir de R$ 170,99",
    "basePrice": 170.99,
    "imageSrc": "https://i.ibb.co/8L04fDY8/Gemini-Generated-Image-zg1wv2zg1wv2zg1w.png",
    "fulfillmentType": "encomenda",
    "isAvailable": true,
    "isFeatured": false,
    "isPromo": true,
    "primaryCategoryLabel": "Cestas",
    "categoryIds": [
      "cestas",
      "dia-das-maes"
    ]
  },
  {
    "id": "cesta-mae-encanto",
    "name": "Cesta Mae Encanto do Vale",
    "description": "Uma surpresa que fala por você… 💛  \n\nEssa cesta foi pensada para transformar um simples presente em um momento inesquecível. Com um toque delicado e cheio de carinho, ela reúne tudo que emociona e encanta logo no primeiro olhar.  \n\n✨ O que acompanha:  \n\n🧸 Pelúcia charmosa com mensagem “Eu te amo”  \n🍫 Seleção de chocolates (Sonho de Valsa, Ouro Branco, etc.)  \n🍰 Doce especial da Encanto do Vale  \n🌹 Pétalas decorativas para um toque romântico  \n🎁 Caixa MDF elegante com a frase “Você é Especial”  \n\n💝 Perfeita para:  \nSurpreender no Dia das Mães, aniversários ou qualquer momento que mereça um gesto cheio de amor.  \n\n💬 Porque mais do que um presente…  \né uma forma de dizer: “eu pensei em você em cada detalhe.”",
    "price": "A partir de R$ 234.9",
    "basePrice": 234.9,
    "imageSrc": "https://i.ibb.co/ZRv9d29Y/Gemini-Generated-Image-t1u2z0t1u2z0t1u2.png",
    "fulfillmentType": "encomenda",
    "isAvailable": true,
    "isFeatured": false,
    "isPromo": false,
    "primaryCategoryLabel": "Cestas",
    "categoryIds": [
      "cestas",
      "dia-das-maes"
    ]
  },
  {
    "id": "cesta-mae-premium",
    "name": "Cesta Mae Premium com Chocolates",
    "description": "\n        Mais do que um presente… uma lembrança que fica pra sempre. 💛\n\n        Essa cesta foi criada pra emocionar de verdade. Cada detalhe foi pensado pra transformar um momento simples em algo inesquecível — principalmente pelas fotos que contam uma história única.\n\n        ✨ O que acompanha:\n\n        🧸 Pelúcia delicada e aconchegante\n        🍫 Chocolates selecionados (KitKat, Alpino, Ferrero Rocher, Serenata de Amor e outros)\n        📸 6 fotos personalizadas presas na tampa (estilo varal de memórias)\n        🎁 Caixa MDF premium com a frase “Você é Especial”\n        🌾 Acabamento rústico elegante com palha decorativa\n      ",
    "price": "A partir de R$ 149,99",
    "basePrice": 149.9,
    "imageSrc": "https://i.ibb.co/qY1hKJTg/crie-um-combo-202604191706-1.jpg",
    "fulfillmentType": "encomenda",
    "isAvailable": true,
    "isFeatured": false,
    "isPromo": false,
    "primaryCategoryLabel": "Cestas",
    "categoryIds": [
      "cestas",
      "dia-das-maes"
    ]
  },
  {
    "id": "bolo-aniversario-brigadeiro",
    "name": "Bolo de Aniversario Brigadeiro Supremo",
    "description": "Massa macia de chocolate, recheio intenso de brigadeiro e acabamento festivo pensado para mesas de aniversario cheias de destaque.",
    "price": "A partir de R$ 109,90",
    "basePrice": 109.9,
    "imageSrc": "https://i.ibb.co/0yLVK114/TROQUE-O-RECHEIO-202604191752.jpg",
    "fulfillmentType": "encomenda",
    "isAvailable": true,
    "isFeatured": true,
    "isPromo": false,
    "primaryCategoryLabel": "Aniversario",
    "categoryIds": [
      "aniversario"
    ]
  },
  {
    "id": "bolo-casamento-branco-dourado",
    "name": "Bolo de Casamento Branco Dourado",
    "description": "Projeto elegante com visual refinado, camadas delicadas e acabamento sofisticado para celebrar com presenca e leveza.",
    "price": "A partir de R$ 289,90",
    "basePrice": 289.9,
    "imageSrc": "https://i.ibb.co/kV9XWFPr/Bolo-de-casamento-dourado-e-elegante.png",
    "fulfillmentType": "encomenda",
    "isAvailable": true,
    "isFeatured": true,
    "isPromo": false,
    "primaryCategoryLabel": "Casamento",
    "categoryIds": [
      "casamento"
    ]
  },
  {
    "id": "taca-ninho-chocolate",
    "name": "Taca de Ninho com Chocolate",
    "description": "Camadas cremosas de leite em po, brigadeiro intenso e finalizacao elegante para servir gelada.",
    "price": "R$ 18,90",
    "basePrice": 18.9,
    "imageSrc": "https://i.ibb.co/8gSY1vj8/Sobremesa-de-chocolate-e-Ninho-elegante.png",
    "fulfillmentType": "entrega-pronta",
    "isAvailable": false,
    "isFeatured": true,
    "isPromo": false,
    "primaryCategoryLabel": "Tacas Doces",
    "categoryIds": [
      "tacas"
    ]
  },
  {
    "id": "copo-felicidade-nutella",
    "name": "Copo da Felicidade com Nutella",
    "description": "Montagem generosa com creme aveludado, bolo fofinho e Nutella em cada colherada.",
    "price": "R$ 16,90",
    "basePrice": 16.9,
    "imageSrc": "https://i.ibb.co/s98VxTkL/Sobremesa-deliciosa-com-Nutella-e-chocolate.png",
    "fulfillmentType": "entrega-pronta",
    "isAvailable": false,
    "isFeatured": true,
    "isPromo": true,
    "primaryCategoryLabel": "Copos da Felicidade",
    "categoryIds": [
      "copos"
    ]
  },
  {
    "id": "bolo-morango-ninho",
    "name": "Bolo de Morango com Ninho",
    "description": "Base delicada, recheio cremoso e morangos frescos para uma sobremesa leve e marcante.",
    "price": "R$ 89,90",
    "basePrice": 89.9,
    "imageSrc": "https://i.ibb.co/ymRnfCRy/CRIE-UM-BOLO-202604191801.jpg",
    "fulfillmentType": "encomenda",
    "isAvailable": true,
    "isFeatured": true,
    "isPromo": false,
    "primaryCategoryLabel": "Tortas",
    "categoryIds": [
      "tortas",
      "dia-das-maes"
    ]
  },
  {
    "id": "bolo-chocolate-glace",
    "name": "Bolo de chocolate com glace",
    "description": "Massa intensa de chocolate, cobertura brilhante e acabamento pensado para mesa de festa.",
    "price": "R$ 44,90",
    "basePrice": 44.9,
    "imageSrc": "https://i.ibb.co/chFPfxyZ/COLOQUEO-NO-PRATO-202604191815.jpg",
    "fulfillmentType": "encomenda",
    "isAvailable": true,
    "isFeatured": true,
    "isPromo": false,
    "primaryCategoryLabel": "Bolos",
    "categoryIds": [
      "bolos"
    ]
  },
  {
    "id": "bolo-oreo-ninho",
    "name": "Bolo de Oreo com Ninho",
    "description": "Recheio cremoso, crocancia de biscoito e visual sofisticado para encomendas especiais.",
    "price": "R$ 89,90",
    "basePrice": 89.9,
    "imageSrc": "https://i.ibb.co/yBRcqBPz/COLOQUE-NO-PRATO-202604191755.jpg",
    "fulfillmentType": "encomenda",
    "isAvailable": true,
    "isFeatured": true,
    "isPromo": true,
    "primaryCategoryLabel": "Bolos",
    "categoryIds": [
      "bolos"
    ]
  },
  {
    "id": "bolo-cenoura-chocolate",
    "name": "Bolo de cenoura com Chocolate",
    "description": "Massa intensa de cenoura, cobertura de chocolate perfeito para tardes.",
    "price": "R$ 44,90",
    "basePrice": 44.9,
    "imageSrc": "https://i.ibb.co/BKnkFySX/COLOQUEO-NO-PRATO-202604191807.jpg",
    "fulfillmentType": "encomenda",
    "isAvailable": true,
    "isFeatured": true,
    "isPromo": false,
    "primaryCategoryLabel": "Bolos",
    "categoryIds": [
      "bolos"
    ]
  },
  {
    "id": "bolo-milho-campo",
    "name": "Bolo de milho",
    "description": "Massa intensa de milho, Perfeito para acompanhar cafe da tarde ou celebrar momentos simples com sabor caseiro.",
    "price": "R$ 0,10",
    "basePrice": 0.1,
    "imageSrc": "https://i.ibb.co/Xf2DFsvs/CRIE-UM-BOLO-202604191804.jpg",
    "fulfillmentType": "encomenda",
    "isAvailable": true,
    "isFeatured": true,
    "isPromo": false,
    "primaryCategoryLabel": "Bolos",
    "categoryIds": [
      "bolos"
    ]
  },
  {
    "id": "brigadeiros-caixas",
    "name": "Brigadeiros em caixas",
    "description": "Selecao artesanal em caixa presenteavel, ideal para mimo, festas e lembrancas doces.",
    "price": "A partir de R$ 10,00",
    "basePrice": 10,
    "imageSrc": "https://i.ibb.co/ymvJsq63/TROQUE-A-CAIXA-202604191819.jpg",
    "fulfillmentType": "encomenda",
    "isAvailable": true,
    "isFeatured": true,
    "isPromo": false,
    "primaryCategoryLabel": "Destaques",
    "categoryIds": [
      "tacas",
      "copos",
      "tortas",
      "bolos"
    ],
    "options": [
      {
        "id": "caixa-4",
        "label": "Caixa com 4 brigadeiros",
        "quantityLabel": "4 brigadeiros",
        "price": 10
      },
      {
        "id": "caixa-8",
        "label": "Caixa com 8 brigadeiros",
        "quantityLabel": "8 brigadeiros",
        "price": 18
      },
      {
        "id": "caixa-12",
        "label": "Caixa com 12 brigadeiros",
        "quantityLabel": "12 brigadeiros",
        "price": 26
      },
      {
        "id": "caixa-16",
        "label": "Caixa com 16 brigadeiros",
        "quantityLabel": "16 brigadeiros",
        "price": 34
      },
      {
        "id": "caixa-20",
        "label": "Caixa com 20 brigadeiros",
        "quantityLabel": "20 brigadeiros",
        "price": 42
      },
      {
        "id": "caixa-24",
        "label": "Caixa com 24 brigadeiros",
        "quantityLabel": "24 brigadeiros",
        "price": 50
      }
    ]
  },
  {
    "id": "cesta-mae-amor-maior",
    "name": "Cesta Mãe Amor Maior 🌷",
    "description": "Uma cesta delicada e apaixonante para transformar o Dia das Mães em um momento inesquecível. 💖\n\nInclui:\n✨ caneca personalizada\n✨ chocolates premium\n✨ mini espumante\n✨ flores decorativas\n✨ ursinho de pelúcia\n✨ embalagem especial para presente",
    "price": "159,99",
    "basePrice": 159.99,
    "imageSrc": "https://i.ibb.co/HLW6Jdcw/cesta-maes-com-caneca.jpg",
    "fulfillmentType": "encomenda",
    "isAvailable": true,
    "isFeatured": false,
    "isPromo": true,
    "primaryCategoryLabel": "Cestas",
    "categoryIds": [
      "cestas",
      "dia-das-maes"
    ]
  },
  {
    "id": "cesta-te-amo-mae",
    "name": "Cesta Te Amo Mãe 💝",
    "description": "Uma combinação perfeita de delicadeza, chocolates e amor em cada detalhe. 🌸\n\nEssa cesta foi criada para mães que merecem um presente elegante e cheio de carinho.\n\nContém:\n🍫 chocolates selecionados\n☕ caneca personalizada\n🧸 ursinho decorativo\n🍾 mini espumante\n🌹 flores decorativas\n🎁 embalagem premium",
    "price": "179,99",
    "basePrice": 179.99,
    "imageSrc": "https://i.ibb.co/ymthQ8vT/adicione-a-cesta-de-caf-202605062028.jpg",
    "fulfillmentType": "encomenda",
    "isAvailable": true,
    "isFeatured": false,
    "isPromo": true,
    "primaryCategoryLabel": "Cestas",
    "categoryIds": [
      "cestas",
      "dia-das-maes"
    ]
  },
  {
    "id": "cesta-cafe-da-manha-premium",
    "name": "Cesta Café da Manhã Premium ☀️",
    "description": "Uma experiência completa de café da manhã para começar o Dia das Mães da forma mais especial possível. 💛\n\nInclui:\n🥐 croissants amanteigados\n🍓 frutas frescas\n🍫 Nutella\n🧇 waffles artesanais\n🥛 bebidas e doces\n🍮 sobremesas especiais\n\nIdeal para surpreender logo nas primeiras horas do dia.",
    "price": "199,99",
    "basePrice": 199.99,
    "imageSrc": "https://i.ibb.co/jv92grKt/cesta-cafe-da-manha.jpg",
    "fulfillmentType": "encomenda",
    "isAvailable": true,
    "isFeatured": false,
    "isPromo": true,
    "primaryCategoryLabel": "Cestas",
    "categoryIds": [
      "cestas",
      "dia-das-maes"
    ]
  },
  {
    "id": "cesta-chocolate-carinho",
    "name": "Cesta Chocolate & Carinho 🍫",
    "description": "Uma opção linda e acessível para presentear no Dia das Mães sem deixar o carinho de lado. ❤️\n\nContém:\n🍫 chocolates variados\n🧸 ursinho de pelúcia\n🎁 cesta decorativa\n💌 apresentação especial\n\nPerfeita para surpreender de forma doce e inesquecível.",
    "price": "129,99",
    "basePrice": 129.99,
    "imageSrc": "https://i.ibb.co/VrnZdK5/cesta-maes-presente.jpg",
    "fulfillmentType": "encomenda",
    "isAvailable": true,
    "isFeatured": false,
    "isPromo": true,
    "primaryCategoryLabel": "Cestas",
    "categoryIds": [
      "cestas",
      "dia-das-maes"
    ]
  },
  {
    "id": "1-caixa-mdf-doce-amor",
    "name": "🌷 Caixa MDF “Doce Amor”",
    "description": "Uma lembrança delicada e cheia de carinho para surpreender no Dia das Mães. ❤️\n\nNossa caixa MDF “Doce Amor” acompanha chocolates selecionados, mini ursinho com coração, bombons premium e acabamento artesanal em uma apresentação elegante e afetiva.\n\n🎁 Ideal para presentear de forma simples, bonita e inesquecível.\n\n✨ Itens inclusos:\n\nMini ursinho decorativo\nChocolates variados\nBombons premium\nCaixa MDF personalizada\nLaço decorativo artesanal\n\n💌 Produção limitada para o Dia das Mães.",
    "price": "A partir de R$ 99,99",
    "basePrice": 99.99,
    "imageSrc": "https://i.ibb.co/k6WhgnT5/cesta-maes-07-05.jpg",
    "fulfillmentType": "encomenda",
    "isAvailable": true,
    "isFeatured": false,
    "isPromo": true,
    "primaryCategoryLabel": "Cestas",
    "categoryIds": [
      "cestas",
      "dia-das-maes"
    ]
  },
  {
    "id": "2-cesta-amor-em-cada-detalhe",
    "name": "❤️ Cesta “Amor em Cada Detalhe”",
    "description": "Uma cesta apaixonante criada para emocionar já no primeiro olhar. 🌹\n\nCom balão decorativo, chocolates, flores artificiais e caneca temática, essa opção combina delicadeza e charme em uma apresentação super especial.\n\n✨ Itens inclusos:\n\nBalão coração metalizado\nMini ursinho\nFerrero Rocher e chocolates variados\nCaneca temática “Mãe Te Amo”\nFlores decorativas\nEmbalagem transparente premium\n\n🎁 Um presente perfeito para transformar o Dia das Mães em um momento inesquecível.",
    "price": "139,99",
    "basePrice": 139.99,
    "imageSrc": "https://i.ibb.co/V0nktMdJ/cesta-maes-07-03.jpg",
    "fulfillmentType": "encomenda",
    "isAvailable": true,
    "isFeatured": false,
    "isPromo": true,
    "primaryCategoryLabel": "Cestas",
    "categoryIds": [
      "cestas",
      "dia-das-maes"
    ]
  },
  {
    "id": "4-box-mae-voce-e-luz",
    "name": "🎀 Box “Mãe, Você é Luz”",
    "description": "Elegância, delicadeza e carinho reunidos em uma caixa presenteável super sofisticada. 🌷\n\nA Box “Mãe, Você é Luz” foi criada para mães que merecem um presente memorável e cheio de significado.\n\n💖 Itens inclusos:\n\nCaneca personalizada\nChocolates variados\nMini ursinho decorativo\nFlores delicadas\nCartão temático\nCaixa premium decorada\nEmbalagem transparente com laço acetinado\n\n🎁 Um presente perfeito para emocionar e encantar neste Dia das Mães.",
    "price": "89,99",
    "basePrice": 89.99,
    "imageSrc": "https://i.ibb.co/jnb56xv/cesta-maes-07-1.jpg",
    "fulfillmentType": "encomenda",
    "isAvailable": true,
    "isFeatured": false,
    "isPromo": true,
    "primaryCategoryLabel": "Cestas",
    "categoryIds": [
      "cestas",
      "dia-das-maes"
    ]
  }
]
