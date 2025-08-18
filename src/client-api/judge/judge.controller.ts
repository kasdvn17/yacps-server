import { Controller, Get, Param } from '@nestjs/common';
import { DMOJBridgeService } from '@/judge-api/dmoj-bridge/dmoj-bridge.service';

@Controller('client/judge')
export class JudgeController {
  constructor(private dmojBridge: DMOJBridgeService) {}

  /**
   * Get all connected judges status
   */
  @Get('status')
  getJudgeStatus() {
    const connectedJudges = this.dmojBridge.getConnectedJudges();
    return {
      connected: connectedJudges.length,
      judges: connectedJudges,
    };
  }

  /**
   * Get available problems across all judges
   */
  @Get('problems')
  getAvailableProblems() {
    return {
      problems: this.dmojBridge.getAvailableProblems(),
    };
  }

  /**
   * Get available executors (languages) across all judges
   */
  @Get('executors')
  getAvailableExecutors() {
    return {
      executors: this.dmojBridge.getAvailableExecutors(),
    };
  }

  /**
   * Check if a specific problem is available
   */
  @Get('problems/:problemCode/available')
  isProblemAvailable(@Param('problemCode') problemCode: string) {
    return {
      problemCode,
      available: this.dmojBridge.isProblemAvailable(problemCode),
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
        totalProblems: this.dmojBridge.getAvailableProblems().length,
        totalExecutors: this.dmojBridge.getAvailableExecutors().length,
      },
    };
  }
}