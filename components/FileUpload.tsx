import React, { useRef } from 'react';

interface FileUploadProps {
  onFileChange: (files: FileList | null) => void;
  onExtract: () => void;
  fileCount: number;
  pdfUrl: string;
  onUrlChange: (url: string) => void;
}

const UploadIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
);


const FileUpload: React.FC<FileUploadProps> = ({ onFileChange, onExtract, fileCount, pdfUrl, onUrlChange }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileBoxClick = () => {
        fileInputRef.current?.click();
    };

    const isExtractDisabled = fileCount === 0 && !pdfUrl.trim();

  return (
    <div className="flex flex-col items-center justify-center p-8">
      
      <div className="w-full max-w-lg mb-6">
        <label htmlFor="pdf-url" className="block text-sm font-medium text-gray-700 mb-2">
          Enter PDF Link
        </label>
        <input 
          type="url"
          id="pdf-url"
          name="pdf-url"
          value={pdfUrl}
          onChange={(e) => onUrlChange(e.target.value)}
          placeholder="https://example.com/meet.pdf"
          className="w-full p-3 border border-gray-300 rounded-md focus:ring-brand-cyan focus:border-brand-cyan"
          aria-label="PDF URL Input"
        />
      </div>

      <div className="relative w-full max-w-lg flex items-center justify-center my-4">
          <div className="flex-grow border-t border-gray-300"></div>
          <span className="flex-shrink mx-4 text-gray-500 font-semibold">OR</span>
          <div className="flex-grow border-t border-gray-300"></div>
      </div>

      <div 
        role="button"
        tabIndex={0}
        aria-label="File Upload Area"
        className="w-full max-w-lg border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-brand-cyan transition-colors"
        onClick={handleFileBoxClick}
        onKeyDown={(e) => e.key === 'Enter' && handleFileBoxClick()}
        >
        <UploadIcon />
        <p className="mt-4 text-lg text-gray-600">
            {fileCount > 0 ? `${fileCount} file selected` : "Click to upload a PDF from your device"}
        </p>
        <p className="text-sm text-gray-500 mt-1">A single PDF file</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={(e) => onFileChange(e.target.files)}
          className="hidden"
        />
      </div>

      <button
        onClick={onExtract}
        disabled={isExtractDisabled}
        className="mt-8 px-8 py-3 bg-brand-blue text-white font-bold text-lg rounded-lg shadow-md hover:bg-brand-cyan disabled:bg-gray-400 disabled:cursor-not-allowed transition-all transform hover:scale-105"
      >
        Extract Events
      </button>
    </div>
  );
};

export default FileUpload;