export type CallPhase =
  | 'ready'
  | 'connecting'
  | 'listening'
  | 'answering'
  | 'escalating'
  | 'completed'
  | 'error';
