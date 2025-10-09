/* eslint-disable no-console */
import Manager from './Manager.js';

Manager.setMaxListeners(2);

Manager.on('clusterCreate', (cluster) => {
 console.log(`[Cluster Manager] Launched Cluster ${cluster.id + 1}`);

 cluster.setMaxListeners(4);

 cluster.on('ready', () =>
  console.log(`[Cluster Manager] Cluster ${cluster.id + 1} has moved into Ready-State`),
 );
 cluster.on('death', () => console.log(`[Cluster Manager] Cluster ${cluster.id + 1} has died`));
 cluster.on('error', (err) =>
  console.log(
   `[Cluster Manager] Cluster ${cluster.id + 1} has encountered an error\n> ${err.message}\n${
    err.stack
   }`,
   true,
  ),
 );
});

if (process.argv.includes('--debug')) {
 Manager.on('debug', (debug) => console.log(`[Cluster Manager] Debug Message: ${debug}`));
}
