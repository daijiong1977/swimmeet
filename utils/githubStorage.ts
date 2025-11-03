import {
  MeetMetadata,
  MeetStatus,
  ShareStorageMetadata,
  ShareStoragePreferences,
  StoredShareData,
} from '../types';
import { base64Decode, base64Encode } from './shareEncoding';

const STATUS_FOLDER: Record<MeetStatus, string> = {
  draft: 'drafts',
  published: 'published',
};

const DEFAULT_SHARE_STORAGE_PREFS: ShareStoragePreferences = {
  githubOwner: '',
  githubRepo: '',
  githubBranch: 'main',
  githubFolder: 'public/shares',
  githubToken: '',
};

export const makeCommitMessage = (action: string, name: string, id: string) =>
  `${action} ${name || 'meet'} (${id})`;

export const sanitizeFolder = (folder: string): string => {
  const trimmed = folder.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.replace(/^\/+/, '').replace(/\/+$/, '');
};

export const buildStatusFolder = (
  status: MeetStatus,
  prefs: ShareStoragePreferences,
): string => {
  const base = sanitizeFolder(
    prefs.githubFolder || DEFAULT_SHARE_STORAGE_PREFS.githubFolder,
  );
  const suffix = STATUS_FOLDER[status];
  return sanitizeFolder(base ? `${base}/${suffix}` : suffix);
};

export const buildStorageFilePath = (metadata: ShareStorageMetadata): string => {
  const folder = sanitizeFolder(metadata.path);
  return `${folder ? `${folder}/` : ''}${metadata.id}.json`;
};

const buildGithubHeaders = (token?: string) => {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
  };
  if (token && token.trim()) {
    headers.Authorization = `token ${token.trim()}`;
  }
  return headers;
};

export const ensureStorageConfigured = (prefs: ShareStoragePreferences) =>
  Boolean(prefs.githubOwner) &&
  Boolean(prefs.githubRepo) &&
  Boolean(prefs.githubToken);

export const createMeetMetadata = (
  data: StoredShareData,
  storage: ShareStorageMetadata,
  sha: string,
): MeetMetadata => ({
  id: storage.id,
  meetName: data.meetInfo?.meetName || 'Untitled Meet',
  status: data.status ?? 'draft',
  createdAt: data.generatedAt || new Date().toISOString(),
  updatedAt: data.updatedAt || data.generatedAt || new Date().toISOString(),
  eventsCount: Array.isArray(data.events) ? data.events.length : 0,
  storage,
  sha,
  shareToken: data.shareToken,
});

export interface GitHubSaveResult {
  metadata: ShareStorageMetadata;
  sha: string;
}

export const deleteShareFromGitHub = async (
  metadata: ShareStorageMetadata,
  sha: string,
  prefs: ShareStoragePreferences,
  message?: string,
): Promise<void> => {
  if (!ensureStorageConfigured(prefs)) {
    throw new Error('GitHub storage is not fully configured.');
  }
  const filePath = buildStorageFilePath(metadata);
  const deleteUrl = `https://api.github.com/repos/${metadata.owner}/${metadata.repo}/contents/${filePath}`;
  const response = await fetch(deleteUrl, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...buildGithubHeaders(prefs.githubToken),
    },
    body: JSON.stringify({
      message: message || makeCommitMessage('Delete meet', metadata.id, metadata.id),
      sha,
      branch: metadata.branch,
    }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    console.error('GitHub delete failed:', response.status, body);
    throw new Error('Failed to delete meet from GitHub.');
  }
};

