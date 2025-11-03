
import { GoogleGenAI, Type } from '@google/genai';
import { MeetData, GeminiModel } from '../types';

const fileToGenerativePart = async (file: File) => {
  const base64EncodedData = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });
  return {
    inlineData: {
      data: base64EncodedData,
      mimeType: file.type,
    },
  };
};

export const extractMeetDataFromImages = async (
  files: File[],
  apiKey: string,
  model: GeminiModel
): Promise<MeetData> => {
  if (!apiKey) {
    throw new Error("API Key is missing.");
  }
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    You are an expert at extracting structured data from documents about swimming competitions.
    Analyze the provided images of a swim meet announcement.
    Extract the general meet information AND all individual and relay swimming events into a single, structured JSON object.
    The object must have two top-level keys: "meetInfo" and "events".

    1. For the "meetInfo" object, extract the following details:
      - meetName: The full, official title of the swim meet.
      - dates: The full date range of the meet (e.g., "November 14-16, 2025").
      - location: The full address of the venue.
      - entryLimits: A brief summary of the entry limitations (e.g., "4 individual events per session").
      - awards: A brief summary of the awards given (e.g., "Medals 1st-3rd, Ribbons 4th-8th for 12 & younger events").
      - sessionDetails: An array of objects, where each object represents a distinct session and contains:
        - session: The name of the session (e.g., "Friday", "Saturday AM", "Saturday PM - 11 & Older").
        - warmUp: The warm-up time for that session.
        - startTime: The start time for that session.

    2. For the "events" array, extract all swimming events. For each event, provide:
      - eventNumber: The number or range of numbers for the event (e.g., "1-2", "9-10").
      - ageGroup: The designated age group for the event (e.g., "12 & Under", "Senior", "9 & 10").
      - distance: The numerical distance of the race (e.g., 200, 400, 50).
      - stroke: The swimming stroke. Use common names like "Freestyle", "Backstroke", "Breaststroke", "Butterfly", "Individual Medley", "Freestyle Relay", "Medley Relay". Abbreviate "F.R." as "Freestyle Relay" and "M.R." as "Medley Relay".
      - day: The day and session the event occurs. Use identifiers like "Friday", "Saturday AM", "Saturday PM", "Sunday AM", "Sunday PM". Determine AM/PM sessions based on headers and event sequencing.
      - originalDescription: The full, original, verbatim text for the event line as it appears in the document. For example, "200 Individual Medley". This is for verification.
    
    Important rules:
    - Do not include warm-up information in the main "events" array.
    - The response must be a valid JSON object and nothing else.
  `;

  const imageParts = await Promise.all(files.map(fileToGenerativePart));
  
  const response = await ai.models.generateContent({
    model: model,
    contents: { parts: [...imageParts, { text: prompt }] },
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          meetInfo: {
            type: Type.OBJECT,
            properties: {
              meetName: { type: Type.STRING },
              dates: { type: Type.STRING },
              location: { type: Type.STRING },
              entryLimits: { type: Type.STRING },
              awards: { type: Type.STRING },
              sessionDetails: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    session: { type: Type.STRING },
                    warmUp: { type: Type.STRING },
                    startTime: { type: Type.STRING },
                  },
                  required: ['session', 'warmUp', 'startTime']
                }
              }
            },
            required: ['meetName', 'dates', 'location', 'entryLimits', 'awards', 'sessionDetails']
          },
          events: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                eventNumber: { type: Type.STRING },
                ageGroup: { type: Type.STRING },
                distance: { type: Type.NUMBER },
                stroke: { type: Type.STRING },
                day: { type: Type.STRING },
                originalDescription: { type: Type.STRING }
              },
              required: ['eventNumber', 'ageGroup', 'distance', 'stroke', 'day', 'originalDescription'],
            },
          },
        },
        required: ['meetInfo', 'events']
      },
    },
  });

  try {
    const jsonString = response.text.trim();
    const result = JSON.parse(jsonString);
    if (typeof result !== 'object' || result === null || !result.meetInfo || !Array.isArray(result.events)) {
      throw new Error("API did not return the expected JSON object structure.");
    }
    return result as MeetData;
  } catch (e) {
    console.error("Failed to parse JSON response:", response.text);
    throw new Error(`The API returned an invalid data format. ${e instanceof Error ? e.message : ''}`);
  }
};
