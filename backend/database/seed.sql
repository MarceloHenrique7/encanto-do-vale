DELETE FROM product_categories;
DELETE FROM products;
DELETE FROM categories;

INSERT INTO categories (id, name, short_label, display_order) VALUES
  ('destaques', 'Destaques da semana', '6 selecoes especiais', 1),
  ('tortas', 'Tortas', 'camadas e recheios', 2),
  ('copos', 'Copos da Felicidade', 'praticos e cremosos', 3),
  ('bolos', 'Bolos', 'fatias e celebracoes', 4),
  ('tacas', 'Tacas Doces', 'sobremesa para impressionar', 5);

INSERT INTO products (id, name, description, price_cents, image_src, is_featured, is_promo, primary_category_label) VALUES
  ('taca-ninho-chocolate', 'Taca de Ninho com Chocolate', 'Camadas cremosas de leite em po, brigadeiro intenso e finalizacao elegante para servir gelada.', 1890, '', 1, 0, 'Tacas Doces'),
  ('copo-felicidade-nutella', 'Copo da Felicidade com Nutella', 'Montagem generosa com creme aveludado, bolo fofinho e Nutella em cada colherada.', 1690, '', 1, 1, 'Copos da Felicidade'),
  ('torta-morango-ninho', 'Torta de Morango com Ninho', 'Base delicada, recheio cremoso e morangos frescos para uma sobremesa leve e marcante.', 8990, '', 1, 0, 'Tortas'),
  ('bolo-chocolate-glace', 'Bolo de chocolate com glace', 'Massa intensa de chocolate, cobertura brilhante e acabamento pensado para mesa de festa.', 7490, '', 1, 0, 'Bolos'),
  ('bolo-oreo-ninho', 'Bolo de Oreo com Ninho', 'Recheio cremoso, crocancia de biscoito e visual sofisticado para encomendas especiais.', 8290, '', 1, 1, 'Bolos'),
  ('brigadeiros-caixas', 'Brigadeiros em caixas', 'Selecao artesanal em caixa presenteavel, ideal para mimo, festas e lembrancas doces.', 3690, '', 1, 0, 'Destaques');

INSERT INTO product_categories (product_id, category_id) VALUES
  ('taca-ninho-chocolate', 'tacas'),
  ('copo-felicidade-nutella', 'copos'),
  ('torta-morango-ninho', 'tortas'),
  ('bolo-chocolate-glace', 'bolos'),
  ('bolo-oreo-ninho', 'bolos'),
  ('brigadeiros-caixas', 'tacas'),
  ('brigadeiros-caixas', 'copos'),
  ('brigadeiros-caixas', 'tortas'),
  ('brigadeiros-caixas', 'bolos');
