export const POETIC_TAG = "v6.0.1";

export const POEM_SYNTAX_REFERENCE_URL = `https://github.com/Poetic-Poems/poetic/blob/${POETIC_TAG}/docs/POEM-SYNTAX.md`;

export const EXAMPLE_POEM = `<<#
Welcome! This is a friendly example poem to help you get started. Edit the
text on the left and watch the preview update on the right.
#>>

={greeting}=Hello, poet

\${greeting} — Welcome to Poetic Fiddle
A Friendly Poet
2026-07-14

{{ First Draft }}

{Verse 1}
The *page* is empty, but not for long,
your **words** will find their way along.
Try /.highlight{styling a phrase} like this one,
or leave yourself a note when you're done.

{Verse 2}
Change a line, delete a verse,
watch the preview redraw — nothing's worse
than losing work, so type away,
your draft stays right here as you play.

<<#
This comment never appears in the rendered preview.
#>>

----

{{ Second Draft }}

{Verse 1}
A second version, side by side,
so early drafts don't have to hide.

====

Suno: s/SongLink12345678

====

{Postscript}
This note is rendered as **Markdown**, so lists and links work too:

- Write your poem on the left
- Watch it render on the right
- Check the [syntax reference|${POEM_SYNTAX_REFERENCE_URL}] any time

====
====

#welcome
#first-draft
`;
