// Copyright 2017-2019 @polkadot/client-p2p authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import pull from 'pull-stream';
import pushable from 'pull-pushable';
import { logger } from '@polkadot/util';

import Peer from './index';

describe('receive', () => {
  let peer;

  beforeEach(() => {
    const peerInfo = {
      id: {
        toB58String: () => '123'
      }
    };
    peer = new Peer({}, {}, peerInfo);
  });

  it('returns false when on error', () => {
    expect(
      peer._receive()
    ).toEqual(false);
  });

  it('returns true when no error', () => {
    expect(
      peer._receive(pull.through())
    ).toEqual(true);
  });
});
