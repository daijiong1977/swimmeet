import React from 'react';
import { MeetInfo, SessionDetail } from '../types';

interface MeetInfoEditorProps {
  info: MeetInfo | null;
  onChange: (info: MeetInfo) => void;
  readOnly?: boolean;
}

const emptySession: SessionDetail = {
  session: '',
  warmUp: '',
  startTime: '',
};

const MeetInfoEditor: React.FC<MeetInfoEditorProps> = ({ info, onChange, readOnly = false }) => {
  if (!info) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
        No meet information available yet.
      </div>
    );
  }

  const updateField = (key: keyof MeetInfo, value: string | SessionDetail[]) => {
    onChange({ ...info, [key]: value } as MeetInfo);
  };

  const updateSession = (index: number, key: keyof SessionDetail, value: string) => {
    const updatedSessions = info.sessionDetails.map((session, idx) =>
      idx === index ? { ...session, [key]: value } : session
    );
    updateField('sessionDetails', updatedSessions);
  };

  const addSession = () => {
    updateField('sessionDetails', [...info.sessionDetails, { ...emptySession }]);
  };

  const removeSession = (index: number) => {
    const updatedSessions = info.sessionDetails.filter((_, idx) => idx !== index);
    updateField('sessionDetails', updatedSessions);
  };

  const renderInput = (
    id: string,
    label: string,
    value: string,
    onValueChange: (value: string) => void,
    options?: { textarea?: boolean }
  ) => (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      {options?.textarea ? (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          disabled={readOnly}
          className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-cyan focus:border-brand-cyan disabled:bg-gray-100 disabled:text-gray-500"
          rows={3}
        />
      ) : (
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          disabled={readOnly}
          className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-cyan focus:border-brand-cyan disabled:bg-gray-100 disabled:text-gray-500"
        />
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderInput('meetName', 'Meet Name', info.meetName, (value) => updateField('meetName', value))}
        {renderInput('dates', 'Dates', info.dates, (value) => updateField('dates', value))}
        {renderInput('location', 'Location', info.location, (value) => updateField('location', value), { textarea: true })}
        {renderInput('entryLimits', 'Entry Limits', info.entryLimits, (value) => updateField('entryLimits', value), { textarea: true })}
      </div>
      {renderInput('awards', 'Awards', info.awards, (value) => updateField('awards', value), { textarea: true })}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">Session Details</h3>
          {!readOnly && (
            <button
              type="button"
              onClick={addSession}
              className="px-3 py-1.5 text-sm font-semibold text-white bg-brand-blue rounded-md hover:bg-brand-blue/90 transition-colors"
            >
              Add Session
            </button>
          )}
        </div>
        {info.sessionDetails.length === 0 ? (
          <p className="text-sm text-gray-500">No session details recorded.</p>
        ) : (
          <div className="space-y-3">
            {info.sessionDetails.map((session, index) => (
              <div key={`session-${index}`} className="p-4 border border-gray-200 rounded-lg bg-white space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {renderInput(
                    `session-${index}`,
                    'Session Name',
                    session.session,
                    (value) => updateSession(index, 'session', value)
                  )}
                  {renderInput(
                    `warmup-${index}`,
                    'Warm-up',
                    session.warmUp,
                    (value) => updateSession(index, 'warmUp', value)
                  )}
                  {renderInput(
                    `start-${index}`,
                    'Start Time',
                    session.startTime,
                    (value) => updateSession(index, 'startTime', value)
                  )}
                </div>
                {!readOnly && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeSession(index)}
                      className="px-3 py-1 text-xs font-semibold text-red-600 border border-red-200 rounded-md hover:bg-red-50 transition-colors"
                    >
                      Remove Session
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MeetInfoEditor;
