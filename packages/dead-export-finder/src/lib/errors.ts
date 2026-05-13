import { Data } from 'effect';

export class WorkspaceNotFoundError extends Data.TaggedError('WorkspaceNotFoundError')<{
  readonly cwd: string;
}> {}

export class ParseError extends Data.TaggedError('ParseError')<{
  readonly filePath: string;
  readonly message: string;
}> {}

export class EntryPointResolutionError extends Data.TaggedError('EntryPointResolutionError')<{
  readonly packageName: string;
  readonly entryPoint: string;
}> {}
