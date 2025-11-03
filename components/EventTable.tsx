
import React, { useState } from 'react';
import { SwimEvent } from '../types';

interface EventTableProps {
  events: SwimEvent[];
  onUpdateEvent: (event: SwimEvent) => void;
  onDeleteEvent: (eventId: string) => void;
  readOnly?: boolean;
}

const EventTable: React.FC<EventTableProps> = ({ events, onUpdateEvent, onDeleteEvent, readOnly = false }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<SwimEvent | null>(null);

  const canModify = !readOnly;

  const handleEditClick = (event: SwimEvent) => {
    if (!canModify) {
      return;
    }
    setEditingId(event.id);
    setEditFormData({ ...event });
  };

  const handleCancelClick = () => {
    setEditingId(null);
    setEditFormData(null);
  };

  const handleSaveClick = () => {
    if (editFormData) {
      onUpdateEvent(editFormData);
    }
    setEditingId(null);
    setEditFormData(null);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (editFormData) {
      setEditFormData({ 
        ...editFormData, 
        [name]: name === 'distance' ? parseInt(value, 10) || 0 : value 
      });
    }
  };

  if (events.length === 0) {
    return (
      <div className="text-center py-12 px-6 bg-gray-50 rounded-lg">
        <p className="text-gray-600 text-lg">No events to display.</p>
        <p className="text-gray-500 text-sm">Add a new event or adjust filters.</p>
      </div>
    );
  }
  
  const renderEditableRow = (event: SwimEvent) => (
    <tr key={event.id} className="bg-yellow-50">
      <td className="px-2 py-2 whitespace-nowrap"><input type="text" name="eventNumber" value={editFormData?.eventNumber} onChange={handleChange} className="w-16 p-1 border rounded"/></td>
      <td className="px-2 py-2 whitespace-nowrap"><input type="text" name="day" value={editFormData?.day} onChange={handleChange} className="w-24 p-1 border rounded"/></td>
      <td className="px-2 py-2 whitespace-nowrap"><input type="text" name="ageGroup" value={editFormData?.ageGroup} onChange={handleChange} className="w-28 p-1 border rounded"/></td>
      <td className="px-2 py-2 whitespace-nowrap">
        <select name="gender" value={editFormData?.gender} onChange={handleChange} className="w-24 p-1 border rounded">
          <option value="Girls">Girls</option>
          <option value="Boys">Boys</option>
          <option value="Mixed">Mixed</option>
        </select>
      </td>
      <td className="px-2 py-2 whitespace-nowrap"><input type="number" name="distance" value={editFormData?.distance} onChange={handleChange} className="w-20 p-1 border rounded"/></td>
      <td className="px-2 py-2 whitespace-nowrap"><input type="text" name="stroke" value={editFormData?.stroke} onChange={handleChange} className="w-32 p-1 border rounded"/></td>
      <td className="px-2 py-2"><input type="text" name="originalDescription" value={editFormData?.originalDescription} onChange={handleChange} className="w-full p-1 border rounded"/></td>
      <td className="px-2 py-2 whitespace-nowrap text-right text-sm font-medium">
        <button onClick={handleSaveClick} className="text-green-600 hover:text-green-900 mr-3">Save</button>
        <button onClick={handleCancelClick} className="text-gray-600 hover:text-gray-900">Cancel</button>
      </td>
    </tr>
  );
  
  const renderRowActions = (event: SwimEvent) => (
    <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
      <button onClick={() => handleEditClick(event)} className="text-indigo-600 hover:text-indigo-900 mr-4">Edit</button>
      <button onClick={() => onDeleteEvent(event.id)} className="text-red-600 hover:text-red-900">Delete</button>
    </td>
  );

  const renderReadOnlyRow = (event: SwimEvent) => (
      <tr key={event.id} className="hover:bg-brand-teal hover:bg-opacity-20 transition-colors">
        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{event.eventNumber}</td>
        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{event.day}</td>
        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{event.ageGroup}</td>
        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{event.gender}</td>
        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{event.distance}</td>
        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{event.stroke}</td>
        <td className="px-4 py-3 text-sm text-gray-500 italic">{event.originalDescription}</td>
        {canModify && renderRowActions(event)}
      </tr>
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Event #</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Day</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Age Group</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gender</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Distance</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stroke</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Original Description</th>
            {canModify && <th scope="col" className="relative px-4 py-3"><span className="sr-only">Actions</span></th>}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {events.map((event) => (
            canModify && editingId === event.id ? renderEditableRow(event) : renderReadOnlyRow(event)
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default EventTable;
