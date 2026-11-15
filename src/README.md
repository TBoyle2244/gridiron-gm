# Gridiron GM source

The game at the top of this repo (index.html, drive.html) is built from these files.

- `engine.js`: the simulation (league, players, draft, contracts, games, career mode)
- `help.js`, `ui.js`: the screens and the in-game manual
- `shell.html`: page layout and styles
- `drive-src.html`: the Play the Game screen (`/*ENGINE*/` is replaced with engine.js)
- `build.py`: builds index.html and drive.html

To build: copy these files plus `rosters.json`, `manifest.json` and the icons into one folder, create `dist/gridiron-gm/`, and run `python3 build.py`. Then copy `dist/gridiron-gm/index.html` and `drive.html` to the top of the repo.
