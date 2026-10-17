// Simple fade-in-on-scroll for the main sections.
document.addEventListener('DOMContentLoaded', () => {
  const targets = document.querySelectorAll('.about, .selected-work, .gallery-section, .site-footer');

  targets.forEach((el) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(24px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1 }
  );

  targets.forEach((el) => observer.observe(el));
});

// Subtle parallax: the hero content scrolls slower than the page, so the dark
// section appears to rise over it.
document.addEventListener('DOMContentLoaded', () => {
  const inner = document.querySelector('.hero-content');
  const hero = document.querySelector('.hero');
  if (!inner || !hero) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const SPEED = 0.35; // 0 = locked to the page, 1 = fully fixed
  let ticking = false;

  const update = () => {
    ticking = false;
    const limit = hero.offsetHeight;
    const y = Math.max(0, Math.min(window.scrollY, limit));
    inner.style.transform = `translate3d(0, ${(y * SPEED).toFixed(1)}px, 0)`;
  };

  const onScroll = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();
});

// Sticky header: aparece una vez que el hero salió de pantalla. Va en su propio
// bloque, fuera del parallax, porque ese se desactiva con prefers-reduced-motion
// y la barra tiene que funcionar igual.
document.addEventListener('DOMContentLoaded', () => {
  const hero = document.querySelector('.hero');
  if (!hero) return;

  const SHOW_AT = 80;   // px de hero que quedan visibles cuando aparece
  let ticking = false;
  let on = null;

  const update = () => {
    ticking = false;
    const next = hero.getBoundingClientRect().bottom < SHOW_AT;
    if (next !== on) {
      on = next;
      document.body.classList.toggle('sticky-on', next);
    }
  };

  const onScroll = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();
});
