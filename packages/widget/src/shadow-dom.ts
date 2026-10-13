/**
 * Creates and attaches an isolated Shadow DOM container to prevent host style interference.
 */
export function createShadowContainer(rootId = 'propbot-widget-root'): {
  host: HTMLElement;
  shadowRoot: ShadowRoot;
} {
  let host = document.getElementById(rootId);
  if (!host) {
    host = document.createElement('div');
    host.id = rootId;
    document.body.appendChild(host);
  }

  const shadowRoot = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
  return { host, shadowRoot };
}
