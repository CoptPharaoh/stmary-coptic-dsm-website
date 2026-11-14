(() => {
  const get = (id) => document.getElementById(id);
  for (const input of document.querySelectorAll("[data-filter]")) {
    const rows = [...get(input.dataset.filter).children];
    const update = () => {
      const query = input.value.trim().toLowerCase();
      for (const row of rows) row.hidden = !row.textContent.toLowerCase().includes(query);
      get(input.dataset.filter + "-count").textContent = rows.filter((row) => !row.hidden).length + " results";
    };
    input.closest("label").hidden = false;
    input.addEventListener("input", update);
    update();
  }

  const checks = [...get("deacon-checklist").querySelectorAll("input")];
  const storageKey = "stmary-deacon-checklist";
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
    if (Array.isArray(saved)) checks.forEach((check) => { check.checked = saved.includes(check.value); });
  } catch {
    // Practice remains available when browser storage is unavailable.
  }
  function updateChecklist() {
    const completed = checks.filter((check) => check.checked).map((check) => check.value);
    get("deacon-progress").textContent = completed.length + " of " + checks.length + " practices complete";
    try {
      localStorage.setItem(storageKey, JSON.stringify(completed));
    } catch {
      // The current page still retains the checklist state.
    }
  }
  checks.forEach((check) => check.addEventListener("change", updateChecklist));
  const reset = get("deacon-reset");
  reset.hidden = false;
  reset.onclick = () => {
    checks.forEach((check) => { check.checked = false; });
    updateChecklist();
  };
  updateChecklist();
  get("deacon-print").hidden = false;
  get("deacon-print").onclick = () => window.print();

  const responses = [...get("responses").children].map((row) => [
    row.querySelector("summary").textContent, row.querySelector("p").textContent,
  ]);
  const questions = [
    ["Which rank is traditionally associated with reading Scripture?", "Anagnostes", "Epsaltos", "Archdeacon"],
    ["Which passage recounts the appointment of the Seven?", "Acts 6", "Acts 8", "Romans 12"],
    ["Who can preside at the Eucharist?", "A bishop or priest", "A reader", "A deacon independently"],
    ["What is the Anaphora?", "The central Eucharistic prayer", "The opening reading", "A vestment"],
    ["How should you respond if you lose your place while chanting?", "Listen and rejoin when ready", "Start the hymn over", "Chant louder"],
  ];
  const mode = get("deacon-mode");
  const panel = get("deacon-question");
  const feedback = get("deacon-feedback");
  const next = get("deacon-next");
  let index = 0;

  function button(label, action) {
    const control = document.createElement("button");
    control.type = "button";
    control.textContent = label;
    control.addEventListener("click", action);
    panel.append(control);
    return control;
  }
  function render() {
    panel.replaceChildren();
    feedback.textContent = "";
    const prompt = document.createElement("p");
    panel.append(prompt);
    next.hidden = mode.value === "Matching";
    if (mode.value === "Flashcards") {
      const [response, meaning] = responses[index % responses.length];
      prompt.textContent = response;
      button("Reveal meaning", () => { feedback.textContent = meaning; });
      next.textContent = "Next card";
    } else if (mode.value === "Knowledge quiz") {
      const [question, answer, ...alternatives] = questions[index % questions.length];
      prompt.textContent = question;
      const controls = [answer, ...alternatives].sort().map((choice) => button(choice, () => {
        feedback.textContent = choice === answer ? "Correct." : "Correct answer: " + answer;
        controls.forEach((control) => { control.disabled = true; });
        next.focus();
      }));
      next.textContent = "Next question";
    } else {
      prompt.textContent = "Select a response, then choose its meaning.";
      let selected = -1;
      let matched = 0;
      const labels = responses.map(([response], i) => button(response, () => {
        selected = i;
        labels.forEach((control, j) => control.setAttribute("aria-pressed", i === j));
        feedback.textContent = "Choose the meaning of " + response + ".";
      }));
      labels.forEach((control) => control.setAttribute("aria-pressed", "false"));
      const options = responses.map((_, i) => i).reverse().map((i) => button(responses[i][1], (event) => {
        if (selected !== i) {
          feedback.textContent = selected < 0 ? "Select a response first." : "Try another meaning.";
          return;
        }
        labels[i].disabled = true;
        labels[i].setAttribute("aria-pressed", "false");
        event.currentTarget.disabled = true;
        selected = -1;
        matched++;
        feedback.textContent = matched + " of " + responses.length + " matched.";
        const available = labels.find((control) => !control.disabled);
        if (available) available.focus();
        else restart.focus();
      }));
      const restart = button("Restart matching", () => {
        render();
        panel.querySelector("button").focus();
      });
    }
  }
  mode.onchange = () => { index = 0; render(); };
  next.onclick = () => {
    index++;
    render();
    panel.querySelector("button").focus();
  };
  render();
  get("deacon-tools").hidden = false;
})();
