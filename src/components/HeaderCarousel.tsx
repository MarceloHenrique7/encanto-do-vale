import { useEffect, useState } from 'react'

const carouselItems = [
  {
    id: 'slide-1',
    title: 'Bolos de Casamento',
    subtitle: 'Tornando um momento inesquecÃ­vel',
    imageSrc: 'https://i.ibb.co/Tqw5Vr70/Chat-GPT-Image-5-de-abr-de-2026-18-16-30.png',
  },
  {
    id: 'slide-2',
    title: 'Bolos de AniversÃ¡rio',
    subtitle: 'As crianÃ§as vÃ£o adorar',
    imageSrc: 'https://i.ibb.co/spQNBhMD/Bolo-de-anivers-rio-com-topo-fofo.png',
  },
  {
    id: 'slide-3',
    title: 'Bolo de Nutella VulcÃ£o',
    subtitle: 'Aqui a Felicidade NÃ£o tem preÃ§o',
    imageSrc: 'https://i.ibb.co/1JYpJnTF/Bolo-de-lava-com-Nutella.png',
  },
  {
    id: 'slide-4',
    title: 'Copo Da Felicidade',
    subtitle: 'Delicioso copo com recheio de explodir o sabor',
    imageSrc: 'https://i.ibb.co/bRq8BKmf/Chat-GPT-Image-5-de-abr-de-2026-18-32-49.png',
  },
  {
    id: 'slide-5',
    title: 'Brownie de Nutella',
    subtitle: 'Delicioso brownie com recheio de Nutella',
    imageSrc: 'https://i.ibb.co/svK6m4TM/Brownie-com-Nutella-e-morangos.png',
  },
]

export default function HeaderCarousel() {
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % carouselItems.length)
    }, 4800)

    return () => window.clearInterval(intervalId)
  }, [])

  const activeItem = carouselItems[activeIndex]

  return (
    <section
      className="header-carousel"
      aria-label="Galeria de destaques da Encanto do Vale"
    >
      <div className="header-carousel-copy">
        <span className="header-carousel-kicker">Mais Pedidos</span>
        <h2>{activeItem.title}</h2>
        <p>{activeItem.subtitle}</p>

        <div className="header-carousel-controls">
          <button
            type="button"
            className="header-carousel-arrow"
            aria-label="Ver destaque anterior"
            onClick={() =>
              setActiveIndex((current) =>
                current === 0 ? carouselItems.length - 1 : current - 1,
              )
            }
          >
            â€¹
          </button>
          <button
            type="button"
            className="header-carousel-arrow"
            aria-label="Ver proximo destaque"
            onClick={() =>
              setActiveIndex((current) => (current + 1) % carouselItems.length)
            }
          >
            â€º
          </button>
        </div>
      </div>

      <div className="header-carousel-stage">
        <div className="header-carousel-track" aria-live="polite">
          {carouselItems.map((item, index) => {
            const offset =
              (index - activeIndex + carouselItems.length) % carouselItems.length
            const isActive = index === activeIndex
            const isNext = offset === 1
            const isPrev = offset === carouselItems.length - 1

            return (
              <button
                key={item.id}
                type="button"
                className={[
                  'header-carousel-card',
                  isActive ? 'is-active' : '',
                  isNext ? 'is-next' : '',
                  isPrev ? 'is-prev' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => setActiveIndex(index)}
                aria-label={`Abrir destaque ${index + 1}`}
                aria-pressed={isActive}
              >
                {item.imageSrc ? (
                  <img
                    src={item.imageSrc}
                    alt={item.title}
                    className="header-carousel-image"
                  />
                ) : (
                  <div className="header-carousel-placeholder">
                    <span>Preencha a URL da imagem</span>
                  </div>
                )}

                <div className="header-carousel-overlay">
                  <strong>{item.title}</strong>
                  <span>{item.subtitle}</span>
                </div>
              </button>
            )
          })}
        </div>

        <div
          className="header-carousel-dots"
          role="tablist"
          aria-label="Selecionar destaque"
        >
          {carouselItems.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={`header-carousel-dot${index === activeIndex ? ' is-active' : ''}`}
              onClick={() => setActiveIndex(index)}
              aria-label={`Ir para destaque ${index + 1}`}
              aria-pressed={index === activeIndex}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
