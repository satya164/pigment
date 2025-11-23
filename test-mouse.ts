import { select } from './src/select.ts';

async function main() {
  console.log('Testing mouse click support in select prompt');
  console.log('Click on any choice with your mouse to select it!\n');

  // Enable raw mode to capture mouse events and ANSI responses
  process.stdin.setRawMode(true);
  process.stdin.resume();

  try {
    const result = await select(
      {
        type: 'select',
        message: 'What is your favorite color?',
        choices: [
          { title: 'Red', value: 'red' },
          { title: 'Green', value: 'green' },
          { title: 'Blue', value: 'blue' },
          { title: 'Yellow', value: 'yellow' },
          { title: 'Purple', value: 'purple' },
        ],
      },
      {
        stdin: process.stdin,
        stdout: process.stdout,
        onCancel: () => {
          process.stdin.setRawMode(false);
          console.log('Cancelled!');
          process.exit(1);
        },
      }
    );

    console.log('\nYou selected:', result);
  } finally {
    process.stdin.setRawMode(false);
  }
}

main().catch(console.error);
