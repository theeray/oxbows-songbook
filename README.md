# Oxbows Songbook

Live app: https://theeray.github.io/oxbows-songbook/

The original song library, recordings, A–B loops, transposable chord sheets,
and browser-local set lists are preserved. Printable PDFs are the default.
Choose **Default display** in the library to prefer the transposable layout or
MusicXML workspace instead. Songs without the preferred format fall back to an
available view. Original sheets remain available in the **Sheet** menu.

## Scores and Voilà!

- **Open in Voilà!** sends the selected MusicXML version for editing, or an original
  PDF to Voilà!'s experimental scanner. Select the PDF page and check the resulting
  notes carefully. The scanner is intended for single melody lines.
- **Import score from Voilà! / MusicXML** accepts `.voila`, `.musicxml`, `.xml`, `.mxl`,
  and PDF. **Import for this song** attaches an import to an existing library song.
- **Edit & play MusicXML** opens the same Voilà! editor inside Songbook: clefs,
  transposition, separate harmonies, moving drones, chord suggestions, range checks,
  arrow-key note edits, click audition, playback from selection, and a blue locator.
- **Save to Songbook** keeps a new version with the complete source, arrangement
  settings, editable MusicXML, and a newly generated landscape vector PDF.
- **Download transfer file** keeps all those pieces together in a `.voila` backup.
  Either app can import it if popups or a sign-in redirect prevent a direct transfer.
  MusicXML and PDF can also be downloaded separately.

Scores and versions use IndexedDB (`oxbowsScores`) on this browser/device.
Set lists retain the original localStorage key (`oxbowsSetLists`). The display
preference uses `oxbowsScoreDisplay`. There is no account sync or server score
storage; export a backup before clearing browser data or changing devices.
Concurrent saves in separate tabs append versions in a single database transaction.

Transfers verify the originating window, origin, and random transfer nonce. No
score content enters the URL. The live private Voilà! app keeps its current access
rules; this integration does not publish private scores or change site sharing.

## Build and deployment

Node 22 or newer:

```sh
npm ci --prefix editor
npm test
npm run build
```

GitHub Pages builds `dist/` using `.github/workflows/pages.yml`. Existing `audio/`,
`music/`, and `assets/` are copied unchanged. The editor's recognition model is
fetched from the official Oemer release and SHA-256 verified during the build.
The PDF viewer renders each page so mobile browsers do not need an embedded PDF
plugin. PDF exports use jsPDF and svg2pdf; notation uses OpenSheetMusicDisplay.

`editor/` vendors the Voilà! source from https://github.com/theeray/Voila.
After changing the shared editor, synchronize with:

```sh
node scripts/sync-editor.mjs /path/to/Voila
```

This copies source, tests, lockfile, licenses, and the shared transfer protocol;
model binaries, dependencies, and build output are excluded from git. The editor
build is rooted at `/oxbows-songbook/editor/` for this repository's Pages URL.
