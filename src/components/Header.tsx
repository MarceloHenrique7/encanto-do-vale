export default function Header() {
  return (
    <header className="hero mb-10">
      <nav className="topbar">
        <a className="brand" href="#cardapio">
          Encanto do Vale
        </a>

        <div className="nav-links" aria-label="Navegacao principal">
          <a className="nav-link" href="#cardapio">
            Cardapio
          </a>

          <a className="nav-link" href="#encomende">
            Encomende
          </a>
          <a className="nav-link nav-link--highlight" href="#peca-agora">
            Peca agora
          </a>
          <a className="nav-link" href="#contatos">
            Contatos
          </a>
        </div>
      </nav>

      <div className="header-note">
        <span className="header-note-pill header-note-pill--order">Encomenda</span>
        <span className="header-note-text">
          produzido com prazo combinado para sua data especial
        </span>
        <span className="header-note-divider">|</span>
        <span className="header-note-pill header-note-pill--ready">Entrega pronta</span>
        <span className="header-note-text">
          opcao para preparo agil e envio no momento do pedido
        </span>
      </div>
    </header>
  )
}
