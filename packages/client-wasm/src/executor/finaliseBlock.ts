// Copyright 2017-2018 @polkadot/client-wasm authors & contributors
// This software may be modified and distributed under the terms
// of the ISC license. See the LICENSE file for details.

import { ExecutorState } from '../types';

import call from './callAsU8a';

export default function finaliseBlock (self: ExecutorState, header: Uint8Array): Uint8Array {
  const start = Date.now();

  self.l.debug(() => 'Finalising block');

  const result = call(self, 'finalise_block')(header);

  self.l.debug(() => `Block finalised (${Date.now() - start}ms)`);

  return result;
}