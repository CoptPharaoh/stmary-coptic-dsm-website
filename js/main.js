const siteNavigation = [
  { label: "Home", href: "index.html" },
  {
    label: "About",
    href: "about.html",
    children: [
      { label: "About Overview", href: "about.html" },
      { label: "Welcome", href: "about-welcome.html" },
      { label: "Clergy", href: "clergy.html" },
      { label: "Our Pope", href: "our-pope.html" },
      { label: "Our Patron Saint", href: "our-patron-saint.html" },
      { label: "Church History", href: "church-history.html" },
      { label: "Contact", href: "contact.html" },
    ],
  },
  {
    label: "Our Faith",
    href: "our-faith.html",
    children: [
      { label: "Our Faith Overview", href: "our-faith.html" },
      { label: "What We Believe", href: "what-we-believe.html" },
      { label: "Holy Scripture", href: "holy-scripture.html" },
      { label: "Church Fathers", href: "church-fathers.html" },
      { label: "Ecumenical Councils", href: "ecumenical-councils.html" },
      { label: "Oriental Orthodox Family", href: "oriental-orthodox-family.html" },
      { label: "Theology", href: "theology.html" },
    ],
  },
  {
    label: "Mysteries",
    href: "mysteries.html",
    children: [
      { label: "Mysteries Overview", href: "mysteries.html" },
      { label: "Baptism", href: "baptism.html" },
      { label: "Chrismation", href: "chrismation.html" },
      { label: "Eucharist", href: "eucharist.html" },
      { label: "Repentance & Confession", href: "repentance-confession.html" },
      { label: "Marriage", href: "marriage.html" },
      { label: "Priesthood", href: "priesthood.html" },
      { label: "Unction of the Sick", href: "unction-sick.html" },
    ],
  },
  {
    label: "Worship",
    href: "worship.html",
    children: [
      { label: "Worship Overview", href: "worship.html" },
      { label: "Divine Liturgy", href: "divine-liturgy.html" },
      { label: "Liturgical Calendar", href: "liturgical-calendar.html" },
      { label: "Hymns & Audio", href: "hymns-audio.html" },
      { label: "Coptic Language", href: "coptic-language.html" },
      { label: "Deacons", href: "deacons.html" },
    ],
  },
  {
    label: "Resources",
    href: "resources.html",
    children: [
      { label: "Resources Overview", href: "resources.html" },
      { label: "Bible Studies", href: "bible-studies.html" },
      { label: "Sermons", href: "sermons.html" },
      { label: "Livestream", href: "livestream.html" },
      { label: "New Visitor Guide", href: "new-visitor-guide.html" },
      { label: "FAQ", href: "faq.html" },
    ],
  },
  {
    label: "Ministries",
    href: "ministries.html",
    children: [
      { label: "Ministries Overview", href: "ministries.html" },
      { label: "Sunday School", href: "sunday-school.html" },
      { label: "Youth", href: "youth.html" },
      { label: "Young Adults", href: "young-adults.html" },
      { label: "Family Ministry", href: "family-ministry.html" },
      { label: "Service Opportunities", href: "service-opportunities.html" },
    ],
  },
  { label: "Events", href: "events.html" },
  { label: "Book Appointment", href: "book-appointment.html", cta: true },
  { label: "Give", href: "give.html", cta: true },
];

function getCurrentPage() {
  const page = window.location.pathname.split("/").pop();
  return page || "index.html";
}

function isActiveItem(item, currentPage) {
  return item.href === currentPage || Boolean(item.children?.some((child) => child.href === currentPage));
}

