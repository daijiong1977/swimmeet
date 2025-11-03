
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { SwimEvent, FilterOptions, RawSwimEvent, MeetInfo, MeetData, GeminiModel, SharePayload, PublishedLink, ShareableEvent, ShareStoragePreferences, ShareStorageMetadata, StoredShareData, ShareStorageTestState } from './types';
import { extractMeetDataFromImages } from './services/geminiService';
import FileUpload from './components/FileUpload';
import EventTable from './components/EventTable';
import EventFilters from './components/EventFilters';
import Spinner from './components/Spinner';
import MeetInfoDisplay from './components/MeetInfoDisplay';
import DataActions from './components/DataActions';
import ConfigPanel from './components/ConfigPanel';
import SheetEmbed from './components/SheetEmbed';
import PublishedLinks from './components/PublishedLinks';

const DEFAULT_PDF_PROXY_URL = 'https://api.allorigins.win/raw?url={{url}}';
const SHARE_VERSION = 1;
const PUBLISHED_LINKS_STORAGE_KEY = 'PUBLISHED_MEETS_V1';
const SHARE_STORAGE_PREFS_KEY = 'SHARE_STORAGE_PREFS_V1';
const DEFAULT_SHARE_STORAGE_PREFS: ShareStoragePreferences = {
  githubOwner: '',
  githubRepo: '',
  githubBranch: 'main',
  githubFolder: 'public/shares',
  githubToken: '',
};

const SHARE_TOKEN_PREFIX_LZ = 'lz:';
const SHARE_TOKEN_PREFIX_B64 = 'b64:';
const MAX_INLINE_SHARE_TOKEN_CHARS = 1800;

const base64Encode = (input: string): string => {
  if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
    return window.btoa(unescape(encodeURIComponent(input)));
  }
  if (typeof globalThis !== 'undefined') {
    const globalBuffer = (globalThis as any).Buffer;
    if (globalBuffer) {
      return globalBuffer.from(input, 'utf-8').toString('base64');
    }
  }
  return input;
};

const base64Decode = (input: string): string => {
  if (typeof window !== 'undefined' && typeof window.atob === 'function') {
    return decodeURIComponent(escape(window.atob(input)));
  }
  if (typeof globalThis !== 'undefined') {
    const globalBuffer = (globalThis as any).Buffer;
    if (globalBuffer) {
      return globalBuffer.from(input, 'base64').toString('utf-8');
    }
  }
  return input;
};

const encodeSharePayload = (payload: SharePayload): string => {
  const json = JSON.stringify(payload);
  const compressed = compressToEncodedURIComponent(json);
  if (compressed) {
    return `${SHARE_TOKEN_PREFIX_LZ}${compressed}`;
  }
  const fallback = base64Encode(json);
  return `${SHARE_TOKEN_PREFIX_B64}${fallback}`;
};

const decodeSharePayload = (token: string): SharePayload => {
  let json: string | null = null;

  if (token.startsWith(SHARE_TOKEN_PREFIX_LZ)) {
    const payload = decompressFromEncodedURIComponent(token.slice(SHARE_TOKEN_PREFIX_LZ.length));
    if (payload) {
      json = payload;
    }
  }

  if (!json) {
    const base64Token = token.startsWith(SHARE_TOKEN_PREFIX_B64)
      ? token.slice(SHARE_TOKEN_PREFIX_B64.length)
      : token;
    json = base64Decode(base64Token);
  }

  const parsed = JSON.parse(json) as SharePayload;
  return parsed;
};

const sanitizeFolder = (folder: string): string => {
  const trimmed = folder.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.replace(/^\/+/, '').replace(/\/+$/, '');
};

const buildStorageFilePath = (metadata: ShareStorageMetadata): string => {
  const folder = sanitizeFolder(metadata.path);
  return `${folder ? `${folder}/` : ''}${metadata.id}.json`;
};


// Declaration for pdf.js library loaded from CDN
declare const pdfjsLib: any;

const convertPdfToImageFiles = async (pdfFile: File): Promise<File[]> => {
  const images: File[] = [];
  const fileUrl = URL.createObjectURL(pdfFile);
  
  try {
    const pdf = await pdfjsLib.getDocument(fileUrl).promise;
    const numPages = pdf.numPages;

    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2.0 }); // Increased scale for better image quality
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      if (context) {
        await page.render({ canvasContext: context, viewport: viewport }).promise;
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95)); // High quality JPEG
        if (blob) {
          images.push(new File([blob], `page_${i}.jpg`, { type: 'image/jpeg' }));
        }
      }
    }
  } finally {
    URL.revokeObjectURL(fileUrl);
  }

  return images;
};

