(() => {
  const library = document.querySelector("#hymn-library");
  if (!library) return;

  const form = library.querySelector("[data-hymn-filters]");
  const { query, season, service, language } = form.elements;
  const status = library.querySelector("[data-hymn-count]");
  const empty = library.querySelector("[data-hymn-empty]");
  const normalize = (value) => value.toLowerCase().normalize("NFD")
    .replace(/\p{M}/gu, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

  const hymns = Array.from(library.querySelectorAll("[data-hymn]"), (card) => ({
    card,
    search: normalize(card.textContent + " " + card.dataset.aliases),
    seasons: card.dataset.season.split("|"),
    services: card.dataset.service.split("|"),
    recordings: Array.from(card.querySelectorAll("[data-recording]")),
  }));

  function addOptions(select, values) {
    [...new Set(values)].sort((a, b) => a.localeCompare(b)).forEach((value) => {
      select.add(new Option(value, value));
    });
  }

  addOptions(season, hymns.flatMap((hymn) => hymn.seasons));
  addOptions(service, hymns.flatMap((hymn) => hymn.services));
  addOptions(language, hymns.flatMap((hymn) => hymn.recordings.map((item) => item.dataset.recording)));

  function update() {
    const terms = normalize(query.value).split(" ").filter(Boolean);
    let count = 0;
    hymns.forEach((hymn) => {
      const matchesLanguage = !language.value || hymn.recordings.some((item) => item.dataset.recording === language.value);
      const visible = matchesLanguage
        && (!season.value || hymn.seasons.includes(season.value))
        && (!service.value || hymn.services.includes(service.value))
        && terms.every((term) => hymn.search.includes(term));
      hymn.card.hidden = !visible;
      hymn.recordings.forEach((item) => {
        item.hidden = Boolean(language.value && item.dataset.recording !== language.value);
      });
      if (visible) count += 1;
    });
    status.textContent = count + (count === 1 ? " hymn" : " hymns");
    empty.hidden = count !== 0;
  }

  form.addEventListener("input", update);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    update();
  });
  const shortcuts = { season, service, language };
  function clearFilters() {
    query.value = "";
    Object.values(shortcuts).forEach((field) => { field.value = ""; });
  }

  form.addEventListener("reset", (event) => {
    event.preventDefault();
    clearFilters();
    update();
  });
  document.querySelectorAll(".hymns-page [data-hymn-filter]").forEach((link) => {
    link.addEventListener("click", (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      const field = shortcuts[link.dataset.hymnFilter];
      if (!field) return;
      clearFilters();
      field.value = link.dataset.value;
      update();
    });
  });
  update();
  form.hidden = false;
})();
