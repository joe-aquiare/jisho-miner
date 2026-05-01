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

/**
 * Calls the Jisho API and returns a normalised data object for the entry
 * that best matches the given word and reading.
 */
async function fetchEntryData(word, reading) {
  const url = `${JISHO_API_URL}?keyword=${encodeURIComponent(word)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Jisho API returned HTTP ${res.status}`);

  const { data } = await res.json();
  if (!data?.length) throw new Error(`No Jisho results for "${word}"`);

  // Prefer an entry whose japanese variants match both word and reading,
  // then word alone, then reading alone, then fall back to the first result.
  const entry =
    data.find(e => e.japanese.some(j => j.word === word && j.reading === reading)) ??
    data.find(e => e.japanese.some(j => j.word === word)) ??
    data.find(e => e.japanese.some(j => j.reading === word)) ??
    data[0];

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

async function addNote(word, reading, audioUrl) {
  const [{ deckName, modelName, fieldMappings }, entryData] = await Promise.all([
    getSettings(),
    fetchEntryData(word, reading),
  ]);

  if (audioUrl && Object.values(fieldMappings).includes("audio")) {
    const filename = audioUrl.split("/").pop();
    await ankiConnectRequest("storeMediaFile", { filename, url: audioUrl });
    entryData.audio = `[sound:${filename}]`;
  } else {
    entryData.audio = "";
  }

  const fields = {};
  for (const [noteField, jishoField] of Object.entries(fieldMappings)) {
    fields[noteField] = jishoField ? (entryData[jishoField] ?? "") : "";
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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "MINE_WORD") return false;

  const { word, reading, audioUrl } = message.payload;

  addNote(word, reading, audioUrl)
    .then(() => sendResponse({ success: true }))
    .catch((err) => sendResponse({ success: false, error: err.message }));

  return true; // keep the message channel open for the async response
});
