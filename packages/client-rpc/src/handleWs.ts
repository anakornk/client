// Copyright 2017-2018 @polkadot/client-rpc authors & contributors
// This software may be modified and distributed under the terms
// of the ISC license. See the LICENSE file for details.

import { RpcState, WsContext } from './types';

import handleMessage from './handleMessage';

type Handler = (ctx: WsContext) => void;

export default function handleWs (self: RpcState): Handler {
  return (ctx: WsContext): void => {
    ctx.websocket.on('message', async (message: string) => {
      const response = await handleMessage(self, message, ctx.websocket);

      ctx.websocket.send(
        JSON.stringify(response)
      );
    });
  };
}