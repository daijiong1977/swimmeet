import {
  FilterOptions,
  FilterSelectOptions,
  RawSwimEvent,
  ShareableEvent,
  SwimEvent,
} from '../types';

export const DEFAULT_FILTERS: FilterOptions = {
  day: 'all',
  ageGroup: 'all',
  stroke: 'all',
  distance: 'all',
  gender: 'all',
};

export const createEmptyEvent = (): SwimEvent => ({
  id: crypto.randomUUID(),
  eventNumber: '',
  day: '',
  ageGroup: '',
  gender: 'Mixed',
  distance: 0,
  stroke: '',
  originalDescription: '',
});

export const processRawEvents = (rawEvents: RawSwimEvent[]): SwimEvent[] => {
  const processed: SwimEvent[] = [];
  rawEvents.forEach((event) => {
    const base = { ...event };
    if (event.eventNumber.includes('-')) {
      const [startStr, endStr] = event.eventNumber.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (
        !Number.isNaN(start) &&
        !Number.isNaN(end) &&
        end === start + 1 &&
        start % 2 === 1
      ) {
        processed.push({
          ...base,
          id: crypto.randomUUID(),
          eventNumber: String(start),
          gender: 'Girls',
        });
        processed.push({
          ...base,
          id: crypto.randomUUID(),
          eventNumber: String(end),
          gender: 'Boys',
        });
      } else {
        processed.push({ ...base, id: crypto.randomUUID(), gender: 'Mixed' });
      }
    } else {
      const number = parseInt(event.eventNumber, 10);
      const gender: SwimEvent['gender'] = Number.isNaN(number)
        ? 'Mixed'
        : number % 2 === 1
        ? 'Girls'
        : 'Boys';
      processed.push({ ...base, id: crypto.randomUUID(), gender });
    }
  });
  return processed;
};

export const toShareableEvents = (events: SwimEvent[]): ShareableEvent[] =>
  events.map(({ id, ...rest }) => rest);

export const toSwimEvents = (events: ShareableEvent[]): SwimEvent[] =>
  events.map((event) => ({ ...event, id: crypto.randomUUID() }));

export const computeFilterOptions = (events: SwimEvent[]): FilterSelectOptions => {
  const days = new Set<string>(['all']);
  const ageGroups = new Set<string>(['all']);
  const strokes = new Set<string>(['all']);
  const distances = new Set<string>(['all']);
  const genders = new Set<string>(['all']);

  events.forEach((event) => {
    if (event.day) {
      days.add(event.day);
    }
    if (event.ageGroup) {
      ageGroups.add(event.ageGroup);
    }
    if (event.stroke) {
      strokes.add(event.stroke);
    }
    if (event.distance) {
      distances.add(String(event.distance));
    }
    if (event.gender) {
      genders.add(event.gender);
    }
  });

  const sortValues = (values: Set<string>) =>
    Array.from(values).sort((a, b) => {
      if (a === 'all') return -1;
      if (b === 'all') return 1;
      return a.localeCompare(b);
    });

  return {
    days: sortValues(days),
    ageGroups: sortValues(ageGroups),
    strokes: sortValues(strokes),
    distances: sortValues(distances),
    genders: sortValues(genders),
  };
};

export const applyFilters = (
  events: SwimEvent[],
  filters: FilterOptions,
): SwimEvent[] =>
  events.filter((event) => {
    if (filters.day !== 'all' && event.day !== filters.day) {
      return false;
    }
    if (filters.ageGroup !== 'all' && event.ageGroup !== filters.ageGroup) {
      return false;
    }
    if (filters.stroke !== 'all' && event.stroke !== filters.stroke) {
      return false;
    }
    if (
      filters.distance !== 'all' &&
      String(event.distance) !== filters.distance
    ) {
      return false;
    }
    if (filters.gender !== 'all' && event.gender !== filters.gender) {
      return false;
    }
    return true;
  });

const parseCsvLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
};

export const parseCsvFile = async (file: File): Promise<SwimEvent[]> => {
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return [];
  }
  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
  const getValue = (row: string[], key: string) => {
    const index = headers.indexOf(key.toLowerCase());
    return index >= 0 ? row[index] ?? '' : '';
  };
  const events: SwimEvent[] = [];
  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    const distanceValue = parseInt(getValue(row, 'distance'), 10);
    events.push({
      id: crypto.randomUUID(),
      eventNumber: getValue(row, 'eventnumber') || getValue(row, 'event_number'),
      day: getValue(row, 'day'),
      ageGroup: getValue(row, 'agegroup') || getValue(row, 'age_group'),
      gender: (getValue(row, 'gender') as SwimEvent['gender']) || 'Mixed',
      distance: Number.isNaN(distanceValue) ? 0 : distanceValue,
      stroke: getValue(row, 'stroke'),
      originalDescription:
        getValue(row, 'originaldescription') || getValue(row, 'original_description'),
    });
  }
  return events;
};

const createCsvRow = (values: Array<string | number>): string =>
  values
    .map((value) => {
      const stringValue = String(value ?? '');
      if (/[,"\n]/.test(stringValue)) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    })
    .join(',');

export const exportEventsToCsv = (events: SwimEvent[]): string => {
  const header = createCsvRow([
    'eventNumber',
    'day',
    'ageGroup',
    'gender',
    'distance',
    'stroke',
    'originalDescription',
  ]);
  const rows = events.map((event) =>
    createCsvRow([
      event.eventNumber,
      event.day,
      event.ageGroup,
      event.gender,
      event.distance,
      event.stroke,
      event.originalDescription,
    ]),
  );
  return [header, ...rows].join('\n');
};
