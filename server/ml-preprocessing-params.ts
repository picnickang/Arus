export interface PreprocessingParams {
  scaler?: { mean: number[]; std: number[] };
  featureNames?: string[];
  [key: string]: unknown;
}

export async function loadPreprocessingParams(
  _pathOrEquipmentId: string,
  _orgId?: string,
  _modelType?: string
): Promise<PreprocessingParams | null> {
  return null;
}

export async function savePreprocessingParams(
  _path: string,
  _params: PreprocessingParams
): Promise<void> {
  /* stub */
}
