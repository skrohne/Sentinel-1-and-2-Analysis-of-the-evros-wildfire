// Load your AOI
var aoi = table; 

// === Cloud Masking Function for Sentinel-2  ===
function maskS2clouds(image) {
  var qa = image.select('QA60');
  var cloudBitMask = 1 << 10;  // Bit 10: clouds
  var cirrusBitMask = 1 << 11; // Bit 11: cirrus

  // Mask where both bits are 0 (clear)
  var cloudMask = qa.bitwiseAnd(cloudBitMask).eq(0)
                   .and(qa.bitwiseAnd(cirrusBitMask).eq(0));

  // Apply mask and scale reflectance to [0,1]
  return image.updateMask(cloudMask).divide(10000)
              .copyProperties(image, ["system:time_start"]);
}

// === Water Mask Function ===
var gsw = ee.Image('JRC/GSW1_4/GlobalSurfaceWater');
var occurrence = gsw.select('occurrence');
var permanentWater = occurrence.gt(50).unmask(0);
var landMask = permanentWater.not();

function maskWater(image) {
  return image.updateMask(landMask);
}

// === Load and Filter Sentinel-2 Imagery (Pre-Fire) ===
var s2pre = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterDate('2023-07-25', '2023-08-01')
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 5))
  .map(maskS2clouds)
  .map(maskWater);

// === Load and Filter Sentinel-2 Imagery (Post-Fire) ===
var s2post = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterDate('2023-09-01', '2023-09-30')
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 5))
  .map(maskS2clouds)
  .map(maskWater);

// === Load and Filter Sentinel-2 Imagery (Summer) ===
var s2summer = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterDate('2024-07-25', '2024-08-01')
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 5))
  .map(maskS2clouds)
  .map(maskWater);

// === Composite Generation ===
var compositePre = s2pre.mean().clip(aoi); 
var compositePost = s2post.mean().clip(aoi);
var compositeSummer = s2summer.mean().clip(aoi);

// === Visualization Parameters ===
var visParams = {
  min: 0.0,
  max: 0.3,
  bands: ['B4', 'B3', 'B2'], // RGB
};

// === Display ===
Map.centerObject(table, 9);
Map.addLayer(compositePre, visParams, 'Composite Pre-Fire');
Map.addLayer(compositePost, visParams, 'Composite Post-Fire');
Map.addLayer(compositeSummer, visParams, 'Composite Summer');


//Export to Asset 

Export.image.toAsset({
  image: compositePre,
  description: 'Sentinel2_RGB_Composite_Pre_Fire',
  assetId: 'S2_Composite_Pre_Fire',
  region: aoi,
  scale: 10,
  maxPixels: 1e13
});

Export.image.toAsset({
  image: compositePost,
  description: 'Sentinel2_RGB_Composite_Post_Fire',
  assetId: 'S2_Composite_Post_Fire',
  region: aoi,
  scale: 10,
  maxPixels: 1e13
});

Export.image.toAsset({
  image: compositeSummer,
  description: 'Sentinel2_RGB_Composite_Summer',
  assetId: 'S2_Composite_Summer',
  region: aoi,
  scale: 10,
  maxPixels: 1e13
});
