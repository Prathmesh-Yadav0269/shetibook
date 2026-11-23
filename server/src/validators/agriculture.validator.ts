import { z } from 'zod';

export const areaUnitEnum = z.enum(['acre', 'guntha', 'hectare'], {
  errorMap: () => ({ message: 'क्षेत्राचे एकक एकर, गुंठे किंवा हेक्टर असावे' }),
});

export const cultivationModeEnum = z.enum(['separate', 'intercropping'], {
  errorMap: () => ({ message: 'पिक पद्धत स्वतंत्र (separate) किंवा आंतरपीक (intercropping) असावी' }),
});

export const cropStatusEnum = z.enum(['planned', 'active', 'harvested', 'cancelled'], {
  errorMap: () => ({ message: 'अवैध पीक स्थिती' }),
});

export const activityStatusEnum = z.enum(['pending', 'in_progress', 'paused', 'completed'], {
  errorMap: () => ({ message: 'अवैध उपक्रम स्थिती' }),
});

export const createFarmSchema = z.object({
  farmName: z.string().trim().min(2, 'शेताचे नाव किमान २ अक्षरांचे असावे').max(100, 'शेताचे नाव १०० अक्षरांपेक्षा कमी असावे'),
  village: z.string().trim().min(2, 'गावाचे नाव आवश्यक आहे').max(100),
  taluka: z.string().trim().max(100).optional().nullable(),
  district: z.string().trim().max(100).optional().nullable(),
  areaValue: z.number({ invalid_type_error: 'क्षेत्र संख्या स्वरूपात असावे' }).positive('क्षेत्र ० पेक्षा जास्त असावे').max(100000, 'अवाजवी क्षेत्र'),
  areaUnit: areaUnitEnum,
  surveyNumber: z.string().trim().max(50).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const updateFarmSchema = createFarmSchema.partial();

export const createPlotSchema = z.object({
  plotName: z.string().trim().min(1, 'तुकड्याचे / प्लॉटचे नाव आवश्यक आहे').max(100),
  areaValue: z.number({ invalid_type_error: 'क्षेत्र संख्या स्वरूपात असावे' }).positive('क्षेत्र ० पेक्षा जास्त असावे'),
  areaUnit: areaUnitEnum,
  cultivationMode: cultivationModeEnum.default('separate'),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const updatePlotSchema = z.object({
  plotName: z.string().trim().min(1).max(100).optional(),
  areaValue: z.number().positive().optional(),
  areaUnit: areaUnitEnum.optional(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const changeCultivationModeSchema = z.object({
  cultivationMode: cultivationModeEnum,
});

export const createCropSchema = z.object({
  farmId: z.string().uuid('अवैध शेत आयडी'),
  plotId: z.string().uuid('अवैध प्लॉट आयडी'),
  cropTypeId: z.string().min(1, 'पिकाचा प्रकार निवडा'),
  cropSeasonId: z.string().min(1, 'हंगाम निवडा'),
  cropNameCustom: z.string().trim().max(100).optional().nullable(),
  sowingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'पेरणी तारीख YYYY-MM-DD स्वरूपात असावी'),
  expectedHarvestDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'अपेक्षित काढणी तारीख YYYY-MM-DD स्वरूपात असावी').optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
}).refine(data => {
  if (data.expectedHarvestDate && data.sowingDate) {
    return new Date(data.expectedHarvestDate) >= new Date(data.sowingDate);
  }
  return true;
}, {
  message: 'अपेक्षित काढणी तारीख पेरणी तारखेनंतरची असावी',
  path: ['expectedHarvestDate'],
});

export const updateCropSchema = z.object({
  cropNameCustom: z.string().trim().max(100).optional().nullable(),
  sowingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  expectedHarvestDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  actualHarvestDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
}).refine(data => {
  if (data.expectedHarvestDate && data.sowingDate) {
    return new Date(data.expectedHarvestDate) >= new Date(data.sowingDate);
  }
  return true;
}, {
  message: 'अपेक्षित काढणी तारीख पेरणी तारखेनंतरची असावी',
  path: ['expectedHarvestDate'],
});

export const changeCropStatusSchema = z.object({
  status: cropStatusEnum,
  actualHarvestDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

export const createActivitySchema = z.object({
  farmId: z.string().uuid('अवैध शेत आयडी'),
  plotId: z.string().uuid('अवैध प्लॉट आयडी').optional().nullable(),
  cropId: z.string().uuid('अवैध पीक आयडी').optional().nullable(),
  activityTypeId: z.string().min(1, 'कामाचा प्रकार निवडा'),
  customActivityName: z.string().trim().max(100).optional().nullable(),
  description: z.string().trim().max(1000).optional().nullable(),
});

export const transitionActivitySchema = z.object({
  transition: z.enum(['start', 'pause', 'resume', 'complete', 'cancel'], {
    errorMap: () => ({ message: 'अवैध कृती (start, pause, resume, complete, cancel पैकी एक असावी)' }),
  }),
  notes: z.string().trim().max(500).optional().nullable(),
});
