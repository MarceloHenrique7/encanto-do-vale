const photoSlots = [
  {
    id: 'mae-1',
    imageSrc: 'https://i.ibb.co/qY1hKJTg/crie-um-combo-202604191706-1.jpg',
    alt: 'Combo especial de Dia das Maes',
  },
  {
    id: 'mae-2',
    imageSrc: 'https://i.ibb.co/jkBnvKCp/tradu-o-texto-202604191651.jpg',
    alt: 'Foto especial de Dia das Maes 2',
  },
  {
    id: 'mae-3',
    imageSrc: 'https://i.ibb.co/8L04fDY8/Gemini-Generated-Image-zg1wv2zg1wv2zg1w.png',
    alt: 'Foto especial de Dia das Maes 3',
  },
  {
    id: 'mae-4',
    imageSrc: 'https://i.ibb.co/ZRv9d29Y/Gemini-Generated-Image-t1u2z0t1u2z0t1u2.png',
    alt: 'Foto especial de Dia das Maes 4',
  },
]

export default function HeaderCarousel() {
  return (
    <section
      className="mothers-day-slide"
      aria-labelledby="mothers-day-slide-title"
    >
      <div className="mothers-day-copy">
        <span className="mothers-day-kicker">Especial Dia das Maes</span>
        <h1 id="mothers-day-slide-title">Doces para celebrar quem faz tudo florescer</h1>
        <p>
          Uma vitrine especial para encomendas de Dia das Maes, com espacos
          reservados para as fotos dos produtos que entram em destaque.
        </p>
        <a className="mothers-day-button" href="#cardapio">
          Ver cardapio
        </a>
      </div>

      <div className="mothers-day-photos" aria-label="Fotos em breve">
        {photoSlots.map((slot, index) => (
          <div
            key={slot.id}
            className={`mothers-day-photo mothers-day-photo--${index + 1}`}
          >
            {slot.imageSrc ? (
              <img
                src={slot.imageSrc}
                alt={slot.alt}
                className="mothers-day-photo-image"
              />
            ) : null}
          </div>
        ))}
      </div>
    </section>
  )
}
