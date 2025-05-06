import ansiEscapes from 'ansi-escapes';
import wrap from 'wrap-ansi';

export function render(text: string, stdout: NodeJS.WriteStream) {
  stdout.write(text);

  let previous = text;

  const update = (newText: string) => {
    if (previous === newText) {
      return;
    }

    const prevWrapped = wrap(previous, stdout.columns, {
      hard: true,
      trim: false,
    });

    previous = newText;

    const prevLines = prevWrapped.split('\n');

    stdout.write(ansiEscapes.cursorLeft);
    stdout.write(ansiEscapes.eraseLines(prevLines.length));

    stdout.write(newText);
  };

  return {
    update,
  };
}
