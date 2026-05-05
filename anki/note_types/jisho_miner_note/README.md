## How to Build the Custom Note Type

To construct your own Anki note type, do the following:

1. populate a new note type with the following fields:

| Field Name |
| --- |
| Word |
| Reading |
| Definition |
| JLPT Level |
| Common Word |
| WaniKani Level |
| Audio |
| Web URL |
| API URL |
| Parts of Speech |
| Tags |
| HTML |
| Word HTML |
| Notes |

2. Create two card types for the note - one for English -> Japanese, and one for Japanese -> English.

3. Copy the HTML for each card type into the Anki card editor. To open the card editor, go to Browse > Notes > Manage Note Types > Select your new note type > Cards.

4. Go to Options > Rename Card Type... > And rename the default card type to "Japanese -> English", or whatever you like.

5. Go to Options > Add Card Type... > Yes > And create a new card type called "English -> Japanese", or again, whatever you like.

6. From the subfolders in this directory, copy and paste the HTML for both the J->E and E->J card types to their respective locations.

7. Follow the steps below, in **"Populating the jisho.org CSS". This is a simple step, but an important one.**

8. Go back to the Jisho Miner extension settings in your browser, and point it at your deck + new note type, and populate each field respectively (Word -> Word, Reading -> Reading, so on so forth).

You're done! Happy mining.

## Populating the jisho.org CSS

Creating the card type manually requires sourcing the Jisho.org CSS styling yourself - you can see there is a section at the bottom of `style.css` that requires some manual setup. Follow the steps there to populate the CSS. **Please don't complain that your Anki cards look off unless you've gone through those steps. If there's a legitimate issue though, I will attempt to fix it.**
