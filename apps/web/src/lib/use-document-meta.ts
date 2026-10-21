import { useEffect } from 'react';

interface DocumentMeta {
  title: string;
  description?: string;
  /** Path used for the canonical URL and og:url, e.g. "/". */
  path?: string;
  /** Keep the page out of search results. */
  noindex?: boolean;
}

const setMeta = (selector: string, attr: 'name' | 'property', key: string, content: string) => {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
};

/** Sets the tab title and the description / Open Graph tags for the current page. */
export function useDocumentMeta({ title, description, path, noindex }: DocumentMeta): void {
  useEffect(() => {
    document.title = title;
    if (description) {
      setMeta('meta[name="description"]', 'name', 'description', description);
      setMeta('meta[property="og:description"]', 'property', 'og:description', description);
    }
    setMeta('meta[property="og:title"]', 'property', 'og:title', title);
    if (path !== undefined) {
      const url = `${window.location.origin}${path}`;
      setMeta('meta[property="og:url"]', 'property', 'og:url', url);
      let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (!link) {
        link = document.createElement('link');
        link.rel = 'canonical';
        document.head.appendChild(link);
      }
      link.href = url;
    }
    setMeta('meta[name="robots"]', 'name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');
  }, [title, description, path, noindex]);
}
