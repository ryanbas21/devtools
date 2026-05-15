import { McpServer } from '@effect/ai';
import { NodeSink, NodeStream } from '@effect/platform-node';
import { Layer } from 'effect';
import { SessionManagerLive } from '../session-manager.js';
import { WolfcolaToolkit, WolfcolaToolkitLive } from './tools.js';

export const McpServerLive = McpServer.toolkit(WolfcolaToolkit).pipe(
  Layer.provide(WolfcolaToolkitLive),
  Layer.provide(
    McpServer.layerStdio({
      name: 'wolfcola-devtools',
      version: '0.0.1',
      stdin: NodeStream.stdin,
      stdout: NodeSink.stdout,
    }),
  ),
  Layer.provide(SessionManagerLive),
);
