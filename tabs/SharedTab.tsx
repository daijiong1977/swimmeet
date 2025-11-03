import React from 'react';
import Spinner from '../components/Spinner';
import MeetInfoDisplay from '../components/MeetInfoDisplay';
import EventTable from '../components/EventTable';
import PublishedLinks from '../components/PublishedLinks';
import { MeetInfo, PublishedLink, SwimEvent } from '../types';

interface SharedTabProps {
  isSharedUrlView: boolean;
  sharedViewLoading: boolean;
  sharedViewError: string | null;
  sharedViewInfo: MeetInfo | null;
  sharedViewEvents: SwimEvent[];
  sharedGeneratedAt: string | null;
  formatDateTime: (value?: string) => string;
  publishedLinks: PublishedLink[];
  onRemovePublishedLink: (id: string) => void;
}

const SharedTab: React.FC<SharedTabProps> = ({
  isSharedUrlView,
  sharedViewLoading,
  sharedViewError,
  sharedViewInfo,
  sharedViewEvents,
  sharedGeneratedAt,
  formatDateTime,
  publishedLinks,
  onRemovePublishedLink,
}) => {
  if (isSharedUrlView) {
    return (
      <section className="space-y-4">
        {sharedViewLoading && (
          <div className="flex items-center justify-center py-10">
            <Spinner />
          </div>
        )}
        {sharedViewError && (
          <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            {sharedViewError}
          </p>
        )}
        {!sharedViewLoading && !sharedViewError && sharedViewInfo && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow">
              <div className="mb-3 text-xs text-gray-500">
                Generated {formatDateTime(sharedGeneratedAt ?? undefined)}
              </div>
              <MeetInfoDisplay info={sharedViewInfo} />
            </div>
            <EventTable
              events={sharedViewEvents}
              onUpdateEvent={() => undefined}
              onDeleteEvent={() => undefined}
              readOnly
            />
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow">
        <h2 className="text-2xl font-semibold text-brand-dark">Published meet links</h2>
        <p className="text-sm text-gray-500">
          Copy a link below or remove it to revoke access. Publish from the Drafts tab to add more.
        </p>
      </div>
      <PublishedLinks links={publishedLinks} onRemove={onRemovePublishedLink} />
    </section>
  );
};

export default SharedTab;
