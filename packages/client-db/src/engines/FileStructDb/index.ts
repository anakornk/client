// Copyright 2017-2019 @polkadot/client-db authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { BaseDb, ProgressCb } from '@polkadot/db/types';
import { KVInfo } from './types';

import codec from '@polkadot/trie-codec';
import { logger } from '@polkadot/util';

import Cache from './Cache';
import Impl from './Impl';
import { BITS_F, BITS_U, KEY_DATA_SIZE, U32_SIZE } from './defaults';
import { readU32, serializeKey, writeU32 } from './util';

const l = logger('db/struct');

const TRIE_BRANCH_LEN = 17;
const TRIE_ENC_SIZE = U32_SIZE + 1;

export default class FileStructDb extends Impl implements BaseDb {
  private _cache: Cache<string> = new Cache(16 * 1024);

  drop (): void {
    l.error('drop() is not implemented');
  }

  empty (): void {
    l.error('empty() is not implemented');
  }

  rename (base: string, file: string): void {
    l.error('rename() is not implemented');
  }

  size (): number {
    l.error('size() is not implemented');

    return 0;
  }

  maintain (fn: ProgressCb): void {
    fn({
      isCompleted: true,
      keys: 0,
      percent: 100
    });
  }

  del (key: Uint8Array): void {
    l.error('del() is not implemented');
  }

  private _get (key: Uint8Array): Uint8Array | null {
    const info = this._findValue(serializeKey(key));

    if (!info || !info.valData) {
      return null;
    } else if (!this._isTrie) {
      return info.valData;
    } else if (!info.valData[0]) {
      return info.valData.subarray(1);
    }

    // 17 entries, assuming there may be an encoded value in there
    const recoded: Array<Uint8Array | null> = [
      null, null, null, null,
      null, null, null, null,
      null, null, null, null,
      null, null, null, null,
      null
    ];
    let index = 0;
    let offset = 1;

    while (offset < info.valData.length) {
      if (info.valData[offset]) {
        const keyAt = readU32(info.valData, offset) & BITS_U;
        const keyIdx = info.valData[offset + U32_SIZE];

        recoded[index] = this._readKey(keyIdx, keyAt).subarray(0, KEY_DATA_SIZE);
        offset += TRIE_ENC_SIZE;
      } else {
        offset++;
      }

      index++;
    }

    return codec.encode(recoded);
  }

  get (key: Uint8Array): Uint8Array | null {
    // l.debug(() => ['get', { key }]);

    const keyStr = key.toString();
    const cached = this._cache.get(keyStr);

    if (cached) {
      return cached;
    }

    const value = this._get(key);

    if (value) {
      this._cache.set(keyStr, value);
    }

    return value;
  }

  put (key: Uint8Array, value: Uint8Array): void {
    // l.debug(() => ['put', { key, value }]);

    this._cache.set(key.toString(), value);

    if (!this._isTrie) {
      this._findValue(serializeKey(key), value);
      return;
    }

    let adjusted: Uint8Array;
    const decoded = codec.decode(value);
    const isEncodable = Array.isArray(decoded) &&
      decoded.length === TRIE_BRANCH_LEN &&
      !decoded.some((value) => value && value.length !== KEY_DATA_SIZE);

    // extension nodes are going away anyway, so just ignore, no worse off.
    if (isEncodable) {
      const recoded = new Uint8Array((TRIE_BRANCH_LEN * TRIE_ENC_SIZE) + 1);
      let length: number = 1;

      // set the initial flag, i.e. we have data following
      recoded[0] = TRIE_BRANCH_LEN;

      for (let index = 0; index < TRIE_BRANCH_LEN; index++) {
        const u8a = (decoded as Array<Uint8Array>)[index];

        if (u8a) {
          const key = serializeKey(u8a);
          const info = this._findValue(key, null, false);

          writeU32(recoded, ((info as KVInfo).keyAt | BITS_F), length);
          recoded[length + U32_SIZE] = key.index;
          length += TRIE_ENC_SIZE;
        } else {
          recoded[length] = 0;
          length++;
        }
      }

      adjusted = recoded.subarray(0, length);
    } else {
      adjusted = new Uint8Array(value.length + 1);
      adjusted.set(value, 1);
    }

    this._findValue(serializeKey(key), adjusted);
  }
}