interface PdfProxyConfig {
  proxyUrl?: string;
  proxyApiKey?: string;
}

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

const fetchPdfFromUrl = async (url: string, config: PdfProxyConfig = {}): Promise<File> => {
  const { proxyUrl, proxyApiKey } = config;
  const seenTemplates = new Set<string>();
  const proxyCandidates = [] as Array<{ template: string; name: string }>;

  const addCandidate = (template: string, name: string) => {
    const trimmed = template.trim();
    if (!trimmed || seenTemplates.has(trimmed)) {
      return;
    }
    seenTemplates.add(trimmed);
    proxyCandidates.push({ template: trimmed, name });
  };

  if (proxyUrl) {
    addCandidate(proxyUrl, 'Custom proxy');
  }

  addCandidate(DEFAULT_PDF_PROXY_URL, 'AllOrigins');

  if (proxyApiKey && proxyApiKey.trim()) {
    addCandidate('https://proxy.cors.sh/{{url}}', 'proxy.cors.sh');
  }

  const errors: string[] = [];

  for (const candidate of proxyCandidates) {
    const proxiedUrl = buildProxiedUrl(candidate.template, url);
    try {
      const response = await fetch(proxiedUrl, {
        headers: proxyApiKey ? { 'x-cors-api-key': proxyApiKey } : undefined,
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-cache',
      });

      if (!response.ok) {
        errors.push(`${candidate.name}: ${response.status} ${response.statusText}`);
        continue;
      }

      const blob = await response.blob();

      if (blob.size === 0) {
        errors.push(`${candidate.name}: received empty response`);
        continue;
      }

      const contentType = response.headers.get('content-type') || blob.type;
      const pdfBlob = contentType && contentType.includes('pdf')
        ? blob
        : new Blob([blob], { type: 'application/pdf' });

      return new File([pdfBlob], 'downloaded_meet_announcement.pdf', { type: 'application/pdf' });
    } catch (error) {
      errors.push(`${candidate.name}: ${(error as Error).message}`);
    }
  }

  throw new Error(`Unable to download PDF via configured proxies. ${errors.join(' | ')}`);
};


