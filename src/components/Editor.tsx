import { useRef, useEffect } from "react";

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

export function Editor({
  value,
  onChange,
  placeholder = "Paste or type your text here...",
  disabled,
  autoFocus,
}: EditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  return (
    <div className="relative flex flex-1 flex-col">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1 resize-none bg-transparent px-4 py-3 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
        spellCheck={false}
      />
      <div className="flex shrink-0 items-center justify-end px-4 pb-2">
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {value.length} chars
        </span>
      </div>
    </div>
  );
}
