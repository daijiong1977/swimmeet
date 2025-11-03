import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import GenerateTab from './tabs/GenerateTab';
import DraftsTab from './tabs/DraftsTab';
import SharedTab from './tabs/SharedTab';
import { extractMeetDataFromImages } from './services/geminiService';
import {
  DEFAULT_PDF_PROXY_URL,
  convertPdfToImageFiles,
  fetchPdfFromUrl,
} from './utils/pdfProcessing';
import {
  DEFAULT_FILTERS,
  applyFilters,
  computeFilterOptions,
  createEmptyEvent,
  exportEventsToCsv,
  parseCsvFile,
  processRawEvents,
  toShareableEvents,
  toSwimEvents,
} from './utils/eventData';
import {
  decodeSharePayload,
  encodeSharePayload,
} from './utils/shareEncoding';
import {
  createMeetMetadata,
  deleteShareFromGitHub,
  ensureStorageConfigured,
  fetchStoredShareData,
  listMeetsFromGitHub,
  saveShareToGitHub,
} from './utils/githubStorage';
import {
  FilterOptions,
  GeminiModel,
  MeetInfo,
  MeetMetadata,
  MeetStatus,
  PublishedLink,
  SharePayload,
  ShareStoragePreferences,
  ShareStorageTestState,
  StoredShareData,
  SwimEvent,
} from './types';

const SHARE_VERSION = 1;
const SHARE_STORAGE_PREFS_KEY = 'SHARE_STORAGE_PREFS_V1';
const ACTIVE_TAB_STORAGE_KEY = 'APP_ACTIVE_TAB_V1';
const GOOGLE_SHEET_URL_KEY = 'GOOGLE_SHEET_URL_V1';
const PDF_PROXY_URL_KEY = 'PDF_PROXY_URL_V1';
const PDF_PROXY_API_KEY_KEY = 'PDF_PROXY_API_KEY_V1';
const GEMINI_API_KEY_STORAGE_KEY = 'GEMINI_API_KEY';

type AppTab = 'generate' | 'drafts' | 'shared';

