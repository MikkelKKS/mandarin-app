import { forwardRef, type TextareaHTMLAttributes } from 'react';

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'rows' | 'wrap'> & {
  value: string;
  onChange: (value: string, el: HTMLTextAreaElement) => void;
};

/**
 * A one-line text box built on a textarea. Chrome on Android shows its autofill strip
 * (key, card and pin icons) above the keyboard for every <input>, ignoring autocomplete="off";
 * it leaves textareas alone. Enter never adds a line: a line break from the phone keyboard is
 * turned back into an Enter key press, so Check / Show the answer still work.
 */
export const OneLineField = forwardRef<HTMLTextAreaElement, Props>(function OneLineField({ value, onChange, className = '', ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      rows={1}
      wrap="off"
      value={value}
      onChange={(e) => {
        const el = e.target;
        if (el.value.includes('\n')) {
          onChange(el.value.replace(/[\r\n]+/g, ''), el);
          el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
          return;
        }
        onChange(el.value, el);
      }}
      className={`block resize-none overflow-hidden whitespace-pre ${className}`}
      {...rest}
    />
  );
});
