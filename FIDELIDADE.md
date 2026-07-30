# Clube de Fidelidade

## Ativação

O recurso nasce ativo com a regra de 1 ponto para cada R$ 1,00 gasto em
produtos. A taxa de entrega não pontua. Em produção, execute:

```bash
npm run db:migrate
```

O comando cria as tabelas de fidelidade e uma recompensa inicial. Não há nova
variável de ambiente obrigatória. Em desenvolvimento sem `DATABASE_URL`, os
dados ficam em `backend/data/loyalty.json`. O caminho pode ser alterado com
`LOYALTY_FILE`.

## Operação

- O crédito ocorre quando o gestor muda o pedido para `completed`.
- O identificador do pedido possui restrição única para impedir crédito duplo.
- Cancelamentos posteriores geram estorno sem apagar o histórico.
- A validade, conversão e pedido mínimo são alterados em
  `/gestor` → **Fidelidade**.
- Recompensas resgatadas geram códigos `DOCE-XXXXXXXX`.
- O cliente informa o código no carrinho. A recompensa é adicionada ao pedido
  como item gratuito e não gera novos pontos.
- Se o pedido que consumiu a recompensa for cancelado, pontos e estoque são
  restaurados.

## Estruturas

- `loyalty_settings`: regra geral.
- `loyalty_accounts`: saldo por cliente.
- `loyalty_transactions`: histórico imutável.
- `loyalty_rewards`: catálogo e estoque.
- `loyalty_redemptions`: códigos, uso e pedido relacionado.

O frontend apenas apresenta dados. Crédito, expiração, saldo, estoque e
resgates são validados no backend.
