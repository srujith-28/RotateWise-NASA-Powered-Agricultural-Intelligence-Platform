import {
  createFallbackClimateForFarm,
  DEMO_CLIMATE_PROFILES,
} from '../../src/data/demoData.ts';
import type { Farm, FarmClimateProfile } from '../../src/types/rotatewise.ts';

/**
 * Modular Climate Data Provider contract.
 * Future stages can implement NasaPowerClimateProvider against this interface
 * without modifying Express routes or frontend visualization components.
 */
export interface ClimateDataProvider {
  readonly providerId: string;
  readonly isExternalLive: boolean;
  getClimateForFarm(farm: Farm): Promise<FarmClimateProfile>;
}

export class DemonstrationClimateProvider implements ClimateDataProvider {
  readonly providerId = 'demonstration-local-model';
  readonly isExternalLive = false;

  async getClimateForFarm(farm: Farm): Promise<FarmClimateProfile> {
    const existing = DEMO_CLIMATE_PROFILES[farm.id];
    if (existing) {
      return existing;
    }
    return createFallbackClimateForFarm(farm);
  }
}

export const climateProvider: ClimateDataProvider = new DemonstrationClimateProvider();
