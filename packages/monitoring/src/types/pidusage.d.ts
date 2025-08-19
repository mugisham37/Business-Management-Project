declare module 'pidusage' {
  interface ProcessStats {
    cpu: number;
    memory: number;
    ppid: number;
    pid: number;
    ctime: number;
    elapsed: number;
    timestamp: number;
  }

  function pidusage(pid: number): Promise<ProcessStats>;
  function pidusage(pids: number[]): Promise<{ [pid: number]: ProcessStats }>;

  export = pidusage;
}
