# Chess.com to Lichess Import

Chrome extension that detects supported Chess.com game pages and imports the current game into Lichess with one click.

## How it works

1. On a Chess.com game page, the content script watches for the Share button.
2. While the game page is supported but the PGN is not ready yet, the extension badge shows `↺` as a retry state.
3. When the PGN can be imported, the badge shows `PGN`.
4. Clicking the extension action always tries to read the PGN again, even if the page was loaded earlier or the content script needs to be reattached.
5. If the import succeeds, the extension opens `https://lichess.org/paste` with an import token in the URL hash, and a Lichess content script fills the PGN form and submits it in-page.

This avoids using the clipboard, avoids requiring a Lichess API token, avoids cross-origin POST failures from extension pages, and avoids matching the game through Chess.com's monthly archive API.

## Load the extension

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select this folder.

## Notes

- The extension is currently scoped to Chess.com game pages.
- Lichess imports created through this flow are public, matching the normal import page behavior.
- If Chrome already has a Lichess import tab open, this extension still opens a fresh `https://lichess.org/paste` tab for a predictable one-click flow.
