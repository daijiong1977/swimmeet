
import React, { useState } from 'react';
import { GeminiModel } from '../types';

interface ConfigPanelProps {
  apiKey: string;
  setApiKey: (key: string) => void;
  model: GeminiModel;
  setModel: (model: GeminiModel) => void;
  googleSheetUrl: string;
  setGoogleSheetUrl: (url: string) => void;
  pdfProxyUrl: string;
  setPdfProxyUrl: (url: string) => void;
  pdfProxyApiKey: string;
  setPdfProxyApiKey: (key: string) => void;
  defaultPdfProxyUrl: string;
}

const ConfigPanel: React.FC<ConfigPanelProps> = ({
  apiKey,
  setApiKey,
  model,
  setModel,
  googleSheetUrl,
  setGoogleSheetUrl,
  pdfProxyUrl,
  setPdfProxyUrl,
  pdfProxyApiKey,
  setPdfProxyApiKey,
  defaultPdfProxyUrl
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-8 w-full bg-white rounded-2xl shadow-lg">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center p-4 text-left font-semibold text-lg text-brand-dark"
        aria-expanded={isOpen}
      >
        <span>Configuration & Collaboration</span>
        <svg
          className={`w-5 h-5 transform transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="p-6 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* API and Model Settings */}
          <div className="space-y-6">
            <div>
              <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700">
                Gemini API Key
              </label>
              <input
                type="password"
                id="apiKey"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your API Key here"
                className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-cyan focus:border-brand-cyan"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      localStorage.removeItem('GEMINI_API_KEY');
                      sessionStorage.removeItem('GEMINI_API_KEY');
                      setApiKey('');
                    }
                  }}
                  className="px-3 py-1 text-xs font-semibold text-brand-cyan border border-brand-cyan rounded-md hover:bg-brand-cyan hover:text-white transition-colors"
                >
                  Reset stored key
                </button>
              </div>
              <div className="mt-2 p-3 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-700 text-xs">
                <p><strong>Security Warning:</strong> Your API key is stored locally in this browser. Use the reset button after you're done, especially on shared machines.</p>
              </div>
            </div>
            <div>
              <label htmlFor="model" className="block text-sm font-medium text-gray-700">
                AI Model (for accuracy vs. speed)
              </label>
              <select
                id="model"
                value={model}
                onChange={(e) => setModel(e.target.value as GeminiModel)}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-brand-cyan focus:border-brand-cyan sm:text-sm rounded-md"
              >
                <option value="gemini-2.5-flash">Gemini 2.5 Flash (Faster)</option>
                <option value="gemini-2.5-pro">Gemini 2.5 Pro (Most Accurate)</option>
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="pdfProxyUrl" className="block text-sm font-medium text-gray-700">
                  PDF Fetch Proxy URL
                </label>
                <button
                  type="button"
                  onClick={() => setPdfProxyUrl(defaultPdfProxyUrl)}
                  className="text-xs text-brand-cyan hover:underline"
                >
                  Use default
                </button>
              </div>
              <input
                type="text"
                id="pdfProxyUrl"
                value={pdfProxyUrl}
                onChange={(e) => setPdfProxyUrl(e.target.value)}
                placeholder="https://api.allorigins.win/raw?url={{url}}"
                className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-cyan focus:border-brand-cyan"
              />
              <p className="mt-1 text-xs text-gray-500">
                Use <code className="bg-gray-200 px-1 rounded">{'{{url}}'}</code> as a placeholder for the PDF link. The default <code className="bg-gray-200 px-1 rounded">{'https://api.allorigins.win/raw?url={{url}}'}</code> does not need an API key. For stricter hosts you can switch to <code className="bg-gray-200 px-1 rounded">{'https://proxy.cors.sh/{{url}}'}</code> (requires a free key).
              </p>
            </div>
            <div>
              <label htmlFor="pdfProxyApiKey" className="block text-sm font-medium text-gray-700">
                Proxy API Key (optional)
              </label>
              <input
                type="password"
                id="pdfProxyApiKey"
                value={pdfProxyApiKey}
                onChange={(e) => setPdfProxyApiKey(e.target.value)}
                placeholder="Only needed for proxies that require it"
                className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-cyan focus:border-brand-cyan"
              />
              <p className="mt-1 text-xs text-gray-500">
                When set, the value is sent as an <code className="bg-gray-200 px-1 rounded">x-cors-api-key</code> header.
              </p>
            </div>
          </div>
          
          {/* Google Sheets Collaboration */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-800">Google Sheets Collaboration</h3>
            <p className="text-sm text-gray-600">
              To collaborate with your athletes, follow these steps:
            </p>
            <ol className="list-decimal list-inside text-sm text-gray-600 space-y-2">
              <li>Export the corrected event data to a CSV file using the button above.</li>
              <li>In Google Sheets, go to <code className="bg-gray-200 p-1 rounded">File &gt; Import</code> and upload the CSV.</li>
              <li>Share the new Google Sheet with your team.</li>
              <li>Paste the shareable URL below to embed it in this app.</li>
            </ol>
             <div>
              <label htmlFor="googleSheetUrl" className="block text-sm font-medium text-gray-700">
                Google Sheet URL
              </label>
              <input
                type="url"
                id="googleSheetUrl"
                value={googleSheetUrl}
                onChange={(e) => setGoogleSheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-cyan focus:border-brand-cyan"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfigPanel;
