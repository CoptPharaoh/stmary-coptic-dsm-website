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
      { label: "Our Patron Saint", href: "st-mary-theotokos.html" },
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
      { label: "Confession", href: "confession.html" },
      { label: "Repentance", href: "repentance.html" },
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
      { label: "Books", href: "books.html" },
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
  { label: "Live Stream", href: "livestream.html", cta: true, variant: "live" },
  { label: "Give", href: "give.html", cta: true },
  { label: "Login", href: "#", cta: true, variant: "secondary" },
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
    const ctaClass = item.cta ? ` nav-button${item.variant ? ` nav-button-${item.variant}` : ""}` : "";

    if (!item.children) {
      return `
        <li class="nav-item">
          <a href="${item.href}" class="nav-link${ctaClass}${isActive}"${ariaCurrent}>${item.label}</a>
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
            <a href="#"><span class="footer-social-icon" aria-hidden="true">f</span>Facebook</a>
            <a href="#"><span class="footer-social-icon" aria-hidden="true">YT</span>YouTube</a>
            <a href="#"><span class="footer-social-icon" aria-hidden="true">IG</span>Instagram</a>
            <a href="livestream.html"><span class="footer-social-icon footer-social-live" aria-hidden="true">ON</span>Live Stream</a>
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
    if (window.innerWidth > 1240) closeMenu();
  });
}

function initDropdownAccessibility() {
  const desktopQuery = window.matchMedia("(min-width: 1241px)");

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

function initSectionViewer() {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  document.querySelectorAll("[data-section-viewer]").forEach((viewer) => {
    const nav = viewer.querySelector(".page-section-nav nav");
    const content = viewer.querySelector(".long-page-content");
    if (!nav || !content) return;

    const links = Array.from(nav.querySelectorAll('a[href^="#"]'));
    const panels = Array.from(content.children).filter((panel) => (
      panel.matches(".content-section[id]")
    ));

    if (!links.length || !panels.length) return;

    const panelMap = new Map(panels.map((panel) => [panel.id, panel]));
    let sectionToggle = null;
    let sectionMenu = null;
    let sectionOptions = [];

    function getLinkTarget(link) {
      return decodeURIComponent((link.getAttribute("href") || "").replace(/^#/, ""));
    }

    function updateHash(sectionId) {
      const nextHash = `#${sectionId}`;
      if (window.location.hash === nextHash) return;
      window.history.pushState(null, "", nextHash);
    }

    function setMobileMenuOpen(isOpen) {
      if (!sectionToggle || !sectionMenu) return;

      sectionToggle.setAttribute("aria-expanded", String(isOpen));
      sectionMenu.hidden = !isOpen;
    }

    function updateMobileSectionControl(targetId) {
      if (!sectionToggle) return;

      const activeLink = links.find((link) => getLinkTarget(link) === targetId);
      if (activeLink) sectionToggle.textContent = activeLink.textContent.trim();

      sectionOptions.forEach((option) => {
        const isActive = option.dataset.sectionTarget === targetId;
        option.classList.toggle("is-active", isActive);
        option.setAttribute("aria-selected", String(isActive));
      });
    }

    function scrollContentIntoView() {
      const navShell = viewer.querySelector(".page-section-nav");
      const navHeight = navShell ? navShell.getBoundingClientRect().height : 0;
      const navTop = navShell ? parseFloat(window.getComputedStyle(navShell).top) || 0 : 0;
      const gap = 14;
      const targetTop = window.scrollY + content.getBoundingClientRect().top - navHeight - navTop - gap;

      window.scrollTo({
        top: Math.max(0, targetTop),
        behavior: reducedMotion.matches ? "auto" : "smooth",
      });
    }

    function showSection(sectionId, options = {}) {
      const targetPanel = panelMap.get(sectionId) || panels[0];
      const targetId = targetPanel.id;

      panels.forEach((panel) => {
        const isActive = panel === targetPanel;
        panel.hidden = !isActive;
        panel.classList.toggle("is-active", isActive);
        panel.setAttribute("aria-hidden", String(!isActive));
      });

      links.forEach((link) => {
        const isActive = getLinkTarget(link) === targetId;
        link.classList.toggle("is-active", isActive);
        link.setAttribute("aria-selected", String(isActive));
        link.setAttribute("tabindex", isActive ? "0" : "-1");
      });

      updateMobileSectionControl(targetId);

      if (options.updateHash) updateHash(targetId);

      if (options.scrollToContent) {
        scrollContentIntoView();
      }
    }

    function focusRelativeTab(currentLink, direction) {
      const currentIndex = links.indexOf(currentLink);
      if (currentIndex < 0) return;

      const nextIndex = (currentIndex + direction + links.length) % links.length;
      const nextLink = links[nextIndex];
      nextLink.focus();
      showSection(getLinkTarget(nextLink), { updateHash: true });
    }

    viewer.classList.add("section-viewer-ready");
    nav.setAttribute("role", "tablist");

    if (!viewer.querySelector(".page-section-select")) {
      const selectWrap = document.createElement("div");
      selectWrap.className = "page-section-select-wrap";

      const menuId = `${panels[0].id}-section-menu`;

      sectionToggle = document.createElement("button");
      sectionToggle.type = "button";
      sectionToggle.className = "page-section-select";
      sectionToggle.setAttribute("aria-controls", menuId);
      sectionToggle.setAttribute("aria-expanded", "false");
      sectionToggle.setAttribute("aria-haspopup", "listbox");

      sectionMenu = document.createElement("div");
      sectionMenu.className = "page-section-select-menu";
      sectionMenu.id = menuId;
      sectionMenu.hidden = true;
      sectionMenu.setAttribute("role", "listbox");
      sectionMenu.setAttribute("aria-label", "Choose page section");

      links.forEach((link) => {
        const targetId = getLinkTarget(link);
        if (!panelMap.has(targetId)) return;

        const option = document.createElement("button");
        option.type = "button";
        option.className = "page-section-select-option";
        option.dataset.sectionTarget = targetId;
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", "false");
        option.textContent = link.textContent.trim();

        option.addEventListener("click", () => {
          setMobileMenuOpen(false);
          showSection(targetId, {
            updateHash: true,
            scrollToContent: true,
          });
          sectionToggle.focus({ preventScroll: true });
        });

        option.addEventListener("keydown", (event) => {
          const currentIndex = sectionOptions.indexOf(option);

          if (event.key === "ArrowDown") {
            event.preventDefault();
            sectionOptions[(currentIndex + 1) % sectionOptions.length]?.focus();
          }

          if (event.key === "ArrowUp") {
            event.preventDefault();
            sectionOptions[(currentIndex - 1 + sectionOptions.length) % sectionOptions.length]?.focus();
          }

          if (event.key === "Escape") {
            event.preventDefault();
            setMobileMenuOpen(false);
            sectionToggle.focus({ preventScroll: true });
          }
        });

        sectionMenu.appendChild(option);
        sectionOptions.push(option);
      });

      sectionToggle.addEventListener("click", () => {
        setMobileMenuOpen(sectionMenu.hidden);
      });

      sectionToggle.addEventListener("keydown", (event) => {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setMobileMenuOpen(true);
          const activeOption = sectionOptions.find((option) => option.classList.contains("is-active"));
          (activeOption || sectionOptions[0])?.focus();
        }

        if (event.key === "Escape") {
          event.preventDefault();
          setMobileMenuOpen(false);
        }
      });

      document.addEventListener("click", (event) => {
        if (!selectWrap.contains(event.target)) setMobileMenuOpen(false);
      });

      selectWrap.appendChild(sectionToggle);
      selectWrap.appendChild(sectionMenu);
      nav.insertAdjacentElement("afterend", selectWrap);
    } else {
      sectionToggle = viewer.querySelector(".page-section-select");
      sectionMenu = viewer.querySelector(".page-section-select-menu");
      sectionOptions = Array.from(viewer.querySelectorAll(".page-section-select-option"));
    }

    panels.forEach((panel) => {
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("tabindex", "-1");
    });

    links.forEach((link) => {
      const targetId = getLinkTarget(link);
      const panel = panelMap.get(targetId);
      if (!panel) return;

      link.setAttribute("role", "tab");
      link.setAttribute("aria-controls", targetId);
      if (!link.id) link.id = `${targetId}-tab`;
      panel.setAttribute("aria-labelledby", link.id);

      link.addEventListener("click", (event) => {
        event.preventDefault();
        showSection(targetId, {
          updateHash: true,
          scrollToContent: window.innerWidth <= 1080,
        });
      });

      link.addEventListener("keydown", (event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowRight") {
          event.preventDefault();
          focusRelativeTab(link, 1);
        }

        if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
          event.preventDefault();
          focusRelativeTab(link, -1);
        }

        if (event.key === "Home") {
          event.preventDefault();
          links[0].focus();
          showSection(getLinkTarget(links[0]), { updateHash: true });
        }

        if (event.key === "End") {
          event.preventDefault();
          const lastLink = links[links.length - 1];
          lastLink.focus();
          showSection(getLinkTarget(lastLink), { updateHash: true });
        }
      });
    });

    function showHashSection() {
      const hashId = decodeURIComponent(window.location.hash.replace(/^#/, ""));
      showSection(panelMap.has(hashId) ? hashId : panels[0].id);
    }

    window.addEventListener("popstate", showHashSection);
    window.addEventListener("hashchange", showHashSection);
    showHashSection();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  renderHeader();
  renderFooter();
  initMobileMenu();
  initDropdownAccessibility();
  initPopeCarousel();
  initSectionViewer();
});
