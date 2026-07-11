# Encanto do Vale — cardápio e checkout

Web cardápio React com carrinho, pedido interno e Mercado Pago Payment Brick
para Pix, cartão de crédito e cartão de débito. O Access Token existe somente
no processo Node/Express.

## Deploy em producao

Para publicar na Hostinger, siga o checklist em
[`DEPLOY_HOSTINGER.md`](DEPLOY_HOSTINGER.md). Use
`.env.production.example` como modelo das variaveis reais.

## Estrutura

```text
frontend/                 React + Vite
  src/components/
    FloatingCart.tsx      carrinho, entrega e criação do pedido
    PaymentBrick.tsx      Payment Brick oficial
    OrderStatusPage.tsx   rota /pedido/:order_id
backend/
  server.js               servidor Express local
  app.js                  rotas e CORS
  controllers/checkout.js pedidos, pagamento e webhook
  services/
    mercado-pago.js       SDK oficial do Mercado Pago
    order-store.js        persistência JSON substituível
  data/orders.json        criado em execução e ignorado pelo Git
  catalog.json            catálogo autoritativo para preços
```

## Instalação

Requer Node.js 20 ou superior.

```bash
npm install
```

Copie `.env.example` para `.env` e preencha as duas credenciais da mesma
aplicação Mercado Pago:

```dotenv
MERCADO_PAGO_PUBLIC_KEY=
MERCADO_PAGO_ACCESS_TOKEN=
BACKEND_URL=http://localhost:3000
FRONTEND_URL=http://localhost:5173
ADMIN_PASSWORD=uma-senha-forte
SESSION_SECRET=uma-chave-aleatoria-com-pelo-menos-24-caracteres
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_VERIFY_SERVICE_SID=
```

`MERCADO_PAGO_PUBLIC_KEY` é incorporada ao bundle público pelo Vite. Isso é
esperado. `MERCADO_PAGO_ACCESS_TOKEN` é lida apenas pelo backend e nunca deve
usar o prefixo `VITE_`.

Inicie frontend e backend juntos:

```bash
npm run dev
```

- Cardápio: `http://localhost:5173`
- API: `http://localhost:3000`
- Diagnóstico: `http://localhost:3000/api/health`
- Gestor do restaurante: `http://localhost:5173/gestor`

## Acesso obrigatório do cliente

O cardápio só é renderizado depois de uma sessão válida. No primeiro acesso, o
cliente informa nome e celular, escolhe SMS ou WhatsApp e confirma o código.
O usuário verificado é salvo em `backend/data/users.json`.

Nos próximos acessos, ele pode:

- solicitar um novo código usando o celular cadastrado; ou
- entrar com celular e senha, caso tenha criado uma senha em **Meu perfil**.

Senhas são derivadas com `scrypt`, salt individual e nunca são salvas em texto
puro. A sessão fica em cookie `HttpOnly`, `SameSite=Lax` e dura 30 dias. Os
endpoints de criação, pagamento e consulta de pedido também exigem a sessão e
validam que o pedido pertence ao usuário.

### SMS e WhatsApp com Twilio Verify

Crie um serviço no Twilio Verify e configure:

```dotenv
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_VERIFY_SERVICE_SID=VA...
TWILIO_VERIFY_FRIENDLY_NAME=Encanto do Vale
# Opcional, somente para SMS/voz:
TWILIO_VERIFY_TEMPLATE_SID=HJ...
```

O `TWILIO_VERIFY_SERVICE_SID` precisa ser o SID de um serviço **Verify** e
começar com `VA`. Um Content SID iniciado por `HX`, usado com
`client.messages.create`, não substitui o serviço Verify deste fluxo.
O nome amigável é enviado em português brasileiro e identifica a mensagem
como sendo da Encanto do Vale. Para controlar o texto exato do SMS, use um
template Verify aprovado com SID iniciado por `HJ`; templates `HX` são de
Programmable Messaging e não funcionam no Verify.

O mesmo serviço aceita os canais `sms` e `whatsapp`. Em uma conta Trial, a
Twilio pode exigir que o número destinatário esteja previamente verificado.

Sem essas três variáveis:

- em desenvolvimento, a tela mostra um código local de seis dígitos;
- em produção, o envio é bloqueado — nunca existe código universal ou bypass.

Endpoints de autenticação:

- `GET /api/auth/session`
- `POST /api/auth/request-code`
- `POST /api/auth/verify-code`
- `POST /api/auth/login/password`
- `PATCH /api/auth/profile`
- `POST /api/auth/logout`

