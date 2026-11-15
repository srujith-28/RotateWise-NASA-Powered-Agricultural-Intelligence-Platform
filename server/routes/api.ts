import express from 'express';
import {
  createFallbackClimateForFarm,
  DEMO_CLIMATE_PROFILES,
  DEMO_CROPS,
  DEMO_FARMS,
} from '../../src/data/demoData.ts';
import type { Farm, SimulationParams } from '../../src/types/rotatewise.ts';
import { climateProvider } from '../services/climateProvider.ts';
import { cropIntelligenceService } from '../services/cropIntelligenceService.ts';
import {
  askFarmAdvisor,
  isGeminiConfigured,
} from '../services/geminiAdvisorService.ts';
import {
  fetchNasaPowerDailyClimate,
  NASA_POWER_ENDPOINT,
  NasaPowerServiceError,
} from '../services/nasaPowerService.ts';

export function createApiRouter() {
  const router = express.Router();

  // In-memory demonstration farm store for immediate backend API responsiveness
  let farmsStore: Farm[] = structuredClone(DEMO_FARMS);

  router.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      climateProvider: climateProvider.providerId,
      climateIsExternalLive: climateProvider.isExternalLive,
      nasaPowerEndpoint: NASA_POWER_ENDPOINT,
      geminiConfigured: isGeminiConfigured(),
    });
  });

  router.get('/farms', (_req, res) => {
    res.json({ farms: farmsStore, source: 'demonstration' });
  });

  router.post('/farms', (req, res) => {
    const body = req.body as Partial<Farm>;
    if (!body?.name || !body?.location || !body?.landAreaAcres || body.landAreaAcres <= 0) {
      res.status(400).json({ error: 'Invalid farm payload: name, location, and positive landAreaAcres are required.' });
      return;
    }

    const crop = DEMO_CROPS.find((c) => c.id === body.currentCropId) ?? DEMO_CROPS[0];
    const newFarm: Farm = {
      id: body.id || `farm-${Date.now()}`,
      name: body.name.trim(),
      location: body.location.trim(),
      coordinates: body.coordinates ?? { lat: 41.5, lng: -93.6 },
      landAreaAcres: Number(body.landAreaAcres),
      soilType: body.soilType ?? 'Loam',
      irrigation: body.irrigation ?? 'Supplemental Rainfed',
      currentCropId: crop.id,
      currentCropName: crop.name,
      plantingStage: body.plantingStage ?? 'Active Season',
      imageUrl: body.imageUrl ?? '/src/assets/images/farm_midwest_fields_1794581720817.jpg',
      health: body.health ?? {
        soilHealthScore: 80,
        organicMatterPct: 3.4,
        phLevel: 6.5,
        nitrogenBalanceScore: 76,
        moistureRetentionScore: 78,
        pestBreakScore: 75,
      },
      rotationPlan: body.rotationPlan ?? [
        {
          id: `rot-${Date.now()}`,
          season: 'Spring 2026',
          cropId: crop.id,
          cropName: crop.name,
          family: crop.family,
          status: 'active',
          expectedYieldIndex: 100,
          nitrogenImpactKgHa: crop.nitrogenDeltaKgHa,
        },
      ],
      updatedAt: new Date().toISOString(),
      isDemo: false,
    };

    farmsStore = [newFarm, ...farmsStore];
    res.status(201).json({ farm: newFarm });
  });

  router.put('/farms/:id', (req, res) => {
    const idx = farmsStore.findIndex((f) => f.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Farm not found' });
      return;
    }
    const updated: Farm = {
      ...farmsStore[idx],
      ...req.body,
      id: farmsStore[idx].id,
      updatedAt: new Date().toISOString(),
    };
    farmsStore[idx] = updated;
    res.json({ farm: updated });
  });

  router.delete('/farms/:id', (req, res) => {
    const exists = farmsStore.some((f) => f.id === req.params.id);
    if (!exists) {
      res.status(404).json({ error: 'Farm not found' });
      return;
    }
    farmsStore = farmsStore.filter((f) => f.id !== req.params.id);
    res.json({ deletedId: req.params.id });
  });

  router.get('/crops', async (_req, res) => {
    const crops = await cropIntelligenceService.getCropCatalog();
    res.json({ crops });
  });

  router.get('/crops/knowledge', async (_req, res) => {
    const crops = await cropIntelligenceService.getCropKnowledgeDatabase();
    res.json({ crops });
  });

  router.get('/climate/nasa-power', async (req, res) => {
    const rawLat = req.query.lat;
    const rawLng = req.query.lng;
    const rawStart = typeof req.query.start === 'string' ? req.query.start : '';
    const rawEnd = typeof req.query.end === 'string' ? req.query.end : '';
    const bypassCache = req.query.refresh === '1' || req.query.refresh === 'true';

    if (
      typeof rawLat !== 'string' ||
      typeof rawLng !== 'string' ||
      !rawStart ||
      !rawEnd
    ) {
      res.status(400).json({
        error: 'Missing required query parameters: lat, lng, start, and end.',
        code: 'MISSING_QUERY_PARAMS',
      });
      return;
    }

    const latitude = Number(rawLat);
    const longitude = Number(rawLng);

    try {
      const data = await fetchNasaPowerDailyClimate({
        latitude,
        longitude,
        startDate: rawStart,
        endDate: rawEnd,
        bypassCache,
      });
      res.json({ data });
    } catch (err) {
      if (err instanceof NasaPowerServiceError) {
        res.status(err.statusCode).json({
          error: err.message,
          code: err.code,
        });
        return;
      }
      res.status(502).json({
        error:
          err instanceof Error
            ? err.message
            : 'Unexpected error while querying NASA POWER.',
        code: 'NASA_POWER_UNEXPECTED_ERROR',
      });
    }
  });

  router.get('/climate/:farmId', async (req, res) => {
    const farm = farmsStore.find((f) => f.id === req.params.farmId);
    if (!farm) {
      const demoProfile = DEMO_CLIMATE_PROFILES[req.params.farmId];
      if (demoProfile) {
        res.json({ climate: demoProfile });
        return;
      }
      res.status(404).json({ error: 'Farm climate profile not found' });
      return;
    }
    const climate = await climateProvider.getClimateForFarm(farm);
    res.json({ climate });
  });

  router.post('/simulations/run', async (req, res) => {
    const { farm, params } = req.body as {
      farm?: Farm;
      params?: SimulationParams;
    };
    if (!farm || !params) {
      res.status(400).json({ error: 'farm and params are required.' });
      return;
    }
    const climate =
      DEMO_CLIMATE_PROFILES[farm.id] ?? createFallbackClimateForFarm(farm);
    const result = await cropIntelligenceService.simulateScenario(
      farm,
      climate,
      params
    );
    res.json({ result });
  });

  router.post('/advisor/ask', async (req, res) => {
    const { prompt, farm, includeFarmContext } = req.body as {
      prompt?: string;
      farm?: Farm;
      includeFarmContext?: boolean;
    };
    if (!prompt || !prompt.trim() || !farm) {
      res.status(400).json({ error: 'Prompt and active farm context are required.' });
      return;
    }
    const climate =
      DEMO_CLIMATE_PROFILES[farm.id] ?? createFallbackClimateForFarm(farm);
    const answer = await askFarmAdvisor({
      prompt: prompt.trim(),
      farm,
      climate,
      includeFarmContext: includeFarmContext ?? true,
    });
    res.json(answer);
  });

  return router;
}
