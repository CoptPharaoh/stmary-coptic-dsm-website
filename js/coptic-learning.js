(() => {
  const get = id => document.getElementById(id);
  const grid = get("letter-grid");
  if (!grid) return;

  const letters = [...get("alphabet-data").children].map(card => card.dataset);
  let selected = 0;
  const letterButtons = letters.map((letter, index) => {
    const button = document.createElement("button");
    button.className = "cop";
    button.lang = "cop";
    button.setAttribute("aria-label", letter.name);
    button.onclick = () => showLetter(index);
    grid.append(button);
    return button;
  });

  function glyph(letter) {
    const mode = get("letter-case").value;
    if (mode === "Uppercase") return letter.upper;
    if (mode === "Lowercase") return letter.lower;
    return letter.upper + " " + letter.lower;
  }

  function showLetter(index) {
    selected = (index + letters.length) % letters.length;
    const letter = letters[selected];
    const older = get("letter-tradition").selectedIndex === 1;
    get("letter-glyph").textContent = glyph(letter);
    get("letter-name").textContent = letter.name + " · " + (selected + 1) + " of " + letters.length;
    get("letter-sound").textContent = letter.name === "Sou"
      ? "Historical numeral for six."
      : (older ? letter.older : letter.modern) || "See the linked pronunciation guide for this character.";
    letterButtons.forEach((button, i) => {
      button.textContent = glyph(letters[i]);
      button.setAttribute("aria-pressed", i === selected);
    });
  }

  get("letter-prev").onclick = () => showLetter(selected - 1);
  get("letter-next").onclick = () => showLetter(selected + 1);
  get("letter-case").onchange = get("letter-tradition").onchange = () => showLetter(selected);
  showLetter(0);
  get("letter-reference").open = false;
  get("letter-tool").hidden = false;

  function filter(rows, search, count, category) {
    const query = search.value.trim().toLowerCase().normalize();
    let visible = 0;
    rows.forEach(row => {
      const matchesCategory = !category || category.value === "All" || row.dataset.category === category.value;
      row.hidden = !matchesCategory || !row.textContent.toLowerCase().normalize().includes(query);
      if (!row.hidden) visible++;
    });
    count.textContent = visible + " of " + rows.length + " results";
  }

  const wordRows = [...get("word-data").children];
  const category = get("word-category");
  const wordSearch = get("word-search");
  const updateWords = () => filter(wordRows, wordSearch, get("word-count"), category);
  wordSearch.oninput = category.onchange = updateWords;
  get("word-controls").hidden = false;
  updateWords();

  const glossarySearch = get("glossary-search");
  glossarySearch.oninput = () => filter([...get("glossary-data").children], glossarySearch, get("glossary-count"));
  get("glossary-control").hidden = false;

  const words = wordRows.map(row => [row.querySelector("dt").textContent, row.querySelector("strong").textContent]);
  const mode = get("practice-mode");
  const card = get("practice-card");
  const status = get("practice-status");
  let question = 0;
  let correct = 0;
  let answered = 0;

  function addButton(label, action, lang) {
    const button = document.createElement("button");
    button.textContent = label;
    if (lang) button.lang = lang;
    button.onclick = action;
    card.append(button);
    return button;
  }

  function renderPractice() {
    card.replaceChildren();
    const type = mode.value;
    const entries = type === "Alphabet quiz" ? letters.map(letter => [letter.upper, letter.name]) : words;
    const index = question % entries.length;
    const [word, meaning] = entries[index];
    status.textContent = type === "Flashcards" ? "" : "Score: " + correct + " of " + answered;
    get("practice-reset").hidden = type === "Flashcards";
    get("practice-next").textContent = type === "Flashcards" ? "Next card" : "Next question";
    const prompt = document.createElement("p");
    prompt.lang = "cop";
    prompt.className = "cop";
    prompt.textContent = word;
    card.append(prompt);

    if (type === "Flashcards") {
      addButton("Reveal meaning", () => { status.textContent = meaning; });
      return;
    }

    if (type === "Matching") {
      const group = [0, 1, 2].map(offset => words[(index + offset) % words.length]);
      prompt.lang = "en";
      prompt.className = "";
      prompt.textContent = "Select a Coptic word, then match its English meaning.";
      let active = null;
      const choices = group.map(([coptic]) => addButton(coptic, () => {
        active = coptic;
        choices.forEach(button => button.setAttribute("aria-pressed", button.textContent === coptic));
        status.textContent = "Choose the English meaning.";
      }, "cop"));
      choices.forEach(button => button.setAttribute("aria-pressed", "false"));
      const meanings = group.slice().reverse().map(([coptic, label]) => addButton(label, () => {
        if (!active) {
          status.textContent = "Choose a Coptic word first.";
          return;
        }
        answered++;
        if (active !== coptic) {
          status.textContent = "Try again. Score: " + correct + " of " + answered;
          return;
        }
        correct++;
        choices.find(button => button.textContent === coptic).disabled = true;
        meanings.find(button => button.textContent === label).disabled = true;
        choices.forEach(button => button.setAttribute("aria-pressed", "false"));
        active = null;
        status.textContent = "Match found. Score: " + correct + " of " + answered;
      }));
      return;
    }

    const options = [0, 1, 2, 3].map(offset => entries[(index + offset) % entries.length][1]).sort();
    const buttons = options.map(option => addButton(option, () => {
      answered++;
      if (option === meaning) correct++;
      buttons.forEach(button => { button.disabled = true; });
      status.textContent = (option === meaning ? "Correct." : "Answer: " + meaning + ".") +
        " Score: " + correct + " of " + answered;
      get("practice-next").focus();
    }));
  }

  function resetPractice() {
    question = correct = answered = 0;
    renderPractice();
  }

  mode.onchange = get("practice-reset").onclick = resetPractice;
  get("practice-next").onclick = () => {
    question++;
    renderPractice();
  };
  renderPractice();
  get("practice-tool").hidden = false;
})();