## Fluxo implementado

1. O cliente monta o carrinho e informa seus dados.
2. `POST /api/orders` valida o pedido e recalcula tudo pelo
   `backend/catalog.json`.
3. O pedido é salvo com UUID e status `pending`.
4. O frontend renderiza o Payment Brick com o total retornado pelo backend.
5. O Brick tokeniza o cartão ou coleta os dados do Pix.
6. `POST /api/process-payment` cobra exatamente o total do pedido persistido.
7. Pix exibe QR Code e copia e cola; cartão aprovado exibe confirmação.
8. O webhook consulta o pagamento no Mercado Pago antes de atualizar o pedido.
9. `/pedido/:order_id` permite consultar o status atual.

Quando o cartão é aprovado, o cliente é redirecionado automaticamente para a
página do pedido. Para Pix pendente, o frontend consulta o pedido a cada cinco
segundos e faz o mesmo redirecionamento assim que o webhook confirmar o
pagamento.

Nenhum número de cartão, CVV ou token do Brick é salvo ou escrito nos logs.

## API

### `POST /api/orders`

Aceita os campos documentados no projeto e também `delivery_method`
(`pickup` ou `delivery`). Para entrega, `address`, `number` e `neighborhood`
são obrigatórios. `subtotal`, `delivery_fee`, `total`, nomes e preços enviados
pelo navegador não são confiados: o backend usa seu catálogo e recalcula a
taxa pela zona de entrega cadastrada.

Resposta:

```json
{
  "order_id": "uuid",
  "total": 39.98
}
```

### `POST /api/process-payment`

```json
{
  "order_id": "uuid",
  "formData": {}
}
```

O `formData` vem diretamente do Payment Brick. O servidor acrescenta o total
do pedido, `external_reference`, descrição e `notification_url`, então usa o
SDK oficial para criar o pagamento.

### `POST /api/webhooks/mercadopago`

Aceita a notificação, extrai `payment_id`, consulta esse pagamento com o SDK e
usa `external_reference` para localizar o pedido:

- `approved` → `paid`
- `pending` ou `in_process` → `waiting_payment`
- `rejected`, `cancelled`, `refunded` ou `charged_back` → `failed`

### `GET /api/orders/:id`

Retorna os itens, totais e o status persistido do pedido.

## Taxa de entrega por bairro

O modo atual usa bairros e distâncias estimadas cadastrados manualmente em
`backend/config/deliveryZones.js`. Ele é gratuito, previsível e mais estável
para uma operação pequena de delivery.

A taxa é calculada exclusivamente no backend:

- até 3 km: grátis;
- a partir de 3,5 km: R$ 6,99;
- cada quilômetro inteiro adicional após 3,5 km: mais R$ 1,50.

O frontend consulta estas rotas:

- `GET /api/delivery-zones`: lista os bairros atendidos, distância e taxa;
- `POST /api/calculate-delivery`: valida o bairro ou calcula retirada grátis.

Na criação do pedido, o servidor consulta novamente a lista, recalcula
subtotal, taxa e total e bloqueia bairros não atendidos. A taxa recebida do
navegador é sempre ignorada.

Para editar a cobertura, altere somente `backend/config/deliveryZones.js`. O
campo `externalRouting.enabled` deixa preparado um modo futuro por API, mas
permanece desativado por padrão. OpenRouteService ou OSRM podem ser usados
futuramente; o OSRM público é gratuito, porém não é indicado para tráfego
pesado em produção. O Google Maps costuma oferecer resultados melhores, mas
pode gerar cobranças. Para este cardápio, zonas fixas são a opção mais segura
e previsível.

## Gestor do restaurante

Acesse `/gestor` e entre com `ADMIN_PASSWORD`. A senha é validada no backend e
o navegador recebe uma sessão assinada em cookie `HttpOnly`; ela nunca é
incluída no bundle do frontend.

Defina também uma chave aleatória com pelo menos 24 caracteres:

```dotenv
ADMIN_PASSWORD=escolha-uma-senha-forte
SESSION_SECRET=gere-uma-frase-aleatoria-longa
```

Depois de alterar o `.env.local`, reinicie `npm run dev`.

O painel oferece:

- navegação única entre pedidos e catálogo;
- CRUD completo de produtos e categorias, com busca, duplicação, adicionais,
  variações, promoções, destaques e pausa rápida de disponibilidade;
