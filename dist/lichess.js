"use strict";
(() => {
    const HASH_PREFIX = '#chesscom-import=';
    const PGN_TEXTAREA_SELECTORS = [
        'textarea[name="pgn"]',
        'textarea[aria-label*="PGN" i]',
        'main textarea'
    ];
    function isRecord(value) {
        return typeof value === 'object' && value !== null;
    }
    function isPendingImport(value) {
        return (isRecord(value) &&
            typeof value.pgn === 'string' &&
            typeof value.sourceUrl === 'string' &&
            typeof value.createdAt === 'number' &&
            (value.orientation === 'white' || value.orientation === 'black'));
    }
    function isGetPendingImportResponse(response) {
        if (!isRecord(response) || typeof response.ok !== 'boolean') {
            return false;
        }
        if (!response.ok) {
            return response.error === undefined || typeof response.error === 'string';
        }
        return response.pendingImport === null || isPendingImport(response.pendingImport);
    }
    function getImportId() {
        if (!window.location.hash.startsWith(HASH_PREFIX)) {
            return null;
        }
        return decodeURIComponent(window.location.hash.slice(HASH_PREFIX.length));
    }
    function wait(milliseconds) {
        return new Promise(resolve => {
            window.setTimeout(resolve, milliseconds);
        });
    }
    async function waitForPgnTextarea(timeoutMs = 5000) {
        const startTime = Date.now();
        while (Date.now() - startTime < timeoutMs) {
            for (const selector of PGN_TEXTAREA_SELECTORS) {
                const textarea = document.querySelector(selector);
                if (textarea) {
                    return textarea;
                }
            }
            await wait(100);
        }
        return null;
    }
    function findImportForm(textarea) {
        return (textarea.closest('form') ??
            Array.from(document.forms).find(form => form.contains(textarea)) ??
            null);
    }
    function findSubmitter(form) {
        const candidates = form.querySelectorAll('button[type="submit"], input[type="submit"]');
        for (const candidate of candidates) {
            const label = `${candidate.textContent ?? ''} ${candidate.value} ${candidate.getAttribute('aria-label') ?? ''}`;
            if (/import/i.test(label)) {
                return candidate;
            }
        }
        return candidates[0];
    }
    function setTextareaValue(textarea, value) {
        const valueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
        if (valueSetter) {
            valueSetter.call(textarea, value);
        }
        else {
            textarea.value = value;
        }
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
    }
    async function importPendingPgn() {
        try {
            const importId = getImportId();
            if (!importId) {
                return;
            }
            const textarea = await waitForPgnTextarea(5000);
            if (!textarea) {
                return;
            }
            const form = findImportForm(textarea);
            if (!form) {
                return;
            }
            const response = await chrome.runtime.sendMessage({
                type: 'GET_PENDING_IMPORT',
                importId
            });
            if (!isGetPendingImportResponse(response) || !response.ok || response.pendingImport === null) {
                return;
            }
            setTextareaValue(textarea, response.pendingImport.pgn);
            await chrome.runtime.sendMessage({
                type: 'CLEAR_PENDING_IMPORT',
                importId
            });
            window.history.replaceState({}, document.title, window.location.pathname);
            form.requestSubmit(findSubmitter(form));
        }
        catch {
            return;
        }
    }
    void importPendingPgn();
})();
