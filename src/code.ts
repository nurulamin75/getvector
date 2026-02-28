interface SVGInfo {
  url: string;
  sourceUrl: string;
  isInline: boolean;
  content?: string;
  title?: string;
  width?: number;
  height?: number;
}

interface HistoryEntry {
  url: string;
  domain: string;
  svgCount: number;
  timestamp: number;
}

interface Collection {
  id: string;
  name: string;
  svgs: SVGInfo[];
  createdAt: number;
}

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

interface UsageData {
  count: number;
  urls: string[];
}

interface LicenseCache {
  valid: boolean;
  checkedAt: number;
}

const CORS_PROXIES = [
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
];

let currentDragSvg: SVGInfo | null = null;

figma.showUI(__html__, { width: 820, height: 600, themeColors: true });

async function loadHistory(): Promise<HistoryEntry[]> {
  try {
    const data = await figma.clientStorage.getAsync(HISTORY_KEY);
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

async function saveHistory(history: HistoryEntry[]): Promise<void> {
  await figma.clientStorage.setAsync(HISTORY_KEY, history.slice(0, MAX_HISTORY));
}

async function sendHistoryToUI(): Promise<void> {
  figma.ui.postMessage({ type: 'history', entries: await loadHistory() });
}

async function loadFavorites(): Promise<SVGInfo[]> {
  try {
    const data = await figma.clientStorage.getAsync(FAVORITES_KEY);
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

async function saveFavorites(favs: SVGInfo[]): Promise<void> {
  await figma.clientStorage.setAsync(FAVORITES_KEY, favs.slice(0, MAX_FAVORITES));
}

async function sendFavoritesToUI(): Promise<void> {
  figma.ui.postMessage({ type: 'favorites', items: await loadFavorites() });
}

async function loadCollections(): Promise<Collection[]> {
  try {
    const data = await figma.clientStorage.getAsync(COLLECTIONS_KEY);
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

async function saveCollections(cols: Collection[]): Promise<void> {
  await figma.clientStorage.setAsync(COLLECTIONS_KEY, cols.slice(0, MAX_COLLECTIONS));
}

async function sendCollectionsToUI(): Promise<void> {
  figma.ui.postMessage({ type: 'collections', items: await loadCollections() });
}

async function loadLicense(): Promise<string | null> {
  try {
    return (await figma.clientStorage.getAsync(LICENSE_KEY)) || null;
  } catch { return null; }
}

async function saveLicense(key: string | null): Promise<void> {
  if (key) await figma.clientStorage.setAsync(LICENSE_KEY, key);
  else await figma.clientStorage.deleteAsync(LICENSE_KEY);
}

async function loadLicenseCache(): Promise<LicenseCache | null> {
  try {
    return (await figma.clientStorage.getAsync(LICENSE_CACHE_KEY)) || null;
  } catch { return null; }
}

async function saveLicenseCache(cache: LicenseCache): Promise<void> {
  await figma.clientStorage.setAsync(LICENSE_CACHE_KEY, cache);
}

async function loadUsage(): Promise<UsageData> {
  try {
    const data = await figma.clientStorage.getAsync(USAGE_KEY);
    if (data) {
      const urls: string[] = Array.isArray(data.urls) ? data.urls : [];
      return { count: urls.length, urls };
    }
    return { count: 0, urls: [] };
  } catch { return { count: 0, urls: [] }; }
}

async function saveUsage(usage: UsageData): Promise<void> {
  await figma.clientStorage.setAsync(USAGE_KEY, usage);
}

async function incrementUsageForUrl(url: string): Promise<{ incremented: boolean; usage: UsageData }> {
  const usage = await loadUsage();
  const normalised = url.replace(/\/+$/, '').toLowerCase();
  if (usage.urls.indexOf(normalised) !== -1) return { incremented: false, usage };
  usage.urls.push(normalised);
  usage.count = usage.urls.length;
  await saveUsage(usage);
  return { incremented: true, usage };
}

async function validateSubscriber(email: string): Promise<boolean> {
  try {
    const url = 'https://api.gumroad.com/v2/products/' + GUMROAD_PRODUCT_ID + '/subscribers?access_token=' + GUMROAD_ACCESS_TOKEN + '&email=' + encodeURIComponent(email);
    const resp = await fetch(url, { method: 'GET' });
    if (!resp.ok) return false;
    const data = await resp.json();
    if (data.success !== true) return false;
    const subs: any[] = data.subscribers || [];
    return subs.some((s: any) => s.status === 'alive' || s.status === 'pending_cancellation');
  } catch {
    return false;
  }
}

async function isLicenseValid(): Promise<boolean> {
  const email = await loadLicense();
  if (!email) return false;

  const cache = await loadLicenseCache();
  if (cache && (Date.now() - cache.checkedAt) < LICENSE_CACHE_TTL) return cache.valid;

  const valid = await validateSubscriber(email);
  await saveLicenseCache({ valid, checkedAt: Date.now() });
  if (!valid) await saveLicense(null);
  return valid;
}

async function canExtract(requestedUrls?: string[]): Promise<{ allowed: boolean; isPro: boolean; usage: UsageData }> {
  const isPro = await isLicenseValid();
  if (isPro) { return { allowed: true, isPro, usage: await loadUsage() }; }
  const usage = await loadUsage();
  if (!requestedUrls || requestedUrls.length === 0) {
    return { allowed: usage.count < FREE_MONTHLY_LIMIT, isPro, usage };
  }
  const newUrls = requestedUrls.filter(u => usage.urls.indexOf(u.replace(/\/+$/, '').toLowerCase()) === -1);
  if (newUrls.length === 0) return { allowed: true, isPro, usage };
  return { allowed: usage.count + newUrls.length <= FREE_MONTHLY_LIMIT, isPro, usage };
}

async function sendLicenseStatusToUI(): Promise<void> {
  const key = await loadLicense();
  const isPro = key ? await isLicenseValid() : false;
  const usage = await loadUsage();
  figma.ui.postMessage({
    type: 'license-status',
    isPro,
    hasKey: !!key,
    usage,
    limit: FREE_MONTHLY_LIMIT,
  });
}

sendHistoryToUI();
sendFavoritesToUI();
sendCollectionsToUI();
sendLicenseStatusToUI();

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout')), ms);
    promise
      .then(v => { clearTimeout(timer); resolve(v); })
      .catch(e => { clearTimeout(timer); reject(e); });
  });
}

async function fetchWithProxy(url: string): Promise<string> {
  const promises = CORS_PROXIES.map(async (build) => {
    const resp = await fetch(build(url));
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp.text();
  });
  return new Promise<string>((resolve, reject) => {
    let remaining = promises.length;
    let lastErr: Error | null = null;
    promises.forEach(p => {
      withTimeout(p, 15000)
        .then(resolve)
        .catch(e => { lastErr = e; if (--remaining === 0) reject(new Error(`All proxies failed: ${lastErr?.message}`)); });
    });
  });
}

function sanitizeSvg(raw: string): string {
  let svg = raw.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  if (svg.includes('<svg') && !svg.includes('xmlns=')) {
    svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  return svg;
}

function applyColorOverride(svgData: string, color: string): string {
  if (!color) return svgData;
  return svgData
    .replace(/fill="(?!none|url)[^"]*"/gi, `fill="${color}"`)
    .replace(/stroke="(?!none|url)[^"]*"/gi, `stroke="${color}"`);
}

function getSvgName(svg: SVGInfo): string {
  if (svg.title && svg.title.length > 0 && !svg.title.startsWith('inline-svg-') && !svg.title.startsWith('symbol-') && !svg.title.startsWith('data-uri-') && !svg.title.startsWith('css-data-') && !svg.title.startsWith('script-svg-')) {
    return svg.title;
  }
  if (svg.url && !svg.url.startsWith('inline-') && !svg.url.startsWith('data:') && !svg.url.startsWith('symbol-') && !svg.url.startsWith('css-data-') && !svg.url.startsWith('script-svg-') && !svg.url.startsWith('style-data-') && !svg.url.startsWith('ext-css-data-')) {
    const filename = svg.url.split('/').pop()?.split('?')[0]?.split('#')[0] || '';
    if (filename.endsWith('.svg')) return filename.replace('.svg', '');
    if (filename) return filename;
  }
  return 'SVG';
}

interface ImportOptions {
  asComponent?: boolean;
  colorOverride?: string;
}

async function importSvgToFigma(svg: SVGInfo, options?: ImportOptions): Promise<SceneNode> {
  let raw: string;
  if (svg.isInline && svg.content) {
    raw = svg.content;
  } else {
    raw = await fetchWithProxy(svg.url);
  }

  let svgData = sanitizeSvg(raw);
  if (options?.colorOverride) svgData = applyColorOverride(svgData, options.colorOverride);
  if (!svgData.toLowerCase().includes('<svg')) throw new Error('Content is not a valid SVG');

  const node = figma.createNodeFromSvg(svgData);
  node.name = getSvgName(svg);

  if (options?.asComponent) {
    const component = figma.createComponent();
    component.name = node.name;
    component.resizeWithoutConstraints(node.width, node.height);
    for (const child of [...node.children]) component.appendChild(child);
    node.remove();
    return component;
  }

  return node;
}

figma.ui.onmessage = async (msg: any) => {
  switch (msg.type) {
    case 'import-svg': {
      try {
        figma.notify('Importing SVG…');
        const node = await importSvgToFigma(msg.svg as SVGInfo, {
          asComponent: msg.asComponent,
          colorOverride: msg.colorOverride,
        });
        if (!currentDragSvg) {
          figma.currentPage.selection = [node];
          figma.viewport.scrollAndZoomIntoView([node]);
          figma.notify('SVG imported!');
        }
      } catch (err) {
        figma.notify(`Import failed: ${(err as Error).message}`, { error: true });
      }
      break;
    }

    case 'import-all-svgs':
    case 'import-selected-svgs': {
      const svgs = msg.svgs as SVGInfo[];
      const layout: string = msg.layout || 'grid';
      const spacing: number = msg.spacing || 20;
      const opts: ImportOptions = {
        asComponent: msg.asComponent || false,
        colorOverride: msg.colorOverride || '',
      };

      let imported = 0;
      figma.notify(`Importing ${svgs.length} SVGs…`);
      const nodes: SceneNode[] = [];

      for (const svg of svgs) {
        try {
          nodes.push(await importSvgToFigma(svg, opts));
          imported++;
        } catch {}
      }

      const cols = Math.ceil(Math.sqrt(nodes.length));
      nodes.forEach((node, i) => {
        if (layout === 'horizontal') {
          node.x = i * (120 + spacing);
          node.y = 0;
        } else if (layout === 'vertical') {
          node.x = 0;
          node.y = i * (120 + spacing);
        } else {
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
        const history = await loadHistory();
        const entry: HistoryEntry = msg.entry;
        const idx = history.findIndex(h => h.url === entry.url);
        if (idx !== -1) history.splice(idx, 1);
        history.unshift(entry);
        await saveHistory(history);
        await sendHistoryToUI();

        const isPro = await isLicenseValid();
        if (!isPro) {
          await incrementUsageForUrl(entry.url);
          await sendLicenseStatusToUI();
        }
      } catch (err) { console.error('save-history error:', err); }
      break;
    }

    case 'delete-history': {
      try {
        await saveHistory((await loadHistory()).filter(h => h.url !== msg.url));
        await sendHistoryToUI();
      } catch (err) { console.error('delete-history error:', err); }
      break;
    }

    case 'clear-history': {
      try {
        await saveHistory([]);
        await sendHistoryToUI();
      } catch (err) { console.error('clear-history error:', err); }
      break;
    }

    case 'toggle-favorite': {
      try {
        const favs = await loadFavorites();
        const svg = msg.svg as SVGInfo;
        const key = svg.url || (svg.content || '').substring(0, 100);
        const idx = favs.findIndex(f => (f.url || (f.content || '').substring(0, 100)) === key);
        if (idx !== -1) favs.splice(idx, 1);
        else favs.unshift(svg);
        await saveFavorites(favs);
        await sendFavoritesToUI();
      } catch (err) { console.error('toggle-favorite error:', err); }
      break;
    }

    case 'load-favorites': {
      await sendFavoritesToUI();
      break;
    }

    case 'create-collection': {
      try {
        const cols = await loadCollections();
        cols.unshift({ id: msg.id, name: msg.name, svgs: [], createdAt: Date.now() });
        await saveCollections(cols);
        await sendCollectionsToUI();
      } catch (err) { console.error('create-collection error:', err); }
      break;
    }

    case 'rename-collection': {
      try {
        const cols = await loadCollections();
        const col = cols.find(c => c.id === msg.id);
        if (col) { col.name = msg.name; await saveCollections(cols); await sendCollectionsToUI(); }
      } catch (err) { console.error('rename-collection error:', err); }
      break;
    }

    case 'delete-collection': {
      try {
        await saveCollections((await loadCollections()).filter(c => c.id !== msg.id));
        await sendCollectionsToUI();
      } catch (err) { console.error('delete-collection error:', err); }
      break;
    }

    case 'add-to-collection': {
      try {
        const cols = await loadCollections();
        const col = cols.find(c => c.id === msg.collectionId);
        if (col) {
          const svgs = msg.svgs as SVGInfo[];
          for (const svg of svgs) {
            const key = svg.url || (svg.content || '').substring(0, 100);
            if (!col.svgs.some(s => (s.url || (s.content || '').substring(0, 100)) === key)) {
              col.svgs.push(svg);
            }
          }
          await saveCollections(cols);
          await sendCollectionsToUI();
        }
      } catch (err) { console.error('add-to-collection error:', err); }
      break;
    }

    case 'remove-from-collection': {
      try {
        const cols = await loadCollections();
        const col = cols.find(c => c.id === msg.collectionId);
        if (col) {
          const key = (msg.svg as SVGInfo).url || ((msg.svg as SVGInfo).content || '').substring(0, 100);
          col.svgs = col.svgs.filter(s => (s.url || (s.content || '').substring(0, 100)) !== key);
          await saveCollections(cols);
          await sendCollectionsToUI();
        }
      } catch (err) { console.error('remove-from-collection error:', err); }
      break;
    }

    case 'load-collections': {
      await sendCollectionsToUI();
      break;
    }

    case 'activate-license': {
      try {
        const email = (msg.key || '').trim().toLowerCase();
        if (!email) { figma.ui.postMessage({ type: 'license-result', success: false, error: 'Please enter your email' }); break; }
        const valid = await validateSubscriber(email);
        if (valid) {
          await saveLicense(email);
          await saveLicenseCache({ valid: true, checkedAt: Date.now() });
          figma.notify('Pro activated!');
          figma.ui.postMessage({ type: 'license-result', success: true });
        } else {
          figma.ui.postMessage({ type: 'license-result', success: false, error: 'No active subscription found for this email' });
        }
        await sendLicenseStatusToUI();
      } catch (err) {
        figma.ui.postMessage({ type: 'license-result', success: false, error: (err as Error).message });
      }
      break;
    }

    case 'deactivate-license': {
      await saveLicense(null);
      await saveLicenseCache({ valid: false, checkedAt: 0 });
      figma.notify('License deactivated');
      await sendLicenseStatusToUI();
      break;
    }

    case 'check-usage': {
      const result = await canExtract(msg.urls);
      figma.ui.postMessage({ type: 'usage-check', ...result, limit: FREE_MONTHLY_LIMIT });
      break;
    }

    case 'load-license-status': {
      await sendLicenseStatusToUI();
      break;
    }

    case 'notify': {
      figma.notify(msg.msg || '');
      break;    
    }

    case 'drag-svg-start': {
      currentDragSvg = msg.svg as SVGInfo;
      break;
    }

    case 'drag-svg-end': {
      currentDragSvg = null;
      break;
    }
  }
};

(figma as any).on('drop', async (event: any) => {
  if (!currentDragSvg) return;
  const svg = currentDragSvg;
  currentDragSvg = null;

  try {
    const node = await importSvgToFigma(svg);
    node.x = event.absoluteX - node.width / 2;
    node.y = event.absoluteY - node.height / 2;
    figma.currentPage.selection = [node];
    figma.viewport.scrollAndZoomIntoView([node]);
    figma.notify('SVG added to canvas!');
  } catch {
    figma.notify('Failed to drop SVG', { error: true });
  }

  return false;
});
