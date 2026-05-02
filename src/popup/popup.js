const ANKICONNECT_URL = "http://127.0.0.1:8765";

const DEFAULTS = {
  deckName: "Mining",
  modelName: "Basic",
  fieldMappings: {},
};

const JISHO_FIELDS = [
  { internalName: "",               variableName: "",               labelName: "(Empty)"          },
  { internalName: "__custom__",     variableName: "",               labelName: "{Custom}"         },
  { internalName: "word",           variableName: "word",           labelName: "Word"             },
  { internalName: "reading",        variableName: "kana",           labelName: "Kana"             },
  { internalName: "definition",     variableName: "meaning",        labelName: "Meaning"          },
  { internalName: "jlptLevel",      variableName: "jlptLevel",      labelName: "JLPT Level"       },
  { internalName: "commonWord",     variableName: "commonWord",     labelName: "Common Word"      },
  { internalName: "wanikaniLevel",  variableName: "wanikaniLevel",  labelName: "WaniKani Level"   },
  { internalName: "audio",          variableName: "audio",          labelName: "Audio"            },
  { internalName: "webUrl",         variableName: "webUrl",         labelName: "Web URL"          },
  { internalName: "apiUrl",         variableName: "apiUrl",         labelName: "API URL"          },
  { internalName: "partsOfSpeech",  variableName: "partsOfSpeech",  labelName: "Parts of Speech"  },
  { internalName: "tags",           variableName: "tags",           labelName: "Tags"             },
];

// Set of known internalNames.
const KNOWN_JISHO_VALUES = new Set(
  JISHO_FIELDS.filter(f => f.internalName !== "__custom__").map(f => f.internalName)
);

// Set of valid variable names usable inside {…} in a custom template.
const VALID_JISHO_VARS = new Set(
  JISHO_FIELDS.filter(f => f.variableName && f.internalName !== "__custom__").map(f => f.variableName)
);

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
  // Build noteField → custom template map from any visible custom inputs first.
  const customValues = {};
  document.querySelectorAll("#field-mappings .custom-field-input").forEach((input) => {
    customValues[input.dataset.noteField] = input.value;
  });

  const fieldMappings = {};
  document.querySelectorAll("#field-mappings select[data-note-field]").forEach((sel) => {
    const noteField = sel.dataset.noteField;
    fieldMappings[noteField] = sel.value === "__custom__"
      ? (customValues[noteField] ?? "")
      : sel.value;
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

function validateCustomInput(input, errorEl) {
  const matches = [...input.value.matchAll(/\{(\w+)\}/g)];
  const hasInvalid = matches.some(m => !VALID_JISHO_VARS.has(m[1]));
  input.classList.toggle("custom-field-input--error", hasInvalid);
  errorEl.hidden = !hasInvalid;
}

function renderFieldMappings(noteFields, savedMappings) {
  const container = document.getElementById("field-mappings");
  container.innerHTML = "";

  if (noteFields.length === 0) {
    container.textContent = "This note type has no fields.";
    return;
  }

  for (const noteField of noteFields) {
    const savedValue = savedMappings[noteField] ?? "";
    const isCustom = !KNOWN_JISHO_VALUES.has(savedValue);

    // Label
    const label = document.createElement("label");
    label.textContent = noteField;
    label.htmlFor = `field-map-${noteField}`;

    // Select
    const select = document.createElement("select");
    select.id = `field-map-${noteField}`;
    select.dataset.noteField = noteField;
    for (const { internalName, labelName } of JISHO_FIELDS) {
      const opt = document.createElement("option");
      opt.value = internalName;
      opt.textContent = labelName;
      select.appendChild(opt);
    }
    select.value = isCustom ? "__custom__" : savedValue;

    // Custom template input (hidden unless "Custom" is selected)
    const customWrapper = document.createElement("div");
    customWrapper.className = "custom-field-wrapper";
    customWrapper.hidden = !isCustom;

    const customInput = document.createElement("input");
    customInput.type = "text";
    customInput.className = "custom-field-input";
    customInput.dataset.noteField = noteField;
    customInput.placeholder = "e.g. {word} (Common: {commonWord})";
    customInput.value = isCustom ? savedValue : "";

    const customError = document.createElement("span");
    customError.className = "custom-field-error";
    customError.textContent = "Error: Invalid variable name.";
    customError.hidden = true;

    customWrapper.appendChild(customInput);
    customWrapper.appendChild(customError);

    if (isCustom) validateCustomInput(customInput, customError);

    customInput.addEventListener("input", () => {
      validateCustomInput(customInput, customError);
    });

    select.addEventListener("change", () => {
      customWrapper.hidden = select.value !== "__custom__";
    });

    container.appendChild(label);
    container.appendChild(select);
    container.appendChild(customWrapper);
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

    modelSelect.addEventListener("change", async () => {
      await loadFields(modelSelect.value, {});
    });
  } catch {
    document.getElementById("error-banner").hidden = false;
  }
}

document.getElementById("settings-form").addEventListener("submit", (e) => {
  e.preventDefault();
  saveSettings();

  const btn = document.getElementById("save-btn");
  btn.textContent = "Saved!";
  btn.disabled = true;
  setTimeout(() => {
    btn.textContent = "Save";
    btn.disabled = false;
  }, 1500);
});

document.getElementById("version").textContent = `v${chrome.runtime.getManifest().version}`;

init();