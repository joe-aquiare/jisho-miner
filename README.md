![The repo banner.](/media/bannerFull.png)

**Jisho Miner** is a Chromium browser extension that lets you add flashcards to an Anki mining deck directly from within Jisho. This will add a button beside every dictionary entry that creates a flashcard via. [AnkiConnect](https://ankiweb.net/shared/info/2055492159).

![A gif showing the functionality of the extension.](/media/example1.gif)

## Requirements

- Chromium-based browser (Chrome, Edge, Brave, Vivaldi, …)
- [Anki](https://apps.ankiweb.net/) desktop app running
- [AnkiConnect](https://ankiweb.net/shared/info/2055492159) add-on installed in Anki

## Custom Anki Note Type

Along with this exension comes instructions for creating your own Anki note type that formats the scraped Jisho data in a pleasant way. Features include:

- Automatic censorship of elements based on their card position
- Identical presentation to that of jisho.org via. CSS export(s)
- An optional "Notes" section for appending additional information to the back of a card

![A preview of the note type.](/media/cardExample.png)

Because this note type directly uses CSS sourced from Jisho.org, *I will not be hosting it here*.

To set up your Anki note type, [follow these instructions](https://github.com/joe-aquiare/jisho-miner/tree/main/anki/note_types/jisho_miner_note).

## Custom Fields

Jisho Miner allows for field concatenation via. "Custom Fields", which allows you to combine Jisho values into a single string value to use for a note field.

For example, selecting "{Custom}" for a note type and setting the text field to "{word} ({kana})" for 例えば will result in `例えば (たとえば)` for the given field.

Use the table below as a guide to the variables that exist in Jisho Miner:

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
| Word HTML | `{wordHtml}` | The embedded HTML of just the word, without any of its english meaning(s) attached. |

## Running Locally

1. Go to `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** and select this directory.
