
import React from 'react';

interface SheetEmbedProps {
  url: string;
}

const SheetEmbed: React.FC<SheetEmbedProps> = ({ url }) => {
  const getEmbedUrl = (originalUrl: string): string | null => {
    try {
      const urlObj = new URL(originalUrl);
      if (urlObj.hostname !== 'docs.google.com' || !urlObj.pathname.includes('/spreadsheets/d/')) {
        return null;
      }
      // Re-construct the URL to be in the /embed format
      const pathParts = urlObj.pathname.split('/');
      const sheetIdIndex = pathParts.findIndex(part => part === 'd') + 1;
      if (sheetIdIndex > 0 && pathParts[sheetIdIndex]) {
        const sheetId = pathParts[sheetIdIndex];
        return `https://docs.google.com/spreadsheets/d/${sheetId}/edit?usp=sharing&widget=true&headers=false`;
      }
      return null;
    } catch (e) {
      return null;
    }
  };

  const embedUrl = getEmbedUrl(url);

  if (!embedUrl) {
    return (
        <div className="mt-8 p-4 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-700">
            <p>The provided URL is not a valid Google Sheet link. Please check the URL and try again.</p>
        </div>
    );
  }

  return (
    <div className="mt-8">
      <h2 className="text-2xl font-bold text-brand-dark mb-4">Embedded Google Sheet</h2>
      <div className="aspect-w-16 aspect-h-9 border border-gray-300 rounded-lg overflow-hidden">
        <iframe
          src={embedUrl}
          className="w-full h-[600px]"
          title="Embedded Google Sheet"
          allowFullScreen
        ></iframe>
      </div>
    </div>
  );
};

export default SheetEmbed;
