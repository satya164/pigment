import { styleText } from 'node:util';

export function formatted(
  styles: Record<string, Parameters<typeof styleText>[0]>
) {
  return (strings: TemplateStringsArray, ...values: unknown[]) => {
    let result = '';

    strings.forEach((string, index) => {
      result += string;

      if (index < values.length) {
        result += String(values[index]);
      }
    });

    return result
      .trim()
      .split('%')
      .map((part, i) => {
        if (i === 0) {
          return part;
        } else {
          const style = part.match(/(^[a-zA-Z]+)[\s]/)?.[1];
          const format = style != null ? styles[style] : null;

          if (style != null && format != null) {
            return styleText(format, part.replace(`${style} `, ''));
          } else {
            throw new Error(`Unknown style prefix: ${part}`);
          }
        }
      })
      .join('');
  };
}
