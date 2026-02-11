export function openConfirmTab(path: string) {
  // Open immediately (user-gesture) to avoid popup blockers.
  const url = path.startsWith("/") ? path : `/${path}`;
  const tab = window.open(url, "_blank", "noopener,noreferrer");
  if (!tab) {
    // Popup blocked
    throw new Error("Popup blocked. Please allow popups for this site.");
  }
  return tab;
}
