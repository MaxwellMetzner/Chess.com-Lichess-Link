"use strict";
(() => {
    const SELECTORS = {
        shareButtons: [
            'button[data-cy="sidebar-share-icon"]',
            '[data-cy="analysis-secondary-controls-menu-open-share"]',
            'button[aria-label="Share"]',
            'button[aria-label="Share game"]',
            'button.share-button-component.icon-share',
            'button.share-button-component.share',
            '#shareMenuButton'
        ],
        secondaryMenuButtons: [
            '.game-controls-secondary-more > button',
            '.game-controls-secondary-button > button',
            '[data-cy="analysis-secondary-controls-menu-open"]'
        ],
        shareModals: [
            '[data-cy="share-menu-modal"]',
            'dialog:has(.share-menu-content)',
            'dialog:has(.share-menu-tab-pgn-component)',
            '[role="dialog"]:has(textarea[aria-label="PGN"])',
            '[role="dialog"]:has(textarea[name="pgn"])'
        ],
        pgnTabs: [
            'button[data-cy="pgn-tab-button"]',
            '#tab-pgn',
            '#live_ShareMenuGlobalDialogDownloadButton',
            '#chessboard_ShareMenuGlobalDialogDownloadButton'
        ],
        pgnTextareas: [
            '[data-cy="share-menu-modal"] textarea[aria-label="PGN"]',
            '.share-menu-tab-pgn-textarea',
            '#live_ShareMenuPgnContentTextareaId',
            '#chessboard_ShareMenuPgnContentTextareaId',
            'textarea[name="pgn"]',
            'textarea[aria-label="PGN"]'
        ],
        modalCloseButtons: [
            '[data-cy="share-menu-modal"] button[aria-label="Close"]',
            '[data-cy="share-menu-modal"] button[aria-label="close"]',
            '[data-cy="modal-close-button"]',
            '.cc-close-button-component',
            '#live_ShareMenuGlobalDialogCloseButton',
            '#chessboard_ShareMenuGlobalDialogCloseButton',
            'button.ui_outside-close-component'
        ]
    };
    const FINISHED_RESULTS = new Set(['1-0', '0-1', '1/2-1/2']);
    const INTERACTION_TIMEOUT_MS = 5000;
    let lastReportedReady = null;
    let statusTimerId = null;
    function isRecord(value) {
        return typeof value === 'object' && value !== null;
    }
    function getErrorMessage(error, fallbackMessage) {
        if (error instanceof Error && error.message.trim()) {
            return error.message;
        }
        return fallbackMessage;
    }
    function isGetStatusRequest(message) {
        return isRecord(message) && message.type === 'GET_STATUS';
    }
    function isStartImportRequest(message) {
        return isRecord(message) && message.type === 'START_IMPORT';
    }
    function isOperationResponse(response) {
        return (isRecord(response) &&
            typeof response.ok === 'boolean' &&
            (response.error === undefined || typeof response.error === 'string'));
    }
    function isVisible(element) {
        if (!(element instanceof HTMLElement)) {
            return true;
        }
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden') {
            return false;
        }
        return element.getClientRects().length > 0;
    }
    function getControlLabel(element) {
        return [
            element.textContent,
            element.getAttribute('aria-label'),
            element.getAttribute('title'),
            element.getAttribute('data-cy')
        ]
            .filter((value) => typeof value === 'string')
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
    function findVisibleControl(selectors, root = document) {
        for (const selector of selectors) {
            try {
                for (const element of root.querySelectorAll(selector)) {
                    if (isVisible(element)) {
                        return element;
                    }
                }
            }
            catch {
                continue;
            }
        }
        return null;
    }
    function findSemanticControl(labelPattern, root = document) {
        const candidates = root.querySelectorAll('button, [role="button"], a[role="button"], [role="tab"]');
        for (const candidate of candidates) {
            if (isVisible(candidate) && labelPattern.test(getControlLabel(candidate))) {
                return candidate;
            }
        }
        return null;
    }
    function findShareButton() {
        return findVisibleControl(SELECTORS.shareButtons) ?? findSemanticControl(/^share(?: game)?$/i);
    }
    function findSecondaryMenuButton() {
        return findVisibleControl(SELECTORS.secondaryMenuButtons);
    }
    function findPgnTextarea() {
        for (const selector of SELECTORS.pgnTextareas) {
            for (const textarea of document.querySelectorAll(selector)) {
                if (isVisible(textarea)) {
                    return textarea;
                }
            }
        }
        return null;
    }
    function getBoardOrientation() {
        const boardSelectors = [
            'wc-chess-board',
            'chess-board',
            '[data-cy="chessboard"]',
            '.board'
        ];
        for (const selector of boardSelectors) {
            for (const board of document.querySelectorAll(selector)) {
                if (!isVisible(board)) {
                    continue;
                }
                const explicitOrientation = board.getAttribute('data-orientation') ?? board.getAttribute('orientation');
                if (board.classList.contains('flipped') ||
                    board.getAttribute('data-flipped') === 'true' ||
                    explicitOrientation?.toLowerCase() === 'black') {
                    return 'black';
                }
                return 'white';
            }
        }
        return 'white';
    }
    function findShareModal() {
        const explicitModal = findVisibleControl(SELECTORS.shareModals);
        if (explicitModal) {
            return explicitModal;
        }
        const pgnElement = findPgnTextarea() ?? findVisibleControl(SELECTORS.pgnTabs);
        return pgnElement?.closest('dialog, [role="dialog"], [class*="modal"]') ?? null;
    }
    function extractGameId(pathname = window.location.pathname) {
        const match = pathname.match(/\/(?:analysis\/)?game\/(?:[a-z-]+\/)?(\d+)/i);
        return match?.[1] ?? null;
    }
    function isReady() {
        return findPgnTextarea() !== null || findShareButton() !== null;
    }
    function wait(milliseconds) {
        return new Promise(resolve => {
            window.setTimeout(resolve, milliseconds);
        });
    }
    async function waitFor(getValue, timeoutMs = INTERACTION_TIMEOUT_MS) {
        const startTime = Date.now();
        while (Date.now() - startTime < timeoutMs) {
            const value = getValue();
            if (value !== null) {
                return value;
            }
            await wait(100);
        }
        return null;
    }
    function clickControl(element) {
        element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        element.click();
    }
    async function reportStatus(force = false) {
        const ready = isReady();
        if (!force && ready === lastReportedReady) {
            return;
        }
        lastReportedReady = ready;
        try {
            await chrome.runtime.sendMessage({ type: 'PAGE_STATUS', ready });
        }
        catch {
            return;
        }
    }
    function scheduleStatusReport() {
        if (statusTimerId !== null) {
            window.clearTimeout(statusTimerId);
        }
        statusTimerId = window.setTimeout(() => {
            void reportStatus();
        }, 150);
    }
    async function ensureShareModalOpen() {
        const existingModal = findShareModal();
        if (existingModal || findPgnTextarea()) {
            return { modal: existingModal, openedByExtension: false };
        }
        let shareButton = findShareButton();
        if (!shareButton) {
            const secondaryMenuButton = findSecondaryMenuButton();
            if (secondaryMenuButton) {
                clickControl(secondaryMenuButton);
                shareButton = await waitFor(findShareButton, 2000);
            }
        }
        if (!shareButton) {
            throw new Error('Share button was not found on this Chess.com game page.');
        }
        clickControl(shareButton);
        const modal = await waitFor(() => findShareModal() ?? findPgnTextarea());
        if (!modal) {
            throw new Error('Share dialog did not open.');
        }
        return {
            modal: modal instanceof HTMLTextAreaElement ? findShareModal() : modal,
            openedByExtension: true
        };
    }
    function findPgnTab(root = document) {
        return findVisibleControl(SELECTORS.pgnTabs, root) ?? findSemanticControl(/^pgn$/i, root);
    }
    function readTextareaValue(textarea) {
        return (textarea.value ||
            textarea.getAttribute('value') ||
            textarea.textContent ||
            '').trim();
    }
    function findPgnValue() {
        const textarea = findPgnTextarea();
        if (textarea) {
            const value = readTextareaValue(textarea);
            if (value) {
                return value;
            }
        }
        const attributeRoot = findShareModal() ?? document;
        for (const element of attributeRoot.querySelectorAll('[pgn], [data-pgn]')) {
            if (attributeRoot === document && !isVisible(element)) {
                continue;
            }
            const value = element.getAttribute('pgn') ?? element.getAttribute('data-pgn');
            if (value?.trim()) {
                return value.trim();
            }
        }
        return null;
    }
    async function ensurePgnVisible(modal) {
        if (findPgnValue()) {
            return;
        }
        const root = modal ?? document;
        const pgnTab = await waitFor(() => findPgnTab(root));
        if (!pgnTab) {
            throw new Error('PGN tab was not found in the Share dialog.');
        }
        if (pgnTab.getAttribute('aria-selected') !== 'true') {
            clickControl(pgnTab);
        }
        const pgn = await waitFor(findPgnValue);
        if (!pgn) {
            throw new Error('PGN text was not found in the Share dialog.');
        }
    }
    function getPgnFromCallbackPayload(value) {
        if (!isRecord(value) || !isRecord(value.game)) {
            return null;
        }
        return typeof value.game.pgn === 'string' && value.game.pgn.trim()
            ? value.game.pgn.trim()
            : null;
    }
    async function fetchPgnFromChessCom(gameId) {
        const pathKind = window.location.pathname.match(/\/game\/(live|daily)\//i)?.[1]?.toLowerCase();
        const gameKinds = pathKind
            ? [pathKind, ...['live', 'daily'].filter(kind => kind !== pathKind)]
            : ['live', 'daily'];
        for (const gameKind of gameKinds) {
            try {
                const response = await fetch(`/callback/${gameKind}/game/${encodeURIComponent(gameId)}`, {
                    credentials: 'include',
                    headers: { Accept: 'application/json' }
                });
                if (!response.ok) {
                    continue;
                }
                const pgn = getPgnFromCallbackPayload(await response.json());
                if (pgn) {
                    return pgn;
                }
            }
            catch {
                continue;
            }
        }
        throw new Error('Chess.com did not provide a PGN for this game.');
    }
    function validateCompletedPgn(pgn) {
        const normalizedPgn = pgn.replace(/\r\n?/g, '\n').trim();
        const result = normalizedPgn.match(/^\[Result\s+"([^"]+)"\]\s*$/im)?.[1];
        if (!result || !FINISHED_RESULTS.has(result)) {
            throw new Error('This game is not finished yet. Lichess analysis is only available after the game ends.');
        }
        return normalizedPgn;
    }
    async function extractPgn() {
        const existingPgn = findPgnValue();
        if (existingPgn) {
            return validateCompletedPgn(existingPgn);
        }
        let openedByExtension = false;
        try {
            const shareDialog = await ensureShareModalOpen();
            openedByExtension = shareDialog.openedByExtension;
            await ensurePgnVisible(shareDialog.modal);
            const pgn = findPgnValue();
            if (!pgn) {
                throw new Error('PGN text was empty.');
            }
            return validateCompletedPgn(pgn);
        }
        catch (shareError) {
            const gameId = extractGameId();
            if (!gameId) {
                throw shareError;
            }
            return validateCompletedPgn(await fetchPgnFromChessCom(gameId));
        }
        finally {
            if (openedByExtension) {
                await closeShareModal();
            }
        }
    }
    async function closeShareModal() {
        const modal = findShareModal();
        if (!modal && !findPgnTextarea()) {
            return;
        }
        const root = modal ?? document;
        for (const selector of SELECTORS.modalCloseButtons) {
            const closeButton = root.querySelector(selector) ?? document.querySelector(selector);
            if (!closeButton || !isVisible(closeButton)) {
                continue;
            }
            clickControl(closeButton);
            await wait(100);
            if (!findShareModal()) {
                return;
            }
        }
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', bubbles: true }));
        await wait(100);
    }
    async function startImport() {
        const orientation = getBoardOrientation();
        const pgn = await extractPgn();
        const response = await chrome.runtime.sendMessage({
            type: 'OPEN_LICHESS_IMPORT',
            pgn,
            sourceUrl: window.location.href,
            orientation
        });
        if (isOperationResponse(response) && response.ok) {
            return;
        }
        const errorMessage = isOperationResponse(response) && response.error
            ? response.error
            : 'Could not open the Lichess import page.';
        throw new Error(errorMessage);
    }
    async function handleMessage(message, sendResponse) {
        if (isGetStatusRequest(message)) {
            sendResponse({ ready: isReady() });
            return;
        }
        if (isStartImportRequest(message)) {
            await startImport();
            sendResponse({ ok: true });
            return;
        }
        sendResponse({ ok: false, error: 'Unsupported message.' });
    }
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        void handleMessage(message, sendResponse).catch(error => {
            sendResponse({ ok: false, error: getErrorMessage(error, 'Unknown error') });
        });
        return true;
    });
    const observer = new MutationObserver(() => {
        scheduleStatusReport();
    });
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'aria-hidden', 'aria-selected']
    });
    void reportStatus(true);
})();
