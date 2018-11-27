// Copyright 2017-2018 @polkadot/client-wasm authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { Config } from '@polkadot/client/types';
import { BlockDb, StateDb } from '@polkadot/client-db/types';
import { RuntimeInterface } from '@polkadot/client-runtime/types';
import { ExecutorInterface, Executor$BlockImportResult } from './types';

import { Block } from '@polkadot/types';
import storage from '@polkadot/storage/static';
import { assert, compactStripLength, logger, u8aToHex } from '@polkadot/util';

import createWasm from './create';
import proxy from './wasm/proxy_substrate_wasm';

type CallResult = {
  bool: boolean,
  lo: number,
  hi: number
};

type Call = (...data: Array<Uint8Array>) => CallResult;

// type CallU8a = (...data: Array<Uint8Array>) => Uint8Array;

const [, CODE_KEY] = compactStripLength(storage.substrate.code());

const l = logger('executor');

export default class Executor implements ExecutorInterface {
  private blockDb: BlockDb;
  private config: Config;
  private runtime: RuntimeInterface;
  private stateDb: StateDb;

  constructor (config: Config, blockDb: BlockDb, stateDb: StateDb, runtime: RuntimeInterface) {
    this.blockDb = blockDb;
    this.config = config;
    this.stateDb = stateDb;
    this.runtime = runtime;
  }

  executeBlock (block: Uint8Array, forceNew: boolean = false): boolean {
    const start = Date.now();

    l.debug(() => 'Executing block');

    const result = this.call('execute_block', forceNew)(block);

    l.debug(() => `Block execution completed (${Date.now() - start}ms)`);

    return result.bool;
  }

  importBlock (u8a: Uint8Array): Executor$BlockImportResult {
    const start = Date.now();
    const block = new Block(u8a);
    const headerHash = block.header.hash;

    l.debug(() => `Importing block #${block.header.blockNumber}, ${u8aToHex(headerHash, 48)}`);

    try {
      this.stateDb.db.transaction(() =>
        this.executeBlock(u8a)
      );
    } catch (error) {
      l.error(`Failed importing #${block.header.blockNumber.toString()}, ${u8aToHex(headerHash, 48)}`);

      throw error;
    }

    this.blockDb.bestHash.set(headerHash);
    this.blockDb.bestNumber.set(block.header.blockNumber);
    this.blockDb.block.set(u8a, headerHash);

    l.debug(() => `Imported block #${block.header.blockNumber} (${Date.now() - start}ms)`);

    return {
      block,
      u8a
    };
  }

  private call (name: string, forceNew: boolean = false): Call {
    const code = this.stateDb.db.get(CODE_KEY);

    assert(code, 'Expected to have code available in runtime');

    // @ts-ignore code check above
    const instance = createWasm({ config: this.config, l }, this.runtime, code, proxy, forceNew);
    const { heap } = this.runtime.environment;

    return (...data: Array<Uint8Array>): CallResult => {
      const start = Date.now();

      l.debug(() => ['preparing', name]);
      // runtime.instrument.start();

      const params = data.reduce((params, data) => {
        l.debug(() => ['storing', u8aToHex(data)]);

        params.push(heap.set(heap.allocate(data.length), data));
        params.push(data.length);

        return params;
      }, ([] as number[]));

      l.debug(() => ['executing', name, params]);

      const lo: number = instance[name].apply(null, params);
      const hi: number = instance['get_result_hi']();

      // l.debug(() => runtime.instrument.stop());
      l.debug(() => [name, 'returned', [lo, hi], `(${Date.now() - start}ms)`]);

      return {
        bool: hi === 0 && lo === 1,
        hi,
        lo
      };
    };
  }

  // private callAsU8a (name: string): CallU8a {
  //   const fn = this.call(name);
  //   const { heap } = this.runtime.environment;

  //   return (...data: Array<Uint8Array>): Uint8Array => {
  //     const { hi, lo } = fn.apply(null, data);
  //     const result = heap.get(lo, hi).slice();

  //     l.debug(() => ['received', u8aToHex(result)]);

  //     return result;
  //   };
  // }
}
