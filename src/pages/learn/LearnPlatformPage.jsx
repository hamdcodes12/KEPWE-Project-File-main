import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronDown, ChevronRight, ExternalLink, Menu, Search, X } from 'lucide-react';
import { DOCS } from './documentationContent';
import './LearnPlatformPage.css';

function searchableText(article) {
  return `${article.title} ${article.intro} ${article.sections.map((section) => `${section.heading} ${section.body} ${section.note || ''}`).join(' ')}`.toLowerCase();
}

export default function LearnPlatformPage() {
  const { articleSlug } = useParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const inputRef = useRef(null);
  const article = DOCS.find((item) => item.slug === articleSlug) || DOCS[0];
  const articleIndex = DOCS.findIndex((item) => item.slug === article.slug);
  const results = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];
    return DOCS.map((item) => ({ article: item, matched: searchableText(item).includes(query) }))
      .filter((item) => item.matched).map((item) => item.article).slice(0, 8);
  }, [search]);

  useEffect(() => {
    document.title = `${article.title} | Kepwe Learn`;
    window.scrollTo({ top: 0, behavior: 'auto' });
    setMobileNavOpen(false);
  }, [article.slug, article.title]);

  useEffect(() => {
    const onKey = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); setSearchOpen(true); inputRef.current?.focus();
      }
      if (event.key === 'Escape') { setSearchOpen(false); setSearch(''); inputRef.current?.blur(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const openArticle = (slug) => {
    navigate(slug === DOCS[0].slug ? '/learn' : `/learn/${slug}`);
    setSearch(''); setSearchOpen(false); setMobileNavOpen(false);
  };
  const selectedIndex = DOCS.findIndex((item) => item.slug === article.slug);
  const previous = DOCS[selectedIndex - 1];
  const next = DOCS[selectedIndex + 1];

  return <main className="docs-page">
    <div className="docs-shell">
      <header className="docs-topbar">
        <button className="docs-mobile-menu" aria-label="Open documentation navigation" onClick={() => setMobileNavOpen((open) => !open)}>{mobileNavOpen ? <X /> : <Menu />}</button>
        <Link to="/learn" className="docs-brand" aria-label="Kepwe Learn documentation home"><span className="docs-brand-mark"><BookOpen size={19} /></span><span><strong>KEPWE</strong><em>LEARN</em></span></Link>
        <span className="docs-topbar-divider" />
        <span className="docs-topbar-label">Quant documentation</span>
        <div className="docs-search-wrap">
          <label className="docs-search" htmlFor="docs-search-input"><Search size={17} /><input ref={inputRef} id="docs-search-input" value={search} placeholder="Search documentation..." onChange={(event) => { setSearch(event.target.value); setSearchOpen(true); }} onFocus={() => setSearchOpen(Boolean(search.trim()))} onKeyDown={(event) => { if (event.key === 'Enter' && results[0]) openArticle(results[0].slug); }} /><kbd>Ctrl K</kbd></label>
          {searchOpen && search.trim() && <div className="docs-search-results" role="listbox" aria-label="Documentation search results">
            {results.length ? results.map((result) => <button key={result.slug} role="option" aria-selected="false" onClick={() => openArticle(result.slug)}><span className="docs-search-result-icon"><FileMark /></span><span><strong>{result.title}</strong><small>{result.intro}</small></span><ChevronRight size={16} /></button>) : <p>No documentation found for “{search}”.</p>}
            <button className="docs-search-close" onClick={() => setSearchOpen(false)}>Close search <X size={14} /></button>
          </div>}
        </div>
        <Link className="docs-topbar-quant" to="/quant">Kepwe Quant <ExternalLink size={14} /></Link>
      </header>

      <div className={`docs-layout ${mobileNavOpen ? 'mobile-nav-open' : ''}`}>
        <aside className="docs-left-sidebar" aria-label="Documentation navigation">
          <div className="docs-sidebar-label">KEPWE QUANT</div>
          <nav>{DOCS.map((item, index) => <button key={item.slug} className={`docs-nav-item ${item.slug === article.slug ? 'selected' : ''} ${index === 1 ? 'docs-nav-subitem' : ''}`} onClick={() => openArticle(item.slug)} aria-current={item.slug === article.slug ? 'page' : undefined}>{item.title}</button>)}</nav>
          <div className="docs-sidebar-bottom"><span className="docs-status-dot" /><span>Documentation for Kepwe Quant</span></div>
        </aside>
        {mobileNavOpen && <button className="docs-mobile-scrim" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}

        <article className="docs-article" key={article.slug}>
          <div className="docs-breadcrumb"><Link to="/learn">Kepwe Learn</Link><ChevronRight size={14} /><span>{article.title}</span></div>
          <div className="docs-article-heading"><span className="docs-eyebrow">KEPWE QUANT · DOCUMENTATION</span><h1>{article.title}</h1><p>{article.intro}</p></div>
          <div className="docs-article-body">
            {article.sections.map((section, index) => <section className="docs-section" id={`section-${index}`} key={section.heading}>
              <h2>{section.heading}</h2>
              <p>{section.body}</p>
              {section.diagram === 'workflow' && <div className="docs-workflow" role="img" aria-label="Quant workflow: Configure a strategy, validate settings, connect a supported broker, and monitor activity."><div><span>01</span><strong>Configure</strong><small>Rules & parameters</small></div><i aria-hidden="true" /><div><span>02</span><strong>Validate</strong><small>Plan & risk checks</small></div><i aria-hidden="true" /><div><span>03</span><strong>Connect</strong><small>Supported broker</small></div><i aria-hidden="true" /><div><span>04</span><strong>Monitor</strong><small>Status & activity</small></div></div>}
              {section.steps && <ol>{section.steps.map((step) => <li key={step}>{step}</li>)}</ol>}
              {section.bullets && <ul>{section.bullets.map((item) => <li key={item}>{item}</li>)}</ul>}
              {section.note && <aside className="docs-note"><span>NOTE</span><p>{section.note}</p></aside>}
              {section.warning && <aside className="docs-warning"><span>IMPORTANT</span><p>{section.warning}</p></aside>}
            </section>)}
          </div>
          <nav className="docs-pagination" aria-label="Article navigation">
            {previous ? <button onClick={() => openArticle(previous.slug)}><ArrowLeft size={16} /><span><small>Previous</small><strong>{previous.title}</strong></span></button> : <span />}
            {next && <button className="docs-pagination-next" onClick={() => openArticle(next.slug)}><span><small>Next</small><strong>{next.title}</strong></span><ArrowRight size={16} /></button>}
          </nav>
          <footer className="docs-article-footer">Kepwe Quant Help Center <span>·</span> Content reflects currently implemented product functionality.</footer>
        </article>

        <aside className="docs-right-sidebar" aria-label="On this page">
          <div className="docs-toc-heading">On this page</div>
          <nav>{article.sections.map((section, index) => <a href={`#section-${index}`} key={section.heading}>{section.heading}</a>)}</nav>
          <div className="docs-help-card"><div className="docs-help-icon"><Check size={16} /></div><strong>Need more help?</strong><p>Contact the Kepwe team if you cannot find an answer here.</p><Link to="/contact">Contact support <ArrowRight size={14} /></Link></div>
        </aside>
      </div>
    </div>
  </main>;
}

function FileMark() { return <BookOpen size={16} />; }
