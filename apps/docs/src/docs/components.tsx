import { Code2, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { sectionId } from './metadata';

type Icon = LucideIcon;

export function DocSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={sectionId(title)} className="doc-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function FeatureGrid({
  items,
}: {
  items: Array<{ icon: Icon; title: string; body: string }>;
}) {
  return (
    <div className="feature-grid">
      {items.map((item) => (
        <article className="feature-card" key={item.title}>
          <item.icon className="icon" aria-hidden />
          <h3>{item.title}</h3>
          <p>{item.body}</p>
        </article>
      ))}
    </div>
  );
}

export function DefinitionList({ items }: { items: Array<[string, string]> }) {
  return (
    <dl className="definition-list">
      {items.map(([term, definition]) => (
        <div key={term}>
          <dt>{term}</dt>
          <dd>{definition}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Callout({
  icon: IconComponent,
  title,
  children,
}: {
  icon: Icon;
  title: string;
  children: ReactNode;
}) {
  return (
    <aside className="callout">
      <IconComponent className="icon" aria-hidden />
      <div>
        <h3>{title}</h3>
        <p>{children}</p>
      </div>
    </aside>
  );
}

export function CodeBlock({ title, code }: { title: string; code: string }) {
  return (
    <figure className="code-block">
      <figcaption>
        <Code2 className="icon" aria-hidden />
        {title}
      </figcaption>
      <pre>
        <code>{code}</code>
      </pre>
    </figure>
  );
}

export function Checklist({ items }: { items: string[] }) {
  return (
    <ul className="checklist">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
