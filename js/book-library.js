(() => {
  const page = document.querySelector(".books-library");
  if (!page) return;
  const form = page.querySelector(".catalog-filters");
  const directory = page.querySelector("[data-library-authors]");
  const grid = page.querySelector("[data-library-books]");
  const heading = page.querySelector("#collection-title");
  const count = page.querySelector("[data-book-count]");
  const message = page.querySelector("[data-book-message]");
  const catalog = window.orthodoxBookCatalog;
  if (!catalog) {
    message.textContent = "The book collection is temporarily unavailable.";
    message.hidden = false;
    return;
  }
  const { authors, books } = catalog;
  const { author, language, q } = form.elements;
  const labels = { english: "English", arabic: "Arabic" };
  const names = Object.entries(authors).sort(([, a], [, b]) => a.name.localeCompare(b.name));
  const normalize = (s) => s.normalize("NFKD").toLowerCase().replace(/[\p{M}\u0640]/gu, "")
    .replace(/[أإآ]/g, "ا").replace(/[هة]/g, "ه").replace(/ى/g, "ي")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const index = books.map((book) => [book, normalize([
    book.title, book.alternateTitle, book.authorName, authors[book.authorId].arabicName,
    ...(authors[book.authorId].aliases || []), labels[book.language],
    book.language === "arabic" ? "العربية" : "الإنجليزية", book.subject,
  ].join(" "))]);

  function el(tag, text, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function collectionUrl(id, lang) {
    const url = new URL("books.html", location.href);
    if (id) url.searchParams.set("author", id);
    if (lang) url.searchParams.set("language", lang);
    if (id || lang) url.hash = "collection";
    return url;
  }

  for (const [id, info] of names) {
    author.add(new Option(info.name, id));
    const card = el("article", "", "resource-card catalog-author");
    if (info.portrait) {
      const image = el("img");
      image.src = info.portrait;
      image.alt = info.name;
      image.width = 160;
      image.height = 160;
      image.loading = "lazy";
      card.append(image);
    } else {
      const mark = el("div", "", "library-author-mark");
      mark.setAttribute("aria-hidden", "true");
      mark.append(el("span", "Orthodox Digital Library"), el("strong", info.name));
      card.append(mark);
    }
    const copy = el("div");
    copy.append(el("h3", info.name), el("p", info.bio));
    const actions = el("div", "", "resource-actions catalog-author-actions");
    for (const lang of Object.keys(labels)) {
      const total = books.filter((book) => book.authorId === id && book.language === lang).length;
      const action = el("a", "", "btn btn-outline");
      const name = el("span", lang === "arabic" ? "الكتب العربية" : "English Books");
      if (lang === "arabic") { name.lang = "ar"; name.dir = "rtl"; }
      action.append(name, document.createTextNode(` (${total})`));
      action.href = collectionUrl(id, lang).href;
      action.dataset.author = id;
      action.dataset.language = lang;
      actions.append(action);
    }
    copy.append(actions);
    card.append(copy);
    directory.append(card);
  }
  if (!names.length) directory.append(el("p", "No author collections are available yet."));

  function render() {
    const terms = normalize(q.value).split(" ").filter(Boolean);
    const matches = index.filter(([book, text]) =>
      (!author.value || book.authorId === author.value)
      && (!language.value || book.language === language.value)
      && terms.every((term) => text.includes(term)));
    heading.textContent = author.value ? authors[author.value].name : "Browse the Books";
    count.textContent = matches.length + (matches.length === 1 ? " book" : " books");
    message.hidden = matches.length !== 0;
    message.textContent = "No books match this selection. Try another search or clear the filters.";
    directory.querySelectorAll("[data-author]").forEach((link) => {
      if (link.dataset.author === author.value && link.dataset.language === language.value) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    });
    grid.replaceChildren(...matches.map(([book]) => {
      const arabic = book.language === "arabic";
      const card = el("article", "", "book-card resource-card");
      if (arabic) { card.lang = "ar"; card.dir = "rtl"; }
      const copy = el("div");
      const meta = el("p", arabic ? "العربية · PDF" : "English · PDF", "book-meta");
      const title = el("h3", book.title);
      title.lang = book.titleLanguage;
      title.dir = "auto";
      const info = authors[book.authorId];
      const hasArabicName = arabic && info.arabicName && book.authorName === info.name;
      const writer = el("p", hasArabicName ? info.arabicName : book.authorName, "library-book-author");
      writer.lang = hasArabicName ? "ar" : "en";
      writer.dir = "auto";
      if (book.cover) {
        const cover = el("img");
        cover.src = book.cover;
        cover.alt = "";
        cover.loading = "lazy";
        copy.append(cover);
      }
      copy.append(meta, title, writer);
      if (book.description) { const description = el("p", book.description); description.dir = "auto"; copy.append(description); }
      const actions = el("div", "", "resource-actions book-actions");
      const read = el("a", arabic ? "قراءة PDF" : "Read PDF");
      const download = el("a", arabic ? "تحميل PDF" : "Download PDF");
      read.href = download.href = book.pdf;
      read.target = "_blank";
      read.rel = "noopener";
      read.setAttribute("aria-label", (arabic ? "قراءة " : "Read PDF: ") + book.title);
      download.setAttribute("aria-label", (arabic ? "تحميل " : "Download PDF: ") + book.title);
      download.download = "";
      actions.append(read, download);
      card.append(copy, actions);
      return card;
    }));
  }

  function restore() {
    const params = new URLSearchParams(location.search);
    const legacy = { "#english-books": "english", "#arabic-books": "arabic" };
    author.value = params.get("author") || "";
    language.value = params.get("language") || legacy[location.hash] || "";
    q.value = params.get("q") || "";
    render();
  }

  function updateUrl(method) {
    const url = collectionUrl(author.value, language.value);
    url.hash = "collection";
    if (q.value.trim()) url.searchParams.set("q", q.value.trim());
    if (url.href !== location.href) history[method](null, "", url);
    render();
  }

  form.addEventListener("input", (event) => {
    updateUrl(event.target === q ? "replaceState" : "pushState");
  });
  form.addEventListener("submit", (event) => event.preventDefault());
  form.addEventListener("reset", (event) => {
    event.preventDefault();
    author.value = language.value = q.value = "";
    updateUrl("pushState");
    q.focus();
  });
  directory.addEventListener("click", (event) => {
    const link = event.target.closest("[data-author]");
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    author.value = link.dataset.author;
    language.value = link.dataset.language;
    q.value = "";
    updateUrl("pushState");
    heading.focus({ preventScroll: true });
    page.querySelector("#collection").scrollIntoView();
  });
  window.addEventListener("popstate", restore);
  restore();
  form.hidden = false;
})();
