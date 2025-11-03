import React from 'react';
import { MeetInfo } from '../types';

interface InfoCardProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}

const InfoCard: React.FC<InfoCardProps> = ({ icon, title, children }) => (
  <div className="flex items-start space-x-4 p-4 bg-white rounded-lg shadow-sm">
    <div className="flex-shrink-0 text-brand-cyan">{icon}</div>
    <div>
      <p className="text-sm font-semibold text-gray-500">{title}</p>
      <p className="text-md text-brand-dark">{children}</p>
    </div>
  </div>
);

const CalendarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const LocationIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const LimitIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const AwardIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
  </svg>
);


const MeetInfoDisplay: React.FC<{ info: MeetInfo }> = ({ info }) => {
  return (
    <div className="p-4 sm:p-6 bg-gray-50 rounded-xl border border-gray-200">
      <h2 className="text-2xl sm:text-3xl font-bold text-brand-blue mb-4 text-center">{info.meetName}</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InfoCard icon={<CalendarIcon />} title="Dates">{info.dates}</InfoCard>
        <InfoCard icon={<LocationIcon />} title="Location">{info.location}</InfoCard>
        <InfoCard icon={<LimitIcon />} title="Entry Limits">{info.entryLimits}</InfoCard>
        <InfoCard icon={<AwardIcon />} title="Awards">{info.awards}</InfoCard>
      </div>

      {info.sessionDetails && info.sessionDetails.length > 0 && (
        <div className="mt-6">
            <h3 className="text-lg font-semibold text-brand-dark mb-2">Session Schedule</h3>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100">
                        <tr>
                            <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Session</th>
                            <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Warm-up</th>
                            <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Time</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {info.sessionDetails.map((session, index) => (
                            <tr key={index}>
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-800">{session.session}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{session.warmUp}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{session.startTime}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      )}
    </div>
  );
};

export default MeetInfoDisplay;
