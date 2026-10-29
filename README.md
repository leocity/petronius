# Petronius

A location-based narrative game set in Bovisa and Dergano, Milan, originally made in 2019 for the
System Design Studio / Interactive Narrative course at Politecnico di Milano (an App Inventor app,
HTML scenes and a physical journal). This repository revives it as a browser game that needs neither
the app nor the journal.

**Play:** https://leocity.github.io/petronius/

- **At home:** every place is on the map and every clue from the journal is in the in-game notebook.
- **In Bovisa:** walk the real streets; your phone's location unlocks each place. Starts at Politecnico Bovisa, Via Durando 10.

## Repository

- `web/` the game (static, no build step)
- `data/story/` scenes, scene flow, clues, cast, media and text fixes as JSON
- `tools/` extraction, validation, asset and playtest scripts · `docs/recap.md` audit and work plan

The original 2019 material (the HTML scenes, the journal's print files, the Android app and the original
media) is not in this repository; the tools read it from the project folder.

Run locally with `npm run dev` and open http://localhost:5173/.

The character photos are of the people who played the characters in the original project and are used
with their consent for this game only.
