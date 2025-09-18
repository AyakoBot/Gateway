/* eslint-disable no-console */
process.setMaxListeners(5);

process.on('unhandledRejection', async (error: string) => console.log(error));
process.on('uncaughtException', async (error: string) => console.log(error));
process.on('promiseRejectionHandledWarning', (error: string) => console.log(error));
process.on('experimentalWarning', (error: string) => console.log(error));
process.on('warning', (warning) => console.log(warning.message, warning.stack));
