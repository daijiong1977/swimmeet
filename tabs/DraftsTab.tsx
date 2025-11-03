import React from 'react';
import Spinner from '../components/Spinner';
import MeetInfoEditor from '../components/MeetInfoEditor';
import DataActions from '../components/DataActions';
import EventFilters from '../components/EventFilters';
import EventTable from '../components/EventTable';
import SheetEmbed from '../components/SheetEmbed';
import {
  FilterOptions,
  FilterSelectOptions,
  MeetInfo,
  MeetMetadata,
  SwimEvent,
} from '../types';

interface DraftsTabProps {
  draftMeets: MeetMetadata[];
  publishedMeets: MeetMetadata[];
  draftsLoading: boolean;
  publishedLoading: boolean;
  onSelectMeet: (metadata: MeetMetadata) => void;
  onDeleteMeet: (metadata: MeetMetadata) => void;
  selectedMetadata: MeetMetadata | null;
  editorMeetInfo: MeetInfo | null;
  filteredEvents: SwimEvent[];
  filterOptions: FilterSelectOptions;
  editorFilters: FilterOptions;
  setEditorFilters: React.Dispatch<React.SetStateAction<FilterOptions>>;
  onChangeMeetInfo: (info: MeetInfo) => void;
  onAddEvent: () => void;
  onUpdateEvent: (event: SwimEvent) => void;
  onDeleteEvent: (eventId: string) => void;
  onExportCsv: () => void;
  onImportCsv: (file: File) => void;
  onSave: () => void;
  onPublish: () => void;
  editorLoading: boolean;
  editorMessage: string | null;
  editorError: string | null;
  canPublish: boolean;
  publishResult: { url: string; copied: boolean } | null;
  onCopyPublishLink: () => void;
  onDismissPublishResult: () => void;
  googleSheetUrl: string;
  formatDateTime: (value?: string) => string;
}

const DraftsTab: React.FC<DraftsTabProps> = ({
  draftMeets,
  publishedMeets,
  draftsLoading,
  publishedLoading,
  onSelectMeet,
  onDeleteMeet,
  selectedMetadata,
  editorMeetInfo,
  filteredEvents,
  filterOptions,
  editorFilters,
  setEditorFilters,
  onChangeMeetInfo,
  onAddEvent,
  onUpdateEvent,
  onDeleteEvent,
  onExportCsv,
  onImportCsv,
  onSave,
  onPublish,
  editorLoading,
  editorMessage,
  editorError,
  canPublish,
  publishResult,
  onCopyPublishLink,
  onDismissPublishResult,
  googleSheetUrl,
  formatDateTime,
}) => {
  const renderMeetList = (
    title: string,
    meets: MeetMetadata[],
    loading: boolean,
    emptyMessage: string,
  ) => (
    <section className="space-y-2">
      <header className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-brand-dark">{title}</h3>
        {loading && <Spinner />}
      </header>
      {meets.length === 0 && !loading ? (
        <p className="text-sm text-gray-500">{emptyMessage}</p>
      ) : (
        <ul className="space-y-2">
          {meets.map((metadata) => (
            <li
              key={metadata.id}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 transition-colors ${
                selectedMetadata?.id === metadata.id
                  ? 'border-brand-cyan bg-brand-cyan/10'
                  : 'border-gray-200 bg-white hover:border-brand-cyan'
              }`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-800">
                  {metadata.meetName}
                </p>
                <p className="text-xs text-gray-500">
                  Updated {formatDateTime(metadata.updatedAt)} · {metadata.eventsCount} events
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onSelectMeet(metadata)}
                  className="rounded-md bg-brand-blue px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-blue/90"
                >
                  Open
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteMeet(metadata)}
                  className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {renderMeetList(
          'Draft Meets',
          draftMeets,
          draftsLoading,
          'No drafts yet. Generate a meet to create one.',
        )}
        {renderMeetList(
          'Published Meets',
          publishedMeets,
          publishedLoading,
          'Nothing published yet. Publish a draft to share.',
        )}
      </div>

      {selectedMetadata && editorMeetInfo && (
        <section className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold text-brand-dark">
                {selectedMetadata.meetName}
              </h2>
              <p className="text-sm text-gray-500">
                Status: {selectedMetadata.status === 'draft' ? 'Draft' : 'Published'} · Updated{' '}
                {formatDateTime(selectedMetadata.updatedAt)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onSave}
                className="rounded-md bg-brand-cyan px-4 py-2 text-sm font-semibold text-white hover:bg-brand-cyan/90"
                disabled={editorLoading}
              >
                {editorLoading ? 'Saving…' : 'Save changes'}
              </button>
              <button
                type="button"
                onClick={onPublish}
                className={`rounded-md px-4 py-2 text-sm font-semibold ${
                  canPublish
                    ? 'bg-brand-orange text-white hover:bg-brand-orange/90'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
                disabled={!canPublish || editorLoading}
              >
                Publish share link
              </button>
            </div>
          </header>

          {editorMessage && (
            <p className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              {editorMessage}
            </p>
          )}
          {editorError && (
            <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              {editorError}
            </p>
          )}

          {publishResult && (
            <div className="rounded-lg border border-brand-orange/40 bg-brand-orange/10 p-4 text-sm text-brand-dark">
              <p className="font-semibold">Share link ready!</p>
              <p className="break-all text-xs">{publishResult.url}</p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={onCopyPublishLink}
                  className="rounded-md bg-brand-orange px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-orange/90"
                >
                  {publishResult.copied ? 'Copied!' : 'Copy link'}
                </button>
                <button
                  type="button"
                  onClick={onDismissPublishResult}
                  className="text-xs font-semibold text-gray-600 hover:underline"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          <MeetInfoEditor
            info={editorMeetInfo}
            onChange={onChangeMeetInfo}
            readOnly={editorLoading}
          />

          <DataActions
            onAddEvent={onAddEvent}
            onExport={onExportCsv}
            onImport={onImportCsv}
            onPublish={onPublish}
            canPublish={canPublish}
          />

          <EventFilters
            filters={editorFilters}
            setFilters={setEditorFilters}
            options={filterOptions}
          />

          <EventTable
            events={filteredEvents}
            onUpdateEvent={onUpdateEvent}
            onDeleteEvent={onDeleteEvent}
          />
        </section>
      )}

      {googleSheetUrl && <SheetEmbed url={googleSheetUrl} />}
    </div>
  );
};

export default DraftsTab;