const App: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [meetInfo, setMeetInfo] = useState<MeetInfo | null>(null);
  const [events, setEvents] = useState<SwimEvent[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('Processing...');
  const [error, setError] = useState<string | null>(null);
  
  const [apiKey, setApiKey] = useState<string>(() => {
    if (typeof window === 'undefined') {
      return '';
    }
    return localStorage.getItem('GEMINI_API_KEY') || sessionStorage.getItem('GEMINI_API_KEY') || '';
  });
  const [model, setModel] = useState<GeminiModel>('gemini-2.5-flash');
  const [googleSheetUrl, setGoogleSheetUrl] = useState<string>('');

  const [isSharedView, setIsSharedView] = useState<boolean>(false);
  const [sharedError, setSharedError] = useState<string | null>(null);
  const [shareMetadata, setShareMetadata] = useState<{ generatedAt: string } | null>(null);
  const [publishResult, setPublishResult] = useState<{ url: string; copied: boolean } | null>(null);
  const [publishedLinks, setPublishedLinks] = useState<PublishedLink[]>(() => {
    if (typeof window === 'undefined') {
      return [];
    }
    try {
      const stored = localStorage.getItem(PUBLISHED_LINKS_STORAGE_KEY);
      if (!stored) {
        return [];
      }
      const parsed = JSON.parse(stored) as PublishedLink[];
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.warn('Failed to parse published links from storage:', err);
      return [];
    }
  });

  const [shareStoragePreferences, setShareStoragePreferences] = useState<ShareStoragePreferences>(() => {
    if (typeof window === 'undefined') {
      return DEFAULT_SHARE_STORAGE_PREFS;
    }
    try {
      const stored = localStorage.getItem(SHARE_STORAGE_PREFS_KEY);
      if (!stored) {
        return DEFAULT_SHARE_STORAGE_PREFS;
      }
      const parsed = JSON.parse(stored) as ShareStoragePreferences;
      return {
        ...DEFAULT_SHARE_STORAGE_PREFS,
        ...parsed,
      };
    } catch (err) {
      console.warn('Failed to parse share storage preferences:', err);
      return DEFAULT_SHARE_STORAGE_PREFS;
    }
  });

  const [shareStorageTestState, setShareStorageTestState] = useState<ShareStorageTestState>({
    status: 'idle',
    message: null,
  });

  const [filters, setFilters] = useState<FilterOptions>({
    day: 'all',
    ageGroup: 'all',
    stroke: 'all',
    distance: 'all',
    gender: 'all',
  });

  const [pdfProxyUrl, setPdfProxyUrl] = useState<string>(() => {
    if (typeof window === 'undefined') {
      return DEFAULT_PDF_PROXY_URL;
    }
    return localStorage.getItem('PDF_PROXY_URL') || DEFAULT_PDF_PROXY_URL;
  });

  const [pdfProxyApiKey, setPdfProxyApiKey] = useState<string>(() => {
    if (typeof window === 'undefined') {
      return '';
    }
    return localStorage.getItem('PDF_PROXY_API_KEY') || '';
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    if (apiKey) {
      sessionStorage.setItem('GEMINI_API_KEY', apiKey);
      localStorage.setItem('GEMINI_API_KEY', apiKey);
    } else {
      sessionStorage.removeItem('GEMINI_API_KEY');
      localStorage.removeItem('GEMINI_API_KEY');
    }
  }, [apiKey]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    if (pdfProxyUrl && pdfProxyUrl.trim() && pdfProxyUrl !== DEFAULT_PDF_PROXY_URL) {
      localStorage.setItem('PDF_PROXY_URL', pdfProxyUrl.trim());
    } else {
      localStorage.removeItem('PDF_PROXY_URL');
    }
  }, [pdfProxyUrl]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    if (pdfProxyApiKey && pdfProxyApiKey.trim()) {
      localStorage.setItem('PDF_PROXY_API_KEY', pdfProxyApiKey.trim());
    } else {
      localStorage.removeItem('PDF_PROXY_API_KEY');
    }
  }, [pdfProxyApiKey]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      localStorage.setItem(PUBLISHED_LINKS_STORAGE_KEY, JSON.stringify(publishedLinks));
    } catch (err) {
      console.warn('Failed to persist published links:', err);
    }
  }, [publishedLinks]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      localStorage.setItem(SHARE_STORAGE_PREFS_KEY, JSON.stringify(shareStoragePreferences));
    } catch (err) {
      console.warn('Failed to persist share storage preferences:', err);
    }
  }, [shareStoragePreferences]);

  useEffect(() => {
    setShareStorageTestState((prev) => (prev.status === 'idle' && prev.message === null)
      ? prev
      : { status: 'idle', message: null });
  }, [
    shareStoragePreferences.githubOwner,
    shareStoragePreferences.githubRepo,
    shareStoragePreferences.githubBranch,
    shareStoragePreferences.githubFolder,
    shareStoragePreferences.githubToken,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const sharedToken = params.get('shared');
    if (!sharedToken) {
      return;
    }
    let cancelled = false;

    const resolveSharedView = async () => {
      try {
        const payload = decodeSharePayload(sharedToken);
        if (payload.version && payload.version > SHARE_VERSION) {
          throw new Error('Unsupported share link version');
        }

        let resolvedMeetInfo = payload.meetInfo ?? null;
        let resolvedEvents = payload.events ?? null;
        let resolvedGeneratedAt = payload.generatedAt;

        if (payload.storage?.type === 'github') {
          const storage = payload.storage;
          const folder = sanitizeFolder(storage.path);
          const rawUrl = `https://raw.githubusercontent.com/${storage.owner}/${storage.repo}/${storage.branch}/${folder ? `${folder}/` : ''}${storage.id}.json`;
          const response = await fetch(rawUrl, { cache: 'no-cache' });
          if (!response.ok) {
            throw new Error(`Failed to fetch shared data (${response.status})`);
          }
          const remoteData = (await response.json()) as StoredShareData;
          resolvedMeetInfo = remoteData.meetInfo;
          resolvedEvents = remoteData.events;
          resolvedGeneratedAt = remoteData.generatedAt || resolvedGeneratedAt;
        }

        if (!resolvedMeetInfo || !Array.isArray(resolvedEvents)) {
          throw new Error('Malformed shared payload');
        }

        if (cancelled) {
          return;
        }

        setIsSharedView(true);
        setShareMetadata({ generatedAt: resolvedGeneratedAt });
        setSharedError(null);
        const restoredEvents: SwimEvent[] = resolvedEvents.map((event) => ({
          ...event,
          id: crypto.randomUUID(),
        }));
        setMeetInfo(resolvedMeetInfo);
        setEvents(restoredEvents);
        setFilters({ day: 'all', ageGroup: 'all', stroke: 'all', distance: 'all', gender: 'all' });
        setFiles([]);
        setPdfUrl('');
        setError(null);
      } catch (err) {
        console.error('Failed to load shared view:', err);
        if (!cancelled) {
          setSharedError('Unable to load this shared meet. The link may be invalid, corrupted, or stored data is unavailable.');
        }
      }
    };

    resolveSharedView();

    return () => {
      cancelled = true;
    };
  }, []);


  const handleFileChange = (selectedFiles: FileList | null) => {
    if (isSharedView) {
      return;
    }
    if (selectedFiles && selectedFiles.length > 0) {
      setFiles([selectedFiles[0]]);
      setPdfUrl('');
    } else {
      setFiles([]);
    }
  };
  
  const handleUrlChange = (url: string) => {
    if (isSharedView) {
      return;
    }
    setPdfUrl(url);
    if (url) {
        setFiles([]);
    }
  };

  const processRawEvents = (rawEvents: RawSwimEvent[]): SwimEvent[] => {
      const processedEvents: SwimEvent[] = [];
      rawEvents.forEach(event => {
        const baseEvent = { ...event, id: crypto.randomUUID() };
        if (event.eventNumber.includes('-')) {
          const [startStr, endStr] = event.eventNumber.split('-');
          const start = parseInt(startStr, 10);
          const end = parseInt(endStr, 10);

          if (!isNaN(start) && !isNaN(end) && end === start + 1 && start % 2 !== 0) {
            processedEvents.push({ ...baseEvent, id: crypto.randomUUID(), eventNumber: String(start), gender: 'Girls' });
            processedEvents.push({ ...baseEvent, id: crypto.randomUUID(), eventNumber: String(end), gender: 'Boys' });
          } else {
            processedEvents.push({ ...baseEvent, gender: 'Mixed' });
          }
        } else {
          const num = parseInt(event.eventNumber, 10);
          if (!isNaN(num)) {
            processedEvents.push({ ...baseEvent, gender: num % 2 !== 0 ? 'Girls' : 'Boys' });
          } else {
            processedEvents.push({ ...baseEvent, gender: 'Mixed' });
          }
        }
      });
      return processedEvents;
  };

  const handleExtract = useCallback(async () => {
    if (isSharedView) {
      return;
    }
    if (!apiKey) {
      setError("Gemini API Key is not set. Please set it in the Configuration panel below before proceeding.");
      return;
    }

    let pdfFile: File | null = null;
    
    setIsLoading(true);
    setError(null);
    setEvents([]);
    setMeetInfo(null);
    setFilters({ day: 'all', ageGroup: 'all', stroke: 'all', distance: 'all', gender: 'all' });

    try {
      if (pdfUrl.trim()) {
        setLoadingMessage('Downloading PDF from URL...');
        pdfFile = await fetchPdfFromUrl(pdfUrl.trim(), {
          proxyUrl: pdfProxyUrl,
          proxyApiKey: pdfProxyApiKey,
        });
      } else if (files.length > 0) {
        pdfFile = files[0];
        if (pdfFile.type !== 'application/pdf') {
          throw new Error('Invalid file type. Please upload a PDF file.');
        }
      } else {
        throw new Error('Please either select a PDF file or enter a URL.');
      }

      setLoadingMessage('Processing PDF pages...');
      const imageFiles = await convertPdfToImageFiles(pdfFile);
      if (imageFiles.length === 0) {
        throw new Error("Could not extract any pages from the PDF.");
      }

      setLoadingMessage(`Extracting meet data with ${model}...`);
      const meetData: MeetData = await extractMeetDataFromImages(imageFiles, apiKey, model);
      
      const processed = processRawEvents(meetData.events);
      setMeetInfo(meetData.meetInfo);
      setEvents(processed);

    } catch (err) {
      const errorMessage = pdfUrl.trim()
        ? `Failed to process the PDF from the URL. The link might be broken, not a direct PDF link, or the content is invalid. Please try downloading it and uploading manually. Error: ${err instanceof Error ? err.message : String(err)}`
        : `Failed to process the uploaded PDF. Please try again. Error: ${err instanceof Error ? err.message : String(err)}`;
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [files, pdfUrl, apiKey, model, isSharedView, pdfProxyApiKey, pdfProxyUrl]);

  const handleUpdateEvent = (updatedEvent: SwimEvent) => {
    if (isSharedView) {
      return;
    }
    setEvents(prevEvents => prevEvents.map(event => event.id === updatedEvent.id ? updatedEvent : event));
  };

  const handleDeleteEvent = (eventId: string) => {
    if (isSharedView) {
      return;
    }
    setEvents(prevEvents => prevEvents.filter(event => event.id !== eventId));
  };

  const handleAddEvent = () => {
    if (isSharedView) {
      return;
    }
    const newEvent: SwimEvent = {
      id: crypto.randomUUID(),
      eventNumber: '',
      day: '',
      ageGroup: '',
      gender: 'Mixed',
      distance: 0,
      stroke: '',
      originalDescription: 'Manually Added',
    };
    setEvents(prevEvents => [newEvent, ...prevEvents]);
  };

  const handleExportCSV = () => {
    const headers = ['Event #', 'Day', 'Age Group', 'Gender', 'Distance', 'Stroke', 'Original Description'];
    const rows = filteredEvents.map(event => [
      `"${event.eventNumber}"`,
      `"${event.day}"`,
      `"${event.ageGroup}"`,
      `"${event.gender}"`,
      event.distance,
      `"${event.stroke}"`,
      `"${event.originalDescription.replace(/"/g, '""')}"`
    ].join(','));

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'swim_meet_events.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCSV = (file: File) => {
    if (isSharedView) {
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = text.split('\n').slice(1); // Skip header
      const importedEvents: SwimEvent[] = rows.map((row): SwimEvent | null => {
        const columns = row.split(',').map(col => col.trim().replace(/^"|"$/g, ''));
        if (columns.length < 6) return null;
        return {
          id: crypto.randomUUID(),
          eventNumber: columns[0] || '',
          day: columns[1] || '',
          ageGroup: columns[2] || '',
          gender: (columns[3] as SwimEvent['gender']) || 'Mixed',
          distance: parseInt(columns[4], 10) || 0,
          stroke: columns[5] || '',
          originalDescription: columns[6] || 'Imported',
        };
      }).filter((e): e is SwimEvent => e !== null);
      
      setEvents(importedEvents);
    };
    reader.readAsText(file);
  };

  const handlePublish = async () => {
    if (!meetInfo) {
      setError('Cannot publish without meet information.');
      return;
    }
    if (events.length === 0) {
      setError('Cannot publish because there are no events to share.');
      return;
    }
    try {
      const shareableEvents: ShareableEvent[] = events.map(({ id, ...rest }) => rest);
      const generatedAt = new Date().toISOString();
      const inlinePayloadSizeEstimate = JSON.stringify({ meetInfo, events: shareableEvents }).length;

      const shouldAttemptRemote = Boolean(
        shareStoragePreferences.githubOwner &&
        shareStoragePreferences.githubRepo &&
        shareStoragePreferences.githubToken &&
        // prefer remote for large payloads or when explicitly configured
        (inlinePayloadSizeEstimate > MAX_INLINE_SHARE_TOKEN_CHARS || shareStoragePreferences.githubFolder)
      );

      let storageMetadata: ShareStorageMetadata | undefined;

      if (shouldAttemptRemote) {
        const uploaded = await uploadShareToGitHub({
          version: SHARE_VERSION,
          generatedAt,
          meetInfo,
          events: shareableEvents,
        }, shareStoragePreferences);
        storageMetadata = uploaded.metadata;
      }

      const payload: SharePayload = storageMetadata
        ? {
            version: SHARE_VERSION,
            generatedAt,
            storage: storageMetadata,
          }
        : {
            version: SHARE_VERSION,
            generatedAt,
            meetInfo,
            events: shareableEvents,
          };

      const token = encodeSharePayload(payload);
      if (!token) {
        throw new Error('Unable to encode share payload.');
      }
      if (typeof window === 'undefined') {
        throw new Error('Publishing is only available in the browser.');
      }
      const encodedToken = encodeURIComponent(token);
      const baseUrl = `${window.location.origin}${window.location.pathname}`;
      const shareUrl = `${baseUrl}?shared=${encodedToken}`;
      const newLink: PublishedLink = {
        id: crypto.randomUUID(),
        meetName: meetInfo.meetName || 'Untitled Meet',
        createdAt: generatedAt,
        url: shareUrl,
        eventsCount: events.length,
        storage: storageMetadata,
      };
      setPublishedLinks(prev => [newLink, ...prev]);
      let copied = false;
      if (navigator?.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(shareUrl);
          copied = true;
        } catch (copyErr) {
          console.warn('Failed to copy share URL:', copyErr);
        }
      }
      setPublishResult({ url: shareUrl, copied });
      setError(null);
    } catch (err) {
      console.error('Failed to publish meet:', err);
      setPublishResult(null);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred while publishing.');
    }
  };

  const handleRemovePublishedLink = (id: string) => {
    setPublishedLinks(prev => prev.filter(link => link.id !== id));
  };

  const handleTestShareStorage = async () => {
    if (!shareStoragePreferences.githubOwner || !shareStoragePreferences.githubRepo || !shareStoragePreferences.githubToken) {
      setShareStorageTestState({
        status: 'error',
        message: 'Provide the repository owner, name, and a token before testing.',
      });
      return;
    }

    setShareStorageTestState({
      status: 'running',
      message: 'Attempting to write and remove a test share file…',
    });

    const sampleData: StoredShareData = {
      version: SHARE_VERSION,
      generatedAt: new Date().toISOString(),
      meetInfo: {
        meetName: 'Storage Connectivity Test',
        dates: 'N/A',
        location: 'N/A',
        entryLimits: 'N/A',
        awards: 'N/A',
        sessionDetails: [],
      },
      events: [
        {
          eventNumber: 'T1',
          ageGroup: 'Test',
          distance: 25,
          stroke: 'Freestyle',
          day: 'Test Day',
          originalDescription: 'Connectivity validation event',
          gender: 'Mixed',
        },
      ],
    };

    let uploadResult: UploadedShareInfo | null = null;
    try {
      uploadResult = await uploadShareToGitHub(sampleData, shareStoragePreferences);
      await deleteShareFromGitHub(
        uploadResult.metadata,
        uploadResult.sha,
        shareStoragePreferences,
        `Remove storage connectivity test ${uploadResult.metadata.id}`,
      );
      const filePath = buildStorageFilePath(uploadResult.metadata);
      setShareStorageTestState({
        status: 'success',
        message: `Success! Wrote and removed ${filePath} on branch ${uploadResult.metadata.branch}.`,
      });
    } catch (err) {
      if (uploadResult) {
        try {
          await deleteShareFromGitHub(
            uploadResult.metadata,
            uploadResult.sha,
            shareStoragePreferences,
            `Cleanup after failed storage test ${uploadResult.metadata.id}`,
          );
        } catch (cleanupErr) {
          console.warn('Failed to clean up test share file:', cleanupErr);
        }
      }
      setShareStorageTestState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Storage test failed due to an unexpected error.',
      });
    }
  };

  type UploadedShareInfo = {
    metadata: ShareStorageMetadata;
    sha: string;
  };

  const uploadShareToGitHub = async (
    data: StoredShareData,
    prefs: ShareStoragePreferences,
  ): Promise<UploadedShareInfo> => {
    if (!prefs.githubOwner || !prefs.githubRepo || !prefs.githubToken) {
      throw new Error('GitHub storage is not fully configured.');
    }

    const folder = sanitizeFolder(prefs.githubFolder || DEFAULT_SHARE_STORAGE_PREFS.githubFolder);
    const id = crypto.randomUUID();
    const filePath = `${folder ? `${folder}/` : ''}${id}.json`;
    const uploadUrl = `https://api.github.com/repos/${prefs.githubOwner}/${prefs.githubRepo}/contents/${filePath}`;
    const contentBase64 = base64Encode(JSON.stringify(data));

    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github+json',
        'Authorization': `token ${prefs.githubToken.trim()}`,
      },
      body: JSON.stringify({
        message: `Add shared meet ${data.meetInfo.meetName || id}`,
        content: contentBase64,
        branch: prefs.githubBranch || DEFAULT_SHARE_STORAGE_PREFS.githubBranch,
      }),
    });

    const responseBody = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('GitHub upload failed:', response.status, responseBody);
      throw new Error('Failed to upload shared meet to GitHub. Check token permissions and branch access.');
    }

    const sha = responseBody?.content?.sha;
    if (!sha || typeof sha !== 'string') {
      throw new Error('GitHub upload succeeded but the file SHA was missing from the response.');
    }

    return {
      metadata: {
        type: 'github',
        owner: prefs.githubOwner,
        repo: prefs.githubRepo,
        branch: prefs.githubBranch || DEFAULT_SHARE_STORAGE_PREFS.githubBranch,
        path: folder,
        id,
      },
      sha,
    };
  };

  const deleteShareFromGitHub = async (
    metadata: ShareStorageMetadata,
    sha: string,
    prefs: ShareStoragePreferences,
    commitMessage?: string,
  ): Promise<void> => {
    if (!prefs.githubOwner || !prefs.githubRepo || !prefs.githubToken) {
      throw new Error('GitHub storage is not fully configured.');
    }

    const filePath = buildStorageFilePath(metadata);
    const deleteUrl = `https://api.github.com/repos/${prefs.githubOwner}/${prefs.githubRepo}/contents/${filePath}`;

    const response = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github+json',
        'Authorization': `token ${prefs.githubToken.trim()}`,
      },
      body: JSON.stringify({
        message: commitMessage || `Remove shared meet ${metadata.id}`,
        sha,
        branch: metadata.branch,
      }),
    });

    const responseBody = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('GitHub delete failed:', response.status, responseBody);
      throw new Error('Failed to delete shared meet from GitHub. Check token permissions and branch access.');
    }
  };


  const filterOptions = useMemo(() => {
    const days = ['all', ...Array.from(new Set(events.map(e => e.day)))];
    const ageGroups = ['all', ...Array.from(new Set(events.map(e => e.ageGroup)))];
    const strokes = ['all', ...Array.from(new Set(events.map(e => e.stroke)))];
    const distances = ['all', ...Array.from(new Set(events.map(e => e.distance.toString())))].sort((a,b) => a === 'all' ? -1 : b === 'all' ? 1 : Number(a) - Number(b));
    const genders = ['all', ...Array.from(new Set(events.map(e => e.gender)))];
    
    return { days, ageGroups, strokes, distances, genders };
  }, [events]);

  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      const dayMatch = filters.day === 'all' || event.day === filters.day;
      const ageGroupMatch = filters.ageGroup === 'all' || event.ageGroup === filters.ageGroup;
      const strokeMatch = filters.stroke === 'all' || event.stroke === filters.stroke;
      const distanceMatch = filters.distance === 'all' || event.distance.toString() === filters.distance;
      const genderMatch = filters.gender === 'all' || event.gender === filters.gender;
      return dayMatch && ageGroupMatch && strokeMatch && distanceMatch && genderMatch;
    });
  }, [events, filters]);
  
  const resetApp = () => {
    setFiles([]);
    setPdfUrl('');
    setEvents([]);
    setMeetInfo(null);
    setError(null);
    setIsLoading(false);
    setFilters({ day: 'all', ageGroup: 'all', stroke: 'all', distance: 'all', gender: 'all' });
    setPublishResult(null);
    setShareMetadata(null);
    setSharedError(null);
    if (isSharedView && typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('shared');
      window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
    }
    setIsSharedView(false);
  };


  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-7xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-brand-blue mb-2">Swim Meet Event Extractor</h1>
          <p className="text-lg text-gray-600">A tool for coaches to extract, verify, and manage swim meet events.</p>
        </header>

        <main className="bg-white p-6 rounded-2xl shadow-lg w-full">
          {!isSharedView && publishedLinks.length > 0 && (
            <PublishedLinks links={publishedLinks} onRemove={handleRemovePublishedLink} />
          )}

          {publishResult && !isSharedView && (
            <div className="mb-6 p-4 rounded-lg border border-brand-teal bg-brand-teal/10 text-brand-dark">
              <p className="font-semibold">Share link created!</p>
              <p className="text-sm break-all">{publishResult.url}</p>
              <p className="text-xs text-gray-600 mt-2">
                {publishResult.copied ? 'Link copied to your clipboard.' : 'Copy the link above to share with your athletes.'}
              </p>
            </div>
          )}

          {isSharedView ? (
            sharedError ? (
              <div className="text-center p-6 bg-red-50 rounded-lg">
                <p className="text-red-600 font-semibold">{sharedError}</p>
                <button onClick={resetApp} className="mt-4 px-6 py-2 bg-brand-blue text-white rounded-lg hover:bg-brand-blue/90 transition-colors">
                  Open full editor
                </button>
              </div>
            ) : (
              <div>
                <div className="mb-6 flex flex-wrap items-start justify-between gap-4 p-4 bg-brand-blue/10 border border-brand-blue/20 rounded-xl">
                  <div>
                    <p className="text-brand-dark font-semibold">Read-only shared view</p>
                    {shareMetadata?.generatedAt && (
                      <p className="text-sm text-brand-dark/70">Published on {new Date(shareMetadata.generatedAt).toLocaleString()}</p>
                    )}
                  </div>
                  <button onClick={resetApp} className="px-4 py-2 bg-brand-blue text-white rounded-lg hover:bg-brand-blue/90 transition-colors">
                    Open full editor
                  </button>
                </div>
                {meetInfo && <MeetInfoDisplay info={meetInfo} />}
                <h2 className="text-2xl font-bold text-brand-dark mt-8 mb-4">Events</h2>
                <EventFilters filters={filters} setFilters={setFilters} options={filterOptions} />
                <EventTable 
                  events={filteredEvents} 
                  onUpdateEvent={handleUpdateEvent}
                  onDeleteEvent={handleDeleteEvent}
                  readOnly
                />
              </div>
            )
          ) : isLoading ? (
            <div className="flex flex-col items-center justify-center h-64">
              <Spinner />
              <p className="mt-4 text-lg text-brand-cyan font-semibold animate-pulse">{loadingMessage}</p>
            </div>
          ) : error && events.length === 0 ? (
            <div className="text-center p-6 bg-red-50 rounded-lg">
              <p className="text-red-600 font-semibold">{error}</p>
              <button onClick={() => setError(null)} className="mt-4 px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">
                Acknowledged
              </button>
            </div>
          ) : (events.length > 0 || meetInfo) ? (
            <div>
              <div className="flex justify-end items-center mb-4">
                <button onClick={resetApp} className="px-4 py-2 bg-brand-orange text-white rounded-lg hover:bg-opacity-90 transition-colors">
                  Start Over
                </button>
              </div>
              {meetInfo && <MeetInfoDisplay info={meetInfo} />}
              <h2 className="text-2xl font-bold text-brand-dark mt-8 mb-4">Events</h2>
              <EventFilters filters={filters} setFilters={setFilters} options={filterOptions} />
              <DataActions
                onExport={handleExportCSV}
                onImport={handleImportCSV}
                onAddEvent={handleAddEvent}
                onPublish={handlePublish}
                canPublish={Boolean(meetInfo && events.length > 0)}
              />
              <EventTable 
                events={filteredEvents} 
                onUpdateEvent={handleUpdateEvent}
                onDeleteEvent={handleDeleteEvent}
              />
               {googleSheetUrl && <SheetEmbed url={googleSheetUrl} />}
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 text-center p-3 bg-red-50 rounded-lg text-red-600 font-semibold">
                  {error}
                </div>
              )}
              <FileUpload
                onFileChange={handleFileChange}
                onExtract={handleExtract}
                fileCount={files.length}
                pdfUrl={pdfUrl}
                onUrlChange={handleUrlChange}
              />
            </>
          )}
        </main>
        
        {!isSharedView && (
          <ConfigPanel 
            apiKey={apiKey}
            setApiKey={setApiKey}
            model={model}
            setModel={setModel}
            googleSheetUrl={googleSheetUrl}
            setGoogleSheetUrl={setGoogleSheetUrl}
            pdfProxyUrl={pdfProxyUrl}
            setPdfProxyUrl={setPdfProxyUrl}
            pdfProxyApiKey={pdfProxyApiKey}
            setPdfProxyApiKey={setPdfProxyApiKey}
            defaultPdfProxyUrl={DEFAULT_PDF_PROXY_URL}
            shareStoragePreferences={shareStoragePreferences}
            setShareStoragePreferences={setShareStoragePreferences}
            onTestShareStorage={handleTestShareStorage}
            shareStorageTestState={shareStorageTestState}
          />
        )}

         <footer className="text-center mt-8 text-gray-500 text-sm">
          <p>Powered by the Gemini API</p>
        </footer>
      </div>
    </div>
  );
};

export default App;
