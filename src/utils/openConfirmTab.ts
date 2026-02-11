// (Deprecated) previously used for /confirm/* pages. Kept to avoid import errors if referenced.
export function openConfirmTab(_path: string) {
  throw new Error("Confirmation tabs are deprecated. Use the in-app confirmation modal.");
}
