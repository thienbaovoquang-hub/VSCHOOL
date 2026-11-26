import React from 'react';

interface FormattedAiTextProps {
  text: string;
  isStreaming?: boolean;
  className?: string;
}

function renderInlineSegments(text: string, keyPrefix: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    const key = `${keyPrefix}-${idx}`;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={key} className="font-semibold text-slate-900 dark:text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={key}
          className="px-1.5 py-0.5 rounded-md bg-slate-200/75 dark:bg-slate-700/75 font-mono-tabular text-[11px] text-slate-800 dark:text-slate-100"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={key}>{part}</React.Fragment>;
  });
}

export const FormattedAiText: React.FC<FormattedAiTextProps> = ({
  text,
  isStreaming = false,
  className = '',
}) => {
  const lines = text.replace(/\r\n/g, '\n').split('\n');

  return (
    <div className={`space-y-1.5 leading-relaxed ${className}`}>
      {lines.map((rawLine, idx) => {
        const line = rawLine.trimEnd();
        const trimmed = line.trim();
        const key = `ai-line-${idx}`;

        if (!trimmed) {
          return <div key={key} className="h-1" />;
        }

        if (/^-{3,}$/.test(trimmed)) {
          return <hr key={key} className="my-2.5 border-slate-900/12 dark:border-white/15" />;
        }

        // Heading: #, ##, ###
        const headingMatch = /^(#{1,3})\s+(.+)$/.exec(trimmed);
        if (headingMatch) {
          const level = headingMatch[1].length;
          const title = headingMatch[2].replace(/^#+\s*/, '');
          return (
            <div
              key={key}
              className={`font-bold text-slate-900 dark:text-white pt-1.5 first:pt-0 ${
                level === 1 ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'
              }`}
            >
              {renderInlineSegments(title, key)}
            </div>
          );
        }

        // Bracketed section label e.g. [Số liệu thực tế] or [Đề xuất hành động]
        if (/^\[[^\]]{2,50}\]$/.test(trimmed)) {
          return (
            <div
              key={key}
              className="inline-block mt-1 px-2 py-0.5 rounded-lg bg-sky-500/12 border border-sky-400/30 text-[11px] font-bold text-sky-800 dark:text-sky-200"
            >
              {trimmed.slice(1, -1)}
            </div>
          );
        }

        // Numbered step: "1. ...", "2) ...", "Bước 1: ..."
        const stepMatch = /^(?:Bước\s+)?(\d+)[.):]\s+(.+)$/i.exec(trimmed);
        if (stepMatch) {
          const stepNum = stepMatch[1];
          const body = stepMatch[2];
          return (
            <div key={key} className="flex items-start gap-2 pt-0.5">
              <span className="mt-0.5 w-5 h-5 rounded-md bg-sky-600/15 dark:bg-sky-400/20 text-sky-700 dark:text-sky-300 font-mono-tabular text-[11px] font-bold flex items-center justify-center shrink-0">
                {stepNum}
              </span>
              <div className="flex-1 min-w-0">
                {renderInlineSegments(body, key)}
              </div>
            </div>
          );
        }

        // Bullet list: "* ...", "- ...", "• ..." (preserving light indent)
        const leadingSpaces = rawLine.length - rawLine.trimStart().length;
        const bulletMatch = /^([*\-•])\s+(.+)$/.exec(trimmed);
        if (bulletMatch) {
          const indentClass = leadingSpaces >= 2 ? 'pl-6' : 'pl-2';
          return (
            <div key={key} className={`flex items-start gap-2 ${indentClass}`}>
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-sky-500/80 dark:bg-sky-400/80 shrink-0" />
              <div className="flex-1 min-w-0">
                {renderInlineSegments(bulletMatch[2], key)}
              </div>
            </div>
          );
        }

        // Normal paragraph line
        return (
          <div key={key}>
            {renderInlineSegments(trimmed, key)}
          </div>
        );
      })}

      {isStreaming && (
        <span
          aria-hidden="true"
          className="inline-block w-1.5 h-3.5 align-middle ml-1 rounded-xs bg-sky-500 animate-pulse"
        />
      )}
    </div>
  );
};