function renderHeader() {
  const headerMount = document.querySelector("[data-site-header]");
  if (!headerMount) return;

  const currentPage = getCurrentPage();
  const navMarkup = siteNavigation.map((item, index) => {
    const isActive = isActiveItem(item, currentPage) ? " active" : "";
    const ariaCurrent = item.href === currentPage ? ' aria-current="page"' : "";

    if (!item.children) {
      return `
        <li class="nav-item">
          <a href="${item.href}" class="nav-link${item.cta ? " nav-button" : ""}${isActive}"${ariaCurrent}>${item.label}</a>
        </li>
      `;
    }

    const submenuId = `submenu-${index}`;
    const childMarkup = item.children.map((child) => (
      `<li><a href="${child.href}" class="${child.href === currentPage ? "active" : ""}"${child.href === currentPage ? ' aria-current="page"' : ""}>${child.label}</a></li>`
    )).join("");

    return `
      <li class="nav-item has-dropdown${isActive}" data-menu-index="${index}">
        <a href="${item.href}" class="nav-link nav-parent${isActive}" aria-haspopup="true" aria-expanded="false"${ariaCurrent}>${item.label}</a>
        <button class="mobile-submenu-toggle" type="button" aria-expanded="false" aria-controls="${submenuId}">${item.label}</button>
        <ul class="dropdown-menu" id="${submenuId}" aria-label="${item.label} submenu">
          ${childMarkup}
        </ul>
      </li>
    `;
  }).join("");

  headerMount.innerHTML = `
    <header class="site-header" id="top">
      <nav class="navbar" aria-label="Primary navigation">
        <a href="index.html" class="brand" aria-label="St. Mary Coptic Orthodox Church home">
          <img src="assets/images/logo-main.png" alt="St. Mary Coptic Orthodox Church logo" />
          <span class="brand-copy">
            <strong>St. Mary</strong>
            <span>Coptic Orthodox Church</span>
            <em>Des Moines, Iowa</em>
          </span>
        </a>

        <button class="menu-toggle" id="menuToggle" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="navLinks">
          <span></span>
          <span></span>
          <span></span>
        </button>

        <ul class="nav-links" id="navLinks">
          ${navMarkup}
        </ul>
      </nav>
    </header>
  `;
}

function renderFooter() {
  const footerMount = document.querySelector("[data-site-footer]");
  if (!footerMount) return;

  footerMount.innerHTML = `
    <footer class="footer">
      <div class="footer-inner">
        <div class="footer-brand">
          <h2>ST. MARY</h2>
          <p class="footer-subtitle">
            <span>COPTIC ORTHODOX</span>
            <span>CHURCH</span>
            <span>DES MOINES, IOWA</span>
          </p>
          <p class="footer-welcome">
            A place to belong.<br />
            We’re so glad you found us — you’re always welcome.
          </p>
        </div>

        <div class="footer-links">
          <div>
            <h3>Quick Links</h3>
            <a href="index.html">Home</a>
            <a href="about.html">About</a>
            <a href="about-welcome.html">I'm New Here</a>
            <a href="worship.html">Worship</a>
            <a href="events.html">Events</a>
          </div>

          <div>
            <h3>Our Services</h3>
            <a href="divine-liturgy.html">Divine Liturgy</a>
            <a href="sunday-school.html">Sunday School</a>
            <a href="bible-studies.html">Bible Study</a>
            <a href="youth.html">Youth Meeting</a>
            <a href="book-appointment.html">Book Appointment</a>
          </div>

          <div>
            <h3>Stay Connected</h3>
            <a href="#">Facebook</a>
            <a href="#">YouTube</a>
            <a href="#">Instagram</a>
            <a href="livestream.html">Live Stream</a>
          </div>

          <div>
            <h3>Contact Info</h3>
            <p>954 Cummins Pkwy.<br />Des Moines, IA 50312</p>
            <p>(515) 981-1621</p>
            <p>saintmarydsm@gmail.com</p>
          </div>
        </div>

        <div class="footer-seal">
          <img src="assets/images/logo-main.png" alt="St. Mary Coptic Orthodox Church logo" />
          <p>Glory be to God forever.</p>
        </div>
      </div>

      <div class="footer-bottom">
        <span>© 2026 St. Mary Coptic Orthodox Church.</span>
        <span class="footer-cross" aria-hidden="true">+</span>
      </div>
    </footer>
  `;
}

function initMobileMenu() {
  const menuToggle = document.getElementById("menuToggle");
  const navLinks = document.getElementById("navLinks");

  if (!menuToggle || !navLinks) return;

  function closeMenu() {
    document.body.classList.remove("menu-open");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Open menu");
    document.querySelectorAll(".has-dropdown.is-open").forEach((item) => {
      item.classList.remove("is-open");
      item.querySelector(".mobile-submenu-toggle")?.setAttribute("aria-expanded", "false");
    });
  }

  function toggleMenu() {
    const isOpen = document.body.classList.toggle("menu-open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
    menuToggle.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
  }

  menuToggle.addEventListener("click", toggleMenu);

  document.querySelectorAll(".mobile-submenu-toggle").forEach((button) => {
    button.addEventListener("click", () => {
      const item = button.closest(".has-dropdown");
      const isOpen = item.classList.toggle("is-open");
      button.setAttribute("aria-expanded", String(isOpen));
    });
  });

  navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 1180) closeMenu();
  });
}

