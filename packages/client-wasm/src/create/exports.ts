// Copyright 2017-2019 @polkadot/client-wasm authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { WasmExtraImports, WasmInstanceExports } from '../types';

import { xxhashAsHex } from '@polkadot/util-crypto';

import createImports from './imports';

type Cache = {
  [index: string]: WebAssembly.Instance
};

const DEFAULT_TABLE: WebAssembly.TableDescriptor = {
  initial: 0,
  element: 'anyfunc'
};

const cache: Cache = {};

export default function createExports (bytecode: Uint8Array, imports?: WasmExtraImports, memory?: WebAssembly.Memory | null, forceCreate: boolean = false): { codeHash: string, exports: WasmInstanceExports, isNewHash: boolean } {
  // FIXME This should be the full hash, however it takes 35-65ms - this is a danger area
  const codeHash = xxhashAsHex(bytecode.subarray(0, 2048));
  const lookup = `${codeHash}_${bytecode.length}`;
  const isNewHash = !cache[lookup];

  // NOTE compilation is quite resource intensive, here we bypass the actual Uint8Array -> Module compilation when we already have this module bytecode in our cache
  if (isNewHash || forceCreate) {
    const table = new WebAssembly.Table(DEFAULT_TABLE);

    cache[lookup] = new WebAssembly.Instance(
      new WebAssembly.Module(bytecode),
      createImports(memory, table, imports)
    );
  }

  return {
    codeHash,
    exports: cache[lookup].exports,
    isNewHash
  };
}
