import { ChevronRight, Menu, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import logoUrl from '../../editor/src/assets/logo.svg';
import {
  defaultPage,
  groupedPages,
  pageHref,
  pages,
  resolvePage,
  sectionId,
} from './docs/metadata';
import { PageContent } from './docs/pages';

function App() {
  const current = resolvePage() ?? defaultPage;
  const [query, setQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const currentIndex = pages.findIndex((page) => page.slug === current.slug);
  const previous = currentIndex > 0 ? (pages[currentIndex - 1] ?? null) : null;
  const next =
    currentIndex >= 0 && currentIndex < pages.length - 1
      ? (pages[currentIndex + 1] ?? null)
      : null;
  const searchResults = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return pages
      .flatMap((page) => [
        {
          key: page.slug,
          title: page.title,
          detail: page.description,
          href: pageHref(page.slug),
          haystack: [page.title, page.description, page.group].join(' '),
        },
        ...page.sections.map((section) => ({
          key: `${page.slug}-${section}`,
          title: section,
          detail: page.title,
          href: `${pageHref(page.slug)}#${sectionId(section)}`,
          haystack: [page.title, page.description, section].join(' '),
        })),
      ])
      .filter((entry) => entry.haystack.toLowerCase().includes(needle))
      .slice(0, 8);
  }, [query]);

  useEffect(() => {
    const title = `${current.title} | LEVERIE Docs`;
    const description = current.description;
    const url = new URL(pageHref(current.slug), window.location.origin).href;

    document.title = title;
    setMeta('description', description);
    setLink('canonical', url);
    setMeta('og:title', title, 'property');
    setMeta('og:description', description, 'property');
    setMeta('og:url', url, 'property');
    setMeta('twitter:title', title);
    setMeta('twitter:description', description);
    setStructuredData({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'TechArticle',
          headline: title,
          description,
          url,
          isPartOf: {
            '@type': 'TechArticle',
            name: 'LEVERIE Docs',
            url: new URL(pageHref('introduction'), window.location.origin).href,
          },
          about: ['decision tables', 'business rules', 'AI agents'],
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'LEVERIE',
              item: window.location.origin,
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: 'Docs',
              item: new URL(pageHref('introduction'), window.location.origin)
                .href,
            },
            {
              '@type': 'ListItem',
              position: 3,
              name: current.title,
              item: url,
            },
          ],
        },
      ],
    });
  }, [current]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
        setIsSearchOpen(true);
      }
      if (event.key === 'Escape') {
        setIsNavOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (isNavOpen) {
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = previousOverflow;
      };
    }
  }, [isNavOpen]);

  return (
    <div className="docs-shell">
      <header className="site-header">
        <button
          type="button"
          className="nav-toggle"
          aria-label={isNavOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={isNavOpen}
          aria-controls="docs-sidebar"
          onClick={() => setIsNavOpen((open) => !open)}
        >
          {isNavOpen ? (
            <X className="icon" aria-hidden />
          ) : (
            <Menu className="icon" aria-hidden />
          )}
        </button>
        <a className="brand" href={pageHref('introduction')}>
          <img src={logoUrl} alt="LEVERIE" />
        </a>
        <search className="search-box">
          <Search className="icon" aria-hidden />
          <input
            ref={searchInputRef}
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setIsSearchOpen(true);
            }}
            onFocus={() => setIsSearchOpen(true)}
            onBlur={() => {
              window.setTimeout(() => setIsSearchOpen(false), 120);
            }}
            placeholder="Search documentation"
            aria-label="Search documentation"
          />
          <kbd>⌘K</kbd>
          {isSearchOpen && query.trim() ? (
            <div className="search-results">
              {searchResults.length ? (
                searchResults.map((result) => (
                  <a key={result.key} href={result.href}>
                    <strong>{result.title}</strong>
                    <span>{result.detail}</span>
                  </a>
                ))
              ) : (
                <p>No results</p>
              )}
            </div>
          ) : null}
        </search>
        <nav className="top-links" aria-label="Primary">
          <a href="/">Home</a>
          <a href="/edit">Editor</a>
          <a href="https://github.com/remi0753/leverie">GitHub</a>
        </nav>
      </header>

      {isNavOpen ? (
        <button
          type="button"
          className="nav-backdrop"
          aria-label="Close navigation"
          onClick={() => setIsNavOpen(false)}
        />
      ) : null}

      <div className="docs-grid">
        <aside
          id="docs-sidebar"
          className={`sidebar${isNavOpen ? ' open' : ''}`}
          aria-label="Documentation navigation"
          aria-hidden={!isNavOpen ? undefined : false}
        >
          {Object.entries(groupedPages).map(([group, items]) => (
            <div className="nav-group" key={group}>
              <p>{group}</p>
              {items.map((page) => (
                <a
                  key={page.slug}
                  className={page.slug === current.slug ? 'active' : undefined}
                  href={pageHref(page.slug)}
                  onClick={() => setIsNavOpen(false)}
                >
                  <page.icon className="icon" aria-hidden />
                  <span>{page.title}</span>
                </a>
              ))}
            </div>
          ))}
        </aside>

        <main className="doc-main">
          <article className="doc-article">
            <nav className="breadcrumbs" aria-label="Breadcrumb">
              <a href={pageHref('introduction')}>Documentation</a>
              <ChevronRight className="icon" aria-hidden />
              <span>{current.title}</span>
            </nav>

            <header className="page-hero">
              <p className="eyebrow">{current.group}</p>
              <h1>{current.title}</h1>
              <p>{current.description}</p>
            </header>

            <PageContent slug={current.slug} />

            <nav className="pager" aria-label="Page navigation">
              {previous ? (
                <a href={pageHref(previous.slug)}>
                  <span>Previous</span>
                  <strong>{previous.title}</strong>
                </a>
              ) : (
                <span />
              )}
              {next ? (
                <a href={pageHref(next.slug)} className="next">
                  <span>Next</span>
                  <strong>{next.title}</strong>
                </a>
              ) : (
                <span />
              )}
            </nav>
          </article>

          <aside className="toc" aria-label="On this page">
            <p>On this page</p>
            {current.sections.map((section) => (
              <a key={section} href={`#${sectionId(section)}`}>
                {section}
              </a>
            ))}
          </aside>
        </main>
      </div>
    </div>
  );
}

function setMeta(
  name: string,
  content: string,
  attribute: 'name' | 'property' = 'name',
) {
  let element = document.head.querySelector<HTMLMetaElement>(
    `meta[${attribute}="${name}"]`,
  );
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, name);
    document.head.append(element);
  }
  element.content = content;
}

function setLink(rel: string, href: string) {
  let element = document.head.querySelector<HTMLLinkElement>(
    `link[rel="${rel}"]`,
  );
  if (!element) {
    element = document.createElement('link');
    element.rel = rel;
    document.head.append(element);
  }
  element.href = href;
}

function setStructuredData(data: Record<string, unknown>) {
  const id = 'leverie-docs-structured-data';
  let element = document.getElementById(id) as HTMLScriptElement | null;
  if (!element) {
    element = document.createElement('script');
    element.id = id;
    element.type = 'application/ld+json';
    document.head.append(element);
  }
  element.textContent = JSON.stringify(data);
}

export default App;
