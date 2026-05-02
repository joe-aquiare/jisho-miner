/**
 * Jisho Miner — content script
 *
 * Injects "Mine" buttons into Jisho.org word entries. On click, sends the
 * word and reading to the service worker, which looks them up via the Jisho
 * API and adds the resulting card to Anki via AnkiConnect.
 */

const MINE_BUTTON_CLASS = "jisho-miner-btn";

// Wraps chrome.runtime.sendMessage to handle the synchronous throw that
// occurs when the extension is reloaded while the tab is still open.
function sendMessage(message) {
  try {
    return chrome.runtime.sendMessage(message).catch(() => null);
  } catch {
    return Promise.resolve(null);
  }
}

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

function markAsAdded(btn) {
  btn.textContent = "✓ In Deck";
  btn.disabled = true;
  btn.classList.add("jisho-miner-btn--added");
  btn.classList.remove("jisho-miner-btn--error");
}

function showSenseModal(word, senses) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "jisho-miner-overlay";

    const modal = document.createElement("div");
    modal.className = "jisho-miner-modal";

    const header = document.createElement("div");
    header.className = "jisho-miner-modal__header";

    const wordEl = document.createElement("span");
    wordEl.className = "jisho-miner-modal__word";
    wordEl.textContent = word;
    header.appendChild(wordEl);

    const titleEl = document.createElement("span");
    titleEl.className = "jisho-miner-modal__title";
    titleEl.textContent = "Select meaning(s):";
    header.appendChild(titleEl);

    const senseList = document.createElement("div");
    senseList.className = "jisho-miner-modal__senses";

    const checkboxes = [];
    for (const sense of senses) {
      const label = document.createElement("label");
      label.className = "jisho-miner-modal__sense";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkboxes.push(checkbox);

      const content = document.createElement("div");
      content.className = "jisho-miner-modal__sense-content";

      const pos = sense.parts_of_speech.join(", ");
      if (pos) {
        const posEl = document.createElement("div");
        posEl.className = "jisho-miner-modal__pos";
        posEl.textContent = pos;
        content.appendChild(posEl);
      }

      const defEl = document.createElement("div");
      defEl.className = "jisho-miner-modal__def";
      defEl.textContent = sense.english_definitions.join("; ");
      content.appendChild(defEl);

      const meta = [...(sense.tags ?? []), ...(sense.info ?? [])].filter(Boolean).join(" · ");
      if (meta) {
        const metaEl = document.createElement("div");
        metaEl.className = "jisho-miner-modal__meta";
        metaEl.textContent = meta;
        content.appendChild(metaEl);
      }

      label.appendChild(checkbox);
      label.appendChild(content);
      senseList.appendChild(label);
    }

    const footer = document.createElement("div");
    footer.className = "jisho-miner-modal__footer";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "jisho-miner-modal__btn jisho-miner-modal__btn--cancel";
    cancelBtn.textContent = "Cancel";

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "jisho-miner-modal__btn jisho-miner-modal__btn--add";
    addBtn.textContent = "Add to Anki";

    footer.appendChild(cancelBtn);
    footer.appendChild(addBtn);

    modal.appendChild(header);
    modal.appendChild(senseList);
    modal.appendChild(footer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    function close(result) {
      overlay.remove();
      resolve(result);
    }

    cancelBtn.addEventListener("click", () => close(null));
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(null); });
    addBtn.addEventListener("click", () => {
      const selected = senses.filter((_, i) => checkboxes[i].checked);
      close(selected.map(s => s.english_definitions.join("; ")).join("; "));
    });
  });
}

function createMineButton(entryEl) {
  const btn = document.createElement("button");
  btn.className = MINE_BUTTON_CLASS;
  btn.textContent = "+ Add to Anki";
  btn.title = "Add to Anki Mining Deck";

  // Silently check on load whether this word is already in the deck.
  const { word, reading } = extractEntryData(entryEl);
  if (word) {
    sendMessage({ type: "CHECK_WORD", payload: { word, reading } })
      .then(response => { if (response?.exists) markAsAdded(btn); });
  }

  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const data = extractEntryData(entryEl);
    if (!data.word) return;

    btn.disabled = true;
    btn.textContent = "…";

    const sensesResponse = await sendMessage({
      type: "FETCH_SENSES",
      payload: { word: data.word, reading: data.reading },
    });

    if (!sensesResponse?.senses) {
      btn.textContent = "Error";
      btn.classList.add("jisho-miner-btn--error");
      btn.title = sensesResponse?.error ?? "Failed to fetch meanings";
      btn.disabled = false;
      return;
    }

    const selectedDefinition = await showSenseModal(data.word, sensesResponse.senses);

    if (selectedDefinition === null) {
      btn.disabled = false;
      btn.textContent = "+ Add to Anki";
      return;
    }

    const response = await sendMessage({
      type: "MINE_WORD",
      payload: { ...data, selectedDefinition },
    });

    if (response?.success) {
      markAsAdded(btn);
    } else {
      btn.textContent = "Error";
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

// Handle dynamically loaded results (e.g. search-as-you-type).
// Disconnects itself if the extension is reloaded mid-session.
const observer = new MutationObserver((mutations) => {
  if (!chrome.runtime?.id) {
    observer.disconnect();
    return;
  }

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
