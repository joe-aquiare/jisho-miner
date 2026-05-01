/**
 * Jisho Miner — content script
 *
 * Injects "Mine" buttons into Jisho.org word entries. On click, sends the
 * word and reading to the service worker, which looks them up via the Jisho
 * API and adds the resulting card to Anki via AnkiConnect.
 */

const MINE_BUTTON_CLASS = "jisho-miner-btn";

function extractEntryData(entryEl) {
  const audioEl  = entryEl.querySelector("audio[id^='audio_']");
  const audioSrc = audioEl?.querySelector('source[type="audio/mpeg"]')?.getAttribute("src") ?? "";
  const audioUrl = audioSrc ? `https:${audioSrc}` : "";

  // The audio id encodes word and reading as "audio_WORD:READING", which is
  // more reliable than parsing furigana spans for mixed kana/kanji entries
  // (the furigana span only carries readings for kanji, not kana prefixes).
  let word, reading;
  if (audioEl?.id) {
    [word = "", reading = ""] = audioEl.id.slice("audio_".length).split(":");
  } else {
    word    = entryEl.querySelector(".text")?.textContent.trim() ?? "";
    reading = entryEl.querySelector(".furigana")?.textContent.trim().replace(/\s+/g, "") ?? "";
  }

  return { word, reading, audioUrl };
}

function createMineButton(entryEl) {
  const btn = document.createElement("button");
  btn.className = MINE_BUTTON_CLASS;
  btn.textContent = "+ Add to Anki";
  btn.title = "Add to Anki Mining Deck";

  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const data = extractEntryData(entryEl);
    if (!data.word) return;

    btn.disabled = true;
    btn.textContent = "…";

    const response = await chrome.runtime.sendMessage({
      type: "MINE_WORD",
      payload: data,
    });

    if (response?.success) {
      btn.textContent = "✓";
      btn.classList.add("jisho-miner-btn--added");
    } else {
      btn.textContent = "✗";
      btn.classList.add("jisho-miner-btn--error");
      btn.title = response?.error ?? "Failed to add card";
      btn.disabled = false;
    }
  });

  return btn;
}

function injectButtons(root = document) {
  root.querySelectorAll(".concept_light").forEach((entryEl) => {
    if (entryEl.querySelector(`.${MINE_BUTTON_CLASS}`)) return;

    const anchor = entryEl.querySelector(".concept_light-representation");
    if (anchor) anchor.appendChild(createMineButton(entryEl));
  });
}

// Initial injection
injectButtons();

// Handle dynamically loaded results (e.g. search-as-you-type)
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      if (node.matches?.(".concept_light")) {
        if (!node.querySelector(`.${MINE_BUTTON_CLASS}`)) {
          const anchor = node.querySelector(".concept_light-representation");
          if (anchor) anchor.appendChild(createMineButton(node));
        }
      } else {
        injectButtons(node);
      }
    }
  }
});

observer.observe(document.body, { childList: true, subtree: true });