- publicação imediata das alterações na vitrine e no catálogo usado pelo
  backend para validar preços;
- fila atualizada por eventos em tempo real, com consulta de contingência;
- sininho metálico de balcão/cozinha, repetido em volume alto para pedidos
  pagos até o pedido ser aceito;
- eventos em tempo real e notificação do sistema mesmo com a aba em segundo
  plano;
- filtros de novos, em preparo, prontos, concluídos e cancelados;
- etapas aceitar → preparar → pronto → finalizar;
- itens, observações, endereço, total e atalho para o WhatsApp;
- bloqueio de produção para pedidos que ainda não foram pagos.

Por política do Chrome e de outros navegadores, clique em **Ativar alertas**
uma vez depois de abrir o gestor. A partir desse gesto, o sininho em loop
continua funcionando ao trocar de aba. Ela não funciona se a aba for fechada,
o navegador for encerrado ou o computador entrar em suspensão.

Endpoints administrativos:

- `POST /api/admin/login`
- `POST /api/admin/logout`
- `GET /api/admin/session`
- `GET /api/admin/orders`
- `GET /api/admin/orders/stream`
- `PATCH /api/admin/orders/:id/status`
- `GET /api/admin/catalog`
- `POST /api/admin/products`
- `PUT /api/admin/products/:id`
- `DELETE /api/admin/products/:id`
- `POST /api/admin/categories`
- `PUT /api/admin/categories/:id`
- `DELETE /api/admin/categories/:id`

O catálogo público é servido por `GET /api/catalog`. A rota antiga `/admin`
redireciona para `/gestor`, evitando dois painéis e duas fontes de dados.
Nesta versão, as alterações são gravadas em `backend/catalog.json`. Em uma
implantação com filesystem efêmero/serverless, migre o `catalog-store` para um
banco persistente antes de usar o CRUD em produção.

## Testando pagamentos

Use sempre Public Key e Access Token de **teste da mesma aplicação**. Não
misture uma chave de teste com um token de produção.

### Pix

1. Cadastre uma chave Pix na conta de teste quando o painel solicitar.
2. Monte um pedido e escolha “Pix ou cartão online”.
3. Clique em “Ir para pagamento” e selecione Pix no Brick.
4. O retorno deve mostrar QR Code e código copia e cola.

### Cartão

Use os cartões e compradores de teste exibidos em **Mercado Pago Developers →
Sua aplicação → Testes**. O resultado aprovado, pendente ou recusado depende
do titular/status indicado pelo Mercado Pago para o cenário de teste.

Execute a validação local:

```bash
npm test
npm run typecheck
npm run build
```

## Webhook local e produção

O Mercado Pago não consegue chamar `localhost`. Para testar webhook local,
publique temporariamente a porta 3000:

```bash
ngrok http 3000
```

Depois defina no `.env`:

```dotenv
BACKEND_URL=https://seu-subdominio.ngrok-free.app
```

Reinicie `npm run dev`. O backend enviará:

```text
https://seu-subdominio.ngrok-free.app/api/webhooks/mercadopago
```

Em produção:

1. Use HTTPS e defina `BACKEND_URL` com o domínio público da API.
2. Defina `FRONTEND_URL` com a origem exata do frontend; somente ela recebe
   cabeçalhos CORS.
3. Cadastre a mesma URL de webhook no painel da aplicação Mercado Pago.
4. Configure as variáveis no provedor, nunca em arquivos versionados.
5. Rode `npm run check` antes de publicar.

O armazenamento JSON é simples e adequado ao desenvolvimento ou a um único
servidor com disco persistente. Em Vercel/serverless, o filesystem é efêmero:
antes de produção, substitua `services/order-store.js` e
`services/user-store.js` por PostgreSQL, SQLite persistente ou outro banco. Os
controllers já estão isolados para essa migração.

## Segurança

- `.env`, `.env.local` e `backend/data/orders.json` estão no `.gitignore`.
- `backend/data/users.json` também é ignorado pelo Git.
- O Access Token nunca é entregue pelo frontend.
- O servidor recalcula preço, subtotal, entrega e total.
- O CORS aceita apenas `FRONTEND_URL`.
- O backend limita JSON a 100 KB e sanitiza os campos persistidos.
- O webhook não confia no corpo recebido: consulta o pagamento no Mercado Pago.
- Logs de produção não contêm token de cartão nem Access Token.
