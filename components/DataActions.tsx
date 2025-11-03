
import React, { useRef } from 'react';

interface DataActionsProps {
  onAddEvent: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onPublish: () => void;
  canPublish: boolean;
}

const DataActions: React.FC<DataActionsProps> = ({ onAddEvent, onExport, onImport, onPublish, canPublish }) => {
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImport(file);
    }
  };

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-800">Data Management</h3>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onAddEvent}
          className="px-4 py-2 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-colors"
        >
          Add Event
        </button>
        <button
          onClick={onExport}
          className="px-4 py-2 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition-colors"
        >
          Export to CSV
        </button>
        <button
          onClick={handleImportClick}
          className="px-4 py-2 bg-purple-500 text-white font-semibold rounded-lg hover:bg-purple-600 transition-colors"
        >
          Import from CSV
        </button>
        <button
          onClick={onPublish}
          disabled={!canPublish}
          className={`px-4 py-2 font-semibold rounded-lg transition-colors ${canPublish ? 'bg-brand-orange text-white hover:bg-brand-orange/90' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
        >
          Publish share link
        </button>
        <input
          type="file"
          ref={importInputRef}
          accept=".csv"
          onChange={handleFileImport}
          className="hidden"
        />
      </div>
    </div>
  );
};

export default DataActions;
