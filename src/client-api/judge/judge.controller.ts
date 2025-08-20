import { Controller, Get, Param } from '@nestjs/common';
import { DMOJBridgeService } from '@/judge-api/dmoj-bridge/dmoj-bridge.service';

@Controller()
export class JudgeController {
  constructor(private dmojBridge: DMOJBridgeService) {}

  /**
   * Get all connected judges status
   */
  @Get('status')
  getJudgeStatus() {
    const connectedJudges = this.dmojBridge.getConnectedJudges();
    return {
      connected: connectedJudges.length > 0,
      judgeCount: connectedJudges.length,
      judges: connectedJudges,
    };
  }

  /**
   * Get available executors (languages) across all judges
   */
  @Get('executors')
  getAvailableExecutors() {
    return this.dmojBridge.getAvailableExecutors();
  }

  /**
   * Check if a specific problem is available
   */
  @Get('problems/:problemSlug/available')
  isProblemAvailable(@Param('problemSlug') problemSlug: string) {
    return {
      problemSlug,
      available: this.dmojBridge.isProblemAvailable(problemSlug),
    };
  }

  /**
   * Check if a specific executor/language is available
   */
  @Get('executors/:executor/available')
  isExecutorAvailable(@Param('executor') executor: string) {
    return {
      executor,
      available: this.dmojBridge.isExecutorAvailable(executor),
    };
  }

  /**
   * Get all judge capabilities
   */
  @Get('capabilities')
  getJudgeCapabilities() {
    const capabilities = this.dmojBridge.getJudgeCapabilities();
    const connectedJudges = this.dmojBridge.getConnectedJudges();

    // Convert Map to object for JSON serialization
    const capabilitiesObj: { [key: string]: any } = {};
    if (capabilities instanceof Map) {
      for (const [judgeId, caps] of capabilities.entries()) {
        capabilitiesObj[judgeId] = caps;
      }
    }

    return {
      judges: capabilitiesObj,
      summary: {
        connectedJudges: connectedJudges.length,
        totalExecutors: this.dmojBridge.getAvailableExecutors().length,
      },
    };
  }
}
