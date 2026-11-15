/** HUFS WORLD v4.1 mount helper (framework-agnostic). */
export function mountHufsWorld(container, options = {}) {
  if (!container) throw new Error('A DOM container is required');
  const iframe = document.createElement('iframe');
  const source = new URL(options.src || '/hufs-world.html', window.location.href);
  if (options.initialPage === 'course') source.searchParams.set('page', 'course');
  iframe.src = source.toString();
  iframe.title = 'HUFS WORLD campus and course planner';
  iframe.loading = 'lazy';
  iframe.style.cssText = 'width:100%;height:900px;border:0;display:block;border-radius:12px;';
  iframe.style.height = options.height || '900px';
  container.replaceChildren(iframe);
  const expectedOrigin = source.origin;
  function handleMessage(event) {
    if (event.source !== iframe.contentWindow || event.origin !== expectedOrigin) return;
    const data = event.data;
    if (!data || data.source !== 'HUFS_WORLD_V4_1') return;
    if (typeof options.onEvent === 'function') options.onEvent(data.type, data.detail);
  }
  window.addEventListener('message', handleMessage);
  return {
    iframe,
    openPlanner: () => iframe.contentWindow?.postMessage({source:'HUFS_WORLD_HOST',command:'open-planner'}, expectedOrigin),
    openCampus: () => iframe.contentWindow?.postMessage({source:'HUFS_WORLD_HOST',command:'open-campus'}, expectedOrigin),
    getBasket: () => iframe.contentWindow?.postMessage({source:'HUFS_WORLD_HOST',command:'get-basket'}, expectedOrigin),
    destroy: () => { window.removeEventListener('message', handleMessage); iframe.remove(); }
  };
}
