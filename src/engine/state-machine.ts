import { type State, type Step, STEPS } from '../types.js';

export class StateMachine {
  constructor(private state: State) {}

  currentStep(): Step {
    return this.state.current_step;
  }

  currentStepRecord() {
    return this.state.steps[this.state.current_step];
  }

  isApproved(): boolean {
    return this.currentStepRecord()?.status === 'approved';
  }

  canRun(command: 'answer' | 'approve' | 'design'): { ok: boolean; reason?: string } {
    const step = this.state.current_step;
    const record = this.state.steps[step];

    if (command === 'answer') {
      if (record?.status === 'approved') {
        return { ok: false, reason: `Step '${step}' is already approved. Run 'lv design' to continue.` };
      }
      return { ok: true };
    }

    if (command === 'approve') {
      if (!record || record.status === 'pending') {
        return { ok: false, reason: `Step '${step}' has not been started yet.` };
      }
      if (record.status === 'approved') {
        return { ok: false, reason: `Step '${step}' is already approved.` };
      }
      return { ok: true };
    }

    if (command === 'design') {
      const analysisStatus = this.state.steps.analysis?.status;
      if (analysisStatus !== 'approved') {
        return {
          ok: false,
          reason: `Analysis must be approved before running design. Current status: '${analysisStatus ?? 'not started'}'. Run 'lv approve' first.`,
        };
      }
      if (this.state.steps.design?.status === 'approved') {
        return { ok: false, reason: 'Design is already approved.' };
      }
      return { ok: true };
    }

    return { ok: false, reason: `Unknown command: ${command}` };
  }

  advance(): State {
    const currentIdx = STEPS.indexOf(this.state.current_step);
    const nextStep = STEPS[currentIdx + 1];
    if (!nextStep) return this.state; // already at last step

    const updated: State = {
      ...this.state,
      current_step: nextStep,
    };
    this.state = updated;
    return updated;
  }

  getState(): State {
    return this.state;
  }
}
