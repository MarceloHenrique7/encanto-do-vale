# Deploy Hostinger - Encanto do Vale

Este checklist parte do projeto ja pronto localmente, usando Neon como banco
PostgreSQL e Mercado Pago para pagamentos online.

## 1. Antes de subir

No computador, rode:

```bash
npm run check
```

Se passar, gere o build:

```bash
npm run build
```

O frontend fica em `dist/`. O backend roda com:

```bash
npm start
```

## 2. Variaveis de producao

No painel da Hostinger, configure as variaveis abaixo. Use
`.env.production.example` como modelo, mas nunca publique valores reais no Git.

Obrigatorias:

```dotenv
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://seudominio.com.br
BACKEND_URL=https://seudominio.com.br
DATABASE_URL=postgresql://...
MERCADO_PAGO_PUBLIC_KEY=APP_USR-...
MERCADO_PAGO_ACCESS_TOKEN=APP_USR-...
MERCADO_PAGO_WEBHOOK_SECRET=...
VITE_META_PIXEL_ID=123456789012345
ADMIN_PASSWORD=...
SESSION_SECRET=...
PIX_PENDING_EXPIRATION_MINUTES=60
```

Use a string nova do Neon. Como a string do banco ja foi compartilhada em chat,
troque/rotacione essa senha antes do deploy real.

## 3. Banco Neon

Depois que `DATABASE_URL` estiver configurada, rode uma vez no ambiente de
producao:

```bash
npm run db:migrate
```

Isso cria as tabelas `customers` e `orders`, se ainda nao existirem.

O projeto também cria `catalog_state` e `store_settings`. Produtos, categorias,
clientes, pedidos, horários, pedido mínimo, bairros e taxas ficam persistidos no
Neon e não são substituídos por um novo deploy.

Depois de publicar, abra `https://seudominio.com.br/api/health` e confirme:

```json
{"storage":"neon-postgres","persistent":true}
```

Se aparecer `local-files`, confira se `NODE_ENV=production` e `DATABASE_URL`
estão definidas no mesmo serviço Node que executa `npm start`. Não use uma URL
de branch temporária do Neon em produção.

## 4. Mercado Pago

No painel Mercado Pago Developers:

1. Use credenciais de producao da mesma aplicacao.
2. Copie `Public Key` para `MERCADO_PAGO_PUBLIC_KEY`.
3. Copie `Access Token` para `MERCADO_PAGO_ACCESS_TOKEN`.
4. Cadastre o webhook:

```text
https://seudominio.com.br/api/webhooks/mercadopago
```

5. Ative notificacoes de pagamento.
6. Gere/defina o segredo do webhook e coloque em
   `MERCADO_PAGO_WEBHOOK_SECRET`.

## 5. Hostinger

No plano com suporte a Node.js:

1. Suba o projeto.
2. Instale dependencias com `npm install --omit=dev` se a Hostinger pedir modo
   de producao, ou `npm install` se for mais simples no painel.
3. Configure o comando de inicializacao:

```bash
npm start
```

4. Garanta que o dominio usa HTTPS.
5. Garanta que chamadas para `/api/*` chegam no backend Node.
6. Garanta que as outras rotas entregam o frontend, incluindo:
   - `/`
   - `/gestor`
   - `/pedido/ID_DO_PEDIDO`
   - `/privacidade`

## 6. Teste final em producao

Depois de publicar:

1. Acesse `/api/health`; deve responder `{ "ok": true }`.
2. Abra o cardapio sem login.
3. Adicione produto ao carrinho.
4. Finalize com nome, WhatsApp e endereco.
5. Gere pagamento Pix real de baixo valor.
6. Confirme se o pedido aparece no `/gestor`.
7. Confirme se o webhook muda o pedido para pagamento aprovado.
8. Avance os status no gestor:
   - Pagamento aprovado
   - Pedido esta sendo preparado
   - Pedido saiu para entrega
   - Pedido finalizado
9. Teste o link de WhatsApp e a pagina `/privacidade`.

## 7. Se algo falhar

- Pagamento nao aprova: conferir `MERCADO_PAGO_ACCESS_TOKEN`.
- Webhook nao chega: conferir `BACKEND_URL`, HTTPS e URL cadastrada no Mercado
  Pago.
- Erro de CORS: conferir `FRONTEND_URL` exatamente igual ao dominio aberto no
  navegador.
- Gestor nao entra: conferir `ADMIN_PASSWORD` e `SESSION_SECRET`.
- Pedido nao salva: conferir `DATABASE_URL` e rodar `npm run db:migrate`.
