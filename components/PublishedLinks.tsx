import React, { useState } from 'react';
import { PublishedLink } from '../types';

type PublishedLinksProps = {
  links: PublishedLink[];
  onRemove: (id: string) => void;
};

const PublishedLinks: React.FC<PublishedLinksProps> = ({ links, onRemove }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (links.length === 0) {
    return null;
  }

  const handleCopy = async (link: PublishedLink) => {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopiedId(link.id);
      setTimeout(() => setCopiedId(null), 2500);
    } catch (error) {
      console.error('Failed to copy link:', error);
      setCopiedId(null);
    }
  };

  return (
    <section className="mb-6 bg-white rounded-2xl shadow p-5 border border-gray-200">
      <header className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-semibold text-brand-dark">Published Meet Links</h2>
          <p className="text-sm text-gray-500">Share these read-only views with athletes. ({links.length})</p>
        </div>
      </header>
      <ul className="space-y-3">
        {links.map((link) => (
          <li key={link.id} className="flex flex-wrap items-start justify-between gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="min-w-0">
              <p className="text-base font-semibold text-gray-800 truncate" title={link.meetName}>{link.meetName}</p>
              <p className="text-sm text-gray-500">Published on {new Date(link.createdAt).toLocaleString()} · {link.eventsCount} events</p>
              <a href={link.url} className="text-sm text-brand-cyan break-all" target="_blank" rel="noreferrer">
                {link.url}
              </a>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => handleCopy(link)}
                className="px-3 py-1.5 text-sm font-semibold text-white bg-brand-blue rounded-md hover:bg-brand-blue/90 transition-colors"
              >
                {copiedId === link.id ? 'Copied!' : 'Copy link'}
              </button>
              <button
                type="button"
                onClick={() => onRemove(link.id)}
                className="px-3 py-1.5 text-sm font-semibold text-red-600 border border-red-200 rounded-md hover:bg-red-50 transition-colors"
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default PublishedLinks;