const formatDateTime = (value?: string) => {
  if (!value) {
    return 'Unknown';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
};

const buildShareUrl = (token: string | null) => {
  if (!token || typeof window === 'undefined') {
    return null;
  }
  const encoded = encodeURIComponent(token);
  return `${window.location.origin}${window.location.pathname}?shared=${encoded}`;
};

const App: React.FC = () => {
  const meetCacheRef = useRef<Map<string, StoredShareData>>(new Map());

  const [files, setFiles] = useState<File[]>([]);
  const [pdfUrl, setPdfUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Processing…');
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateMessage, setGenerateMessage] = useState<string | null>(null);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [publishedLoading, setPublishedLoading] = useState(false);
  const [draftsLoaded, setDraftsLoaded] = useState(false);
  const [publishedLoaded, setPublishedLoaded] = useState(false);

  const [apiKey, setApiKey] = useState<string>(() => {
    if (typeof window === 'undefined') {
      return '';
    }
    return (
      localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY) ||
      sessionStorage.getItem(GEMINI_API_KEY_STORAGE_KEY) ||
      ''
    );
  });

  const [model, setModel] = useState<GeminiModel>('gemini-2.5-flash');

  const [googleSheetUrl, setGoogleSheetUrl] = useState<string>(() =>
    typeof window === 'undefined'
      ? ''
      : localStorage.getItem(GOOGLE_SHEET_URL_KEY) || '',
  );

  const [pdfProxyUrl, setPdfProxyUrl] = useState<string>(() =>
    typeof window === 'undefined'
      ? DEFAULT_PDF_PROXY_URL
      : localStorage.getItem(PDF_PROXY_URL_KEY) || DEFAULT_PDF_PROXY_URL,
  );
  const [pdfProxyApiKey, setPdfProxyApiKey] = useState<string>(() =>
    typeof window === 'undefined'
      ? ''
      : localStorage.getItem(PDF_PROXY_API_KEY_KEY) || '',
  );

  const [activeTab, setActiveTab] = useState<AppTab>(() => {
    if (typeof window === 'undefined') {
      return 'generate';
    }
    const stored = localStorage.getItem(ACTIVE_TAB_STORAGE_KEY) as AppTab | null;
    return stored === 'drafts' || stored === 'shared' ? stored : 'generate';
  });

  const [shareStoragePreferences, setShareStoragePreferences] =
    useState<ShareStoragePreferences>(() => {
      if (typeof window === 'undefined') {
        return {
          githubOwner: '',
          githubRepo: '',
          githubBranch: 'main',
          githubFolder: 'public/shares',
          githubToken: '',
        };
      }
      try {
        const stored = localStorage.getItem(SHARE_STORAGE_PREFS_KEY);
        if (!stored) {
          return {
            githubOwner: '',
            githubRepo: '',
            githubBranch: 'main',
            githubFolder: 'public/shares',
            githubToken: '',
          };
        }
        const parsed = JSON.parse(stored) as ShareStoragePreferences;
        return {
          githubOwner: '',
          githubRepo: '',
          githubBranch: 'main',
          githubFolder: 'public/shares',
          githubToken: '',
          ...parsed,
        };
      } catch {
        return {
          githubOwner: '',
          githubRepo: '',
          githubBranch: 'main',
          githubFolder: 'public/shares',
          githubToken: '',
        };
      }
    });

  const [shareStorageTestState, setShareStorageTestState] =
    useState<ShareStorageTestState>({ status: 'idle', message: null });

  const [draftMeets, setDraftMeets] = useState<MeetMetadata[]>([]);
  const [publishedMeets, setPublishedMeets] = useState<MeetMetadata[]>([]);

  const [selectedMetadata, setSelectedMetadata] = useState<MeetMetadata | null>(
    null,
  );
  const [selectedData, setSelectedData] = useState<StoredShareData | null>(null);
  const [editorMeetInfo, setEditorMeetInfo] = useState<MeetInfo | null>(null);
  const [editorEvents, setEditorEvents] = useState<SwimEvent[]>([]);
  const [editorFilters, setEditorFilters] = useState<FilterOptions>({
    ...DEFAULT_FILTERS,
  });
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorMessage, setEditorMessage] = useState<string | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);

  const [isSharedUrlView, setIsSharedUrlView] = useState(false);
  const [sharedViewLoading, setSharedViewLoading] = useState(false);
  const [sharedViewError, setSharedViewError] = useState<string | null>(null);
  const [sharedViewInfo, setSharedViewInfo] = useState<MeetInfo | null>(null);
  const [sharedViewEvents, setSharedViewEvents] = useState<SwimEvent[]>([]);
  const [sharedGeneratedAt, setSharedGeneratedAt] = useState<string | null>(
    null,
  );

  const [publishResult, setPublishResult] = useState<{
    url: string;
    copied: boolean;
  } | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    if (apiKey) {
      sessionStorage.setItem(GEMINI_API_KEY_STORAGE_KEY, apiKey);
      localStorage.setItem(GEMINI_API_KEY_STORAGE_KEY, apiKey);
    } else {
      sessionStorage.removeItem(GEMINI_API_KEY_STORAGE_KEY);
      localStorage.removeItem(GEMINI_API_KEY_STORAGE_KEY);
    }
  }, [apiKey]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    if (googleSheetUrl && googleSheetUrl.trim()) {
      localStorage.setItem(GOOGLE_SHEET_URL_KEY, googleSheetUrl.trim());
    } else {
      localStorage.removeItem(GOOGLE_SHEET_URL_KEY);
    }
  }, [googleSheetUrl]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    if (pdfProxyUrl && pdfProxyUrl.trim() && pdfProxyUrl !== DEFAULT_PDF_PROXY_URL) {
      localStorage.setItem(PDF_PROXY_URL_KEY, pdfProxyUrl.trim());
    } else {
      localStorage.removeItem(PDF_PROXY_URL_KEY);
    }
  }, [pdfProxyUrl]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    if (pdfProxyApiKey && pdfProxyApiKey.trim()) {
      localStorage.setItem(PDF_PROXY_API_KEY_KEY, pdfProxyApiKey.trim());
    } else {
      localStorage.removeItem(PDF_PROXY_API_KEY_KEY);
    }
  }, [pdfProxyApiKey]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    localStorage.setItem(
      SHARE_STORAGE_PREFS_KEY,
      JSON.stringify(shareStoragePreferences),
    );
  }, [shareStoragePreferences]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const sharedToken = params.get('shared');
    if (!sharedToken) {
      return;
    }
    setActiveTab('shared');
    setIsSharedUrlView(true);
    setSharedViewLoading(true);
    (async () => {
      try {
        const decodedToken = decodeURIComponent(sharedToken);
        const payload = decodeSharePayload(decodedToken);
        const events = payload.events ? toSwimEvents(payload.events) : [];
        setSharedViewInfo(payload.meetInfo ?? null);
        setSharedViewEvents(events);
        setSharedGeneratedAt(payload.generatedAt ?? null);
        setSharedViewError(null);
      } catch (err) {
        setSharedViewError(
          err instanceof Error ? err.message : 'Failed to load shared meet.',
        );
      } finally {
        setSharedViewLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedData) {
      setEditorMeetInfo(null);
      setEditorEvents([]);
      setEditorFilters({ ...DEFAULT_FILTERS });
      return;
    }
    setEditorMeetInfo({ ...selectedData.meetInfo });
    setEditorEvents(toSwimEvents(selectedData.events));
    setEditorFilters({ ...DEFAULT_FILTERS });
  }, [selectedData]);

  const filteredEvents = useMemo(
    () => applyFilters(editorEvents, editorFilters),
    [editorEvents, editorFilters],
  );

  const filterOptions = useMemo(
    () => computeFilterOptions(editorEvents),
    [editorEvents],
  );

  const publishedLinks: PublishedLink[] = useMemo(() => {
    return publishedMeets
      .map((metadata) => {
        const url = buildShareUrl(metadata.shareToken ?? null);
        if (!url) {
          return null;
        }
        return {
          id: metadata.id,
          meetName: metadata.meetName,
          createdAt: metadata.updatedAt,
          url,
          eventsCount: metadata.eventsCount,
          storage: metadata.storage,
        } satisfies PublishedLink;
      })
      .filter((item): item is PublishedLink => item !== null);
  }, [publishedMeets]);

  const loadMeets = useCallback(
    async (status: MeetStatus) => {
      if (!ensureStorageConfigured(shareStoragePreferences)) {
        if (status === 'draft') {
          setDraftMeets([]);
          setDraftsLoaded(true);
        } else {
          setPublishedMeets([]);
          setPublishedLoaded(true);
        }
        return;
      }
      if (status === 'draft') {
        setDraftsLoading(true);
      } else {
        setPublishedLoading(true);
      }
      try {
        const results = await listMeetsFromGitHub(status, shareStoragePreferences);
        results.forEach(({ metadata, data }) => {
          meetCacheRef.current.set(metadata.id, data);
        });
        if (status === 'draft') {
          setDraftMeets(results.map((item) => item.metadata));
          setDraftsLoaded(true);
        } else {
          setPublishedMeets(results.map((item) => item.metadata));
          setPublishedLoaded(true);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load meets.';
        if (status === 'draft') {
          setEditorError(message);
        } else {
          setSharedViewError(message);
        }
      } finally {
        if (status === 'draft') {
          setDraftsLoading(false);
        } else {
          setPublishedLoading(false);
        }
      }
    },
    [shareStoragePreferences],
  );

  useEffect(() => {
    if (activeTab === 'drafts' && !draftsLoaded) {
      loadMeets('draft');
      loadMeets('published');
    }
    if (activeTab === 'shared' && !publishedLoaded) {
      loadMeets('published');
    }
  }, [activeTab, draftsLoaded, loadMeets, publishedLoaded]);

  const handleFileChange = (fileList: FileList | null) => {
    setFiles(fileList ? Array.from(fileList) : []);
    setGenerateMessage(null);
    setGenerateError(null);
  };

  const handleExtract = useCallback(async () => {
    if (!apiKey) {
      setGenerateError('Provide a Gemini API key before extracting.');
      return;
    }
    if (!ensureStorageConfigured(shareStoragePreferences)) {
      setGenerateError('Configure GitHub storage before generating meets.');
      return;
    }
    try {
      setIsLoading(true);
      setLoadingMessage('Reading PDF…');
      setGenerateError(null);
      setGenerateMessage(null);

      let workingFiles = files;
      if (workingFiles.length === 0) {
        if (!pdfUrl.trim()) {
          setGenerateError('Upload a PDF or provide a PDF URL first.');
          setIsLoading(false);
          return;
        }
        const fetchedPdf = await fetchPdfFromUrl(
          pdfUrl.trim(),
          pdfProxyUrl,
          pdfProxyApiKey,
        );
        workingFiles = [fetchedPdf];
      }

      const pdfFile = workingFiles.find(
        (file) => file.type === 'application/pdf',
      );
      if (!pdfFile) {
        setGenerateError('Provide a PDF file for extraction.');
        setIsLoading(false);
        return;
      }

      setLoadingMessage('Rendering PDF pages…');
      const imageFiles = await convertPdfToImageFiles(pdfFile);
      if (imageFiles.length === 0) {
        setGenerateError('No pages were generated from the PDF.');
        setIsLoading(false);
        return;
      }

      setLoadingMessage('Extracting meet data with Gemini…');
      const meetData = await extractMeetDataFromImages(imageFiles, apiKey, model);

      const processedEvents = processRawEvents(meetData.events);
      const generatedAt = new Date().toISOString();
      const storedData: StoredShareData = {
        version: SHARE_VERSION,
        generatedAt,
        updatedAt: generatedAt,
        meetInfo: meetData.meetInfo,
        events: toShareableEvents(processedEvents),
        status: 'draft',
      };

      setLoadingMessage('Uploading draft to GitHub…');
      const { metadata, sha } = await saveShareToGitHub(
        storedData,
        'draft',
        shareStoragePreferences,
      );
      const meetMetadata = createMeetMetadata(storedData, metadata, sha);

      meetCacheRef.current.set(meetMetadata.id, storedData);
      setDraftMeets((prev) => [meetMetadata, ...prev.filter((m) => m.id !== meetMetadata.id)]);
      setDraftsLoaded(true);
      setGenerateMessage(
        `Meet saved as draft. Switch to the Drafts tab to review “${meetMetadata.meetName}”.`,
      );
      setFiles([]);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Failed to extract meet.');
    } finally {
      setIsLoading(false);
      setLoadingMessage('Processing…');
    }
  }, [
    apiKey,
    files,
    model,
    pdfProxyApiKey,
    pdfProxyUrl,
    pdfUrl,
    shareStoragePreferences,
  ]);

  const handleSelectMeet = useCallback(
    async (metadata: MeetMetadata) => {
      setEditorMessage(null);
      setEditorError(null);
      setPublishResult(null);
      setSelectedMetadata(metadata);
      setEditorLoading(true);
      try {
        let data = meetCacheRef.current.get(metadata.id) || null;
        let sha = metadata.sha;
        if (!data) {
          const fetched = await fetchStoredShareData(
            metadata.storage,
            shareStoragePreferences,
          );
          data = fetched.data;
          sha = fetched.sha;
          meetCacheRef.current.set(metadata.id, data);
        }
        if (sha !== metadata.sha) {
          const updateList = (items: MeetMetadata[]) =>
            items.map((item) => (item.id === metadata.id ? { ...item, sha } : item));
          if (metadata.status === 'draft') {
            setDraftMeets((prev) => updateList(prev));
          } else {
            setPublishedMeets((prev) => updateList(prev));
          }
        }
        setSelectedData(data);
      } catch (err) {
        setEditorError(
          err instanceof Error ? err.message : 'Unable to load selected meet.',
        );
      } finally {
        setEditorLoading(false);
      }
    },
    [shareStoragePreferences],
  );

  const handleAddEvent = () => {
    setEditorEvents((prev) => [...prev, createEmptyEvent()]);
    setEditorMessage(null);
  };

  const handleUpdateEvent = (updatedEvent: SwimEvent) => {
    setEditorEvents((prev) =>
      prev.map((event) => (event.id === updatedEvent.id ? updatedEvent : event)),
    );
    setEditorMessage(null);
  };

  const handleDeleteEvent = (eventId: string) => {
    setEditorEvents((prev) => prev.filter((event) => event.id !== eventId));
    setEditorMessage(null);
  };

  const handleExport = () => {
    if (editorEvents.length === 0) {
      setEditorMessage('No events to export.');
      return;
    }
    const csv = exportEventsToCsv(editorEvents);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${selectedMetadata?.meetName || 'meet'}-events.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setEditorMessage('Exported events to CSV.');
  };

  const handleImport = async (file: File) => {
    try {
      const importedEvents = await parseCsvFile(file);
      if (importedEvents.length === 0) {
        setEditorMessage('CSV file did not contain any events.');
        return;
      }
      setEditorEvents(importedEvents);
      setEditorFilters({ ...DEFAULT_FILTERS });
      setEditorMessage(`Imported ${importedEvents.length} events from CSV.`);
    } catch (err) {
      setEditorError(
        err instanceof Error ? err.message : 'Failed to import CSV file.',
      );
    }
  };

  const syncMeetLists = (
    metadata: MeetMetadata,
    data: StoredShareData,
  ) => {
    meetCacheRef.current.set(metadata.id, data);
    if (metadata.status === 'draft') {
      setDraftMeets((prev) => [metadata, ...prev.filter((item) => item.id !== metadata.id)]);
      setPublishedMeets((prev) => prev.filter((item) => item.id !== metadata.id));
    } else {
      setPublishedMeets((prev) => [metadata, ...prev.filter((item) => item.id !== metadata.id)]);
      setDraftMeets((prev) => prev.filter((item) => item.id !== metadata.id));
    }
  };

  const handleSave = async () => {
    if (!selectedMetadata || !selectedData || !editorMeetInfo) {
      setEditorError('Select a meet before saving changes.');
      return;
    }
    try {
      setEditorLoading(true);
      setEditorError(null);
      setEditorMessage(null);
      const now = new Date().toISOString();
      const data: StoredShareData = {
        version: SHARE_VERSION,
        generatedAt: selectedData.generatedAt,
        updatedAt: now,
        meetInfo: editorMeetInfo,
        events: toShareableEvents(editorEvents),
        status: selectedMetadata.status,
        shareToken: selectedData.shareToken,
      };
      const { metadata, sha } = await saveShareToGitHub(
        data,
        selectedMetadata.status,
        shareStoragePreferences,
        selectedMetadata,
      );
      const updatedMetadata = createMeetMetadata(data, metadata, sha);
      syncMeetLists(updatedMetadata, data);
      setSelectedMetadata(updatedMetadata);
      setSelectedData(data);
      setEditorMessage('Saved changes successfully.');
    } catch (err) {
      setEditorError(err instanceof Error ? err.message : 'Failed to save changes.');
    } finally {
      setEditorLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!selectedMetadata || !selectedData || !editorMeetInfo) {
      setEditorError('Select a meet before publishing.');
      return;
    }
    try {
      setEditorLoading(true);
      setEditorError(null);
      setEditorMessage(null);
      setPublishResult(null);
      const now = new Date().toISOString();
      const shareableEvents = toShareableEvents(editorEvents);
      const payload: SharePayload = {
        version: SHARE_VERSION,
        meetInfo: editorMeetInfo,
        events: shareableEvents,
        generatedAt: selectedData.generatedAt || now,
        storage: selectedMetadata.storage,
        status: 'published',
      };
      const token = encodeSharePayload(payload);
      const data: StoredShareData = {
        version: SHARE_VERSION,
        generatedAt: selectedData.generatedAt,
        updatedAt: now,
        meetInfo: editorMeetInfo,
        events: shareableEvents,
        status: 'published',
        shareToken: token,
      };
      const { metadata, sha } = await saveShareToGitHub(
        data,
        'published',
        shareStoragePreferences,
        selectedMetadata,
      );
      const updatedMetadata = createMeetMetadata(data, metadata, sha);
      syncMeetLists(updatedMetadata, data);
      setSelectedMetadata(updatedMetadata);
      setSelectedData(data);
      const url = buildShareUrl(token);
      setPublishResult(url ? { url, copied: false } : null);
      setEditorMessage('Meet published successfully.');
    } catch (err) {
      setEditorError(err instanceof Error ? err.message : 'Failed to publish meet.');
    } finally {
      setEditorLoading(false);
    }
  };

  const handleDelete = async (metadata: MeetMetadata) => {
    if (!ensureStorageConfigured(shareStoragePreferences)) {
      setEditorError('Configure GitHub storage before deleting meets.');
      return;
    }
    try {
      setEditorLoading(true);
      await deleteShareFromGitHub(
        metadata.storage,
        metadata.sha,
        shareStoragePreferences,
      );
      meetCacheRef.current.delete(metadata.id);
      setDraftMeets((prev) => prev.filter((item) => item.id !== metadata.id));
      setPublishedMeets((prev) => prev.filter((item) => item.id !== metadata.id));
      if (selectedMetadata?.id === metadata.id) {
        setSelectedMetadata(null);
        setSelectedData(null);
        setEditorMeetInfo(null);
        setEditorEvents([]);
      }
      setEditorMessage('Deleted meet successfully.');
    } catch (err) {
      setEditorError(err instanceof Error ? err.message : 'Failed to delete meet.');
    } finally {
      setEditorLoading(false);
    }
  };

  const handleRemovePublishedLink = (id: string) => {
    const metadata = publishedMeets.find((item) => item.id === id);
    if (metadata) {
      void handleDelete(metadata);
    }
  };

  const handleCopyPublishLink = async () => {
    if (!publishResult?.url) {
      return;
    }
    try {
      await navigator.clipboard.writeText(publishResult.url);
      setPublishResult({ url: publishResult.url, copied: true });
    } catch {
      setEditorError('Copy failed. Manually copy the link below.');
    }
  };

  const handleTestShareStorage = async () => {
    if (!ensureStorageConfigured(shareStoragePreferences)) {
      setShareStorageTestState({
        status: 'error',
        message: 'Provide owner, repo, and token before testing.',
      });
      return;
    }
    setShareStorageTestState({ status: 'running', message: null });
    try {
      await listMeetsFromGitHub('draft', shareStoragePreferences);
      setShareStorageTestState({
        status: 'success',
        message: 'Successfully accessed repository storage.',
      });
    } catch (err) {
      setShareStorageTestState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Unable to access GitHub storage.',
      });
    }
  };

  const canPublish =
    ensureStorageConfigured(shareStoragePreferences) &&
    Boolean(selectedMetadata) &&
    editorEvents.length > 0 &&
    Boolean(editorMeetInfo?.meetName?.trim());

  return (
    <div className="min-h-screen bg-gray-100 pb-16">
      <header className="bg-white shadow">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-brand-blue">Swim Meet Builder</h1>
            <p className="text-sm text-gray-500">
              Extract, edit, and publish swim meet events with AI assistance.
            </p>
          </div>
          <div className="flex gap-2 rounded-full bg-brand-blue/10 px-4 py-2 text-xs text-brand-blue">
            <span>Gemini model: {model}</span>
            <span className="hidden sm:inline">·</span>
            <span>
              Storage{' '}
              {ensureStorageConfigured(shareStoragePreferences)
                ? 'GitHub connected'
                : 'Not configured'}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto mt-8 max-w-6xl px-4">
        <nav className="mb-6 flex flex-wrap gap-2">
          {(
            [
              { key: 'generate', label: 'Generate meets' },
              { key: 'drafts', label: 'Draft meets' },
              { key: 'shared', label: 'Meets shared' },
            ] as Array<{ key: AppTab; label: string }>
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
                activeTab === tab.key
                  ? 'bg-brand-blue text-white shadow'
                  : 'bg-white text-brand-blue hover:bg-brand-blue/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {activeTab === 'generate' && (
          <GenerateTab
            files={files}
            pdfUrl={pdfUrl}
            onFileChange={handleFileChange}
            onUrlChange={setPdfUrl}
            onExtract={handleExtract}
            isLoading={isLoading}
            loadingMessage={loadingMessage}
            successMessage={generateMessage}
            errorMessage={generateError}
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

        {activeTab === 'drafts' && (
          <DraftsTab
            draftMeets={draftMeets}
            publishedMeets={publishedMeets}
            draftsLoading={draftsLoading}
            publishedLoading={publishedLoading}
            onSelectMeet={handleSelectMeet}
            onDeleteMeet={handleDelete}
            selectedMetadata={selectedMetadata}
            editorMeetInfo={editorMeetInfo}
            filteredEvents={filteredEvents}
            filterOptions={filterOptions}
            editorFilters={editorFilters}
            setEditorFilters={setEditorFilters}
            onChangeMeetInfo={setEditorMeetInfo}
            onAddEvent={handleAddEvent}
            onUpdateEvent={handleUpdateEvent}
            onDeleteEvent={handleDeleteEvent}
            onExportCsv={handleExport}
            onImportCsv={handleImport}
            onSave={handleSave}
            onPublish={handlePublish}
            editorLoading={editorLoading}
            editorMessage={editorMessage}
            editorError={editorError}
            canPublish={canPublish}
            publishResult={publishResult}
            onCopyPublishLink={handleCopyPublishLink}
            onDismissPublishResult={() => setPublishResult(null)}
            googleSheetUrl={googleSheetUrl}
            formatDateTime={formatDateTime}
          />
        )}

        {activeTab === 'shared' && (
          <SharedTab
            isSharedUrlView={isSharedUrlView}
            sharedViewLoading={sharedViewLoading}
            sharedViewError={sharedViewError}
            sharedViewInfo={sharedViewInfo}
            sharedViewEvents={sharedViewEvents}
            sharedGeneratedAt={sharedGeneratedAt}
            formatDateTime={formatDateTime}
            publishedLinks={publishedLinks}
            onRemovePublishedLink={handleRemovePublishedLink}
          />
        )}
      </main>
    </div>
  );
};

export default App;