export const saveShareToGitHub = async (
  data: StoredShareData,
  status: MeetStatus,
  prefs: ShareStoragePreferences,
  existing?: MeetMetadata,
): Promise<GitHubSaveResult> => {
  if (!ensureStorageConfigured(prefs)) {
    throw new Error(
      'GitHub storage is not fully configured. Provide owner, repo, and a token.',
    );
  }

  const branch = prefs.githubBranch || DEFAULT_SHARE_STORAGE_PREFS.githubBranch;
  const folder = buildStatusFolder(status, prefs);
  const id = existing?.id ?? crypto.randomUUID();
  const targetPath = `${folder ? `${folder}/` : ''}${id}.json`;

  if (existing && sanitizeFolder(existing.storage.path) !== folder) {
    await deleteShareFromGitHub(
      existing.storage,
      existing.sha,
      prefs,
      makeCommitMessage('Move meet', existing.meetName, existing.id),
    );
    existing = undefined;
  }

  const uploadUrl = `https://api.github.com/repos/${prefs.githubOwner}/${prefs.githubRepo}/contents/${targetPath}`;
  const payload = base64Encode(JSON.stringify(data));
  const body: Record<string, unknown> = {
    message: makeCommitMessage('Save meet', data.meetInfo?.meetName || 'Untitled', id),
    content: payload,
    branch,
  };
  if (existing?.sha) {
    body.sha = existing.sha;
  }

  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...buildGithubHeaders(prefs.githubToken),
    },
    body: JSON.stringify(body),
  });
  const responseBody = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('GitHub upload failed:', response.status, responseBody);
    throw new Error('Failed to upload meet to GitHub. Check token permissions and branch.');
  }

  const sha = responseBody?.content?.sha;
  if (!sha || typeof sha !== 'string') {
    throw new Error('GitHub response did not include file SHA.');
  }

  const metadata: ShareStorageMetadata = {
    type: 'github',
    owner: prefs.githubOwner,
    repo: prefs.githubRepo,
    branch,
    path: folder,
    id,
  };

  return { metadata, sha };
};

export const fetchStoredShareData = async (
  metadata: ShareStorageMetadata,
  prefs: ShareStoragePreferences,
): Promise<{ data: StoredShareData; sha: string }> => {
  const filePath = buildStorageFilePath(metadata);
  const url = `https://api.github.com/repos/${metadata.owner}/${metadata.repo}/contents/${filePath}?ref=${metadata.branch}`;
  const response = await fetch(url, { headers: buildGithubHeaders(prefs.githubToken) });
  if (!response.ok) {
    throw new Error(`Failed to load meet data (${response.status}).`);
  }
  const body = await response.json();
  const content = typeof body.content === 'string' ? body.content : '';
  const decoded = base64Decode(content.replace(/\n/g, ''));
  const parsed = JSON.parse(decoded) as StoredShareData;
  const sha = typeof body.sha === 'string' ? body.sha : metadata.id;
  return { data: parsed, sha };
};

export const listMeetsFromGitHub = async (
  status: MeetStatus,
  prefs: ShareStoragePreferences,
): Promise<Array<{ metadata: MeetMetadata; data: StoredShareData }>> => {
  if (!ensureStorageConfigured(prefs)) {
    return [];
  }
  const branch = prefs.githubBranch || DEFAULT_SHARE_STORAGE_PREFS.githubBranch;
  const folder = buildStatusFolder(status, prefs);
  const listUrl = `https://api.github.com/repos/${prefs.githubOwner}/${prefs.githubRepo}/contents/${folder}?ref=${branch}`;
  const response = await fetch(listUrl, { headers: buildGithubHeaders(prefs.githubToken) });
  if (response.status === 404) {
    return [];
  }
  if (!response.ok) {
    throw new Error(`Failed to list ${status} meets (${response.status}).`);
  }
  const entries = await response.json();
  if (!Array.isArray(entries)) {
    return [];
  }
  const results: Array<{ metadata: MeetMetadata; data: StoredShareData }> = [];
  for (const entry of entries) {
    if (
      !entry ||
      entry.type !== 'file' ||
      typeof entry.name !== 'string' ||
      !entry.name.endsWith('.json')
    ) {
      continue;
    }
    const id = entry.name.replace(/\.json$/, '');
    const fileMetadata: ShareStorageMetadata = {
      type: 'github',
      owner: prefs.githubOwner,
      repo: prefs.githubRepo,
      branch,
      path: folder,
      id,
    };
    try {
      const { data, sha } = await fetchStoredShareData(fileMetadata, prefs);
      data.status = data.status ?? status;
      const metadata = createMeetMetadata(data, fileMetadata, sha);
      results.push({ metadata, data });
    } catch (err) {
      console.warn(`Failed to load meet ${id}:`, err);
    }
  }
  return results;
};
