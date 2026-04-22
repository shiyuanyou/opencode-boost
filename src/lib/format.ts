export function shortId(sid: string): string {
  // "ses_abc12345678" → first 15 chars
  return sid.slice(0, 15);
}

export function formatSession(name: string | null, sid: string, isCurrent: boolean): string {
  const marker = isCurrent ? "*" : " ";
  const label = name ? `${name} (${shortId(sid)})` : `(${shortId(sid)})`;
  return `${marker} ${label}`;
}

export function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatUnmanagedSession(title: string, sid: string): string {
  const label = title || "(no title)";
  return `  ${shortId(sid).padEnd(18)} ${label.padEnd(30)} [unmanaged]`;
}
