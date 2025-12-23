import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Job {
  id: string;
  type: string;
  status: JobStatus;
  progress: number;
  result?: any;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

class JobManager extends EventEmitter {
  private jobs: Map<string, Job> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly JOB_TTL_MS = 30 * 60 * 1000; // 30 minutes

  constructor() {
    super();
    this.startCleanup();
  }

  createJob(type: string, metadata?: Record<string, any>): Job {
    const job: Job = {
      id: randomUUID(),
      type,
      status: 'pending',
      progress: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata,
    };
    this.jobs.set(job.id, job);
    this.emit('job:created', job);
    return job;
  }

  getJob(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  updateJob(id: string, updates: Partial<Pick<Job, 'status' | 'progress' | 'result' | 'error'>>): Job | undefined {
    const job = this.jobs.get(id);
    if (!job) return undefined;

    Object.assign(job, updates, { updatedAt: new Date() });
    this.jobs.set(id, job);

    this.emit('job:updated', job);
    if (updates.status === 'completed') {
      this.emit('job:completed', job);
    } else if (updates.status === 'failed') {
      this.emit('job:failed', job);
    } else if (updates.progress !== undefined) {
      this.emit('job:progress', job);
    }

    return job;
  }

  setProgress(id: string, progress: number): Job | undefined {
    return this.updateJob(id, { status: 'processing', progress: Math.min(100, Math.max(0, progress)) });
  }

  complete(id: string, result: any): Job | undefined {
    return this.updateJob(id, { status: 'completed', progress: 100, result });
  }

  fail(id: string, error: string): Job | undefined {
    return this.updateJob(id, { status: 'failed', error });
  }

  deleteJob(id: string): boolean {
    const deleted = this.jobs.delete(id);
    if (deleted) {
      this.emit('job:deleted', { id });
    }
    return deleted;
  }

  listJobs(filter?: { type?: string; status?: JobStatus }): Job[] {
    let jobs = Array.from(this.jobs.values());
    if (filter?.type) {
      jobs = jobs.filter(j => j.type === filter.type);
    }
    if (filter?.status) {
      jobs = jobs.filter(j => j.status === filter.status);
    }
    return jobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [id, job] of this.jobs.entries()) {
        if (job.status === 'completed' || job.status === 'failed') {
          if (now - job.updatedAt.getTime() > this.JOB_TTL_MS) {
            this.jobs.delete(id);
          }
        }
      }
    }, 5 * 60 * 1000); // Run every 5 minutes
  }

  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

export const jobManager = new JobManager();
export default jobManager;
