/**
 * Jisho Miner — service worker
 *
 * Receives MINE_WORD messages from the content script, looks up the word
 * via the Jisho public API to get authoritative field data, then adds the
 * card to Anki via the AnkiConnect HTTP API (http://127.0.0.1:8765).
 */

const ANKICONNECT_URL = "http://127.0.0.1:8765";
const ANKICONNECT_VERSION = 6;
const JISHO_API_URL = "https://jisho.org/api/v1/search/words";

async function ankiConnectRequest(action, params = {}) {
  const response = await fetch(ANKICONNECT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, version: ANKICONNECT_VERSION, params }),
  });

  if (!response.ok) {
    throw new Error(`AnkiConnect returned HTTP ${response.status}`);
  }

  const body = await response.json();
  if (body.error) throw new Error(body.error);
  return body.result;
}

async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      { deckName: "Mining", modelName: "Basic", fieldMappings: {} },
      resolve
    );
  });
}

async function findEntry(word, reading, slug = "", pageMeanings = []) {
  const url = `${JISHO_API_URL}?keyword=${encodeURIComponent(word)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Jisho API returned HTTP ${res.status}`);

  const { data } = await res.json();
  if (!data?.length) throw new Error(`No Jisho results for "${word}"`);

  // Priority 1: slug from the .light-details_link /word/ href (search-page entries).
  if (slug) {
    const byLinkSlug = data.find(e => e.slug === slug);
    if (byLinkSlug) return byLinkSlug;
  }

  // Priority 2: the word text displayed on the page equals an entry's slug.
  // Handles word-page entries where .light-details_link doesn't point to /word/.
  const byWordSlug = data.find(e => e.slug === word);
  if (byWordSlug) return byWordSlug;

  // Priority 3: meaning cross-check — any page .meaning-meaning text matches
  // the joined english_definitions of a sense, or matches an individual item.
  if (pageMeanings.length) {
    const byMeaning = data.find(e =>
      e.senses.some(s => {
        const joined = s.english_definitions.join("; ");
        return pageMeanings.some(m => m === joined || s.english_definitions.includes(m));
      })
    );
    if (byMeaning) return byMeaning;
  }

  // Fallback: word+reading priority chain.
  return (
    data.find(e => e.japanese.some(j => j.word === word && j.reading === reading)) ??
    data.find(e => e.japanese.some(j => j.word === word)) ??
    data.find(e => e.japanese.some(j => j.reading === word)) ??
    data[0]
  );
}

async function fetchEntryData(word, reading, slug, pageMeanings) {
  const entry = await findEntry(word, reading, slug, pageMeanings);
  const firstJapanese = entry.japanese[0] ?? {};

  const jlptTag = entry.jlpt?.[0] ?? "";
  const jlptLevel = jlptTag ? jlptTag.replace("jlpt-", "").toUpperCase() : "";

  const wanikaniTag = (entry.tags ?? []).find(t => /^wanikani\d+$/.test(t)) ?? "";
  const wanikaniLevel = wanikaniTag ? wanikaniTag.replace("wanikani", "") : "";

  return {
    word:          firstJapanese.word ?? firstJapanese.reading ?? "",
    reading:       firstJapanese.reading ?? "",
    definition:    entry.senses[0]?.english_definitions.join("; ") ?? "",
    commonWord:    entry.is_common ? "Yes" : "",
    jlptLevel,
    wanikaniLevel,
    webUrl:        `https://jisho.org/word/${encodeURIComponent(entry.slug)}`,
    apiUrl:        `${JISHO_API_URL}?keyword=${encodeURIComponent(word)}`,
    partsOfSpeech: entry.senses[0]?.parts_of_speech.join(", ") ?? "",
    tags:          entry.senses[0]?.tags.join(", ") ?? "",
  };
}

async function fetchSenses(word, reading, slug, pageMeanings) {
  const entry = await findEntry(word, reading, slug, pageMeanings);
  return entry.senses.filter(s => !s.parts_of_speech.includes("Wikipedia definition"));
}

async function addNote(word, reading, audioUrl, selectedDefinition, slug, pageMeanings) {
  const [{ deckName, modelName, fieldMappings }, entryData] = await Promise.all([
    getSettings(),
    fetchEntryData(word, reading, slug, pageMeanings),
  ]);

  if (selectedDefinition !== undefined) {
    entryData.definition = selectedDefinition;
  }

  if (audioUrl && Object.values(fieldMappings).includes("audio")) {
    const filename = audioUrl.split("/").pop();
    await ankiConnectRequest("storeMediaFile", { filename, url: audioUrl });
    entryData.audio = `[sound:${filename}]`;
  } else {
    entryData.audio = "";
  }

  const fields = {};
  for (const [noteField, jishoField] of Object.entries(fieldMappings)) {
    if (!jishoField) {
      fields[noteField] = "";
    } else if (Object.hasOwn(entryData, jishoField)) {
      fields[noteField] = entryData[jishoField] ?? "";
    } else {
      // Custom template — replace {varName} placeholders with entry data
      fields[noteField] = jishoField.replace(
        /\{(\w+)\}/g,
        (_, key) => entryData[key] ?? ""
      );
    }
  }

  return ankiConnectRequest("addNote", {
    note: {
      deckName,
      modelName,
      fields,
      options: { allowDuplicate: false },
      tags: ["jisho-miner"],
    },
  });
}

async function checkNote(word, reading) {
  const { deckName, fieldMappings } = await getSettings();

  // Find the first note field mapped to "word", falling back to "reading"
  const [searchField, searchValue] =
    Object.entries(fieldMappings).find(([, v]) => v === "word")
      ? [Object.entries(fieldMappings).find(([, v]) => v === "word")[0], word]
      : Object.entries(fieldMappings).find(([, v]) => v === "reading")
      ? [Object.entries(fieldMappings).find(([, v]) => v === "reading")[0], reading]
      : [null, null];

  if (!searchField || !searchValue) return false;

  const query = `deck:"${deckName}" "${searchField}:${searchValue}"`;
  const noteIds = await ankiConnectRequest("findNotes", { query });
  return noteIds.length > 0;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "FETCH_SENSES") {
    const { word, reading, slug, pageMeanings } = message.payload;
    fetchSenses(word, reading, slug, pageMeanings)
      .then(senses => sendResponse({ senses }))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }

  if (message.type === "MINE_WORD") {
    const { word, reading, audioUrl, selectedDefinition, slug, pageMeanings } = message.payload;
    addNote(word, reading, audioUrl, selectedDefinition, slug, pageMeanings)
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === "CHECK_WORD") {
    const { word, reading } = message.payload;
    checkNote(word, reading)
      .then(exists => sendResponse({ exists }))
      .catch(() => sendResponse({ exists: false }));
    return true;
  }
});
