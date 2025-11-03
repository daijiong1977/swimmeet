const DEFAULT_PDF_PROXY_URL = 'https://corsproxy.io/?{{url}}';

declare const pdfjsLib: any;

type ProxyCandidate = {
  template: string;
  label: string;
};

const buildProxiedUrl = (template: string, targetUrl: string): string => {
  if (!template) {
    return targetUrl;
  }
  if (template.includes('{{url}}')) {
    return template.replace('{{url}}', encodeURIComponent(targetUrl));
  }
  if (template.endsWith('=')) {
    return `${template}${encodeURIComponent(targetUrl)}`;
  }
  if (template.endsWith('/')) {
    return `${template}${targetUrl}`;
  }
  if (template.includes('?')) {
    const hasUrlParam = /[?&]url=/i.test(template);
    if (hasUrlParam) {
      return `${template}${encodeURIComponent(targetUrl)}`;
    }
    const suffix = template.endsWith('?') || template.endsWith('&') ? '' : '&';
    return `${template}${suffix}url=${encodeURIComponent(targetUrl)}`;
  }
  return `${template}${encodeURIComponent(targetUrl)}`;
};

const createProxyCandidates = (
  proxyUrl?: string,
  proxyApiKey?: string,
): ProxyCandidate[] => {
  const tried = new Set<string>();
  const candidates: ProxyCandidate[] = [];

  const addCandidate = (template: string, label: string) => {
    const trimmed = template.trim();
    if (!trimmed || tried.has(trimmed)) {
      return;
    }
    tried.add(trimmed);
    candidates.push({ template: trimmed, label });
  };

  if (proxyUrl) {
    addCandidate(proxyUrl, 'Custom proxy');
  }
  addCandidate(DEFAULT_PDF_PROXY_URL, 'CORSProxy.io');
  addCandidate('https://api.allorigins.win/raw?url={{url}}', 'AllOrigins (backup)');
  if (proxyApiKey && proxyApiKey.trim()) {
    addCandidate('https://proxy.cors.sh/{{url}}', 'proxy.cors.sh');
  }

  return candidates;
};

export const fetchPdfFromUrl = async (
  url: string,
  proxyUrl?: string,
  proxyApiKey?: string,
): Promise<File> => {
  const candidates = createProxyCandidates(proxyUrl, proxyApiKey);
  const errors: string[] = [];
  for (const candidate of candidates) {
    const proxiedUrl = buildProxiedUrl(candidate.template, url);
    try {
      const response = await fetch(proxiedUrl, {
        method: 'GET',
        headers:
          proxyApiKey && candidate.template.includes('proxy.cors.sh')
            ? { 'x-cors-api-key': proxyApiKey.trim() }
            : undefined,
      });
      if (!response.ok) {
        errors.push(`${candidate.label} responded with ${response.status}`);
        continue;
      }
      const blob = await response.blob();
      if (blob.type !== 'application/pdf') {
        errors.push(`${candidate.label} returned ${blob.type}`);
        continue;
      }
      return new File([blob], 'remote.pdf', { type: 'application/pdf' });
    } catch (err) {
      errors.push(
        `${candidate.label} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  throw new Error(
    `Unable to fetch PDF from URL. Attempts: ${errors.join('; ')}`,
  );
};

const ensurePdfJsAvailable = () => {
  if (typeof pdfjsLib === 'undefined' || !pdfjsLib?.getDocument) {
    throw new Error(
      'PDF.js is not available. Ensure pdfjsLib is loaded globally before using PDF extraction.',
    );
  }
};

export const convertPdfToImageFiles = async (pdfFile: File): Promise<File[]> => {
  ensurePdfJsAvailable();

  const images: File[] = [];
  const fileUrl = URL.createObjectURL(pdfFile);
  try {
    const pdf = await pdfjsLib.getDocument(fileUrl).promise;
    const numPages = pdf.numPages;
    for (let pageNumber = 1; pageNumber <= numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      if (!context) {
        continue;
      }
      await page.render({ canvasContext: context, viewport }).promise;
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.95),
      );
      if (blob) {
        images.push(new File([blob], `page_${pageNumber}.jpg`, { type: 'image/jpeg' }));
      }
    }
  } finally {
    URL.revokeObjectURL(fileUrl);
  }
  return images;
};

export { DEFAULT_PDF_PROXY_URL };
