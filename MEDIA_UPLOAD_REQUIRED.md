# Media upload required

The app source and GitHub Pages workflow are in this repository. The connected GitHub integration used to populate the repository can write text/source files, but it does not expose a local binary-file upload action. Because the Oxbows media library is about 100 MB of audio, PDFs, JPGs and PNGs, these folders still need one binary upload from the prepared v17 package:

- `assets/`
- `audio/`
- `music/`

Download and unzip `Oxbows_MeAndEr_Songbook_Prototype_v17.zip`, then copy those three folders into the repository root and commit/push them. Every individual file is below GitHub's 100 MB file limit.

After those folders are pushed, the included Pages workflow will redeploy the complete app automatically. The expected project Pages address is `https://theeray.github.io/oxbows-songbook/` once Pages has successfully deployed.
