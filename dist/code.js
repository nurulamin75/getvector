var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const HISTORY_KEY = 'getvector_history';
const FAVORITES_KEY = 'getvector_favorites';
const COLLECTIONS_KEY = 'getvector_collections';
const LICENSE_KEY = 'getvector_license';
const LICENSE_CACHE_KEY = 'getvector_license_valid';
const USAGE_KEY = 'getvector_usage';
const MAX_HISTORY = 50;
const MAX_FAVORITES = 200;
const MAX_COLLECTIONS = 50;
const FREE_MONTHLY_LIMIT = 10;
const GUMROAD_ACCESS_TOKEN = 'ju15-behg_DFwTArswii9cXGn-lP2fR521T2Jf57VP4';
const GUMROAD_PRODUCT_ID = 'rat5DcAqF3YRI7DfmrlaCQ==';
const LICENSE_CACHE_TTL = 24 * 60 * 60 * 1000;
const CORS_PROXIES = [
    (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
];
let currentDragSvg = null;
figma.showUI(__html__, { width: 820, height: 600, themeColors: true });
function loadHistory() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const data = yield figma.clientStorage.getAsync(HISTORY_KEY);
            return Array.isArray(data) ? data : [];
        }
        catch (_a) {
            return [];
        }
    });
}
function saveHistory(history) {
    return __awaiter(this, void 0, void 0, function* () {
        yield figma.clientStorage.setAsync(HISTORY_KEY, history.slice(0, MAX_HISTORY));
    });
}
function sendHistoryToUI() {
    return __awaiter(this, void 0, void 0, function* () {
        figma.ui.postMessage({ type: 'history', entries: yield loadHistory() });
    });
}
function loadFavorites() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const data = yield figma.clientStorage.getAsync(FAVORITES_KEY);
            return Array.isArray(data) ? data : [];
        }
        catch (_a) {
            return [];
        }
    });
}
function saveFavorites(favs) {
    return __awaiter(this, void 0, void 0, function* () {
        yield figma.clientStorage.setAsync(FAVORITES_KEY, favs.slice(0, MAX_FAVORITES));
    });
}
function sendFavoritesToUI() {
    return __awaiter(this, void 0, void 0, function* () {
        figma.ui.postMessage({ type: 'favorites', items: yield loadFavorites() });
    });
}
function loadCollections() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const data = yield figma.clientStorage.getAsync(COLLECTIONS_KEY);
            return Array.isArray(data) ? data : [];
        }
        catch (_a) {
            return [];
        }
    });
}
function saveCollections(cols) {
    return __awaiter(this, void 0, void 0, function* () {
        yield figma.clientStorage.setAsync(COLLECTIONS_KEY, cols.slice(0, MAX_COLLECTIONS));
    });
}
function sendCollectionsToUI() {
    return __awaiter(this, void 0, void 0, function* () {
        figma.ui.postMessage({ type: 'collections', items: yield loadCollections() });
    });
}
function loadLicense() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            return (yield figma.clientStorage.getAsync(LICENSE_KEY)) || null;
        }
        catch (_a) {
            return null;
        }
    });
}
function saveLicense(key) {
    return __awaiter(this, void 0, void 0, function* () {
        if (key)
            yield figma.clientStorage.setAsync(LICENSE_KEY, key);
        else
            yield figma.clientStorage.deleteAsync(LICENSE_KEY);
    });
}
function loadLicenseCache() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            return (yield figma.clientStorage.getAsync(LICENSE_CACHE_KEY)) || null;
        }
        catch (_a) {
            return null;
        }
    });
}
function saveLicenseCache(cache) {
    return __awaiter(this, void 0, void 0, function* () {
        yield figma.clientStorage.setAsync(LICENSE_CACHE_KEY, cache);
    });
}
function loadUsage() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const data = yield figma.clientStorage.getAsync(USAGE_KEY);
            if (data) {
                const urls = Array.isArray(data.urls) ? data.urls : [];
                return { count: urls.length, urls };
            }
            return { count: 0, urls: [] };
        }
        catch (_a) {
            return { count: 0, urls: [] };
        }
    });
}
function saveUsage(usage) {
    return __awaiter(this, void 0, void 0, function* () {
        yield figma.clientStorage.setAsync(USAGE_KEY, usage);
    });
}
function incrementUsageForUrl(url) {
    return __awaiter(this, void 0, void 0, function* () {
        const usage = yield loadUsage();
        const normalised = url.replace(/\/+$/, '').toLowerCase();
        if (usage.urls.indexOf(normalised) !== -1)
            return { incremented: false, usage };
        usage.urls.push(normalised);
        usage.count = usage.urls.length;
        yield saveUsage(usage);
        return { incremented: true, usage };
    });
}
function validateSubscriber(email) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const url = 'https://api.gumroad.com/v2/products/' + GUMROAD_PRODUCT_ID + '/subscribers?access_token=' + GUMROAD_ACCESS_TOKEN + '&email=' + encodeURIComponent(email);
            const resp = yield fetch(url, { method: 'GET' });
            if (!resp.ok)
                return false;
            const data = yield resp.json();
            if (data.success !== true)
                return false;
            const subs = data.subscribers || [];
            return subs.some((s) => s.status === 'alive' || s.status === 'pending_cancellation');
        }
        catch (_a) {
            return false;
        }
    });
}
function isLicenseValid() {
    return __awaiter(this, void 0, void 0, function* () {
        const email = yield loadLicense();
        if (!email)
            return false;
        const cache = yield loadLicenseCache();
        if (cache && (Date.now() - cache.checkedAt) < LICENSE_CACHE_TTL)
            return cache.valid;
        const valid = yield validateSubscriber(email);
        yield saveLicenseCache({ valid, checkedAt: Date.now() });
        if (!valid)
            yield saveLicense(null);
        return valid;
    });
}
function canExtract(requestedUrls) {
    return __awaiter(this, void 0, void 0, function* () {
        const isPro = yield isLicenseValid();
        if (isPro) {
            return { allowed: true, isPro, usage: yield loadUsage() };
        }
        const usage = yield loadUsage();
        if (!requestedUrls || requestedUrls.length === 0) {
            return { allowed: usage.count < FREE_MONTHLY_LIMIT, isPro, usage };
        }
        const newUrls = requestedUrls.filter(u => usage.urls.indexOf(u.replace(/\/+$/, '').toLowerCase()) === -1);
        if (newUrls.length === 0)
            return { allowed: true, isPro, usage };
        return { allowed: usage.count + newUrls.length <= FREE_MONTHLY_LIMIT, isPro, usage };
    });
}
function sendLicenseStatusToUI() {
    return __awaiter(this, void 0, void 0, function* () {
        const key = yield loadLicense();
        const isPro = key ? yield isLicenseValid() : false;
        const usage = yield loadUsage();
        figma.ui.postMessage({
            type: 'license-status',
            isPro,
            hasKey: !!key,
            usage,
            limit: FREE_MONTHLY_LIMIT,
        });
    });
}
sendHistoryToUI();
sendFavoritesToUI();
sendCollectionsToUI();
sendLicenseStatusToUI();
function withTimeout(promise, ms) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timeout')), ms);
        promise
            .then(v => { clearTimeout(timer); resolve(v); })
            .catch(e => { clearTimeout(timer); reject(e); });
    });
}
function fetchWithProxy(url) {
    return __awaiter(this, void 0, void 0, function* () {
        const promises = CORS_PROXIES.map((build) => __awaiter(this, void 0, void 0, function* () {
            const resp = yield fetch(build(url));
            if (!resp.ok)
                throw new Error(`HTTP ${resp.status}`);
            return resp.text();
        }));
        return new Promise((resolve, reject) => {
            let remaining = promises.length;
            let lastErr = null;
            promises.forEach(p => {
                withTimeout(p, 15000)
                    .then(resolve)
                    .catch(e => { lastErr = e; if (--remaining === 0)
                    reject(new Error(`All proxies failed: ${lastErr === null || lastErr === void 0 ? void 0 : lastErr.message}`)); });
            });
        });
    });
}
function sanitizeSvg(raw) {
    let svg = raw.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    if (svg.includes('<svg') && !svg.includes('xmlns=')) {
        svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    return svg;
}
function applyColorOverride(svgData, color) {
    if (!color)
        return svgData;
    return svgData
        .replace(/fill="(?!none|url)[^"]*"/gi, `fill="${color}"`)
        .replace(/stroke="(?!none|url)[^"]*"/gi, `stroke="${color}"`);
}
function getSvgName(svg) {
    var _a, _b;
    if (svg.title && svg.title.length > 0 && !svg.title.startsWith('inline-svg-') && !svg.title.startsWith('symbol-') && !svg.title.startsWith('data-uri-') && !svg.title.startsWith('css-data-') && !svg.title.startsWith('script-svg-')) {
        return svg.title;
    }
    if (svg.url && !svg.url.startsWith('inline-') && !svg.url.startsWith('data:') && !svg.url.startsWith('symbol-') && !svg.url.startsWith('css-data-') && !svg.url.startsWith('script-svg-') && !svg.url.startsWith('style-data-') && !svg.url.startsWith('ext-css-data-')) {
        const filename = ((_b = (_a = svg.url.split('/').pop()) === null || _a === void 0 ? void 0 : _a.split('?')[0]) === null || _b === void 0 ? void 0 : _b.split('#')[0]) || '';
        if (filename.endsWith('.svg'))
            return filename.replace('.svg', '');
        if (filename)
            return filename;
    }
    return 'SVG';
}
function importSvgToFigma(svg, options) {
    return __awaiter(this, void 0, void 0, function* () {
        let raw;
        if (svg.isInline && svg.content) {
            raw = svg.content;
        }
        else {
            raw = yield fetchWithProxy(svg.url);
        }
        let svgData = sanitizeSvg(raw);
        if (options === null || options === void 0 ? void 0 : options.colorOverride)
            svgData = applyColorOverride(svgData, options.colorOverride);
        if (!svgData.toLowerCase().includes('<svg'))
            throw new Error('Content is not a valid SVG');
        const node = figma.createNodeFromSvg(svgData);
        node.name = getSvgName(svg);
        if (options === null || options === void 0 ? void 0 : options.asComponent) {
            const component = figma.createComponent();
            component.name = node.name;
            component.resizeWithoutConstraints(node.width, node.height);
            for (const child of [...node.children])
                component.appendChild(child);
            node.remove();
            return component;
        }
        return node;
    });
}
figma.ui.onmessage = (msg) => __awaiter(this, void 0, void 0, function* () {
    switch (msg.type) {
        case 'import-svg': {
            try {
                figma.notify('Importing SVG…');
                const node = yield importSvgToFigma(msg.svg, {
                    asComponent: msg.asComponent,
                    colorOverride: msg.colorOverride,
                });
                if (!currentDragSvg) {
                    figma.currentPage.selection = [node];
                    figma.viewport.scrollAndZoomIntoView([node]);
                    figma.notify('SVG imported!');
                }
            }
            catch (err) {
                figma.notify(`Import failed: ${err.message}`, { error: true });
            }
            break;
        }
        case 'import-all-svgs':
        case 'import-selected-svgs': {
            const svgs = msg.svgs;
            const layout = msg.layout || 'grid';
            const spacing = msg.spacing || 20;
            const opts = {
                asComponent: msg.asComponent || false,
                colorOverride: msg.colorOverride || '',
            };
            let imported = 0;
            figma.notify(`Importing ${svgs.length} SVGs…`);
            const nodes = [];
            for (const svg of svgs) {
                try {
                    nodes.push(yield importSvgToFigma(svg, opts));
                    imported++;
                }
                catch (_a) { }
            }
            const cols = Math.ceil(Math.sqrt(nodes.length));
            nodes.forEach((node, i) => {
                if (layout === 'horizontal') {
                    node.x = i * (120 + spacing);
                    node.y = 0;
                }
                else if (layout === 'vertical') {
                    node.x = 0;
                    node.y = i * (120 + spacing);
                }
                else {
                    node.x = (i % cols) * (120 + spacing);
                    node.y = Math.floor(i / cols) * (120 + spacing);
                }
            });
            if (nodes.length > 0) {
                figma.currentPage.selection = nodes;
                figma.viewport.scrollAndZoomIntoView(nodes);
            }
            figma.notify(`Imported ${imported} of ${svgs.length} SVGs`);
            figma.ui.postMessage({ type: 'import-all-done' });
            break;
        }
        case 'save-history': {
            try {
                const history = yield loadHistory();
                const entry = msg.entry;
                const idx = history.findIndex(h => h.url === entry.url);
                if (idx !== -1)
                    history.splice(idx, 1);
                history.unshift(entry);
                yield saveHistory(history);
                yield sendHistoryToUI();
                const isPro = yield isLicenseValid();
                if (!isPro) {
                    yield incrementUsageForUrl(entry.url);
                    yield sendLicenseStatusToUI();
                }
            }
            catch (err) {
                console.error('save-history error:', err);
            }
            break;
        }
        case 'delete-history': {
            try {
                yield saveHistory((yield loadHistory()).filter(h => h.url !== msg.url));
                yield sendHistoryToUI();
            }
            catch (err) {
                console.error('delete-history error:', err);
            }
            break;
        }
        case 'clear-history': {
            try {
                yield saveHistory([]);
                yield sendHistoryToUI();
            }
            catch (err) {
                console.error('clear-history error:', err);
            }
            break;
        }
        case 'toggle-favorite': {
            try {
                const favs = yield loadFavorites();
                const svg = msg.svg;
                const key = svg.url || (svg.content || '').substring(0, 100);
                const idx = favs.findIndex(f => (f.url || (f.content || '').substring(0, 100)) === key);
                if (idx !== -1)
                    favs.splice(idx, 1);
                else
                    favs.unshift(svg);
                yield saveFavorites(favs);
                yield sendFavoritesToUI();
            }
            catch (err) {
                console.error('toggle-favorite error:', err);
            }
            break;
        }
        case 'load-favorites': {
            yield sendFavoritesToUI();
            break;
        }
        case 'create-collection': {
            try {
                const cols = yield loadCollections();
                cols.unshift({ id: msg.id, name: msg.name, svgs: [], createdAt: Date.now() });
                yield saveCollections(cols);
                yield sendCollectionsToUI();
            }
            catch (err) {
                console.error('create-collection error:', err);
            }
            break;
        }
        case 'rename-collection': {
            try {
                const cols = yield loadCollections();
                const col = cols.find(c => c.id === msg.id);
                if (col) {
                    col.name = msg.name;
                    yield saveCollections(cols);
                    yield sendCollectionsToUI();
                }
            }
            catch (err) {
                console.error('rename-collection error:', err);
            }
            break;
        }
        case 'delete-collection': {
            try {
                yield saveCollections((yield loadCollections()).filter(c => c.id !== msg.id));
                yield sendCollectionsToUI();
            }
            catch (err) {
                console.error('delete-collection error:', err);
            }
            break;
        }
        case 'add-to-collection': {
            try {
                const cols = yield loadCollections();
                const col = cols.find(c => c.id === msg.collectionId);
                if (col) {
                    const svgs = msg.svgs;
                    for (const svg of svgs) {
                        const key = svg.url || (svg.content || '').substring(0, 100);
                        if (!col.svgs.some(s => (s.url || (s.content || '').substring(0, 100)) === key)) {
                            col.svgs.push(svg);
                        }
                    }
                    yield saveCollections(cols);
                    yield sendCollectionsToUI();
                }
            }
            catch (err) {
                console.error('add-to-collection error:', err);
            }
            break;
        }
        case 'remove-from-collection': {
            try {
                const cols = yield loadCollections();
                const col = cols.find(c => c.id === msg.collectionId);
                if (col) {
                    const key = msg.svg.url || (msg.svg.content || '').substring(0, 100);
                    col.svgs = col.svgs.filter(s => (s.url || (s.content || '').substring(0, 100)) !== key);
                    yield saveCollections(cols);
                    yield sendCollectionsToUI();
                }
            }
            catch (err) {
                console.error('remove-from-collection error:', err);
            }
            break;
        }
        case 'load-collections': {
            yield sendCollectionsToUI();
            break;
        }
        case 'activate-license': {
            try {
                const email = (msg.key || '').trim().toLowerCase();
                if (!email) {
                    figma.ui.postMessage({ type: 'license-result', success: false, error: 'Please enter your email' });
                    break;
                }
                const valid = yield validateSubscriber(email);
                if (valid) {
                    yield saveLicense(email);
                    yield saveLicenseCache({ valid: true, checkedAt: Date.now() });
                    figma.notify('Pro activated!');
                    figma.ui.postMessage({ type: 'license-result', success: true });
                }
                else {
                    figma.ui.postMessage({ type: 'license-result', success: false, error: 'No active subscription found for this email' });
                }
                yield sendLicenseStatusToUI();
            }
            catch (err) {
                figma.ui.postMessage({ type: 'license-result', success: false, error: err.message });
            }
            break;
        }
        case 'deactivate-license': {
            yield saveLicense(null);
            yield saveLicenseCache({ valid: false, checkedAt: 0 });
            figma.notify('License deactivated');
            yield sendLicenseStatusToUI();
            break;
        }
        case 'check-usage': {
            const result = yield canExtract(msg.urls);
            figma.ui.postMessage(Object.assign(Object.assign({ type: 'usage-check' }, result), { limit: FREE_MONTHLY_LIMIT }));
            break;
        }
        case 'load-license-status': {
            yield sendLicenseStatusToUI();
            break;
        }
        case 'drag-svg-start': {
            currentDragSvg = msg.svg;
            break;
        }
        case 'drag-svg-end': {
            currentDragSvg = null;
            break;
        }
    }
});
figma.on('drop', (event) => __awaiter(this, void 0, void 0, function* () {
    if (!currentDragSvg)
        return;
    const svg = currentDragSvg;
    currentDragSvg = null;
    try {
        const node = yield importSvgToFigma(svg);
        node.x = event.absoluteX - node.width / 2;
        node.y = event.absoluteY - node.height / 2;
        figma.currentPage.selection = [node];
        figma.viewport.scrollAndZoomIntoView([node]);
        figma.notify('SVG added to canvas!');
    }
    catch (_a) {
        figma.notify('Failed to drop SVG', { error: true });
    }
    return false;
}));
//# sourceMappingURL=code.js.map