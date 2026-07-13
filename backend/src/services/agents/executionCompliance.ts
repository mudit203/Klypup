import { PricingStrategyOutput } from './pricingStrategy';

export interface ExecutionComplianceOutput {
  summary: string;
  decision: 'AUTO_EXECUTE' | 'QUEUE_FOR_REVIEW' | 'BLOCK';
  decision_reason: string;
  margin_check_passed: boolean;
  confidence_check_passed: boolean;
}

export function runExecutionComplianceAgent(
  strategyOutput: PricingStrategyOutput,
  confidenceThreshold: number,
  marginFloorViolated: boolean
): ExecutionComplianceOutput {
  const confidenceScore = strategyOutput.confidence_score;
  
  // Rule evaluations
  const confidenceCheckPassed = (confidenceScore / 100) >= confidenceThreshold;
  const marginCheckPassed = !marginFloorViolated;

  let decision: 'AUTO_EXECUTE' | 'QUEUE_FOR_REVIEW' | 'BLOCK' = 'QUEUE_FOR_REVIEW';
  let decisionReason = '';

  if (!marginCheckPassed) {
    decision = 'BLOCK';
    decisionReason = 'Price recommendation rejected: proposed price violates category margin floor requirements.';
  } else if (confidenceCheckPassed) {
    decision = 'AUTO_EXECUTE';
    decisionReason = `Price recommendation auto-executed: confidence score (${confidenceScore}%) meets or exceeds the required threshold (${confidenceThreshold * 100}%).`;
  } else {
    decision = 'QUEUE_FOR_REVIEW';
    decisionReason = `Price recommendation queued for human analyst review: confidence score (${confidenceScore}%) is below the required auto-execution threshold (${confidenceThreshold * 100}%).`;
  }

  const summary = `Execution decision resolved as ${decision}. ${decisionReason}`;

  return {
    summary,
    decision,
    decision_reason: decisionReason,
    margin_check_passed: marginCheckPassed,
    confidence_check_passed: confidenceCheckPassed,
  };
}
