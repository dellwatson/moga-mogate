import fs from 'node:fs/promises';
import figlet from 'figlet';
import { IExecDataProtectorDeserializer } from '@iexec/dataprotector-deserializer';

const main = async () => {
  const { IEXEC_OUT } = process.env;

  let computedJsonObj = {};

  try {
    let messages = [];

    // Example of process.argv:
    // [ '/usr/local/bin/node', '/app/src/app.js', 'Bob' ]
    const args = process.argv.slice(2);
    console.log(`Received ${args.length} args`);
    messages.push(args.join(' '));

    try {
      const deserializer = new IExecDataProtectorDeserializer();
      // The protected data mock created for the purpose of this Hello World journey
      // contains an object with a key "secretText" which is a string
      const protectedText = await deserializer.getValue('secretText', 'string');
      console.log('Found a protected data');
      messages.push(protectedText);
    } catch (e) {
      console.log('It seems there is an issue with your protected data:', e);
    }

    // Transform input text into an ASCII Art text
    const asciiArtText = figlet.textSync(
      `Hello, ${messages.join(' ') || 'World'}!`
    );

    // Write result to IEXEC_OUT
    await fs.writeFile(`${IEXEC_OUT}/result.txt`, asciiArtText);

    // Build the "computed.json" object
    computedJsonObj = {
      'deterministic-output-path': `${IEXEC_OUT}/result.txt`,
    };
  } catch (e) {
    // Handle errors
    console.log(e);

    // Build the "computed.json" object with an error message
    computedJsonObj = {
      'deterministic-output-path': IEXEC_OUT,
      'error-message': 'Oops something went wrong',
    };
  } finally {
    // Save the "computed.json" file
    await fs.writeFile(
      `${IEXEC_OUT}/computed.json`,
      JSON.stringify(computedJsonObj)
    );
  }
};

main();
