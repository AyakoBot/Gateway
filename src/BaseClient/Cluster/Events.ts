/* eslint-disable no-console */
import manager from './Manager.js';

manager.setMaxListeners(2);

manager.on('clusterCreate', (cluster) => {
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
 manager.on('debug', (debug) => console.log(`[Cluster Manager] Debug Message: ${debug}`));
}
