import { CROP_KNOWLEDGE_DATABASE } from '../../src/data/cropKnowledgeDb.ts';
import { DEMO_CROPS } from '../../src/data/demoData.ts';
import {
  calculateRotationEfficiency,
  getRecommendedNextCrops,
  runScenarioSimulation,
} from '../../src/lib/agronomy.ts';
import { evaluateCropsForFarm } from '../../src/lib/cropSuitabilityEngine.ts';
import type {
  CropKnowledgeEntry,
  CropProfile,
  CropRecommendation,
  CropSuitabilityEvaluation,
  Farm,
  FarmClimateProfile,
  NasaPowerClimateDataset,
  SimulationParams,
  SimulationResult,
} from '../../src/types/rotatewise.ts';

export interface CropIntelligenceProvider {
  getCropCatalog(): Promise<CropProfile[]>;
  getCropKnowledgeDatabase(): Promise<CropKnowledgeEntry[]>;
  evaluateSuitability(
    farm: Farm,
    nasaData: NasaPowerClimateDataset | null
  ): Promise<CropSuitabilityEvaluation[]>;
  getRecommendations(
    farm: Farm,
    climate: FarmClimateProfile
  ): Promise<CropRecommendation[]>;
  simulateScenario(
    farm: Farm,
    climate: FarmClimateProfile,
    params: SimulationParams
  ): Promise<SimulationResult>;
  evaluateRotation(farm: Farm): ReturnType<typeof calculateRotationEfficiency>;
}

export class AgronomyCropIntelligenceService implements CropIntelligenceProvider {
  async getCropCatalog(): Promise<CropProfile[]> {
    return DEMO_CROPS;
  }

  async getCropKnowledgeDatabase(): Promise<CropKnowledgeEntry[]> {
    return CROP_KNOWLEDGE_DATABASE;
  }

  async evaluateSuitability(
    farm: Farm,
    nasaData: NasaPowerClimateDataset | null
  ): Promise<CropSuitabilityEvaluation[]> {
    return evaluateCropsForFarm(farm, nasaData, CROP_KNOWLEDGE_DATABASE);
  }

  async getRecommendations(
    farm: Farm,
    climate: FarmClimateProfile
  ): Promise<CropRecommendation[]> {
    return getRecommendedNextCrops(farm, climate, DEMO_CROPS);
  }

  async simulateScenario(
    farm: Farm,
    climate: FarmClimateProfile,
    params: SimulationParams
  ): Promise<SimulationResult> {
    return runScenarioSimulation(farm, climate, DEMO_CROPS, params);
  }

  evaluateRotation(farm: Farm) {
    return calculateRotationEfficiency(farm.rotationPlan, DEMO_CROPS, farm);
  }
}

export const cropIntelligenceService = new AgronomyCropIntelligenceService();
