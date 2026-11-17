# Chess.com to Lichess Import

Chrome extension that detects supported Chess.com game pages and imports the current game into Lichess with one click.

## Development

1. Install dependencies with `npm install`.
2. Build the extension with `npm run build`.
3. Re-run `npm run build` whenever you change files under `src/`.

The TypeScript source lives in `src/`, and the compiled extension files are emitted to `dist/`.

## How it works

1. On a Chess.com game or game-analysis page, the content script looks for the Share button, including the version nested under the secondary controls menu.
2. While the game page is supported but the PGN is not ready yet, the extension badge shows `↺` as a retry state.
3. When the PGN can be imported, the badge shows `PGN`.
4. Clicking the extension action always tries to read the PGN again, even if the page was loaded earlier or the content script needs to be reattached.
5. It opens Chess.com's Share dialog, selects the PGN tab, and reads the finished game. If Chess.com's controls have moved, it falls back to the same-origin game callback used by the page.
6. If the import succeeds, the extension opens `https://lichess.org/paste` with an import token in the URL hash, and a Lichess content script fills the PGN form and submits it in-page.
7. When the Chess.com board has Black at the bottom, the imported Lichess game automatically opens from Black's perspective as well.

This avoids using the clipboard, avoids requiring a Lichess API token, avoids cross-origin POST failures from extension pages, and avoids matching the game through Chess.com's monthly archive API.

## Load the extension

1. Run `npm run build`.
2. Open `chrome://extensions`.
3. Enable Developer mode.
4. Click Load unpacked.
5. Select this folder.

## Notes

- The extension supports both `/game/...` and `/analysis/game/...` Chess.com pages.
- A PGN must contain a finished result (`1-0`, `0-1`, or `1/2-1/2`). Active games are deliberately rejected.
- Lichess imports created through this flow are public, matching the normal import page behavior.
- If Chrome already has a Lichess import tab open, this extension still opens a fresh `https://lichess.org/paste` tab for a predictable one-click flow.
