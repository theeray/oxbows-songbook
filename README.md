# The Oxbows Songbook

Tablet-first rehearsal songbook for The Oxbows / Me&er.

## Current features

- Searchable song library
- Linked practice recordings, including alternate takes
- A-B practice looping
- Editable two-column chord/lyric sheets with semitone transposition where source material supports it
- Original PDF/notation sheets kept alongside editable versions
- Violin/viola notation kept as notation rather than converted to text
- Locally saved set lists with previous/next navigation while playing a set

## Deployment

The browser app is `index.html`. Large audio/PDF assets are stored as split ZIP parts under `deploy/` so they stay within GitHub file limits. The Pages workflow reassembles and extracts those assets before deployment.

After the repository is populated, enable GitHub Pages once under **Settings → Pages → Build and deployment → Source: GitHub Actions**. The included workflow will then deploy the site.
