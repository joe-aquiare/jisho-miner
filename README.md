![Alt text](/icons/bannerFull.png)

**Jisho Miner** is a Chromium browser extension that lets you add flashcards to an Anki mining deck directly from within Jisho. This will add a button beside every dictionary entry that creates a flashcard via. [AnkiConnect](https://ankiweb.net/shared/info/2055492159).

![Alt text](/icons/example1.gif)

## Requirements

- Chromium-based browser (Chrome, Edge, Brave, …)
- [Anki](https://apps.ankiweb.net/) desktop app running
- [AnkiConnect](https://ankiweb.net/shared/info/2055492159) add-on installed in Anki

## Anki Preset(s)


## Variables

| Name | Variable | Description |
| -------- | -------- | -------- |
| (Empty) | N/A | Keeps the flashcard field empty. |
| {Custom} | N/A | Allows for the injection and concatenation of variables using brackets, e.g. {word}. |
| Word | `{word}` | The (Japanese) word being added. |
| Kana | `{kana}` | The same as "Word", with all the Kanji replaced by kana. |
| Meaning | `{meaning}` | The (English) meaning of the word. |
| Common Word | `{commonWord}` | Whether the word is common (Yes/No). |
| WaniKani Level | `{waniKaniLevel}` | The WaniKani level for this word, if it is supplied. |
| JLPT Level | `{jlptLevel}` | The JLPT level for this word, if it is supplied. |
| Parts of Speech | `{partsOfSpeech}` | A string containing information about whether this word is a Noun, Verb, etc. |
| Tags | `{tags}` | Tags that are included for this entry. |
| Audio | `{audio}` | The Anki-compatible audio field entry, if one exists. Audio files will be downloaded locally. |
| Web URL | `{webUrl}` | The web client URL for the entry. |
| API URL | `{apiURL}` | The API URL that returns all entries containing this word slug. |
| HTML | `{html}` | The full, embedded HTML of the Jisho entry, filtered to the meaning(s) that were selected. |

## Running Locally

1. Go to `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** and select this directory.
