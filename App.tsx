
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { SwimEvent, FilterOptions, RawSwimEvent, MeetInfo, MeetData, GeminiModel } from './types';
import { extractMeetDataFromImages } from './services/geminiService';
import FileUpload from './components/FileUpload';
import EventTable from './components/EventTable';
import EventFilters from './components/EventFilters';
import Spinner from './components/Spinner';
import MeetInfoDisplay from './components/MeetInfoDisplay';
import DataActions from './components/DataActions';
import ConfigPanel from './components/ConfigPanel';
import SheetEmbed from './components/SheetEmbed';

const DEFAULT_PDF_PROXY_URL = 'https://api.allorigins.win/raw?url={{url}}';


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
  
  const [apiKey, setApiKey] = useState<string>(() => sessionStorage.getItem('GEMINI_API_KEY') || '');
  const [model, setModel] = useState<GeminiModel>('gemini-2.5-flash');
  const [googleSheetUrl, setGoogleSheetUrl] = useState<string>('');

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
    if (apiKey) {
      sessionStorage.setItem('GEMINI_API_KEY', apiKey);
    } else {
      sessionStorage.removeItem('GEMINI_API_KEY');
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


  const handleFileChange = (selectedFiles: FileList | null) => {
    if (selectedFiles && selectedFiles.length > 0) {
      setFiles([selectedFiles[0]]);
      setPdfUrl('');
    } else {
      setFiles([]);
    }
  };
  
  const handleUrlChange = (url: string) => {
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
  }, [files, pdfUrl, apiKey, model]);

  const handleUpdateEvent = (updatedEvent: SwimEvent) => {
    setEvents(prevEvents => prevEvents.map(event => event.id === updatedEvent.id ? updatedEvent : event));
  };

  const handleDeleteEvent = (eventId: string) => {
    setEvents(prevEvents => prevEvents.filter(event => event.id !== eventId));
  };

  const handleAddEvent = () => {
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
  };


  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-7xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-brand-blue mb-2">Swim Meet Event Extractor</h1>
          <p className="text-lg text-gray-600">A tool for coaches to extract, verify, and manage swim meet events.</p>
        </header>

        <main className="bg-white p-6 rounded-2xl shadow-lg w-full">
          {isLoading ? (
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
              <DataActions onExport={handleExportCSV} onImport={handleImportCSV} onAddEvent={handleAddEvent} />
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
        />

         <footer className="text-center mt-8 text-gray-500 text-sm">
          <p>Powered by the Gemini API</p>
        </footer>
      </div>
    </div>
  );
};

export default App;
