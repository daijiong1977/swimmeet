import React from 'react';
import FileUpload from '../components/FileUpload';
import Spinner from '../components/Spinner';
import ConfigPanel from '../components/ConfigPanel';
import {
  GeminiModel,
  ShareStoragePreferences,
  ShareStorageTestState,
} from '../types';

interface GenerateTabProps {
  files: File[];
  pdfUrl: string;
  onFileChange: (files: FileList | null) => void;
  onUrlChange: (url: string) => void;
  onExtract: () => void;
  isLoading: boolean;
  loadingMessage: string;
  successMessage: string | null;
  errorMessage: string | null;
  apiKey: string;
  setApiKey: (value: string) => void;
  model: GeminiModel;
  setModel: (model: GeminiModel) => void;
  googleSheetUrl: string;
  setGoogleSheetUrl: (value: string) => void;
  pdfProxyUrl: string;
  setPdfProxyUrl: (value: string) => void;
  pdfProxyApiKey: string;
  setPdfProxyApiKey: (value: string) => void;
  defaultPdfProxyUrl: string;
  shareStoragePreferences: ShareStoragePreferences;
  setShareStoragePreferences: (value: ShareStoragePreferences) => void;
  onTestShareStorage: () => void;
  shareStorageTestState: ShareStorageTestState;
  isProxyConfigured?: boolean;
}

const GenerateTab: React.FC<GenerateTabProps> = ({
  files,
  pdfUrl,
  onFileChange,
  onUrlChange,
  onExtract,
  isLoading,
  loadingMessage,
  successMessage,
  errorMessage,
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
  defaultPdfProxyUrl,
  shareStoragePreferences,
  setShareStoragePreferences,
  onTestShareStorage,
  shareStorageTestState,
  isProxyConfigured = false,
}) => (
  <div className="space-y-6">
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow">
      <h2 className="mb-4 text-2xl font-semibold text-brand-dark">
        Generate a new meet from a PDF
      </h2>
      <FileUpload
        onFileChange={onFileChange}
        onExtract={onExtract}
        fileCount={files.length}
        pdfUrl={pdfUrl}
        onUrlChange={onUrlChange}
      />
      {isLoading && (
        <div className="mt-6 flex flex-col items-center gap-3">
          <Spinner />
          <p className="text-sm text-gray-600">{loadingMessage}</p>
        </div>
      )}
      {successMessage && (
        <p className="mt-6 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {successMessage}
        </p>
      )}
      {errorMessage && (
        <p className="mt-6 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {errorMessage}
        </p>
      )}
    </section>

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
      defaultPdfProxyUrl={defaultPdfProxyUrl}
      shareStoragePreferences={shareStoragePreferences}
      setShareStoragePreferences={setShareStoragePreferences}
      onTestShareStorage={onTestShareStorage}
      shareStorageTestState={shareStorageTestState}
      isProxyConfigured={isProxyConfigured}
    />
  </div>
);

export default GenerateTab;
