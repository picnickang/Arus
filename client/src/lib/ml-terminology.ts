/**
 * ML Terminology Helper
 * Provides user-friendly translations of technical ML terms
 */

export interface MLTerm {
  technical: string;
  friendly: string;
  description: string;
}

export const ML_TERMINOLOGY: Record<string, MLTerm> = {
  lstm: {
    technical: "LSTM",
    friendly: "Pattern Detection AI",
    description:
      "AI that learns from historical patterns to predict when equipment might fail. It looks at trends over time to spot early warning signs.",
  },
  gru: {
    technical: "GRU",
    friendly: "Fast Pattern AI",
    description:
      "A faster version of Pattern Detection AI, optimized for real-time predictions. Great for continuous monitoring.",
  },
  random_forest: {
    technical: "Random Forest",
    friendly: "Health Classification AI",
    description:
      "AI that evaluates current equipment health by looking at many sensor readings at once. Like getting a check-up from multiple doctors.",
  },
  hybrid: {
    technical: "Hybrid",
    friendly: "Combined AI Model",
    description:
      "Uses both Pattern Detection and Health Classification together for more accurate predictions.",
  },
  shap: {
    technical: "SHAP Values",
    friendly: "AI Explanation",
    description:
      "Shows which sensor readings influenced the AI's prediction and by how much. Helps you understand why the AI made a specific decision.",
  },
  accuracy: {
    technical: "Accuracy",
    friendly: "Prediction Accuracy",
    description:
      "How often the AI's predictions turn out to be correct. 90%+ means the AI is very reliable.",
  },
  ttf: {
    technical: "Time To Failure (TTF)",
    friendly: "Days Until Failure",
    description:
      "The AI's estimate of how many days until equipment needs maintenance or replacement.",
  },
  confidence: {
    technical: "Confidence Score",
    friendly: "AI Confidence",
    description:
      "How sure the AI is about its prediction. Higher confidence means the AI found strong patterns in the data.",
  },
  feature_importance: {
    technical: "Feature Importance",
    friendly: "Important Factors",
    description:
      "Which sensor readings and measurements matter most for predicting equipment health.",
  },
  sensor_fusion: {
    technical: "Sensor Fusion",
    friendly: "Smart Sensor Combining",
    description:
      "Combines data from multiple sensors to filter out noise and get more accurate readings.",
  },
  kalman_filter: {
    technical: "Kalman Filter",
    friendly: "Noise Reduction",
    description:
      "Filters out random fluctuations in sensor data to reveal the true equipment condition.",
  },
  adaptive_threshold: {
    technical: "Adaptive Threshold",
    friendly: "Smart Alerting",
    description:
      "Adjusts alert sensitivity based on conditions like weather and operating mode to reduce false alarms.",
  },
  real_time_prediction: {
    technical: "Real-time Prediction",
    friendly: "Live Monitoring",
    description:
      "AI continuously analyzes incoming sensor data to detect problems as they develop.",
  },
  model_training: {
    technical: "Model Training",
    friendly: "AI Learning",
    description: "The process where AI learns from historical data to make better predictions.",
  },
  validation: {
    technical: "Validation",
    friendly: "Accuracy Check",
    description:
      "Comparing AI predictions against actual equipment failures to measure how well the AI is working.",
  },
  false_positive: {
    technical: "False Positive",
    friendly: "False Alarm",
    description: "When the AI predicts a failure that doesn't actually happen.",
  },
  false_negative: {
    technical: "False Negative",
    friendly: "Missed Detection",
    description: "When equipment fails but the AI didn't predict it.",
  },
};

/**
 * Get friendly name for a model type
 */
export function getFriendlyModelName(modelType: string): string {
  const key = modelType.toLowerCase();
  return ML_TERMINOLOGY[key]?.friendly || modelType;
}

/**
 * Get description for a technical term
 */
export function getTermDescription(term: string): string {
  const key = term.toLowerCase().replaceAll(" ", "_");
  return ML_TERMINOLOGY[key]?.description || "";
}

/**
 * Get confidence level description
 */
export function getConfidenceDescription(confidence: number): {
  label: string;
  color: string;
  description: string;
} {
  if (confidence >= 0.85) {
    return {
      label: "Very Confident",
      color: "bg-green-500",
      description: "The AI found very strong patterns and is highly certain about this prediction.",
    };
  }
  if (confidence >= 0.7) {
    return {
      label: "Confident",
      color: "bg-blue-500",
      description: "The AI found clear patterns and is reasonably certain about this prediction.",
    };
  }
  if (confidence >= 0.5) {
    return {
      label: "Moderately Confident",
      color: "bg-yellow-500",
      description: "The AI sees some patterns but recommends monitoring closely for confirmation.",
    };
  }
  return {
    label: "Low Confidence",
    color: "bg-red-500",
    description:
      "Limited data available. The AI suggests gathering more information before acting.",
  };
}

/**
 * Get accuracy level description
 */
export function getAccuracyDescription(accuracy: number): {
  label: string;
  color: string;
  description: string;
} {
  const percent = accuracy * 100;

  if (percent >= 90) {
    return {
      label: "Excellent",
      color: "bg-green-500",
      description:
        "AI predictions are highly reliable. You can trust these forecasts for planning maintenance.",
    };
  }
  if (percent >= 80) {
    return {
      label: "Good",
      color: "bg-blue-500",
      description:
        "AI predictions are reliable. Good enough for most maintenance planning decisions.",
    };
  }
  if (percent >= 70) {
    return {
      label: "Fair",
      color: "bg-yellow-500",
      description:
        "AI predictions are somewhat reliable. Use as one factor among several when planning.",
    };
  }
  return {
    label: "Poor",
    color: "bg-red-500",
    description: "AI predictions need improvement. More training data or model tuning required.",
  };
}

/**
 * Format time to failure in friendly language
 */
export function formatTimeToFailure(days: number): string {
  if (days < 1) {
    return "Less than 1 day";
  }
  if (days === 1) {
    return "1 day";
  }
  if (days < 7) {
    return `${Math.round(days)} days`;
  }
  if (days < 30) {
    const weeks = Math.round(days / 7);
    return `${weeks} week${weeks > 1 ? "s" : ""} (${Math.round(days)} days)`;
  }
  if (days < 365) {
    const months = Math.round(days / 30);
    return `${months} month${months > 1 ? "s" : ""} (${Math.round(days)} days)`;
  }
  const years = Math.round(days / 365);
  return `${years} year${years > 1 ? "s" : ""} (${Math.round(days)} days)`;
}
