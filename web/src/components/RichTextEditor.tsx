import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Link2,
  Undo2,
  Redo2,
} from 'lucide-react';
import { useEffect } from 'react';

type Props = {
  /** HTML string (controlled). */
  valueHtml: string;
  /** Fired with HTML AND a flat text fallback whenever the document changes. */
  onChange: (html: string, text: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
};

export default function RichTextEditor({
  valueHtml,
  onChange,
  placeholder,
  className,
  autoFocus,
}: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // We disable headings to keep the UI focused on email-style writing.
        heading: false,
        // CodeBlock is overkill for email; keep inline code only via StarterKit's Code mark.
        codeBlock: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: { rel: 'noreferrer noopener', target: '_blank' },
      }),
      Placeholder.configure({ placeholder: placeholder ?? 'Write your message…' }),
    ],
    content: valueHtml || '',
    editorProps: {
      attributes: {
        class:
          'prose-invert max-w-none min-h-[260px] px-3 py-2.5 outline-none ' +
          'text-[14px] leading-[1.55] text-zstext ' +
          // Lists need visible markers.
          '[&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 ' +
          '[&_blockquote]:border-l-2 [&_blockquote]:border-zsborder [&_blockquote]:pl-3 [&_blockquote]:text-zsmuted ' +
          '[&_a]:text-zsaccent [&_a]:underline ' +
          '[&_code]:bg-zsbg/60 [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.92em] ' +
          '[&_p]:my-1.5 [&_ul]:my-2 [&_ol]:my-2 [&_blockquote]:my-2',
        spellcheck: 'true',
      },
    },
    onUpdate({ editor }) {
      const html = editor.getHTML();
      // getHTML returns "<p></p>" for an empty doc — surface that as empty so
      // the caller can decide whether to send anything at all.
      const isEmpty = editor.isEmpty;
      onChange(isEmpty ? '' : html, editor.getText());
    },
    autofocus: autoFocus,
  });

  // Sync external value changes back into the editor (e.g. when loading a draft).
  // We compare against current HTML to avoid recursive updates.
  useEffect(() => {
    if (!editor) return;
    if (valueHtml !== editor.getHTML() && !editor.isFocused) {
      editor.commands.setContent(valueHtml || '', { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueHtml, editor]);

  return (
    <div
      className={
        'rounded-xl bg-zsbg/60 ring-1 ring-zsborder/60 ' +
        'focus-within:ring-2 focus-within:ring-zsaccent/40 focus-within:bg-zsbg/80 ' +
        'transition-shadow duration-150 overflow-hidden ' +
        (className ?? '')
      }
    >
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;

  const isActive = (name: string, attrs?: Record<string, unknown>) =>
    editor.isActive(name, attrs);

  const promptForLink = () => {
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('URL', prev ?? 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange('link')
      .setLink({ href: url, target: '_blank' })
      .run();
  };

  return (
    <div className="flex items-center gap-0.5 px-1.5 py-1.5 border-b border-zsborder/60 select-none">
      <Btn label="Bold" active={isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        <BoldIcon className="w-3.5 h-3.5" strokeWidth={2.5} />
      </Btn>
      <Btn label="Italic" active={isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <ItalicIcon className="w-3.5 h-3.5" strokeWidth={2.25} />
      </Btn>
      <Btn label="Underline" active={isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <UnderlineIcon className="w-3.5 h-3.5" strokeWidth={2.25} />
      </Btn>
      <Btn label="Strikethrough" active={isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough className="w-3.5 h-3.5" strokeWidth={2.25} />
      </Btn>

      <Sep />

      <Btn label="Bullet list" active={isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="w-3.5 h-3.5" strokeWidth={2.25} />
      </Btn>
      <Btn label="Numbered list" active={isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="w-3.5 h-3.5" strokeWidth={2.25} />
      </Btn>
      <Btn label="Quote" active={isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote className="w-3.5 h-3.5" strokeWidth={2.25} />
      </Btn>

      <Sep />

      <Btn label="Link" active={isActive('link')} onClick={promptForLink}>
        <Link2 className="w-3.5 h-3.5" strokeWidth={2.25} />
      </Btn>

      <div className="flex-1" />

      <Btn label="Undo" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
        <Undo2 className="w-3.5 h-3.5" strokeWidth={2.25} />
      </Btn>
      <Btn label="Redo" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
        <Redo2 className="w-3.5 h-3.5" strokeWidth={2.25} />
      </Btn>
    </div>
  );
}

function Btn({
  label,
  onClick,
  active,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault() /* keep editor focus */}
      onClick={onClick}
      disabled={disabled}
      className={[
        'h-7 w-7 inline-flex items-center justify-center rounded-md',
        'text-zsmuted transition-colors duration-100',
        active ? 'bg-zsaccent/15 text-zsaccent' : 'hover:bg-zsborder/40 hover:text-zstext',
        disabled ? 'opacity-40 cursor-not-allowed hover:bg-transparent hover:text-zsmuted' : '',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span aria-hidden="true" className="mx-1 h-4 w-px bg-zsborder/60" />;
}
