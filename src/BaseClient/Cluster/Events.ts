/* eslint-disable no-console */
import managers from './Manager.js';

managers.forEach(({ key, manager }) => {
 manager.setMaxListeners(2);

 manager.on('clusterCreate', (cluster) => {
  console.log(`[Cluster Manager - ${key}] Launched Cluster ${cluster.id + 1}`);

  cluster.setMaxListeners(4);

  cluster.on('ready', () =>
   console.log(`[Cluster Manager - ${key}] Cluster ${cluster.id + 1} has moved into Ready-State`),
  );
  cluster.on('death', () =>
   console.log(`[Cluster Manager - ${key}] Cluster ${cluster.id + 1} has died`),
  );
  cluster.on('error', (err) =>
   console.log(
    `[Cluster Manager - ${key}] Cluster ${cluster.id + 1} has encountered an error\n> ${err.message}\n${
     err.stack
    }`,
    true,
   ),
  );
 });

 if (process.argv.includes('--debug')) {
  manager.on('debug', (debug) => console.log(`[Cluster Manager - ${key}] Debug Message: ${debug}`));
 }
});
