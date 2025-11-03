import React from 'react';
import { FilterOptions, FilterSelectOptions } from '../types';

interface EventFiltersProps {
  filters: FilterOptions;
  setFilters: React.Dispatch<React.SetStateAction<FilterOptions>>;
  options: FilterSelectOptions;
}

const EventFilters: React.FC<EventFiltersProps> = ({ filters, setFilters, options }) => {
  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const resetFilters = () => {
    setFilters({ day: 'all', ageGroup: 'all', stroke: 'all', distance: 'all', gender: 'all' });
  };


  return (
    <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 items-center">
        
        <div className="flex flex-col">
            <label htmlFor="day" className="mb-1 text-sm font-medium text-gray-700">Day</label>
            <select name="day" id="day" value={filters.day} onChange={handleFilterChange} className="p-2 border border-gray-300 rounded-md focus:ring-brand-cyan focus:border-brand-cyan">
            {options.days.map(opt => <option key={opt} value={opt}>{opt === 'all' ? 'All Days' : opt}</option>)}
            </select>
        </div>
        
        <div className="flex flex-col">
            <label htmlFor="ageGroup" className="mb-1 text-sm font-medium text-gray-700">Age Group</label>
            <select name="ageGroup" id="ageGroup" value={filters.ageGroup} onChange={handleFilterChange} className="p-2 border border-gray-300 rounded-md focus:ring-brand-cyan focus:border-brand-cyan">
            {options.ageGroups.map(opt => <option key={opt} value={opt}>{opt === 'all' ? 'All Ages' : opt}</option>)}
            </select>
        </div>

        <div className="flex flex-col">
            <label htmlFor="gender" className="mb-1 text-sm font-medium text-gray-700">Gender</label>
            <select name="gender" id="gender" value={filters.gender} onChange={handleFilterChange} className="p-2 border border-gray-300 rounded-md focus:ring-brand-cyan focus:border-brand-cyan">
            {options.genders.map(opt => <option key={opt} value={opt}>{opt === 'all' ? 'All Genders' : opt}</option>)}
            </select>
        </div>

        <div className="flex flex-col">
            <label htmlFor="stroke" className="mb-1 text-sm font-medium text-gray-700">Stroke</label>
            <select name="stroke" id="stroke" value={filters.stroke} onChange={handleFilterChange} className="p-2 border border-gray-300 rounded-md focus:ring-brand-cyan focus:border-brand-cyan">
            {options.strokes.map(opt => <option key={opt} value={opt}>{opt === 'all' ? 'All Strokes' : opt}</option>)}
            </select>
        </div>

        <div className="flex flex-col">
            <label htmlFor="distance" className="mb-1 text-sm font-medium text-gray-700">Distance</label>
            <select name="distance" id="distance" value={filters.distance} onChange={handleFilterChange} className="p-2 border border-gray-300 rounded-md focus:ring-brand-cyan focus:border-brand-cyan">
            {options.distances.map(opt => <option key={opt} value={opt}>{opt === 'all' ? 'All Distances' : opt}</option>)}
            </select>
        </div>

        <div className="flex flex-col mt-auto">
             <button 
                onClick={resetFilters} 
                className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors">
                Reset
            </button>
        </div>
      </div>
    </div>
  );
};

export default EventFilters;