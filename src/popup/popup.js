const ANKICONNECT_URL = "http://127.0.0.1:8765";

const DEFAULTS = {
  deckName: "Mining",
  modelName: "Basic",
  fieldMappings: {},
};

const JISHO_FIELDS = [
  { value: "",              label: "(empty)" },
  { value: "word",          label: "Word" },
  { value: "reading",       label: "Kana" },
  { value: "definition",    label: "Meaning" },
  { value: "jlptLevel",     label: "JLPT Level" },
  { value: "commonWord",    label: "Common Word" },
  { value: "wanikaniLevel", label: "WaniKani Level" },
  { value: "audio",         label: "Audio" },
  { value: "webUrl",        label: "Web URL" },
  { value: "apiUrl",        label: "API URL" },
  { value: "partsOfSpeech", label: "Parts of Speech" },
  { value: "tags",          label: "Tags" },
];

async function ankiConnect(action, params = {}) {
  const res = await fetch(ANKICONNECT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, version: 6, params }),
  });
  if (!res.ok) throw new Error(`AnkiConnect returned HTTP ${res.status}`);
  const { result, error } = await res.json();
  if (error) throw new Error(error);
  return result;
}

function getSettings() {
  return new Promise((resolve) => chrome.storage.sync.get(DEFAULTS, resolve));
}

function saveSettings() {
  const fieldMappings = {};
  document.querySelectorAll("#field-mappings select").forEach((sel) => {
    fieldMappings[sel.dataset.noteField] = sel.value;
  });

  chrome.storage.sync.set({
    deckName: document.getElementById("deck-name").value,
    modelName: document.getElementById("model-name").value,
    fieldMappings,
  });
}

function populateSelect(selectEl, items, savedValue) {
  selectEl.innerHTML = "";
  for (const item of items) {
    const opt = document.createElement("option");
    opt.value = item;
    opt.textContent = item;
    selectEl.appendChild(opt);
  }
  selectEl.value = items.includes(savedValue) ? savedValue : (items[0] ?? "");
}

function renderFieldMappings(noteFields, savedMappings) {
  const container = document.getElementById("field-mappings");
  container.innerHTML = "";

  if (noteFields.length === 0) {
    container.textContent = "This note type has no fields.";
    return;
  }

  for (const noteField of noteFields) {
    const label = document.createElement("label");
    label.textContent = noteField;
    label.htmlFor = `field-map-${noteField}`;

    const select = document.createElement("select");
    select.id = `field-map-${noteField}`;
    select.dataset.noteField = noteField;

    for (const { value, label: optLabel } of JISHO_FIELDS) {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = optLabel;
      select.appendChild(opt);
    }

    select.value = savedMappings[noteField] ?? "";
    select.addEventListener("change", saveSettings);

    container.appendChild(label);
    container.appendChild(select);
  }
}

async function loadFields(modelName, savedMappings) {
  const noteFields = await ankiConnect("modelFieldNames", { modelName });
  renderFieldMappings(noteFields, savedMappings);
}

async function init() {
  const settings = await getSettings();

  try {
    const [decks, models] = await Promise.all([
      ankiConnect("deckNames"),
      ankiConnect("modelNames"),
    ]);

    decks.sort();
    models.sort();

    const deckSelect = document.getElementById("deck-name");
    const modelSelect = document.getElementById("model-name");

    populateSelect(deckSelect, decks, settings.deckName);
    populateSelect(modelSelect, models, settings.modelName);

    await loadFields(modelSelect.value, settings.fieldMappings);

    deckSelect.addEventListener("change", saveSettings);

    modelSelect.addEventListener("change", async () => {
      await loadFields(modelSelect.value, {});
      saveSettings();
    });
  } catch {
    document.getElementById("error-banner").hidden = false;

    populateSelect(document.getElementById("deck-name"), [settings.deckName], settings.deckName);
    populateSelect(document.getElementById("model-name"), [settings.modelName], settings.modelName);

    const savedMappings = settings.fieldMappings ?? {};
    const savedNoteFields = Object.keys(savedMappings);
    if (savedNoteFields.length > 0) {
      renderFieldMappings(savedNoteFields, savedMappings);
    } else {
      document.getElementById("field-mappings").textContent =
        "Start Anki to configure field mappings.";
    }
  }
}

init();
