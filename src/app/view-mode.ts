const VIEW_PARAMETER = 'view';
const FULL_VIEW = 'full';

/** Whether the app was opened without journey or other review chrome. */
export function isFullView(document: Document): boolean {
  return (
    new URLSearchParams(document.defaultView?.location.search ?? '').get(VIEW_PARAMETER) ===
    FULL_VIEW
  );
}

/** Builds a full-view link without dropping the app's path or other parameters. */
export function fullViewUrl(document: Document): string {
  const view = document.defaultView;
  if (!view) return `?${VIEW_PARAMETER}=${FULL_VIEW}`;

  const url = new URL(view.location.href);
  url.searchParams.set(VIEW_PARAMETER, FULL_VIEW);
  return url.toString();
}
