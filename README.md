# Encanto do Vale

Landing page em React + Vite + TypeScript para a doceria Encanto do Vale.

## Tecnologias

- React
- Vite
- TypeScript
- CSS customizado
- Tailwind CSS configurado

## Scripts

```bash
npm install
npm run dev
npm run build
```

## Checkout online

O carrinho possui finalizacao por WhatsApp e pagamento online via Mercado Pago
Checkout Pro em `/api/create-checkout`.

Variaveis principais:

- `MERCADO_PAGO_ACCESS_TOKEN`: token da conta que recebe o pagamento.
- `MERCADO_PAGO_SELLER_ACCESS_TOKEN`: token OAuth do vendedor, quando usar marketplace/split.
- `MARKETPLACE_FEE_PERCENT`: percentual da plataforma sobre os produtos, aplicado somente com token OAuth do vendedor.
- `PUBLIC_SITE_URL`: dominio publico usado nas URLs de retorno e webhook.
- `VITE_DELIVERY_FEE`: taxa de entrega exibida no carrinho.

Em marketplace, o checkout usa `marketplace_fee` para separar a comissao da
plataforma. O webhook em `/api/mercado-pago-webhook` consulta o pagamento e
registra status, referencia externa e detalhes no log do servidor.

## Deploy

Projeto pronto para deploy estatico na Vercel ou Render.