function initDropdownAccessibility() {
  const desktopQuery = window.matchMedia("(min-width: 1181px)");

  document.querySelectorAll(".has-dropdown").forEach((item) => {
    const parentLink = item.querySelector(".nav-parent");
    if (!parentLink) return;

    function setOpen(isOpen) {
      if (desktopQuery.matches) {
        parentLink.setAttribute("aria-expanded", String(isOpen));
      }
    }

    item.addEventListener("mouseenter", () => setOpen(true));
    item.addEventListener("mouseleave", () => setOpen(false));
    item.addEventListener("focusin", () => setOpen(true));
    item.addEventListener("focusout", (event) => {
      if (!item.contains(event.relatedTarget)) setOpen(false);
    });
  });
}

function initPopeCarousel() {
  document.querySelectorAll("[data-carousel]").forEach((carousel) => {
    const track = carousel.querySelector("[data-carousel-track]");
    const slides = Array.from(carousel.querySelectorAll("[data-carousel-slide]"));
    const dots = Array.from(carousel.querySelectorAll("[data-carousel-dot]"));
    const prevButton = carousel.querySelector("[data-carousel-prev]");
    const nextButton = carousel.querySelector("[data-carousel-next]");

    if (!track || slides.length <= 1) return;

    const autoplayDelay = Number(carousel.dataset.autoplay) || 4000;
    const resumeDelay = 6500;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let currentIndex = 0;
    let autoplayTimer = null;
    let resumeTimer = null;
    let isHovering = false;
    let touchStartX = 0;
    let touchStartY = 0;

    function stopAutoplay() {
      window.clearInterval(autoplayTimer);
      autoplayTimer = null;
    }

    function startAutoplay() {
      stopAutoplay();
      if (reducedMotion.matches || isHovering) return;
      autoplayTimer = window.setInterval(() => {
        goToSlide(currentIndex + 1);
      }, autoplayDelay);
    }

    function pauseThenResume() {
      stopAutoplay();
      window.clearTimeout(resumeTimer);
      if (!reducedMotion.matches && !isHovering) {
        resumeTimer = window.setTimeout(startAutoplay, resumeDelay);
      }
    }

    function goToSlide(index) {
      currentIndex = (index + slides.length) % slides.length;
      track.style.transform = `translateX(-${currentIndex * 100}%)`;

      slides.forEach((slide, slideIndex) => {
        slide.classList.toggle("is-active", slideIndex === currentIndex);
        slide.setAttribute("aria-hidden", String(slideIndex !== currentIndex));
      });

      dots.forEach((dot, dotIndex) => {
        const isActive = dotIndex === currentIndex;
        dot.classList.toggle("is-active", isActive);
        dot.setAttribute("aria-current", isActive ? "true" : "false");
      });
    }

    prevButton?.addEventListener("click", () => {
      goToSlide(currentIndex - 1);
      pauseThenResume();
    });

    nextButton?.addEventListener("click", () => {
      goToSlide(currentIndex + 1);
      pauseThenResume();
    });

    dots.forEach((dot, dotIndex) => {
      dot.addEventListener("click", () => {
        goToSlide(dotIndex);
        pauseThenResume();
      });
    });

    carousel.addEventListener("mouseenter", () => {
      isHovering = true;
      stopAutoplay();
    });

    carousel.addEventListener("mouseleave", () => {
      isHovering = false;
      startAutoplay();
    });

    carousel.addEventListener("touchstart", (event) => {
      const touch = event.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
    }, { passive: true });

    carousel.addEventListener("touchend", (event) => {
      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;

      if (Math.abs(deltaX) > 44 && Math.abs(deltaX) > Math.abs(deltaY)) {
        goToSlide(currentIndex + (deltaX < 0 ? 1 : -1));
        pauseThenResume();
      }
    }, { passive: true });

    reducedMotion.addEventListener?.("change", startAutoplay);
    goToSlide(0);
    startAutoplay();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  renderHeader();
  renderFooter();
  initMobileMenu();
  initDropdownAccessibility();
  initPopeCarousel();
});
