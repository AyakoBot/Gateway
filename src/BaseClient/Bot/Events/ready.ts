/* eslint-disable no-console */
import {
 ActivityType,
 GatewayOpcodes,
 PresenceUpdateStatus,
 type GatewayReadyDispatchData,
} from 'discord-api-types/v10';
import { getInfo } from 'discord-hybrid-sharding';

import { cluster, gateway } from '../Client.js';

let ready: boolean = false;

export default async (data: GatewayReadyDispatchData, shardId: number | string) => {
 if (!ready) {
  ready = true;

  console.log(`[Login] ${new Date(Date.now()).toLocaleString()}`);
  console.log(`[Login] Bot: ${data.user?.username}#${data.user?.discriminator} / ${data.user?.id}`);
  console.log(`[Login] Cluster: ${Number(cluster.id) + 1}`);
  console.log(
   `[Login] Shards: ${getInfo()
    .SHARD_LIST.map((shard) => shard + 1)
    .join(', ')}`,
  );
 }

 console.log(`[Ready | Shard ${shardId}]`);

 const allShards = (
  await cluster.broadcastEval(() =>
   import('discord-hybrid-sharding').then(({ getInfo }) => getInfo().SHARD_LIST),
  )
 )?.flat();

 getInfo().SHARD_LIST.forEach(async (shard) => {
  gateway.send(shard, {
   op: GatewayOpcodes.PresenceUpdate,
   d: {
    afk: false,
    activities: [await getActivities(shard, allShards)],
    status: PresenceUpdateStatus.Online,
    since: Date.now(),
   },
  });
 });
};

const getActivities = async (thisShard: number, allShards: number[]) => {
 const clusterShardsText = `Shard ${thisShard + 1}/${
  getInfo().SHARD_LIST.length
 } (Cluster)/${allShards?.length ?? 1} (Total) | Cluster ${Number(cluster.id) + 1}/${
  getInfo().CLUSTER_COUNT
 }`;

 return {
  name: 'Stable',
  state: `/help | ${clusterShardsText}`,
  type: ActivityType.Custom,
 };
};
