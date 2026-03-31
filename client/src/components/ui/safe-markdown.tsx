import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

const SAFE_PROTOCOLS = ['http:', 'https:', 'mailto:'];

function isSafeUrl(href: string | undefined): string | null {
  if (!href) {return null;}
  
  try {
    const url = new URL(href, 'https://example.com');
    if (SAFE_PROTOCOLS.includes(url.protocol)) {
      return href;
    }
    return null;
  } catch {
    if (href.startsWith('/') || href.startsWith('#')) {
      return href;
    }
    return null;
  }
}

interface SafeMarkdownProps {
  content: string;
  className?: string;
}

export function SafeMarkdown({ content, className }: SafeMarkdownProps) {
  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none",
        "prose-headings:font-semibold prose-headings:text-foreground",
        "prose-p:text-muted-foreground prose-p:leading-relaxed",
        "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
        "prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm",
        "prose-pre:bg-muted prose-pre:border prose-pre:border-border",
        "prose-ul:text-muted-foreground prose-ol:text-muted-foreground",
        "prose-li:marker:text-muted-foreground",
        "prose-strong:text-foreground prose-strong:font-semibold",
        "prose-blockquote:border-l-primary prose-blockquote:text-muted-foreground",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children, ...props }) => {
            const safeHref = isSafeUrl(href);
            if (!safeHref) {
              return <span className="text-muted-foreground">{children}</span>;
            }
            return (
              <a
                href={safeHref}
                target="_blank"
                rel="noopener noreferrer"
                {...props}
              >
                {children}
              </a>
            );
          },
          img: ({ src, alt, ...props }) => {
            if (!src?.startsWith('https://')) {
              return <span className="text-muted-foreground italic">[Image: {alt || 'unavailable'}]</span>;
            }
            return (
              <img
                src={src}
                alt={alt}
                loading="lazy"
                className="max-w-full h-auto rounded"
                {...props}
              />
            );
          },
          script: () => null,
          iframe: () => null,
          object: () => null,
          embed: () => null,
          form: () => null,
          input: () => null,
          button: () => null,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export function ReleaseNotesMarkdown({ content, className }: SafeMarkdownProps) {
  return (
    <div className={cn("rounded-md bg-muted p-4", className)}>
      <h4 className="mb-3 font-medium text-foreground">Release Notes</h4>
      <SafeMarkdown 
        content={content} 
        className="text-sm"
      />
    </div>
  );
}
